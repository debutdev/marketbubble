# TwitchIO Chat Collector

This optional worker bridges Twitch EventSub chat into the Market Bubble Next app.

TwitchIO is a long-running Python process, so it should run outside Vercel
Functions. It listens to Twitch chat through EventSub WebSockets and posts
normalized chat events to:

```text
POST /api/community-live-events
```

The Next app stores those events in Redis and the Home/Watch chat surfaces poll
them.

## Environment

```bash
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
TWITCH_BOT_ID=...
TWITCH_OWNER_ID=...
TWITCH_BROADCASTER_IDS=123,456
TWITCH_TOKEN_DB_PATH=tokens.db
MARKETBUBBLE_INGEST_URL=https://marketbubble.vercel.app/api/community-live-events
STREAM_EVENT_INGEST_SECRET=...
```

`STREAM_EVENT_INGEST_SECRET` must match the Vercel project env var with the same
name.

Twitch EventSub chat subscriptions require the normal TwitchIO OAuth setup:

- Add `http://localhost:4343/oauth/callback` as the Twitch app callback URL.
- Run the collector once.
- Log in as the bot account and open:
  `http://localhost:4343/oauth?scopes=user:read:chat%20user:write:chat%20user:bot&force_verify=true`
- Log in as each broadcaster account and open:
  `http://localhost:4343/oauth?scopes=channel:bot&force_verify=true`

The collector stores OAuth tokens in `TWITCH_TOKEN_DB_PATH` and reloads them on
restart. `TWITCH_BROADCASTER_IDS` is optional; when set, it limits forwarding to
those broadcaster user ids.

Important: Twitch EventSub chat access requires the broadcaster authorization
above. The website's browser socket fallback still supports public test chats
when you do not control the broadcaster account.

## Run

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python collector.py
```

On macOS/Linux, use `.venv/bin/pip` and `.venv/bin/python`.
