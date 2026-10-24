# Lifexam plugins

This repository owns the shared plugin source, builder, tests, platform plugin
folders, and release workflow. It builds independently of the Lifexam application.

- Shared source lives in `plugins/lifexam-eu/`. Maintain `claude/lifexam-eu/`
  as a complete committed repository package, synchronized with the shared
  source. Grok Build loads this Claude package directly; do not add a Grok copy.
- `pnpm plugins:build` validates Claude without creating or overwriting its
  folder. It generates only `chatgpt/lifexam-eu/` and the ChatGPT release ZIP.
  Do not edit the generated ChatGPT folder independently.
- Maintain listing copy in all six languages in `translations.json`.
- Preserve the `lifexam-eu` identity, read-only scope, and MCP endpoint unless the
  user requests a coordinated platform migration.
- Keep real health data, reviewer credentials, tokens, and private keys out of
  every tracked file and package. Use platform submission fields for credentials.
- The MIT license covers this repository's files; it does not cover the hosted
  Lifexam application or grant access to health records.
- Before committing or pushing, run `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm plugins:build`, and `pnpm plugins:check`. Include updated repository packages and the
  regenerated ChatGPT folder with source changes.
- Do not commit, push, create release tags, publish releases, or open PRs without
  an explicit request. A pushed `v<version>` tag publishes the verified ChatGPT ZIP
  through the release workflow. A branch push, PR, or manual run only verifies.

See `README.md` for releases and `plugins/README.md` for package details.
