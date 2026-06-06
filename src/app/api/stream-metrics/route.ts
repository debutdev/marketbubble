import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const defaultKickChannels = ["ansem"];
const defaultTwitchChannels: string[] = [];
const defaultXHandles = ["blknoiz06"];
const twitchClientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const execFileAsync = promisify(execFile);
const maxRequestedChannels = 8;

export const runtime = "nodejs";

type ChannelMetrics = {
  online: boolean;
  viewers: number;
};

function normalizeKickChannel(value: string) {
  return value.trim().replace(/[^\w-]/g, "").slice(0, 32);
}

function normalizeTwitchChannel(value: string) {
  return value.trim().replace(/[^\w]/g, "").slice(0, 32);
}

function normalizeXHandle(value: string) {
  return value.trim().replace(/^@/, "").replace(/[^\w]/g, "").slice(0, 32);
}

function uniqueValues(values: string[], normalize: (value: string) => string) {
  return Array.from(new Set(values.map(normalize).filter(Boolean))).slice(0, maxRequestedChannels);
}

async function getTwitchChannelMetrics(twitchChannel: string): Promise<ChannelMetrics> {
  try {
    const response = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-ID": twitchClientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "StreamMetrics",
        variables: { login: twitchChannel },
        query:
          "query StreamMetrics($login: String!) { user(login: $login) { stream { viewersCount } } }",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return { online: false, viewers: 0 };
    }

    const data = await response.json();
    const stream = data?.data?.user?.stream;

    return {
      online: Boolean(stream),
      viewers: Number(stream?.viewersCount ?? 0),
    };
  } catch {
    return { online: false, viewers: 0 };
  }
}

async function getTwitchMetrics(twitchChannels: string[]) {
  const channelMetrics = await Promise.all(
    twitchChannels.map(async (twitchChannel) => [
      twitchChannel,
      await getTwitchChannelMetrics(twitchChannel),
    ]),
  );

  return Object.fromEntries(channelMetrics) as Record<string, ChannelMetrics>;
}

