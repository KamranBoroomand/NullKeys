# Content Sources

NullKeys ships browser-served content packs under `public/content-packs/`. Those packs are produced from tracked source files with:

```bash
npm run content:packs
```

The generated manifest records a stable content version and source hash. Running the command with unchanged tracked inputs should leave `public/content-packs/` byte-for-byte unchanged.

## Tracked Source Inputs

| Source input | Purpose | Current provenance status |
| --- | --- | --- |
| `src/content/dictionaries/seed-language-content.generated.ts` | Empty baseline content slot retained for pack-builder compatibility | Contains no bundled words or passages. |
| `src/content/dictionaries/language-layered-lexicons.ts` | Vocabulary and passages used by the pack builder | Repository-maintained source content. |
| `src/content/languages/language-text-metadata.ts` | Language metadata for rendering, direction, and input expectations | Repository-maintained metadata. |
| `src/lib/text/language-text-normalization.ts` | Normalization and segmentation rules used during pack production | Repo-maintained implementation. |

## Release Policy

The bundled lexicons and templates are suitable for redistribution as project-written content under the repository license.

English, Persian, and Russian are the only v1 product languages and the only languages emitted in the public manifest. Each language has one common-word pack, one phrase pack, and one passage pack. The source schema can represent additional languages without publishing them.

Automated checks cover exact and normalized duplicates, repeated four-word sequences, repeated openings, training-related meta vocabulary, malformed spacing, script purity, and entry length. Human editorial review is not recorded by the generated audit.

## Transformation Steps

1. `scripts/build-content-packs.mjs` combines the tracked baseline content slot, supplemental lexicons, language metadata, and normalization helpers.
2. The pack build emits tiered JSON payloads, `manifest.json`, and audit summaries under `public/content-packs/`.
3. The manifest `buildId` and audit `sourceHash` are derived from tracked source content and the content pack version.

No learner data is included in content packs.
