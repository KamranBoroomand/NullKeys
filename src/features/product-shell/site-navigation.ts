export interface SiteNavigationItem {
  href: string;
  label: string;
  description: string;
  aliases?: string[];
}

export const primaryNavigationItems: SiteNavigationItem[] = [
  {
    href: "/",
    label: "Practice",
    description: "Adaptive typing lessons with indicators, key sets, and the keyboard directly in view.",
    aliases: ["/practice"],
  },
  {
    href: "/profile",
    label: "Profile",
    description: "Detailed local statistics for speed, accuracy, key performance, and practice history.",
    aliases: ["/progress"],
  },
  {
    href: "/help",
    label: "Help",
    description: "Read how the training flow works and how to use the site effectively.",
    aliases: ["/guide"],
  },
  {
    href: "/high-scores",
    label: "High Scores",
    description: "Local best runs and scoreboards that stay fully offline-first.",
  },
  {
    href: "/multiplayer",
    label: "Multiplayer",
    description: "Offline-only page explaining why NullKeys avoids accounts and hosted multiplayer for now.",
  },
  {
    href: "/typing-test",
    label: "Typing Test",
    description: "Run standalone typing tests with fixed settings and review the results.",
    aliases: ["/benchmark"],
  },
  {
    href: "/layouts",
    label: "Layouts",
    description: "Compare keyboard layouts and study efficiency tradeoffs across languages.",
  },
];

export const utilityNavigationItems: SiteNavigationItem[] = [
  {
    href: "/settings",
    label: "Settings",
    description: "Lesson, typing, keyboard, and local-data configuration.",
  },
  {
    href: "/methodology",
    label: "Method",
    description: "Read how scoring, adaptation, layout analysis, and local storage are designed.",
  },
  {
    href: "/privacy",
    label: "Privacy",
    description: "Review the local-only data model, storage locations, and reset controls.",
  },
];

export function getShellNavigationItems() {
  return primaryNavigationItems;
}