async function getKickChannelMetrics(kickChannel: string): Promise<ChannelMetrics> {
  const channelUrl = `https://kick.com/api/v2/channels/${kickChannel}`;

  try {
    const response = await fetch(channelUrl, {
      headers: {
        Accept: "application/json",
        Referer: `https://kick.com/${kickChannel}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return getKickChannelMetricsWithCurl(kickChannel, channelUrl);
    }

    const data = await response.json();
    const livestream = data?.livestream;

    return {
      online: Boolean(livestream),
      viewers: Number(livestream?.viewer_count ?? 0),
    };
  } catch {
    return getKickChannelMetricsWithCurl(kickChannel, channelUrl);
  }
}

async function getKickChannelMetricsWithCurl(
  kickChannel: string,
  channelUrl: string,
): Promise<ChannelMetrics> {
  try {
    const curlBinary = process.platform === "win32" ? "curl.exe" : "curl";
    const { stdout } = await execFileAsync(
      curlBinary,
      [
        "-L",
        channelUrl,
        "-H",
        "Accept: application/json",
        "-H",
        `Referer: https://kick.com/${kickChannel}`,
        "-H",
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "--max-time",
        "12",
        "--silent",
        "--show-error",
      ],
      { timeout: 15_000 },
    );
    const data = JSON.parse(stdout);
    const livestream = data?.livestream;

    return {
      online: Boolean(livestream),
      viewers: Number(livestream?.viewer_count ?? 0),
    };
  } catch {
    return { online: false, viewers: 0 };
  }
}

async function getKickMetrics(kickChannels: string[]) {
  const channelMetrics = await Promise.all(
    kickChannels.map(async (kickChannel) => [
      kickChannel,
      await getKickChannelMetrics(kickChannel),
    ]),
  );

  return Object.fromEntries(channelMetrics) as Record<string, ChannelMetrics>;
}

function getXMetrics(xHandles: string[]) {
  return Object.fromEntries(
    xHandles.map((xHandle) => [xHandle, { online: false, viewers: 0 }]),
  ) as Record<string, ChannelMetrics>;
}

function sumViewers(channelMetrics: Record<string, ChannelMetrics>) {
  return Object.values(channelMetrics).reduce(
    (sum, channelMetric) => sum + channelMetric.viewers,
    0,
  );
}

function mapViewers(channelMetrics: Record<string, ChannelMetrics>) {
  return Object.fromEntries(
    Object.entries(channelMetrics).map(([channel, channelMetric]) => [
      channel,
      channelMetric.viewers,
    ]),
  );
}

function mapOnline(channelMetrics: Record<string, ChannelMetrics>) {
  return Object.fromEntries(
    Object.entries(channelMetrics).map(([channel, channelMetric]) => [
      channel,
      channelMetric.online,
    ]),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedTwitchChannels = searchParams.getAll("twitchChannel");
  const requestedKickChannels = searchParams.getAll("kickChannel");
  const requestedXHandles = searchParams.getAll("xHandle");
  const hasRequestedSources =
    requestedTwitchChannels.length +
      requestedKickChannels.length +
      requestedXHandles.length >
    0;
  const twitchChannels = uniqueValues(
    requestedTwitchChannels.length > 0
      ? requestedTwitchChannels
      : hasRequestedSources
        ? []
        : defaultTwitchChannels,
    normalizeTwitchChannel,
  );
  const kickChannels = uniqueValues(
    requestedKickChannels.length > 0
      ? requestedKickChannels
      : hasRequestedSources
        ? []
        : defaultKickChannels,
    normalizeKickChannel,
  );
  const xHandles = uniqueValues(
    requestedXHandles.length > 0
      ? requestedXHandles
      : hasRequestedSources
        ? []
        : defaultXHandles,
    normalizeXHandle,
  );

  try {
    const [twitchChannelMetrics, kickChannelMetrics] = await Promise.all([
      getTwitchMetrics(twitchChannels),
      getKickMetrics(kickChannels),
    ]);
    const xHandleMetrics = getXMetrics(xHandles);
    const twitchViewers = sumViewers(twitchChannelMetrics);
    const kickViewers = sumViewers(kickChannelMetrics);
    const xViewers = sumViewers(xHandleMetrics);
    const platformViewers = {
      Kick: kickViewers,
      Twitch: twitchViewers,
      X: xViewers,
    };
    const totalViewers = Object.values(platformViewers).reduce(
      (sum, viewerCount) => sum + viewerCount,
      0,
    );
    const online = [
      ...Object.values(twitchChannelMetrics),
      ...Object.values(kickChannelMetrics),
      ...Object.values(xHandleMetrics),
    ].some((channelMetric) => channelMetric.online);

    return NextResponse.json(
      {
        kickChannelOnline: mapOnline(kickChannelMetrics),
        kickChannelViewers: mapViewers(kickChannelMetrics),
        kickViewers,
        online,
        platformViewers,
        totalViewers,
        twitchChannelOnline: mapOnline(twitchChannelMetrics),
        twitchChannelViewers: mapViewers(twitchChannelMetrics),
        twitchViewers,
        xHandleOnline: mapOnline(xHandleMetrics),
        xHandleViewers: mapViewers(xHandleMetrics),
        xViewers,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        kickChannelOnline: Object.fromEntries(
          kickChannels.map((kickChannel) => [kickChannel, false]),
        ),
        kickChannelViewers: Object.fromEntries(
          kickChannels.map((kickChannel) => [kickChannel, 0]),
        ),
        kickViewers: 0,
        online: false,
        platformViewers: { Kick: 0, Twitch: 0, X: 0 },
        totalViewers: 0,
        twitchChannelOnline: Object.fromEntries(
          twitchChannels.map((twitchChannel) => [twitchChannel, false]),
        ),
        twitchChannelViewers: Object.fromEntries(
          twitchChannels.map((twitchChannel) => [twitchChannel, 0]),
        ),
        twitchViewers: 0,
        xHandleOnline: Object.fromEntries(xHandles.map((xHandle) => [xHandle, false])),
        xHandleViewers: Object.fromEntries(xHandles.map((xHandle) => [xHandle, 0])),
        xViewers: 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
