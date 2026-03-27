"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import {
  getShellNavigationItems,
  utilityNavigationItems,
  type SiteNavigationItem,
} from "@/features/product-shell/site-navigation";
import type { ThemeChoice } from "@/features/user-preferences/preferences-schema";
import {
  getNextThemeChoice,
  getThemeDefinition,
} from "@/features/user-preferences/theme-registry";
import { getBuildMetadata } from "@/lib/product/build-metadata";
import { classNames } from "@/lib/utils/class-names";

interface PageFrameProps {
  title: string;
  description: string;
  themeChoice: ThemeChoice;
  onThemeChange: (themeChoice: ThemeChoice) => void;
  eyebrow?: string;
  actions?: ReactNode;
  showHeading?: boolean;
  children: ReactNode;
}

function matchesPath(item: SiteNavigationItem, pathname: string) {
  return item.href === pathname || item.aliases?.includes(pathname);
}

export function PageFrame({
  title,
  description,
  themeChoice,
  onThemeChange,
  eyebrow,
  actions,
  showHeading = true,
  children,
}: PageFrameProps) {
  const pathname = usePathname();
  const primaryItems = getShellNavigationItems();
  const activeTheme = getThemeDefinition(themeChoice);
  const nextThemeChoice = getNextThemeChoice(themeChoice);
  const nextThemeLabel = getThemeDefinition(nextThemeChoice).label;
  const buildMetadata = getBuildMetadata();

  return (
    <div className="min-h-screen bg-canvas text-text">
      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 pb-9 pt-3 lg:grid-cols-[minmax(0,1fr)_8.75rem] lg:px-6">
        <div className="min-w-0">
          {showHeading ? (
            <header className="border-b border-borderTone/45 pb-3">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-textMuted">
                    <Link href="/" className="font-semibold tracking-[0.26em] text-text">
                      {buildMetadata.name}
                    </Link>
                    <span className="normal-case tracking-[0.08em]">{buildMetadata.tagline}</span>
                  </div>
                  <div className="space-y-1">
                    {eyebrow ? (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-textMuted">
                        {eyebrow}
                      </p>
                    ) : null}
                    <h1 className="text-[1.85rem] font-medium tracking-tight text-text sm:text-[2rem]">
                      {title}
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-textMuted">{description}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 md:items-end">
                  <button
                    type="button"
                    onClick={() => onThemeChange(nextThemeChoice)}
                    className="inline-flex min-h-8 items-center gap-2 rounded-[0.4rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.9)] px-2.5 py-1 text-[13px] text-text hover:border-accent/28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={`Switch theme to ${nextThemeLabel}`}
                    title={`Next theme: ${nextThemeLabel}`}
                  >
                    {activeTheme.mode === "dark" ? (
                      <MoonStar className="h-4 w-4" />
                    ) : (
                      <SunMedium className="h-4 w-4" />
                    )}
                    <span className="max-w-[10rem] truncate">{activeTheme.label}</span>
                  </button>
                  {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
                </div>
              </div>

              <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {primaryItems.map((item) => {
                  const active = matchesPath(item, pathname);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "whitespace-nowrap rounded-[0.45rem] border px-3 py-1.5 text-[13px] transition",
                        active
                          ? "border-accent/44 bg-accentSoft/90 text-text shadow-[inset_0_1px_0_hsl(var(--text)/0.04)]"
                          : "border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] text-textMuted hover:border-accent/30 hover:text-text",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </header>
          ) : (
            <header className="pb-2 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="text-sm font-semibold uppercase tracking-[0.24em] text-text">
                  {buildMetadata.name}
                </Link>
                <button
                  type="button"
                  onClick={() => onThemeChange(nextThemeChoice)}
                  className="inline-flex min-h-8 items-center gap-2 rounded-[0.4rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.9)] px-2.5 py-1 text-[13px] text-text hover:border-accent/28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`Switch theme to ${nextThemeLabel}`}
                  title={`Next theme: ${nextThemeLabel}`}
                >
                  {activeTheme.mode === "dark" ? (
                    <MoonStar className="h-4 w-4" />
                  ) : (
                    <SunMedium className="h-4 w-4" />
                  )}
                  <span className="max-w-[10rem] truncate">{activeTheme.label}</span>
                </button>
              </div>
            </header>
          )}

          <main className={classNames(showHeading ? "pt-4" : "pt-1")}>{children}</main>

          {showHeading ? (
            <footer className="mt-7 border-t border-borderTone/45 pt-3 text-xs text-textMuted">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{buildMetadata.tagline}</span>
                  <span data-testid="product-version">v{buildMetadata.version}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span>local only</span>
                  {utilityNavigationItems.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:text-text">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </footer>
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-5 pl-2">
            <div className="space-y-4 border-l border-borderTone/28 pl-3 text-right">
              <div className="space-y-1">
                <Link href="/" className="text-sm font-semibold uppercase tracking-[0.24em] text-text">
                  {buildMetadata.name.toLowerCase()}
                </Link>
                <button
                  type="button"
                  onClick={() => onThemeChange(nextThemeChoice)}
                  className="text-[11px] text-textMuted transition hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`Switch theme to ${nextThemeLabel}`}
                  title={`Next theme: ${nextThemeLabel}`}
                >
                  {activeTheme.label}
                </button>
              </div>

              <nav className="space-y-1.5">
                {primaryItems.map((item) => {
                  const active = matchesPath(item, pathname);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "block py-0.5 text-sm transition",
                        active
                          ? "font-medium text-text"
                          : "text-textMuted hover:text-text",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="space-y-1 border-t border-borderTone/35 pt-3 text-xs text-textMuted">
                {utilityNavigationItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block hover:text-text">
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="space-y-1 border-t border-borderTone/35 pt-3 text-[11px] leading-5 text-textMuted">
                <p>{buildMetadata.tagline}</p>
                <p>local only</p>
                <p>no account</p>
                <p>no sync</p>
                <p data-testid="product-version">v{buildMetadata.version}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
