import asyncio
import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import TYPE_CHECKING, Any

import asqlite
import twitchio
from twitchio import eventsub
from twitchio.ext import commands


if TYPE_CHECKING:
    import sqlite3


LOGGER = logging.getLogger("marketbubble.twitchio")


def clean_env_value(value: str | None) -> str:
    value = (value or "").strip()

    if (
        (value.startswith('"') and value.endswith('"'))
        or (value.startswith("'") and value.endswith("'"))
    ):
        return value[1:-1]

    return value


def required_env(name: str) -> str:
    value = clean_env_value(os.environ.get(name))

    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")

    return value


def optional_env(name: str, default: str = "") -> str:
    return clean_env_value(os.environ.get(name, default))


def split_env(name: str) -> list[str]:
    return [value.strip() for value in optional_env(name).split(",") if value.strip()]


CLIENT_ID = required_env("TWITCH_CLIENT_ID")
CLIENT_SECRET = required_env("TWITCH_CLIENT_SECRET")
BOT_ID = required_env("TWITCH_BOT_ID")
OWNER_ID = required_env("TWITCH_OWNER_ID")
INGEST_URL = required_env("MARKETBUBBLE_INGEST_URL")
INGEST_SECRET = required_env("STREAM_EVENT_INGEST_SECRET")
TOKEN_DB_PATH = optional_env("TWITCH_TOKEN_DB_PATH", "tokens.db")
WATCH_BROADCASTER_IDS = set(split_env("TWITCH_BROADCASTER_IDS"))


def get_attr(value: Any, *names: str) -> Any:
    for name in names:
        current = getattr(value, name, None)

        if current is not None:
            return current

    return None


def should_watch_broadcaster(user_id: str | None) -> bool:
    if not user_id:
        return False

    return not WATCH_BROADCASTER_IDS or user_id in WATCH_BROADCASTER_IDS


def normalize_message(payload: twitchio.ChatMessage) -> dict[str, Any] | None:
    chatter = get_attr(payload, "chatter", "user")
    broadcaster = get_attr(payload, "broadcaster")
    author = get_attr(chatter, "display_name", "name", "login")
    channel = get_attr(broadcaster, "name", "login", "display_name")
    text = get_attr(payload, "text", "content")
    message_id = get_attr(payload, "id", "message_id")

    if not author or not text or not message_id:
        return None

    return {
        "author": str(author),
        "channel": str(channel) if channel else "",
        "color": str(get_attr(chatter, "color") or "#9146ff"),
        "platform": "Twitch",
        "receivedAt": int(time.time() * 1000),
        "sourceId": f"twitch:{message_id}",
        "text": str(text),
    }


def post_events(events: list[dict[str, Any]]) -> None:
    body = json.dumps({"events": events}).encode("utf-8")
    request = urllib.request.Request(
        INGEST_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {INGEST_SECRET}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status >= 300:
                LOGGER.warning("Ingest returned status %s", response.status)
    except urllib.error.URLError as exc:
        LOGGER.warning("Failed to post TwitchIO event batch: %s", exc)


class MarketBubbleTwitchBot(commands.AutoBot):
    def __init__(
        self,
        *,
        subs: list[eventsub.SubscriptionPayload],
        token_database: asqlite.Pool,
    ) -> None:
        self.token_database = token_database

        super().__init__(
            bot_id=BOT_ID,
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            force_subscribe=True,
            owner_id=OWNER_ID,
            prefix="!",
            subscriptions=subs,
        )

    async def setup_hook(self) -> None:
        await self.add_component(MarketBubbleForwarder())

    async def event_oauth_authorized(
        self,
        payload: twitchio.authentication.UserTokenPayload,
    ) -> None:
        await self.add_token(payload.access_token, payload.refresh_token)

        if not payload.user_id or payload.user_id == self.bot_id:
            return

        if not should_watch_broadcaster(payload.user_id):
            return

        subscription = eventsub.ChatMessageSubscription(
            broadcaster_user_id=payload.user_id,
            user_id=self.bot_id,
        )
        response = await self.multi_subscribe([subscription])

        if response.errors:
            LOGGER.warning("Failed to subscribe for user %s: %r", payload.user_id, response.errors)

    async def add_token(
        self,
        token: str,
        refresh: str,
    ) -> twitchio.authentication.ValidateTokenPayload:
        response = await super().add_token(token, refresh)
        query = """
        INSERT INTO tokens (user_id, token, refresh)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
            token = excluded.token,
            refresh = excluded.refresh;
        """

        async with self.token_database.acquire() as connection:
            await connection.execute(query, (response.user_id, token, refresh))

        LOGGER.info("Stored Twitch token for user %s", response.user_id)
        return response

    async def event_ready(self) -> None:
        LOGGER.info("TwitchIO collector connected as bot id %s", self.bot_id)


class MarketBubbleForwarder(commands.Component):
    @commands.Component.listener()
    async def event_message(self, payload: twitchio.ChatMessage) -> None:
        event = normalize_message(payload)

        if event:
            await asyncio.to_thread(post_events, [event])


async def setup_database(
    db: asqlite.Pool,
) -> tuple[list[tuple[str, str]], list[eventsub.SubscriptionPayload]]:
    query = """
    CREATE TABLE IF NOT EXISTS tokens(
        user_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        refresh TEXT NOT NULL
    )
    """

    async with db.acquire() as connection:
        await connection.execute(query)
        rows: list[sqlite3.Row] = await connection.fetchall("SELECT * FROM tokens")

    tokens: list[tuple[str, str]] = []
    subs: list[eventsub.SubscriptionPayload] = []

    for row in rows:
        user_id = row["user_id"]
        tokens.append((row["token"], row["refresh"]))

        if user_id == BOT_ID or not should_watch_broadcaster(user_id):
            continue

        subs.append(eventsub.ChatMessageSubscription(broadcaster_user_id=user_id, user_id=BOT_ID))

    return tokens, subs


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    twitchio.utils.setup_logging(level=logging.INFO)

    async def runner() -> None:
        async with asqlite.create_pool(TOKEN_DB_PATH) as token_database:
            tokens, subs = await setup_database(token_database)

            async with MarketBubbleTwitchBot(
                subs=subs,
                token_database=token_database,
            ) as bot:
                for token_pair in tokens:
                    await bot.add_token(*token_pair)

                await bot.start(load_tokens=False)

    asyncio.run(runner())


if __name__ == "__main__":
    main()
