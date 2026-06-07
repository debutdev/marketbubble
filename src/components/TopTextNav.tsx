import Link from "next/link";

const navItems = [
  { href: "/", label: "Home", key: "home" },
  { href: "/market", label: "Market", key: "market" },
  { href: "/content", label: "Content", key: "content" },
  { href: "/leaderboard", label: "Leaderboard", key: "leaderboard" },
] as const;

type TopTextNavProps = {
  current?: (typeof navItems)[number]["key"];
};

export function TopTextNav({ current }: TopTextNavProps) {
  return (
    <nav className="top-text-nav" aria-label="Primary navigation">
      {navItems.map((item, index) => (
        <span className="top-text-nav-item" key={item.key}>
          {index > 0 ? (
            <span className="top-text-nav-separator" aria-hidden="true">
              &bull;
            </span>
          ) : null}
          <Link
            aria-current={current === item.key ? "page" : undefined}
            className="top-text-nav-link"
            href={item.href}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
