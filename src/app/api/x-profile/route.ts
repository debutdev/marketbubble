import { NextResponse } from "next/server";

export const runtime = "nodejs";

type XUserEntity = {
  description?: string;
  followers_count?: number;
  friends_count?: number;
  is_blue_verified?: boolean;
  name?: string;
  normal_followers_count?: number;
  profile_image_url_https?: string;
  screen_name?: string;
  verified?: boolean;
};

type XInitialState = {
  entities?: {
    users?: {
      entities?: Record<string, XUserEntity>;
    };
  };
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([a-f0-9]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    );
}

function findJsonObjectEnd(source: string, startIndex: number) {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseInitialState(html: string): XInitialState | null {
  const marker = "window.__INITIAL_STATE__=";
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const objectStart = html.indexOf("{", markerIndex + marker.length);

  if (objectStart === -1) {
    return null;
  }

  const objectEnd = findJsonObjectEnd(html, objectStart);

  if (objectEnd === -1) {
    return null;
  }

  try {
    return JSON.parse(html.slice(objectStart, objectEnd + 1)) as XInitialState;
  } catch {
    return null;
  }
}

function normalizeAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) {
    return undefined;
  }

  try {
    const url = new URL(avatarUrl.replace("_normal.", "_400x400."));

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim().replace(/[^\w]/g, "").slice(0, 32);
}

async function getXProfile(handle: string) {
  const cleanHandle = normalizeHandle(handle);

  if (!cleanHandle) {
    return null;
  }

  try {
    const response = await fetch(`https://x.com/${encodeURIComponent(cleanHandle)}`, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const state = parseInitialState(await response.text());
    const users = state?.entities?.users?.entities ?? {};
    const user = Object.values(users).find(
      (candidate) =>
        candidate.screen_name?.toLowerCase() === cleanHandle.toLowerCase(),
    );

    if (!user?.screen_name) {
      return null;
    }

    return {
      avatarUrl: normalizeAvatarUrl(user.profile_image_url_https),
      description: decodeHtmlEntities(user.description ?? ""),
      followers: Number(user.normal_followers_count ?? user.followers_count ?? 0),
      following: Number(user.friends_count ?? 0),
      handle: user.screen_name,
      name: decodeHtmlEntities(user.name ?? user.screen_name),
      profileUrl: `https://x.com/${user.screen_name}`,
      verified: Boolean(user.is_blue_verified || user.verified),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handles = Array.from(
    new Set(
      searchParams
        .getAll("handle")
        .map(normalizeHandle)
        .filter(Boolean),
    ),
  ).slice(0, 8);
  const profiles = (await Promise.all(handles.map(getXProfile))).filter(
    (profile) => profile !== null,
  );

  return NextResponse.json(
    { profiles },
    { headers: { "Cache-Control": "no-store" } },
  );
}
