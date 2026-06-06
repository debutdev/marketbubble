import type { Metadata } from "next";
import { MarketSidePanel } from "@/components/MarketSidePanel";
import { MarketTicker } from "@/components/MarketTicker";
import { MarketWidePanel } from "@/components/MarketWidePanel";
import { SmartMoneyTracker } from "@/components/SmartMoneyTracker";
import { TopTextNav } from "@/components/TopTextNav";

export const metadata: Metadata = {
  title: "Market | Market Bubble",
  description: "Live market sentiment and Polymarket opportunities from Market Bubble.",
};

export default function MarketPage() {
  return (
    <main
      aria-label="Market Bubble market"
      className="site-shell market-site-shell relative min-h-dvh overflow-hidden bg-background"
    >
      <TopTextNav current="market" />
      <MarketSidePanel />
      <MarketWidePanel />
      <SmartMoneyTracker />
      <MarketTicker />
    </main>
  );
}
