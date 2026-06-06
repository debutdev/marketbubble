"use client";

import { useCallback, useEffect, useState } from "react";
import { FiMaximize2, FiMinimize2 } from "react-icons/fi";

const COMPACT_EXPANDED_BREAKPOINT = 980;

type StatusSources = {
  kickChannels: { channel: string }[];
  twitchChannels: string[];
  xHandles: string[];
};

type StreamStageProps = {
  src: string;
  statusSources?: StatusSources;
  title: string;
};

export function StreamStage({ src, statusSources, title }: StreamStageProps) {
  const [expanded, setExpanded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const [online, setOnline] = useState(false);
  const statusTwitchChannelsKey = statusSources?.twitchChannels.join(",") ?? "";
  const statusKickChannelsKey =
    statusSources?.kickChannels.map((kickChannel) => kickChannel.channel).join(",") ?? "";
  const statusXHandlesKey = statusSources?.xHandles.join(",") ?? "";

  const clearExpandedMetricStyles = useCallback(() => {
    document.body.style.removeProperty("--stream-expanded-stage-width");
    document.body.style.removeProperty("--stream-expanded-chat-left");
    document.body.style.removeProperty("--stream-expanded-chat-top");
    document.body.style.removeProperty("--stream-expanded-chat-height");

    const chatStage = document.querySelector<HTMLElement>(".chat-stage");
    const backdrop = document.querySelector<HTMLElement>(".stream-expanded-backdrop");

    if (chatStage) {
      chatStage.style.removeProperty("top");
      chatStage.style.removeProperty("left");
      chatStage.style.removeProperty("bottom");
      chatStage.style.removeProperty("height");
      chatStage.style.removeProperty("z-index");
      chatStage.style.removeProperty("opacity");
      chatStage.style.removeProperty("translate");
      chatStage.style.removeProperty("scale");
      chatStage.style.removeProperty("animation");
      chatStage.style.removeProperty("transition");
    }

    if (backdrop) {
      backdrop.style.removeProperty("opacity");
      backdrop.style.removeProperty("backdrop-filter");
      backdrop.style.removeProperty("transition");
    }
  }, []);

  const updateExpandedMetrics = useCallback(() => {
    if (window.innerWidth <= COMPACT_EXPANDED_BREAKPOINT) {
      clearExpandedMetricStyles();
      return;
    }

    const shell = document.querySelector(".site-shell");

    if (!shell) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const clampValue = (min: number, preferred: number, max: number) =>
      Math.min(Math.max(preferred, min), max);
    const edge = clampValue(8, viewportWidth * 0.01, 14);
    const padding = clampValue(5, viewportWidth * 0.006, 8);
    const headerHeight = clampValue(28, viewportWidth * 0.027, 38);
    const gap = clampValue(5, viewportWidth * 0.0056, 8);
    const overlayInset = clampValue(12, viewportWidth * 0.011, 18);
    const availablePlayerWidth = shellRect.width - edge * 2 - padding * 2;
    const availablePlayerHeight =
      shellRect.height - edge * 2 - padding * 2 - headerHeight - gap;
    const playerWidth = Math.min(availablePlayerWidth, availablePlayerHeight * (16 / 9));
    const playerHeight = playerWidth * (9 / 16);
    const stageWidth = playerWidth + padding * 2;
    const stageHeight = playerHeight + headerHeight + gap + padding * 2;
    const stageLeft = (shellRect.width - stageWidth) / 2;
    const stageTop = (shellRect.height - stageHeight) / 2;
    const chatHeight = Math.max(180, Math.min(playerHeight - overlayInset * 2, playerHeight * 0.62));

    document.body.style.setProperty("--stream-expanded-stage-width", `${stageWidth}px`);
    document.body.style.setProperty(
      "--stream-expanded-chat-left",
      `${stageLeft + padding + overlayInset}px`,
    );
    document.body.style.setProperty(
      "--stream-expanded-chat-top",
      `${stageTop + padding + headerHeight + gap + overlayInset}px`,
    );
    document.body.style.setProperty("--stream-expanded-chat-height", `${chatHeight}px`);

    const chatStage = document.querySelector<HTMLElement>(".chat-stage");
    const backdrop = document.querySelector<HTMLElement>(".stream-expanded-backdrop");

    if (chatStage) {
      chatStage.style.top = `${stageTop + padding + headerHeight + gap + overlayInset}px`;
      chatStage.style.left = `${stageLeft + padding + overlayInset}px`;
      chatStage.style.bottom = "auto";
      chatStage.style.height = `${chatHeight}px`;
      chatStage.style.zIndex = "46";
      chatStage.style.opacity = "1";
      chatStage.style.translate = "0 0";
      chatStage.style.scale = "1";
      chatStage.style.animation = "none";
      chatStage.style.transition = "none";
    }

    if (backdrop) {
      backdrop.style.opacity = "1";
      backdrop.style.backdropFilter = "blur(18px)";
      backdrop.style.transition = "none";
    }
  }, [clearExpandedMetricStyles]);

  const resetExpandedMetrics = useCallback(() => {
    clearExpandedMetricStyles();
  }, [clearExpandedMetricStyles]);

  useEffect(() => {
    const updateCompactViewport = () => {
      setCompactViewport(window.innerWidth <= COMPACT_EXPANDED_BREAKPOINT);
    };

    updateCompactViewport();
    window.addEventListener("resize", updateCompactViewport);

    return () => {
      window.removeEventListener("resize", updateCompactViewport);
    };
  }, []);

  useEffect(() => {
    if (expanded) {
      updateExpandedMetrics();
      document.body.setAttribute("data-stream-expanded", "true");
      window.addEventListener("resize", updateExpandedMetrics);
    } else {
      document.body.removeAttribute("data-stream-expanded");
      resetExpandedMetrics();
    }

    return () => {
      window.removeEventListener("resize", updateExpandedMetrics);
      document.body.removeAttribute("data-stream-expanded");
      resetExpandedMetrics();
    };
  }, [expanded, resetExpandedMetrics, updateExpandedMetrics]);

  useEffect(() => {
    let active = true;

    async function updateStatus() {
      try {
        const statusUrl = new URL("/api/stream-metrics", window.location.origin);
        const twitchChannels = statusTwitchChannelsKey.split(",").filter(Boolean);
        const kickChannels = statusKickChannelsKey.split(",").filter(Boolean);
        const xHandles = statusXHandlesKey.split(",").filter(Boolean);

        for (const twitchChannel of twitchChannels) {
          statusUrl.searchParams.append("twitchChannel", twitchChannel);
        }

        for (const kickChannel of kickChannels) {
          statusUrl.searchParams.append("kickChannel", kickChannel);
        }

        for (const xHandle of xHandles) {
          statusUrl.searchParams.append("xHandle", xHandle);
        }

        const response = await fetch(statusUrl, { cache: "no-store" });
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
  }, [statusKickChannelsKey, statusTwitchChannelsKey, statusXHandlesKey]);

  return (
    <>
      <div
        className="stream-expanded-backdrop"
        data-expanded={expanded ? "true" : undefined}
        aria-hidden="true"
        style={
          expanded
            ? {
                backdropFilter: "blur(18px)",
                opacity: 1,
              }
            : undefined
        }
      />
      <section
        className="stream-stage"
        data-entered={entered ? "true" : undefined}
        data-expanded={expanded ? "true" : undefined}
        aria-label="Twitch stream"
        style={
          expanded && !compactViewport
            ? {
                translate: "-50% -50%",
                width: "var(--stream-expanded-stage-width)",
              }
            : undefined
        }
        onAnimationEnd={(event) => {
          if (event.animationName === "stream-expand-in") {
            setEntered(true);
          }
        }}
      >
        <div className="stream-header">
          <button
            className="stream-fullscreen-button"
            type="button"
            aria-label={expanded ? "Exit expanded stream" : "Expand stream"}
            aria-pressed={expanded}
            title={expanded ? "Exit expanded stream" : "Expand stream"}
            onClick={() => {
              setExpanded((currentExpanded) => !currentExpanded);
            }}
          >
            {expanded ? (
              <FiMinimize2 aria-hidden="true" />
            ) : (
              <FiMaximize2 aria-hidden="true" />
            )}
          </button>
          <div
            aria-live="polite"
            className={`stream-status ${online ? "stream-status-online" : "stream-status-offline"}`}
          >
            {online ? "Online" : "Offline"}
          </div>
        </div>
        <div className="stream-viewport">
          <iframe
            className="twitch-player"
            src={src}
            title={title}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
          />
        </div>
      </section>
    </>
  );
}
