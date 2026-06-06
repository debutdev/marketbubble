"use client";

import { useEffect, useRef } from "react";

type XTimelineProps = {
  handle: string;
  height?: number;
};

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement) => void;
      };
    };
  }
}

const xWidgetsScript = "https://platform.x.com/widgets.js";

export function XTimeline({ handle, height = 680 }: XTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanHandle = handle.replace(/^@/, "");

  useEffect(() => {
    const loadTimeline = () => {
      if (containerRef.current) {
        window.twttr?.widgets?.load(containerRef.current);
      }
    };

    if (window.twttr?.widgets) {
      window.requestAnimationFrame(loadTimeline);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${xWidgetsScript}"]`,
    );
    const script = existingScript ?? document.createElement("script");
    const handleScriptLoad = () => {
      loadTimeline();
    };

    if (!existingScript) {
      script.async = true;
      script.charset = "utf-8";
      script.src = xWidgetsScript;
      document.body.appendChild(script);
    }

    script.addEventListener("load", handleScriptLoad);

    return () => {
      script.removeEventListener("load", handleScriptLoad);
    };
  }, []);

  return (
    <div className="x-timeline-shell" ref={containerRef}>
      <a
        className="twitter-timeline"
        data-chrome="nofooter transparent"
        data-dnt="true"
        data-height={height}
        data-show-replies="true"
        data-theme="dark"
        href={`https://twitter.com/${cleanHandle}?ref_src=twsrc%5Etfw`}
      >
        Posts by @{cleanHandle}
      </a>
    </div>
  );
}
