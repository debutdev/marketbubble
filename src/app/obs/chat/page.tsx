import type { Metadata } from "next";
import { ObsOverlayClient } from "../ObsOverlayClient";
import {
  getOverlaySettings,
  type OverlaySearchParams,
} from "../overlay-settings";

export const metadata: Metadata = {
  title: "OBS Chat Overlay | Market Bubble",
};

type ObsChatOverlayPageProps = {
  searchParams: Promise<OverlaySearchParams>;
};

export default async function ObsChatOverlayPage({
  searchParams,
}: ObsChatOverlayPageProps) {
  return (
    <ObsOverlayClient
      kind="chat"
      settings={getOverlaySettings("chat", await searchParams)}
    />
  );
}
