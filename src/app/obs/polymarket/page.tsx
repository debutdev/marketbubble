import type { Metadata } from "next";
import { ObsOverlayClient } from "../ObsOverlayClient";
import {
  getOverlaySettings,
  type OverlaySearchParams,
} from "../overlay-settings";

export const metadata: Metadata = {
  title: "OBS Polymarket Overlay | Market Bubble",
};

type ObsPolymarketOverlayPageProps = {
  searchParams: Promise<OverlaySearchParams>;
};

export default async function ObsPolymarketOverlayPage({
  searchParams,
}: ObsPolymarketOverlayPageProps) {
  return (
    <ObsOverlayClient
      kind="polymarket"
      settings={getOverlaySettings("polymarket", await searchParams)}
    />
  );
}
