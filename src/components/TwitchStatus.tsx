"use client";

import { useEffect, useState } from "react";

export function TwitchStatus({ channel }: { channel: string }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;

    async function updateStatus() {
      try {
        const response = await fetch(
          `/api/twitch-status?twitchChannel=${encodeURIComponent(channel)}`,
          { cache: "no-store" },
        );
        const data = await response.json();

        if (active) {
          setOnline(Boolean(data.online));
        }
      } catch {
        if (active) {
          setOnline(false);
        }
      }
    }

    updateStatus();
    const intervalId = window.setInterval(updateStatus, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [channel]);

  return (
    <div
      aria-live="polite"
      className={`stream-status ${online ? "stream-status-online" : "stream-status-offline"}`}
    >
      {online ? "Online" : "Offline"}
    </div>
  );
}
