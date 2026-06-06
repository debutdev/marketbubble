import Image from "next/image";
import { MarketBubbleLogo } from "@/components/MarketBubbleLogo";
import { MarketBubbleExperience } from "@/components/MarketBubbleExperience";
import { TopTextNav } from "@/components/TopTextNav";

export default function Home() {
  return (
    <main
      aria-label="Market Bubble"
      className="site-shell home-site-shell relative min-h-dvh overflow-hidden bg-background"
    >
      <div className="logo-stage" aria-hidden="true">
        <div className="logo-motion">
          <MarketBubbleLogo className="market-logo" />
        </div>
      </div>
      <TopTextNav current="home" />
      <MarketBubbleExperience />
      <div className="presented-by" aria-label="Presented by Polymarket">
        <Image
          className="presented-lockup"
          src="/presented-by-polymarket.svg"
          alt="Presented by Polymarket"
          width={420}
          height={140}
        />
      </div>
      <div className="tagline" aria-label="Make Money. Command Attention. Leverage AI.">
        <span>Make Money</span>
        <span>Command Attention</span>
        <span>Leverage AI</span>
      </div>
      <p className="bottom-left-line">&quot;Invest in Yourself&quot;</p>
      <p className="schedule-line">
        LIVE&nbsp;&nbsp;&bull;&nbsp;&nbsp;THURDSAYS&nbsp;&nbsp;&bull;&nbsp;&nbsp;1PM PST
      </p>
    </main>
  );
}
