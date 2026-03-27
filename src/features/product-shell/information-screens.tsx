"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Compass, DatabaseZap, LockKeyhole, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import { usePracticePreferencesState } from "@/features/user-preferences/use-practice-preferences-state";
import { getBuildMetadata } from "@/lib/product/build-metadata";

interface InformationSection {
  title: string;
  body: string;
  bullets?: string[];
}

interface InformationScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  introCards: Array<{
    label: string;
    title: string;
    body: string;
    icon: ReactNode;
  }>;
  sections: InformationSection[];
  sidebarTitle: string;
  sidebarBody: string;
  sidebarLinks: Array<{ href: string; label: string }>;
}

const productName = getBuildMetadata().name;

function InformationScreen({
  eyebrow,
  title,
  description,
  introCards,
  sections,
  sidebarTitle,
  sidebarBody,
  sidebarLinks,
}: InformationScreenProps) {
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
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {introCards.map((card) => (
              <Panel key={card.title} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl border border-accent/20 bg-accentSoft p-2 text-accent">
                    {card.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-textMuted">
                      {card.label}
                    </p>
                    <h2 className="text-lg font-semibold text-text">{card.title}</h2>
                  </div>
                </div>
                <p className="text-sm leading-6 text-textMuted">{card.body}</p>
              </Panel>
            ))}
          </div>
          {sections.map((section) => (
            <Panel key={section.title} className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-text">{section.title}</h2>
                <p className="text-sm leading-7 text-textMuted">{section.body}</p>
              </div>
              {section.bullets ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-[1.6rem] border border-borderTone/70 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
        <div className="space-y-6">
          <Panel className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                Quick path
              </p>
              <h2 className="text-xl font-semibold text-text">{sidebarTitle}</h2>
              <p className="text-sm leading-6 text-textMuted">{sidebarBody}</p>
            </div>
            <div className="grid gap-3">
              {sidebarLinks.map((sidebarLink) => (
                <Link key={sidebarLink.href} href={sidebarLink.href}>
                  <ActionButton tone="secondary" block>
                    {sidebarLink.label}
                  </ActionButton>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-textMuted">
              Product stance
            </p>
            <div className="space-y-3 text-sm leading-6 text-textMuted">
              <p>{productName} is deliberately local-only. There are no accounts, no sync servers, and no backend requirement for personal progress.</p>
              <p>The product can still feel full and layered because the richness comes from the client architecture, analytics views, and reusable training systems rather than remote services.</p>
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}

function GuideSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-borderTone/60 pt-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-textMuted">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold text-text">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-7 text-textMuted">{children}</div>
    </section>
  );
}

function GuideFigure({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-3 border border-borderTone/70 bg-panel/65 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-textMuted">
        {title}
      </p>
      <pre className="editorial-copy overflow-x-auto text-xs leading-6 text-text">{body}</pre>
    </div>
  );
}

function GuideSidebarCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel className="space-y-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-textMuted">{children}</div>
    </Panel>
  );
}

export function GuideScreen() {
  const { preferences, hydrated, patchPreferences } = usePracticePreferencesState();

  if (!hydrated) {
    return null;
  }

  return (
    <PageFrame
      eyebrow="Help"
      title={`How ${productName} teaches and how to use it well`}
      description={`${productName} is meant to feel like a focused typing utility: practice teaches, typing test measures, layouts explain keyboard tradeoffs, and profile shows what is actually changing over time.`}
      themeChoice={preferences.themeChoice}
      onThemeChange={(themeChoice) => patchPreferences({ themeChoice })}
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="space-y-8">
          <section className="space-y-4">
            <p className="max-w-4xl text-sm leading-7 text-textMuted">
              The site works best when you treat each area as a separate tool. Practice is for
              learning difficult keys. Typing Test is for repeatable measurement. Layouts is for
              understanding why a board feels easy or awkward. Profile is where all of the saved
              evidence comes together.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  label: "Practice",
                  body: "Adaptive lessons bias every passage toward the weakest included key, then surround it with related letters and readable word families.",
                },
                {
                  label: "Typing test",
                  body: "Tests freeze the environment so the score stays comparable across runs. Use them after practice, not instead of practice.",
                },
                {
                  label: "Profile + layouts",
                  body: "Charts, histograms, heatmaps, and layout analysis explain whether a problem is exposure, finger travel, same-hand load, or raw control.",
                },
              ].map((item) => (
                <div key={item.label} className="border-t border-borderTone/60 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-textMuted">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-textMuted">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <GuideSection eyebrow="Teaching loop" title="How adaptive practice works">
            <p>
              Practice is not a random text stream. {productName} keeps an active set of characters,
              identifies the weakest included key, builds a short cluster around that weakness, and
              then re-measures the result. The next lesson is generated from that evidence rather
              than from a fixed lesson list.
            </p>
            <ol className="space-y-2 pl-5 text-sm leading-7 text-textMuted">
              <li>Start from a small active set that matches your current unlock stage.</li>
              <li>Measure per-key timing and mistakes while you type.</li>
              <li>Choose the weakest included character as the next lesson focus.</li>
              <li>Generate readable related words around that focus, using pseudo-words only when natural words run out.</li>
              <li>Unlock preview characters only after the current set is stable enough.</li>
            </ol>
            <GuideFigure
              title="Lesson cycle"
              body={`small active set\n      |\n      v\n weakest included key\n      |\n      v\n related-word cluster\n      |\n      v\n timing + accuracy evidence\n      |\n      v\n reinforce / recover / unlock preview`}
            />
            <p>
              The feeling should be that the system is teaching a local cluster, not scattering
              unrelated words. If you keep seeing the same awkward letter inside similar families,
              the planner is doing its job.
            </p>
          </GuideSection>

          <GuideSection eyebrow="Practice screen" title="How to read the main practice view">
            <p>
              The practice page stays text-first on purpose. The compact metric line above the
              passage tells you what matters immediately: all keys versus active keys, the current
              focus key, your last and top speeds, learning-rate direction, accuracy, and today’s
              goal progress.
            </p>
            <GuideFigure
              title="Metric line example"
              body={`metrics | all keys 24/31 | active keys 13 | current key t\nlast speed 68.4 | top speed 74.1 | learning rate +1.8\naccuracy 97% | daily goal 18 / 25 min`}
            />
            <p>
              Use the three view modes deliberately. Normal keeps the keyboard, key details, and
              extended teaching notes visible. Compact keeps the same lesson logic with less chrome.
              Bare removes most scaffolding when you want the cleanest possible typing surface.
            </p>
            <p>
              Whitespace display changes only the visual aid, not the lesson itself. `none` is the
              cleanest surface, `bar` makes word spacing obvious, and `bullet` is useful when you
              want every space to remain visible. If `space skips words` is enabled, pressing space
              will jump over the rest of a damaged word so you can keep tempo during drills.
            </p>
          </GuideSection>

          <GuideSection eyebrow="Typing test" title="When to use Typing Test instead of Practice">
            <p>
              Typing Test is a measurement mode. Pick a fixed duration and text family, run the
              test, then study the report before starting another one. If you keep changing source
              family, layout, or duration, the score becomes less useful.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <GuideFigure
                title="Clean test flow"
                body={`choose preset -> choose text family -> type\n                     |\n                     v\n             report + replay + graphs\n                     |\n                     v\n        return to practice if weak keys appear`}
              />
              <GuideFigure
                title="Three text families"
                body={`book-like text   : smoother rhythm, sentence pacing\ncommon words    : direct speed comparison\npseudo-words    : less memory help, harder raw control`}
              />
            </div>
            <p>
              Read the report in layers. The headline speed and accuracy tell you the outcome. The
              speed and accuracy trajectories show whether you settled in or faded. The latency
              histogram shows whether a few stalls dragged the run down. Replay is for locating
              where rhythm broke, not for admiring a single number.
            </p>
          </GuideSection>

          <GuideSection eyebrow="Layouts" title="What the layouts page is trying to teach">
            <p>
              Layout analysis is educational, not ornamental. The keyboard heatmap shows where the
              language spends time. The row, hand, and finger charts show how the load is
              distributed. Direct comparison tells you whether a layout improves home-row share,
              alternation, or symbol reach without hiding a same-finger problem somewhere else.
            </p>
            <GuideFigure
              title="Finger-zone concept"
              body={`L5 L4 L3 L2 L1   R1 R2 R3 R4 R5\n Q  W  E  R  T   Y  U  I  O  P\n A  S  D  F  G   H  J  K  L  ;\n Z  X  C  V  B   N  M  ,  .  /\n\nGoal: keep frequent keys near home and avoid frequent same-finger jumps.`}
            />
            <p>
              High home-row share is usually good, but it is not enough by itself. A layout can put
              many common keys near home and still feel bad if it overloads one hand or one finger.
              That is why the page keeps row, hand, finger, alternation, and same-finger metrics
              together instead of promoting a single score as the truth.
            </p>
          </GuideSection>

          <GuideSection eyebrow="Profile" title="How to interpret the progress lab">
            <p>
              The profile page is meant to be read from broad to specific. Start with all-time and
              today summaries, then move to the speed and accuracy histograms, then the trend lines,
              then the per-key sections. The keyboard heatmap and key charts matter most when they
              agree with each other.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <GuideFigure
                title="Read order"
                body={`summary -> histograms -> trends -> weak keys\n         -> key charts -> heatmap -> calendar`}
              />
              <GuideFigure
                title="What agreement looks like"
                body={`hot key + slow key      = real bottleneck\nhot key + accurate key  = normal workload\ncold key + slow key     = low exposure\nhot zone + layout issue = likely geometry problem`}
              />
            </div>
            <p>
              Accuracy streaks are useful because averages can hide instability. A single high score
              matters less than a stable run of sessions above your normal control band.
            </p>
          </GuideSection>

          <GuideSection eyebrow="Practical use" title="A simple workflow that usually works">
            <ol className="space-y-2 pl-5 text-sm leading-7 text-textMuted">
              <li>Finish onboarding and make sure the keyboard family matches your real hardware.</li>
              <li>Run 3 to 5 adaptive lessons in normal or compact view.</li>
              <li>Take one 60-second typing test using a fixed source family.</li>
              <li>Open Profile and note the weak keys, hot zones, and accuracy streaks.</li>
              <li>Open Layouts only if the weakness looks structural rather than temporary.</li>
              <li>Return to Practice and let the planner remediate the same area for a few sessions.</li>
            </ol>
            <p>
              If typing-test speed is much higher than practice speed, that is usually normal.
              Practice is designed to keep surfacing weak keys and unfamiliar transitions instead of
              feeding you only comfortable text.
            </p>
          </GuideSection>
        </article>

        <aside className="space-y-5">
          <GuideSidebarCard title="Recommended first session">
            <p>Set the language and keyboard first, run a few lessons, then take a 60-second typing test.</p>
            <div className="grid gap-2">
              <Link href="/onboarding">
                <ActionButton tone="secondary" block>
                  Open setup
                </ActionButton>
              </Link>
              <Link href="/practice">
                <ActionButton tone="secondary" block>
                  Start practice
                </ActionButton>
              </Link>
              <Link href="/typing-test">
                <ActionButton tone="secondary" block>
                  Open typing test
                </ActionButton>
              </Link>
              <Link href="/profile">
                <ActionButton tone="secondary" block>
                  Open profile
                </ActionButton>
              </Link>
            </div>
          </GuideSidebarCard>

          <GuideSidebarCard title="Remember">
            <p>Practice teaches. Typing Test measures. Layouts explains. Profile confirms.</p>
            <p>
              The product stays local-only, so all of these pages are reading from the same browser
              storage instead of from an account or remote profile.
            </p>
          </GuideSidebarCard>

          <GuideSidebarCard title="Good defaults">
            <p>Use compact or normal view on desktop. Keep whitespace visible while learning. Disable space skipping only when you want stricter correction pressure.</p>
            <p>When you change layout or language, expect the profile numbers to diverge until enough new sessions are saved.</p>
          </GuideSidebarCard>
        </aside>
      </div>
    </PageFrame>
  );
}

export function MethodologyScreen() {
  return (
    <InformationScreen
      eyebrow="Methodology"
      title={`How ${productName} is built to teach`}
      description={`${productName} is not a random text generator with a timer attached. The training logic, scoring model, layout analysis, and product structure are designed to keep the app original, maintainable, and local-first while still delivering a full typing-website experience.`}
      introCards={[
        {
          label: "Adaptive",
          title: "Progression by evidence",
          body: "Unlock pressure, reinforcement, recovery, and stable review are all derived from recent per-character timing and accuracy rather than a fixed static ladder.",
          icon: <Sparkles className="h-5 w-5" />,
        },
        {
          label: "Scoring",
          title: "Clean local metrics",
          body: "Gross speed, net speed, accuracy, corrected errors, and per-character timing are calculated in the client and saved locally for later analysis.",
          icon: <DatabaseZap className="h-5 w-5" />,
        },
        {
          label: "Layouts",
          title: "Keyboard-aware analysis",
          body: "Layouts are not only visual skins. They expose row, hand, finger, modifier, and numpad metadata that feeds both explanation and training.",
          icon: <Compass className="h-5 w-5" />,
        },
      ]}
      sections={[
        {
          title: "Adaptive practice balances readability and pressure",
          body: `${productName} decides how much of a lesson should be recovery, reinforcement, bridge material, exploration, and fluency. That matters because lessons that are too pure become unrealistic, while lessons that are too mixed stop helping the exact weak keys that need attention.`,
          bullets: [
            "Recovery characters reappear after unstable or error-heavy sessions.",
            "Bridge characters keep drills readable while still biasing the prompt toward your current targets.",
            "Unlock previews appear only when the recent window is stable enough to absorb new characters.",
            "Stable review prevents older keys from silently decaying after they fall out of focus.",
          ],
        },
        {
          title: "Benchmark mode protects comparability",
          body: "Practice and benchmark sessions share the same typing engine, but benchmark mode narrows the objective. Its presets, progress UI, and report screen emphasize consistency and repeated comparison instead of live teaching. That separation helps you measure improvement instead of blending measurement and remediation into one loop.",
          bullets: [
            "Preset duration changes the pacing and expected fatigue profile of the test.",
            "Source families make it obvious whether you are testing natural language, symbol density, or code-heavy material.",
            "Matching-result comparisons stay scoped to the same environment so results remain interpretable.",
            "Review and replay controls are meant to support analysis, not inflate random speed runs.",
          ],
        },
        {
          title: "Layout analysis is language-aware",
          body: `A keyboard layout does not have one universal efficiency score. ${productName} runs analysis against a language-aware corpus so metrics such as row usage, alternation, same-hand share, and direct symbol access reflect the script and text patterns you actually practice.`,
          bullets: [
            "Home-row and alternation metrics help estimate flow-oriented efficiency.",
            "Same-hand and same-finger shares expose likely strain or awkward repetition zones.",
            "Direct symbol access matters more for code, shell, and punctuation-heavy training.",
            "Numpad and modifier metadata explain the suitability of a layout for spreadsheet or programmer-style drills.",
          ],
        },
      ]}
      sidebarTitle="What the numbers mean"
      sidebarBody="Use trends and distributions to see whether improvement is stable, use heatmaps to see where errors cluster, and use layout analysis to understand why the pattern may exist."
      sidebarLinks={[
        { href: "/practice", label: "View practice studio" },
        { href: "/layouts", label: "Compare layouts" },
        { href: "/progress", label: "Open stats lab" },
      ]}
    />
  );
}

export function PrivacyScreen() {
  return (
    <InformationScreen
      eyebrow="Privacy and local data"
      title="Everything personal stays on this device"
      description={`${productName} is intentionally designed without accounts, cloud sync, or backend user storage. The product still includes deep progress history, preference controls, and replayable reports because those systems are implemented locally in the browser.`}
      introCards={[
        {
          label: "Accounts",
          title: "None required",
          body: "There is no sign-in flow, no remote profile, and no server-side dependency for your personal progress or settings.",
          icon: <LockKeyhole className="h-5 w-5" />,
        },
        {
          label: "Storage",
          title: "Browser only",
          body: "Preferences, session records, analytics snapshots, and progression profiles are stored locally using browser storage mechanisms.",
          icon: <DatabaseZap className="h-5 w-5" />,
        },
        {
          label: "Control",
          title: "Reset anytime",
          body: "You can clear local history, restore defaults, or restart onboarding without contacting any external service.",
          icon: <Compass className="h-5 w-5" />,
        },
      ]}
      sections={[
        {
          title: "What is stored locally",
          body: `${productName} uses only client-side storage. Preferences and shell behavior live in localStorage, while saved sessions, analytics snapshots, content cache, and learner progression profiles live in IndexedDB. Small cookies are used only for lightweight local hints such as onboarding or install banners.`,
          bullets: [
            "Preferences cover theme, language, layout, device behavior, and adaptive tuning.",
            "Saved sessions preserve prompt text, timing metrics, attempt logs, and per-character performance.",
            "Analytics snapshots speed up deeper progress views without requiring a server.",
            "Learner progression profiles remember unlock state and recent adaptive readiness.",
          ],
        },
        {
          title: `What ${productName} does not do`,
          body: `${productName} does not upload your typing history, sync across devices, create an account, or require a backend to function. The richer product feel comes from local UI depth rather than remote infrastructure.`,
          bullets: [
            "No cloud sync means clearing browser storage removes the local history on that device.",
            "No account system means there is no central place to recover deleted or cleared data.",
            "No remote analytics pipeline means product exploration stays private to your browser.",
            "No server dependency means the app remains useful offline after installation and caching.",
          ],
        },
        {
          title: "How to manage your local footprint",
          body: "Open Settings whenever you want to restore defaults, clear history, change how the app behaves, or revisit onboarding. The privacy page is descriptive; the settings page is where the operational controls live.",
          bullets: [
            "Use Clear local history to remove sessions, analytics snapshots, progression profiles, and cached content.",
            "Use Restore defaults in Settings to reset preferences without adding remote complexity.",
            "Use Onboarding again when your language, device, or keyboard setup changes.",
            `Because everything is local, each browser profile behaves as its own self-contained ${productName} environment.`,
          ],
        },
      ]}
      sidebarTitle="Manage local data"
      sidebarBody="If you want to clear stored history, adjust privacy-related defaults, or re-run onboarding, the controls live in Settings."
      sidebarLinks={[
        { href: "/settings", label: "Open settings" },
        { href: "/progress", label: "Review local history" },
        { href: "/practice", label: "Return to practice" },
      ]}
    />
  );
}
