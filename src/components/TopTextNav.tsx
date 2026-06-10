"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Home", key: "home" },
  { href: "/watch", label: "Watch", key: "watch" },
  { href: "/market", label: "Market", key: "market" },
  { href: "/content", label: "Content", key: "content" },
  { href: "/schedule", label: "Schedule", key: "schedule" },
  { href: "/leaderboard", label: "Leaderboard", key: "leaderboard" },
] as const;

type TopTextNavProps = {
  current?: (typeof navItems)[number]["key"];
};

function getKeyForPathname(pathname: string) {
  if (pathname.startsWith("/watch")) {
    return "watch";
  }

  if (pathname.startsWith("/leaderboard")) {
    return "leaderboard";
  }

  if (pathname.startsWith("/content")) {
    return "content";
  }

  if (pathname.startsWith("/schedule")) {
    return "schedule";
  }

  if (pathname.startsWith("/market")) {
    return "market";
  }

  return "home";
}

export function TopTextNav({ current }: TopTextNavProps) {
  const pathname = usePathname();
  const routeKey = current ?? getKeyForPathname(pathname);
  const [pendingActive, setPendingActive] = useState<{
    key: (typeof navItems)[number]["key"];
    routeKey: (typeof navItems)[number]["key"];
  } | null>(null);
  const activeKey = pendingActive?.routeKey === routeKey ? pendingActive.key : routeKey;
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.key === activeKey));
  const navStyle = {
    "--top-nav-active-offset":
      activeIndex === 0
        ? "0px"
        : `calc(${activeIndex * 100}% + ${(activeIndex * 0.28).toFixed(2)}rem)`,
  } as CSSProperties;

  return (
    <nav className="top-text-nav" aria-label="Primary navigation" style={navStyle}>
      {navItems.map((item) => (
        <span className="top-text-nav-item" key={item.key}>
          <Link
            aria-current={routeKey === item.key ? "page" : undefined}
            className="top-text-nav-link"
            data-active={activeKey === item.key ? "true" : undefined}
            href={item.href}
            onClick={() => setPendingActive({ key: item.key, routeKey })}
            onPointerDown={() => setPendingActive({ key: item.key, routeKey })}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
