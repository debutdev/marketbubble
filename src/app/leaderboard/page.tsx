import type { Metadata } from "next";
import { LeaderboardTop10 } from "@/components/LeaderboardTop10";
import { TopTextNav } from "@/components/TopTextNav";

export const metadata: Metadata = {
  title: "Leaderboard | Market Bubble",
  description: "Market Bubble leaderboard for smart-money traders, portfolio signals, and prediction market volume.",
};

export default function LeaderboardPage() {
  return (
    <main
      aria-label="Market Bubble leaderboard"
      className="site-shell leaderboard-site-shell relative min-h-dvh overflow-hidden bg-background"
    >
      <TopTextNav current="leaderboard" />
      <LeaderboardTop10 />
    </main>
  );
}
