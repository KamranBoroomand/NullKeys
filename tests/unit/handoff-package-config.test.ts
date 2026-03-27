import path from "node:path";
import { pathToFileURL } from "node:url";

const handoffConfigModule = (await import(
  pathToFileURL(path.resolve(process.cwd(), "scripts/handoff-package-config.mjs")).href
)) as {
  excludedPaths: readonly string[];
  isBannedHandoffArchiveEntry: (entry: string) => boolean;
};

describe("handoff package config", () => {
  it("keeps required archive exclusions and banned-entry guards in sync", () => {
    expect(handoffConfigModule.excludedPaths).toEqual(
      expect.arrayContaining([
        ".git",
        ".next",
        "node_modules",
        "test-results",
        "__MACOSX",
        ".cache",
        "tmp",
        "temp",
        "output",
        "tsconfig.tsbuildinfo",
      ]),
    );

    expect(handoffConfigModule.isBannedHandoffArchiveEntry(".git/config")).toBe(true);
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("./node_modules/react/index.js")).toBe(
      true,
    );
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("test-results/ui/output.json")).toBe(
      true,
    );
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("__MACOSX/._archive")).toBe(true);
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("tmp/runtime/cache.txt")).toBe(true);
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("logs/build.log")).toBe(true);

    expect(handoffConfigModule.isBannedHandoffArchiveEntry("src/app/page.tsx")).toBe(false);
    expect(
      handoffConfigModule.isBannedHandoffArchiveEntry("public/content-packs/audit-summary.json"),
    ).toBe(false);
    expect(handoffConfigModule.isBannedHandoffArchiveEntry("scripts/create-handoff.mjs")).toBe(
      false,
    );
  });
});
