import type { Metadata } from "next";
import { WatchShell } from "./WatchShell";

export const metadata: Metadata = {
  title: "Watch | Market Bubble",
  description: "Market Bubble watch page.",
};

export default function WatchPage() {
  return <WatchShell />;
}
