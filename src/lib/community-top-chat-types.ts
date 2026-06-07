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
  color: string;
  platform: CommunityPlatform;
  receivedAt: number;
  sourceId: string;
  text: string;
};

export type CommunityTopChatResponse = {
  chatters: Record<string, CommunityChatterEntry>;
  reason?: "missing-env" | "storage-error";
  stored: boolean;
  totalMessages: number;
  updatedAt?: number;
};
