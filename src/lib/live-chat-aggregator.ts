import type { CommunityChatEvent } from "@/lib/community-top-chat-types";

export const kickPusherUrl =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false";

export const legacyClientChatSocketsEnabled =
  process.env.NEXT_PUBLIC_DISABLE_LEGACY_CHAT_SOCKETS !== "true";

const authorColors = [
  "#a970ff",
  "#ff7a9a",
  "#45d483",
  "#4fa7ff",
  "#ffb347",
  "#72e0d1",
  "#d889ff",
  "#ff6f61",
  "#c7e85f",
  "#7aa7ff",
  "#f0d35f",
  "#ff8fd6",
];

export function getAuthorColor(author: string) {
  const colorIndex =
    [...author].reduce((hash, character) => hash + character.charCodeAt(0), 0) %
    authorColors.length;

  return authorColors[colorIndex];
}

export function parseIrcTags(value = "") {
  return Object.fromEntries(
    value
      .split(";")
      .map((tag) => {
        const separatorIndex = tag.indexOf("=");
        const key = separatorIndex === -1 ? tag : tag.slice(0, separatorIndex);
        const tagValue = separatorIndex === -1 ? "" : tag.slice(separatorIndex + 1);

        return [key, tagValue] as const;
      })
      .filter(([key]) => key),
  );
}

export function stripChatHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

export function parseTwitchCommunityChatEvent(line: string): CommunityChatEvent | null {
  const match = line.match(/^(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.*)$/);

  if (!match?.[2] || !match[3] || !match[4]) {
    return null;
  }

  const tags = parseIrcTags(match[1]);
  const receivedAt = Date.now();

  return {
    author: match[2],
    channel: match[3],
    color: tags.color || getAuthorColor(match[2]),
    platform: "Twitch",
    receivedAt,
    sourceId: tags.id
      ? `twitch:${tags.id}`
      : `twitch:fallback:${match[3]}:${receivedAt}:${Math.random()}`,
    text: match[4],
  };
}

export function parseKickCommunityChatEvent(
  rawData: string,
  channel: string,
): CommunityChatEvent | null {
  try {
    const data = JSON.parse(rawData);
    const author = String(data?.sender?.username ?? "");
    const text = stripChatHtml(String(data?.content ?? ""));

    if (!author || !text) {
      return null;
    }

    const receivedAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();

    return {
      author,
      channel,
      color: data.sender.identity?.color || getAuthorColor(author),
      platform: "Kick",
      receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
      sourceId: data.id ? `kick:${data.id}` : `kick:fallback:${Date.now()}:${Math.random()}`,
      text,
    };
  } catch {
    return null;
  }
}
