# Lifexam plugins

Official release packages for the Lifexam EU integrations with Claude,
ChatGPT, and Grok Build. All packages provide read-only access to eligible Lifexam
health records through the same remote MCP server and include the same health-record
skill. The current package version is **1.0.4**.

## Packages

| Platform             | Plugin folder                                        | Distribution                                                                               |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Claude (Lifexam)     | [`claude/lifexam-eu`](claude/lifexam-eu/README.md)   | Submit this repository and plugin path `claude/lifexam-eu` to the Claude developer portal. |
| ChatGPT              | [`chatgpt/lifexam-eu`](chatgpt/lifexam-eu/README.md) | Upload the ChatGPT ZIP to the OpenAI Plugins dashboard.                                    |
| Grok Build (Lifexam) | [`grok/lifexam-eu`](grok/lifexam-eu/README.md)       | Repository package; load locally with `grok --plugin-dir ./grok/lifexam-eu`.               |

These folders contain complete installable packages, including their own README,
license, connection configuration, skill, and icons. The Claude and Grok Build configuration is
`.mcp.json`, with its manifest in `.claude-plugin/plugin.json`. The ChatGPT
configuration and manifest are `mcp.json` and `plugin.json` at the package root.

## Using Lifexam

You need a Lifexam EU account with connected-app access. Follow the assistant's
OAuth sign-in flow and separately enable app-sharing consent in Lifexam under
**Account → Consent**. List your Profiles and select one before requesting its
records. Human Profiles must have a known valid age of 16 or older; cats and dogs
are also eligible. Unknown age or species is blocked.

This integration cannot upload or change records, diagnose a condition, or
recommend treatment. Read each package's README for its full scope and data
handling details. Retrieved records go to the connected assistant provider under
that provider's privacy terms; withdrawing consent blocks future retrieval but
does not erase copies the provider already received.

## Build and verify

This repository owns the shared source in `plugins/lifexam-eu/`, the builder and
its tests, the maintained Claude/Grok plugin folders, the generated ChatGPT
folder, and the release workflow. It builds
independently, using Node.js 24, pnpm 11.22.0, and the `zip` and `unzip` utilities.
The source includes its own icons and the six supported listing languages.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm plugins:build
pnpm plugins:check
```

Builds produce only the ChatGPT ZIP in `dist/plugins/` and refresh
`chatgpt/lifexam-eu/`. The committed `claude/lifexam-eu/` and `grok/lifexam-eu/`
folders are maintained directly: builds validate them without creating or
overwriting them. Checks inspect exact file
inventories and bytes, including README and LICENSE. Files are archived in a
fixed order with fixed timestamps. The ZIP root contains the package contents,
without an enclosing platform or plugin directory. Unexpected files in generated
folders are rejected rather than included in a release.

Edit the shared source and keep the maintained Claude/Grok packages synchronized.
Do not edit the generated ChatGPT folder independently.
Listing translations live in `plugins/lifexam-eu/translations.json`; icons live
in `plugins/lifexam-eu/assets/`. See [package details](plugins/README.md).

To check the Claude manifest locally when Claude Code is installed:

```sh
claude plugin validate --strict ./claude/lifexam-eu
```

## Grok Build and multiple MCP servers

The Grok package uses the Claude-compatible format documented by
[Grok Build](https://docs.x.ai/build/features/skills-plugins-marketplaces#claude-code-compatibility).
Load it from the repository root:

```sh
grok --plugin-dir ./grok/lifexam-eu
```

Use `/mcps` to inspect connections and complete OAuth. Live authentication and
record reads must be verified in Grok before claiming tested support. This
package targets Grok Build; Grok Bot installation is not yet verified.

Declare additional named HTTPS servers in `plugins/lifexam-eu/mcp.json`.
Keep all declared servers in the maintained Claude and Grok Build configs;
the builder verifies they match the shared source.
ChatGPT receives only `lifexam-eu` because its submission portal connects one
server per plugin. The existing Lifexam endpoint remains required. See
[server configuration details](plugins/README.md#multiple-mcp-servers).

## Releasing

The GitHub Actions workflow verifies pull requests, pushes to `main`, and manual
runs. A pushed tag such as `v1.0.4` also creates a GitHub Release with the ChatGPT ZIP
and `SHA256SUMS`. The tag must match the shared manifest version, and the
committed platform folders must match the build. The workflow uses GitHub's
repository token; no bot private key or additional publishing secret is needed.
Manual runs only verify and do not publish.

To prepare a new version, for example:

```sh
# First update the Claude and Grok manifest versions to 1.0.5.
pnpm plugins:build --version 1.0.5 --release-notes "Describe the changes"
pnpm typecheck
pnpm lint
pnpm test
pnpm plugins:check
```

Commit the shared source, maintained Claude/Grok packages, and regenerated
ChatGPT folder together. Only the ChatGPT ZIP is attached to Releases. When authorized
to publish a GitHub release, create a tag on the verified release commit and push
that tag:

```sh
git tag -a v1.0.5 -m "Lifexam EU 1.0.5"
git push origin v1.0.5
```

Never reuse a published version or move its release tag. An existing release is
not overwritten on a workflow rerun. Version updates belong to the shared plugin
manifest; the root `package.json` version is tooling metadata, not the release
version.

## Publication

- [Claude developer portal](https://claude.ai/directory/manage): choose **Plugin
  bundle**, repository `Lifexam/lifexam-plugins`, and path `claude/lifexam-eu`.
  Submit the Lifexam remote server as an **MCP connector** separately as well.
- [OpenAI Plugins dashboard](https://platform.openai.com/plugins): upload the
  ChatGPT ZIP to the existing `lifexam-eu` plugin.

Claude and Grok use this repository URL and their respective plugin paths for
distribution; Grok directory submission requirements still need verification.
Creating a GitHub Release does not publish a plugin in an assistant directory. Complete each
platform's authentication tests, review, and publication process separately.
Use a dedicated reviewer account with sample data and enter its credentials only
in the platform's secure submission fields.

The ChatGPT manifest includes Lifexam EU's 30-country availability allowlist.
Claude has no documented country-availability field in its plugin manifest;
confirm equivalent distribution restrictions with Anthropic before publication.
Country availability is separate from where the assistant provider processes
returned data.

References: [Claude submission](https://claude.com/docs/plugins/submit),
[Claude checklist](https://claude.com/docs/plugins/pre-submission-checklist), and
[OpenAI submission](https://developers.openai.com/plugins/deploy/submission).

## Links and license

- [Lifexam EU](https://eu.lifexam.com/en)
- [Privacy policy](https://eu.lifexam.com/en/privacy-policy)
- [Terms and conditions](https://eu.lifexam.com/en/terms-and-conditions)
- [Support](https://eu.lifexam.com/en/privacy-policy#15-contact)

The files in this repository are distributed under the MIT license, copyright
2026 Lifexam Ltd. See [LICENSE](LICENSE); a copy is included in each package.
The license does not cover the hosted Lifexam application or grant access to the
service or users' records.
