import { createVerify } from "node:crypto";
import type { CommunityChatEvent } from "@/lib/community-top-chat-types";

const kickWebhookPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

type KickChatEventPayload = {
  broadcaster?: {
    channel_slug?: string;
  };
  content?: string;
  created_at?: string;
  message_id?: string;
  sender?: {
    identity?: {
      color?: string;
      username_color?: string;
    } | null;
    username?: string;
  };
};

function getReceivedAt(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");

  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function verifyKickWebhookSignature(headers: Headers, rawBody: string) {
  const messageId = headers.get("kick-event-message-id") ?? "";
  const signature = headers.get("kick-event-signature") ?? "";
  const timestamp = headers.get("kick-event-message-timestamp") ?? "";

  if (!messageId || !signature || !timestamp) {
    return false;
  }

  try {
    const verifier = createVerify("RSA-SHA256");

    verifier.update(`${messageId}.${timestamp}.${rawBody}`);
    verifier.end();

    return verifier.verify(kickWebhookPublicKey, signature, "base64");
  } catch {
    return false;
  }
}

export function parseKickChatWebhookEvent(
  headers: Headers,
  payload: unknown,
): CommunityChatEvent | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = payload as KickChatEventPayload;
  const author = value.sender?.username?.trim();
  const text = typeof value.content === "string" ? value.content : "";

  if (!author || !text) {
    return null;
  }

  const headerMessageId = headers.get("kick-event-message-id") ?? "";
  const sourceId = value.message_id || headerMessageId;

  if (!sourceId) {
    return null;
  }

  return {
    author,
    ...(value.broadcaster?.channel_slug ? { channel: value.broadcaster.channel_slug } : {}),
    color: value.sender?.identity?.username_color ?? value.sender?.identity?.color ?? "#53fc18",
    platform: "Kick",
    receivedAt: getReceivedAt(value.created_at ?? headers.get("kick-event-message-timestamp")),
    sourceId: `kick:${sourceId}`,
    text,
  };
}
