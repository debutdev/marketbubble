import { NextResponse } from "next/server";

const twitchClientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";

function normalizeTwitchChannel(channel: string) {
  return channel.trim().replace(/[^\w]/g, "").slice(0, 32);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const twitchChannel = normalizeTwitchChannel(searchParams.get("twitchChannel") ?? "arky") || "arky";

  try {
    const response = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-ID": twitchClientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "StreamStatus",
        variables: { login: twitchChannel },
        query:
          "query StreamStatus($login: String!) { user(login: $login) { stream { id type } } }",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ online: false }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(
      { online: Boolean(data?.data?.user?.stream) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { online: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
