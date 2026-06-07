import type { Metadata } from "next";
import { CommunityLive } from "@/components/CommunityLive";
import { TopTextNav } from "@/components/TopTextNav";

export const metadata: Metadata = {
  title: "Community | Market Bubble",
  description:
    "Live Market Bubble community chat, real-time Twitch and Kick stream stats, and top chatters from the active test rooms.",
};

export default function CommunityPage() {
  return (
    <main
      aria-label="Market Bubble community"
      className="site-shell community-site-shell relative min-h-dvh overflow-hidden bg-background"
    >
      <TopTextNav current="community" />
      <CommunityLive />
    </main>
  );
}
