import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/features/developer-tools/devtools-screen", () => ({
  DeveloperToolsScreen: () => null,
}));

const devtoolsPageModulePromise = import("@/app/devtools/page");
const mutableProcessEnv = process.env as Record<string, string | undefined>;

describe("devtools page", () => {
  afterEach(() => {
    delete mutableProcessEnv.NODE_ENV;
    notFoundMock.mockClear();
  });

  it("omits page metadata outside development", async () => {
    mutableProcessEnv.NODE_ENV = "production";
    const devtoolsPageModule = await devtoolsPageModulePromise;

    expect(devtoolsPageModule.generateMetadata()).toEqual({});
  });

  it("throws notFound outside development", async () => {
    mutableProcessEnv.NODE_ENV = "production";
    const devtoolsPageModule = await devtoolsPageModulePromise;

    expect(() => devtoolsPageModule.default()).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("keeps development metadata available while iterating locally", async () => {
    mutableProcessEnv.NODE_ENV = "development";
    const devtoolsPageModule = await devtoolsPageModulePromise;
    const metadata = devtoolsPageModule.generateMetadata();

    expect(metadata.title).toBe("Developer Tools");
    expect(metadata.description).toContain("development-only utilities");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
