const twitchApiBaseUrl = "https://api.twitch.tv/helix/";
const twitchTokenUrl = "https://id.twitch.tv/oauth2/token";

type TwitchTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type TwitchTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type TwitchStream = {
  game_id?: string;
  game_name?: string;
  id?: string;
  language?: string;
  started_at?: string;
  thumbnail_url?: string;
  title?: string;
  type?: string;
  user_id?: string;
  user_login?: string;
  user_name?: string;
  viewer_count?: number;
};

export type TwitchUser = {
  broadcaster_type?: string;
  created_at?: string;
  description?: string;
  display_name?: string;
  id?: string;
  login?: string;
  offline_image_url?: string;
  profile_image_url?: string;
  type?: string;
};

export type TwitchVideo = {
  created_at?: string;
  description?: string;
  duration?: string;
  id?: string;
  language?: string;
  published_at?: string;
  stream_id?: string;
  thumbnail_url?: string;
  title?: string;
  type?: string;
  url?: string;
  user_id?: string;
  user_login?: string;
  user_name?: string;
  view_count?: number;
  viewable?: string;
};

let twitchTokenCache: TwitchTokenCache | null = null;

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getTwitchClientId() {
  return cleanEnvValue(process.env.TWITCH_CLIENT_ID);
}

function getTwitchClientSecret() {
  return cleanEnvValue(process.env.TWITCH_CLIENT_SECRET);
}

function getStaticTwitchToken() {
  return cleanEnvValue(process.env.TWITCH_APP_ACCESS_TOKEN);
}

export function hasTwitchApiCredentials() {
  return Boolean(getStaticTwitchToken() || (getTwitchClientId() && getTwitchClientSecret()));
}

async function getTwitchAccessToken() {
  const staticToken = getStaticTwitchToken();

  if (staticToken) {
    return staticToken;
  }

  const clientId = getTwitchClientId();
  const clientSecret = getTwitchClientSecret();

  if (!clientId || !clientSecret) {
    return null;
  }

  if (twitchTokenCache && twitchTokenCache.expiresAt > Date.now() + 60_000) {
    return twitchTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const response = await fetch(twitchTokenUrl, {
    body,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as TwitchTokenResponse;

  if (!data.access_token) {
    return null;
  }

  twitchTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in ?? 0) - 60) * 1000,
  };

  return data.access_token;
}

async function twitchFetch<T>(path: string, params?: URLSearchParams) {
  const clientId = getTwitchClientId();
  const accessToken = await getTwitchAccessToken();

  if (!clientId || !accessToken) {
    return null;
  }

  const url = new URL(path.replace(/^\/+/, ""), twitchApiBaseUrl);

  if (params) {
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function getTwitchStreamsByLogin(logins: string[]) {
  if (!hasTwitchApiCredentials() || logins.length === 0) {
    return null;
  }

  const params = new URLSearchParams();

  for (const login of logins.slice(0, 100)) {
    params.append("user_login", login);
  }

  const data = await twitchFetch<{ data?: TwitchStream[] }>("/streams", params);

  if (!data) {
    return null;
  }

  return Object.fromEntries(
    (data.data ?? [])
      .filter((stream) => stream.user_login)
      .map((stream) => [String(stream.user_login).toLowerCase(), stream]),
  ) as Record<string, TwitchStream>;
}

export async function getTwitchUsersByLogin(logins: string[]) {
  if (!hasTwitchApiCredentials() || logins.length === 0) {
    return null;
  }

  const params = new URLSearchParams();

  for (const login of logins.slice(0, 100)) {
    params.append("login", login);
  }

  const data = await twitchFetch<{ data?: TwitchUser[] }>("/users", params);

  if (!data) {
    return null;
  }

  return Object.fromEntries(
    (data.data ?? [])
      .filter((user) => user.login)
      .map((user) => [String(user.login).toLowerCase(), user]),
  ) as Record<string, TwitchUser>;
}

export async function getTwitchVideosByLogin(login: string, limit: number) {
  if (!hasTwitchApiCredentials()) {
    return null;
  }

  const users = await getTwitchUsersByLogin([login]);
  const user = users?.[login.toLowerCase()];

  if (!user?.id) {
    return null;
  }

  const params = new URLSearchParams({
    first: String(Math.max(1, Math.min(limit, 100))),
    type: "archive",
    user_id: user.id,
  });
  const data = await twitchFetch<{ data?: TwitchVideo[] }>("/videos", params);

  return data?.data ?? null;
}
