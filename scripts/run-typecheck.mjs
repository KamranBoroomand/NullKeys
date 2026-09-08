import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

rmSync("tsconfig.tsbuildinfo", { force: true });

for (const command of [
  ["next", "typegen"],
  ["tsc", "--noEmit", "--incremental", "false"],
]) {
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
