const tokenUrl = "https://id.kick.com/oauth/token";
const apiBaseUrl = "https://api.kick.com";

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

function requiredEnv(name) {
  const value = cleanEnvValue(process.env[name]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function splitEnv(name) {
  return cleanEnvValue(process.env[name])
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getKickAccessToken() {
  const staticToken = cleanEnvValue(process.env.KICK_APP_ACCESS_TOKEN);

  if (staticToken) {
    return staticToken;
  }

  const response = await fetch(tokenUrl, {
    body: new URLSearchParams({
      client_id: requiredEnv("KICK_CLIENT_ID"),
      client_secret: requiredEnv("KICK_CLIENT_SECRET"),
      grant_type: "client_credentials",
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Kick token request failed with ${response.status}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Kick token response did not include an access token.");
  }

  return data.access_token;
}

async function kickFetch(path, accessToken, init = {}) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Kick API ${path} failed with ${response.status}: ${body}`);
  }

  return response.json();
}

async function getChannels(accessToken, slugs) {
  const params = new URLSearchParams();

  for (const slug of slugs) {
    params.append("slug", slug);
  }

  const payload = await kickFetch(`/public/v1/channels?${params}`, accessToken);

  return Array.isArray(payload.data) ? payload.data : [];
}

async function registerChatEvent(accessToken, broadcasterUserId) {
  return kickFetch("/public/v1/events/subscriptions", accessToken, {
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      events: [{ name: "chat.message.sent", version: 1 }],
      method: "webhook",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function getExistingSubscriptions(accessToken, broadcasterUserId) {
  const params = new URLSearchParams({
    broadcaster_user_id: String(broadcasterUserId),
  });
  const payload = await kickFetch(`/public/v1/events/subscriptions?${params}`, accessToken);

  return Array.isArray(payload.data) ? payload.data : [];
}

function hasChatSubscription(subscriptions) {
  return subscriptions.some((subscription) => {
    const event = String(subscription.event ?? subscription.name ?? "");
    const method = String(subscription.method ?? "");
    const version = Number(subscription.version ?? 0);

    return event === "chat.message.sent" && method === "webhook" && version === 1;
  });
}

async function main() {
  const slugs = splitEnv("KICK_CHANNEL_SLUGS");

  if (slugs.length === 0) {
    throw new Error("Set KICK_CHANNEL_SLUGS to one or more comma-separated Kick channel slugs.");
  }

  const accessToken = await getKickAccessToken();
  const channels = await getChannels(accessToken, slugs);

  for (const channel of channels) {
    if (!channel.broadcaster_user_id) {
      console.warn(`Skipping ${channel.slug ?? "unknown"}: missing broadcaster_user_id`);
      continue;
    }

    const existingSubscriptions = await getExistingSubscriptions(
      accessToken,
      channel.broadcaster_user_id,
    );

    if (hasChatSubscription(existingSubscriptions)) {
      console.log(
        JSON.stringify({
          broadcaster_user_id: channel.broadcaster_user_id,
          skipped: true,
          slug: channel.slug,
        }),
      );
      continue;
    }

    const result = await registerChatEvent(accessToken, channel.broadcaster_user_id);

    console.log(
      JSON.stringify({
        broadcaster_user_id: channel.broadcaster_user_id,
        result: result.data,
        slug: channel.slug,
      }),
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
