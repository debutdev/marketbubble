import type { Metadata } from "next";
import { ObsOverlayClient } from "../ObsOverlayClient";
import {
  getOverlaySettings,
  type OverlaySearchParams,
} from "../overlay-settings";

export const metadata: Metadata = {
  title: "OBS News Overlay | Market Bubble",
};

type ObsNewsOverlayPageProps = {
  searchParams: Promise<OverlaySearchParams>;
};

export default async function ObsNewsOverlayPage({
  searchParams,
}: ObsNewsOverlayPageProps) {
  return (
    <ObsOverlayClient
      kind="news"
      settings={getOverlaySettings("news", await searchParams)}
    />
  );
}
