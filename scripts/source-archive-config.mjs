export function sourceArchivePrefix(commitSha) {
  if (!/^[a-f0-9]{40}$/u.test(commitSha)) {
    throw new Error("A full lowercase commit SHA is required for a source archive.");
  }
  return `nullkeys-source-${commitSha.slice(0, 12)}/`;
}

export function normalizeArchiveEntry(entry) {
  return entry.trim().replace(/^\.\//u, "");
}

export function verifySourceArchiveEntries({ entries, prefix, trackedFiles }) {
  const normalizedEntries = entries.map(normalizeArchiveEntry).filter(Boolean);
  const archivedFiles = normalizedEntries
    .filter((entry) => !entry.endsWith("/"))
    .map((entry) => {
      if (!entry.startsWith(prefix)) {
        throw new Error(`Archive entry is outside the stable prefix: ${entry}`);
      }
      return entry.slice(prefix.length).replace(/\/$/u, "");
    })
    .filter(Boolean)
    .sort();
  const expectedFiles = [...trackedFiles].sort();

  if (archivedFiles.length !== expectedFiles.length) {
    throw new Error(
      `Archive contains ${archivedFiles.length} files; expected ${expectedFiles.length} tracked files.`,
    );
  }
  for (const [index, expectedFile] of expectedFiles.entries()) {
    if (archivedFiles[index] !== expectedFile) {
      throw new Error(
        `Archive content mismatch: found ${archivedFiles[index] ?? "<missing>"}; expected ${expectedFile}.`,
      );
    }
  }

  return { archivedFileCount: archivedFiles.length };
}
