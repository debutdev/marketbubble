import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FearGreedResponse = {
  data?: Array<{
    timestamp?: string;
    time_until_update?: string;
    value?: string;
    value_classification?: string;
  }>;
  metadata?: {
    error?: string | null;
  };
  name?: string;
};

export async function GET() {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=1&format=json", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to load crypto sentiment." },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as FearGreedResponse;
    const latest = payload.data?.[0];
    const value = Number(latest?.value);

    if (!latest || !Number.isFinite(value)) {
      return NextResponse.json(
        { error: payload.metadata?.error ?? "Crypto sentiment is unavailable." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      classification: latest.value_classification ?? "Unknown",
      fetchedAt: new Date().toISOString(),
      name: payload.name ?? "Fear and Greed Index",
      sourceName: "Alternative.me",
      sourceUrl: "https://alternative.me/crypto/fear-and-greed-index/",
      timeUntilUpdate: Number(latest.time_until_update ?? 0),
      timestamp: latest.timestamp ? Number(latest.timestamp) * 1000 : null,
      value,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load crypto sentiment.",
      },
      { status: 500 },
    );
  }
}
