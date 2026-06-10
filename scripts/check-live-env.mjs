import { existsSync, readFileSync } from "node:fs";

const envFile = ".env.local";

function cleanEnvValue(value) {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readLocalEnv() {
  if (!existsSync(envFile)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], cleanEnvValue(match[2])]),
  );
}

const localEnv = readLocalEnv();

function valueOf(name) {
  return cleanEnvValue(process.env[name] ?? localEnv[name]);
}

function has(name) {
  return Boolean(valueOf(name));
}

function printGroup(title, checks) {
  console.log(`\n${title}`);

  for (const check of checks) {
    const ok = check.ok();
    console.log(`${ok ? "OK " : "MISS"} ${check.label}`);
  }
}

printGroup("Twitch", [
  {
    label: "Helix metrics/videos: TWITCH_CLIENT_ID plus TWITCH_CLIENT_SECRET or TWITCH_APP_ACCESS_TOKEN",
    ok: () => has("TWITCH_CLIENT_ID") && (has("TWITCH_CLIENT_SECRET") || has("TWITCH_APP_ACCESS_TOKEN")),
  },
  {
    label: "TwitchIO collector: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_BOT_ID, TWITCH_OWNER_ID",
    ok: () =>
      has("TWITCH_CLIENT_ID") &&
      has("TWITCH_CLIENT_SECRET") &&
      has("TWITCH_BOT_ID") &&
      has("TWITCH_OWNER_ID"),
  },
]);

printGroup("Kick", [
  {
    label: "Developer API metrics: KICK_CLIENT_ID plus KICK_CLIENT_SECRET or KICK_APP_ACCESS_TOKEN",
    ok: () => has("KICK_APP_ACCESS_TOKEN") || (has("KICK_CLIENT_ID") && has("KICK_CLIENT_SECRET")),
  },
  {
    label: "Chat webhooks: Kick API credentials plus KICK_CHANNEL_SLUGS",
    ok: () =>
      (has("KICK_APP_ACCESS_TOKEN") || (has("KICK_CLIENT_ID") && has("KICK_CLIENT_SECRET"))) &&
      has("KICK_CHANNEL_SLUGS"),
  },
]);

printGroup("X Broadcasts", [
  {
    label: "Broadcast collector direct URLs or handle discovery: X_BROADCAST_URLS or X_BROADCAST_HANDLES",
    ok: () => has("X_BROADCAST_URLS") || has("X_BROADCAST_HANDLES"),
  },
  {
    label: "Broadcast handle discovery site: X_BROADCAST_DISCOVERY_SITE_URL or NEXT_PUBLIC_SITE_URL",
    ok: () => has("X_BROADCAST_DISCOVERY_SITE_URL") || has("NEXT_PUBLIC_SITE_URL"),
  },
]);

printGroup("Live ingest", [
  {
    label: "Protected collector ingest: STREAM_EVENT_INGEST_SECRET",
    ok: () => has("STREAM_EVENT_INGEST_SECRET"),
  },
  {
    label: "Browser socket fallback enabled unless NEXT_PUBLIC_DISABLE_LEGACY_CHAT_SOCKETS=true",
    ok: () => valueOf("NEXT_PUBLIC_DISABLE_LEGACY_CHAT_SOCKETS") !== "true",
  },
]);
