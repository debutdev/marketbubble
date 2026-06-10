import { NextResponse } from "next/server";
import {
  parseKickChatWebhookEvent,
  verifyKickWebhookSignature,
} from "@/lib/kick-webhook";
import { writeCommunityChatEvents } from "@/lib/community-top-chat-store";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function canSkipSignatureVerification() {
  return (
    process.env.KICK_WEBHOOK_SKIP_SIGNATURE === "true" &&
    process.env.VERCEL_ENV !== "production"
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureVerified =
    canSkipSignatureVerification() ||
    verifyKickWebhookSignature(request.headers, rawBody);

  if (!signatureVerified) {
    return NextResponse.json(
      { error: "Invalid Kick webhook signature." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const eventType = request.headers.get("kick-event-type");

  if (eventType !== "chat.message.sent") {
    return NextResponse.json(
      { ignored: true, ok: true },
      { headers: noStoreHeaders },
    );
  }

  try {
    const event = parseKickChatWebhookEvent(request.headers, JSON.parse(rawBody));

    if (!event) {
      return NextResponse.json(
        { error: "Invalid Kick chat payload." },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    const payload = await writeCommunityChatEvents([event]);

    return NextResponse.json(
      {
        ok: true,
        stored: payload.stored,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Kick webhook body." },
      { headers: noStoreHeaders, status: 400 },
    );
  }
}
