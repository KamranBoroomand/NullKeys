"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PageFrame } from "@/components/shared/page-frame";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";

interface BoundaryPlaceholderScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  links: Array<{
    href: string;
    label: string;
    description: string;
  }>;
  footer?: ReactNode;
}

export function BoundaryPlaceholderScreen({
  eyebrow,
  title,
  description,
  body,
  links,
  footer,
}: BoundaryPlaceholderScreenProps) {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      description={description}
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
    >
      <div className="mx-auto max-w-[48rem] space-y-6">
        <section className="space-y-3 border-t border-borderTone/50 pt-4">
          <p className="text-sm leading-7 text-textMuted">{body}</p>
        </section>

        <section className="grid gap-3 border-t border-borderTone/50 pt-4 sm:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block border border-borderTone/50 px-4 py-4 transition hover:border-accent/35 hover:text-text"
            >
              <p className="text-sm font-semibold text-text">{link.label}</p>
              <p className="mt-1 text-sm leading-6 text-textMuted">{link.description}</p>
            </Link>
          ))}
        </section>

        {footer ? (
          <section className="border-t border-borderTone/50 pt-4 text-sm leading-7 text-textMuted">
            {footer}
          </section>
        ) : null}
      </div>
    </PageFrame>
  );
}
