"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { FiMaximize2, FiMinus, FiX } from "react-icons/fi";

const fallbackTwitchVideoId = "2788673017";

function getTwitchVideoEmbedSrc() {
  const parents = ["127.0.0.1", "localhost", "marketbubble.vercel.app"];
  const parentParams = parents.map((parent) => `parent=${encodeURIComponent(parent)}`).join("&");

  return `https://player.twitch.tv/?video=${fallbackTwitchVideoId}&${parentParams}&muted=true&autoplay=true`;
}

export function TwitchStreamPopout() {
  const pathname = usePathname();
  const [controlsState, setControlsState] = useState({
    dismissed: false,
    minimized: false,
    pathname: "",
  });
  const [dragState, setDragState] = useState<{
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const embedSrc = useMemo(() => getTwitchVideoEmbedSrc(), []);
  const dismissed = controlsState.pathname === pathname && controlsState.dismissed;
  const defaultMinimized = pathname === "/market";
  const minimized =
    controlsState.pathname === pathname ? controlsState.minimized : defaultMinimized;
  const marketMinimizedStyle =
    pathname === "/market" && minimized
      ? ({
          bottom: "auto",
          left: "auto",
          right: "clamp(150px, 11.5vw, 190px)",
          top: "clamp(38px, 5vh, 48px)",
        } satisfies CSSProperties)
      : undefined;
  const popoutStyle = position
    ? ({
        bottom: "auto",
        left: `${position.left}px`,
        right: "auto",
        top: `${position.top}px`,
      } satisfies CSSProperties)
    : marketMinimizedStyle;

  function handleHeaderPointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    const rect = event.currentTarget.closest(".twitch-popout")?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      pointerId: event.pointerId,
    });
  }

  function handleHeaderPointerMove(event: PointerEvent<HTMLElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const popout = event.currentTarget.closest(".twitch-popout");
    const width = popout?.getBoundingClientRect().width ?? 360;
    const height = popout?.getBoundingClientRect().height ?? 240;
    const edge = 8;
    const nextLeft = Math.min(
      Math.max(edge, event.clientX - dragState.offsetX),
      window.innerWidth - width - edge,
    );
    const nextTop = Math.min(
      Math.max(edge, event.clientY - dragState.offsetY),
      window.innerHeight - height - edge,
    );

    setPosition({ left: nextLeft, top: nextTop });
  }

  function handleHeaderPointerUp(event: PointerEvent<HTMLElement>) {
    if (dragState?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  }

  if (!pathname || pathname === "/" || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Twitch stream popout"
      className="twitch-popout"
      data-minimized={minimized ? "true" : undefined}
      style={popoutStyle}
    >
      <div
        className="twitch-popout-header"
        onPointerCancel={handleHeaderPointerUp}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <strong>Banks Twitch Stream</strong>
        <div className="twitch-popout-actions">
          <button
            aria-label={minimized ? "Restore Twitch stream" : "Minimize Twitch stream"}
            onClick={() =>
              setControlsState({
                dismissed: false,
                minimized: !minimized,
                pathname,
              })
            }
            type="button"
          >
            {minimized ? <FiMaximize2 aria-hidden="true" /> : <FiMinus aria-hidden="true" />}
          </button>
          <button
            aria-label="Close Twitch stream"
            onClick={() =>
              setControlsState({
                dismissed: true,
                minimized: false,
                pathname,
              })
            }
            type="button"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      </div>
      {!minimized ? (
        <div className="twitch-popout-viewport">
          <iframe
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="twitch-popout-player"
            src={embedSrc}
            title="Banks previous Twitch stream popout"
          />
        </div>
      ) : null}
    </aside>
  );
}
