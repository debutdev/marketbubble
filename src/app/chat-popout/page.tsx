import type { Metadata } from "next";
import { ChatPopoutExperience } from "@/components/ChatPopoutExperience";
import { getChannelOption } from "@/lib/channel-options";

export const metadata: Metadata = {
  title: "Market Bubble Chat",
};

type ChatPopoutPageProps = {
  searchParams: Promise<{
    channel?: string | string[];
  }>;
};

export default async function ChatPopoutPage({
  searchParams,
}: ChatPopoutPageProps) {
  const params = await searchParams;
  const channelParam = Array.isArray(params.channel)
    ? params.channel[0]
    : params.channel;
  const selectedChannel = getChannelOption(channelParam);

  return (
    <main className="chat-popout-shell" aria-label="Market Bubble chat pop-out">
      <ChatPopoutExperience initialChannelValue={selectedChannel.value} />
    </main>
  );
}
