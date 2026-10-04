"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { BookIcon, HistoryIcon, PlayIcon } from "./Icons";

const NAV = [
  { href: "/", label: "Mashg‘ulot", Icon: PlayIcon },
  { href: "/history", label: "Tarix", Icon: HistoryIcon },
  { href: "/library", label: "Savollar bazasi", Icon: BookIcon },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-auto rounded-lg py-2 text-lg font-semibold tracking-tight text-fg"
        >
          Zakovat
        </Link>
        <nav aria-label="Asosiy menyu">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {NAV.map(({ href, label, Icon }) => {
              const active = href === "/" ? pathname === "/" || pathname === "/quiz" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    title={label}
                    className={`inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
                      active ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg"
                    }`}
                  >
                    <Icon className="sm:hidden" />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
