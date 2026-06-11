import type { Metadata } from "next";
import Link from "next/link";
import styles from "./obs.module.css";

export const metadata: Metadata = {
  title: "OBS Overlays | Market Bubble",
};

const overlays = [
  {
    description: "Transparent aggregated chat overlay with Twitch, Kick, X, emotes, and ticker cards.",
    href: "/obs/chat?source=both",
    label: "Live Chat",
  },
  {
    description: "Live crypto and finance newswire cards for the left-side stream context feed.",
    href: "/obs/news?limit=8",
    label: "News",
  },
  {
    description: "Live Polymarket cards with close dates, volume, and Yes/No probability bars.",
    href: "/obs/polymarket?limit=6",
    label: "Polymarket",
  },
];

export default function ObsOverlayIndexPage() {
  return (
    <main className={styles.indexShell}>
      <section className={styles.indexPanel}>
        <h1>OBS Overlays</h1>
        <p>
          Browser-source overlays for the Market Bubble watch stack. Use these URLs
          directly in OBS, then crop or scale them to fit the scene.
        </p>
        <div className={styles.indexGrid}>
          {overlays.map((overlay) => (
            <Link className={styles.indexCard} href={overlay.href} key={overlay.href}>
              <span>
                <strong>{overlay.label}</strong>
                <p>{overlay.description}</p>
              </span>
              <code>{overlay.href}</code>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
