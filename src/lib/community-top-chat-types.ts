export type CommunityPlatform = "Twitch" | "Kick" | "X";

export type CommunityChatterEntry = {
  author: string;
  color: string;
  count: number;
  lastMessage: string;
  lastSeen: number;
  platform: CommunityPlatform;
};

export type CommunityChatEvent = {
  author: string;
  bits?: number;
  channel?: string;
  color: string;
  eventLabel?: string;
  eventType?: "bits" | "first-message" | "raid" | "sub" | "subgift" | "system";
  firstMessage?: boolean;
  platform: CommunityPlatform;
  receivedAt: number;
  sourceId: string;
  text: string;
};

export type CommunityTopChatResponse = {
  chatters: Record<string, CommunityChatterEntry>;
  reason?: "file-fallback" | "memory-fallback" | "missing-env" | "storage-error";
  stored: boolean;
  totalMessages: number;
  updatedAt?: number;
};

export type CommunityLiveEventsResponse = {
  events: CommunityChatEvent[];
  reason?: "file-fallback" | "memory-fallback" | "missing-env" | "storage-error";
  stored: boolean;
  updatedAt?: number;
};
