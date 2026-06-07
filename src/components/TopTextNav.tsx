"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Home", key: "home" },
  { href: "/market", label: "Market", key: "market" },
  { href: "/content", label: "Content", key: "content" },
  { href: "/community", label: "Community", key: "community" },
  { href: "/leaderboard", label: "Leaderboard", key: "leaderboard" },
] as const;

type TopTextNavProps = {
  current?: (typeof navItems)[number]["key"];
};

function getKeyForPathname(pathname: string) {
  if (pathname.startsWith("/leaderboard")) {
    return "leaderboard";
  }

  if (pathname.startsWith("/community")) {
    return "community";
  }

  if (pathname.startsWith("/content")) {
    return "content";
  }

  if (pathname.startsWith("/market")) {
    return "market";
  }

  return "home";
}

export function TopTextNav({ current }: TopTextNavProps) {
  const pathname = usePathname();
  const routeKey = current ?? getKeyForPathname(pathname);
  const [activeKey, setActiveKey] = useState(routeKey);
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
            onClick={() => setActiveKey(item.key)}
            onPointerDown={() => setActiveKey(item.key)}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
