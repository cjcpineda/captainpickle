"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Schedule" },
  { href: "/scouting", label: "Scouting" },
  { href: "/strategist", label: "AI Strategist" },
];

export function NavLinks() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="nav">
      {LINKS.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
