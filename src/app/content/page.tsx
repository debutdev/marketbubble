import type { Metadata } from "next";
import { ContentArchive } from "@/components/ContentArchive";
import { TopTextNav } from "@/components/TopTextNav";

export const metadata: Metadata = {
  title: "Content | Market Bubble",
  description: "Market Bubble tweets, clips, and media highlights.",
};

export default function ContentPage() {
  return (
    <main
      aria-label="Market Bubble content"
      className="site-shell content-site-shell relative min-h-dvh overflow-hidden bg-background"
    >
      <TopTextNav current="content" />
      <ContentArchive />
    </main>
  );
}
