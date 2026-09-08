import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const staticAssetRoot = path.resolve(process.cwd(), ".next/static");
const maxStaticAssetBytes = 8 * 1024 * 1024;

function collectSizeBytes(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }

  const stats = statSync(filePath);

  if (!stats.isDirectory()) {
    return stats.size;
  }

  return readdirSync(filePath).reduce(
    (sum, entry) => sum + collectSizeBytes(path.join(filePath, entry)),
    0,
  );
}

const staticAssetBytes = collectSizeBytes(staticAssetRoot);

if (staticAssetBytes > maxStaticAssetBytes) {
  process.stderr.write(
    `Static asset budget exceeded: ${staticAssetBytes} bytes > ${maxStaticAssetBytes} bytes\n`,
  );
  process.exit(1);
}

console.log(`Static asset budget: ${staticAssetBytes} bytes / ${maxStaticAssetBytes} bytes`);
