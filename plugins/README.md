# Lifexam assistant plugins

All three packages use the same source: `lifexam-eu/` for the manifest
template, MCP configuration, health-record skill, package README and MIT license,
and `translations.json` for listing copy. Do not edit generated ZIPs. Icons are maintained
in `lifexam-eu/assets/`.
The existing plugin identity (`lifexam-eu`), version, author, endpoint, and
read-only behavior are shared by all targets.

## Build and verify

Requires the repository's Node/pnpm dependencies and the `zip` and `unzip`
utilities on `PATH`.

```sh
pnpm plugins:build
pnpm plugins:check
```

The build generates and inspects `dist/plugins/lifexam-eu-chatgpt-<version>.zip`
and the generated ChatGPT folder. Claude and Grok Build are maintained as
complete repository packages under `claude/lifexam-eu/` and `grok/lifexam-eu/`.
The build validates those packages but never creates or overwrites them.
No Claude or Grok ZIP is produced.

`--check` checks the ChatGPT archive and all three folders against the current
shared source. It rejects missing, stale, extra, or duplicate entries. Builds use fixed
timestamps and file order, so identical inputs produce identical ZIPs with the
same ZIP tools. The ChatGPT output is replaced only after the repository packages pass
validation and its archive passes inspection.

To prepare another release:

```sh
# First update the maintained Claude and Grok manifest versions to 1.0.4.
pnpm plugins:build --version 1.0.4 --release-notes "Describe the change"
pnpm plugins:build --out-dir dist/custom-plugins
pnpm plugins:check --out-dir dist/custom-plugins
```

Version and release-note options update the shared manifest after a successful
build. They cannot be combined with `--check`. The old `chatgpt:plugin:build`
command and `chatgpt-plugin/` source have been replaced by this workflow.

## Package formats

| Component         | ChatGPT                                              | Claude and Grok Build              |
| ----------------- | ---------------------------------------------------- | ---------------------------------- |
| Manifest          | Root `plugin.json` (portable Agent Plugins format)   | `.claude-plugin/plugin.json`       |
| MCP configuration | Root `mcp.json`, transport `streamable-http`         | Root `.mcp.json`, transport `http` |
| Skill             | `skills/lifexam-health-record/SKILL.md`              | Identical file and path            |
| Icons             | `assets/lifexam-icon.png`, `assets/lifexam-logo.png` | Identical files and paths          |
| Package docs      | Root `README.md` and `LICENSE`                       | Identical files and paths          |

The ChatGPT manifest preserves `extensions.com.openai`, including listing,
review cases, release notes, and any supplied video URL or country settings.
The maintained Claude and Grok manifests use the display name `Lifexam` and
retain the `lifexam-eu` identity. Their version, description, author, icon, and
policy/support links must match the shared source; the builder checks them. OpenAI-specific review
and publication fields stay out of the Claude manifest. Claude release notes
are entered separately in its publication flow. The shared short description
is limited to 500 characters for Claude uploads; ChatGPT's longer listing text
remains available under `extensions.com.openai.interface.longDescription`.

The Grok Build package uses the same layout and bytes as the Claude package,
including `.claude-plugin/plugin.json` and `.mcp.json`. It is maintained separately
under `grok/lifexam-eu/` for repository-based distribution.
[Grok Build documents Claude Code plugin compatibility](https://docs.x.ai/build/features/skills-plugins-marketplaces#claude-code-compatibility).
This does not establish Grok Bot package installation support.

## Multiple MCP servers

`plugins/lifexam-eu/mcp.json` is the shared server map. Keep the required
`lifexam-eu` entry at `https://eu.lifexam.com/api/mcp`. To add another server,
add an entry under `mcpServers` with a unique lowercase kebab-case name,
`type: "streamable-http"`, and its verified HTTPS `url`. Add matching entries
to the maintained Claude and Grok `.mcp.json` files using `type: "http"`.
Run the build and checks.
No additional endpoint is configured by this change.

Claude and Grok Build must include every declared server, using transport
`http`; the build validates their configuration against the shared server map. ChatGPT receives only `lifexam-eu`; additional servers are deliberately
excluded because the
[OpenAI submission portal connects one server per plugin](https://developers.openai.com/plugins/deploy/submission#connect-and-scan-your-mcp-server).

Server declarations accept only `type` and `url`. URLs cannot contain embedded
credentials, query parameters, or fragments. Do not add tokens, headers, local
commands, or secrets. Authentication is completed in each host. Adding a server
does not establish its read-only scope: verify its tools and access controls,
and update the shared skill and all six listing translations if its capabilities
change the described behavior.

For Grok Build, run `grok --plugin-dir ./grok/lifexam-eu` from the repository
root. Use `/mcps` to inspect and authenticate the servers. Before claiming live
support, test sign-in, tool discovery, profile selection, record reads, withdrawn
consent, and language handling with a dedicated sample account. Grok Build has
no country targeting field established here; the OpenAI country allowlist is
not enforced by the Grok package.

## Languages

Listing subtitles and descriptions are maintained in
`plugins/lifexam-eu/translations.json`, keyed by locale (`en`, `it`, `fr`, `es`,
`pt`, `de`). The build uses this repository's
`SUPPORTED_LOCALES`, requires complete valid copy for every language, and adds
it to `extensions.com.openai.publication.translations` in the ChatGPT ZIP.
English also supplies its base listing fields. Release options update only the
manifest template, so translated copy is never duplicated into it.

The shared skill instructs ChatGPT, Claude, and Grok Build to follow the user's language
in English, Italian, French, Spanish, Portuguese, or German, preserving record
values, units, codes, dates, and medical meaning. Source quotations remain in
their original language. Model responses still need live verification.

OpenAI currently imports and retains translations but does not yet display them
in its directory. Claude has no documented translated-listing manifest field;
its listing metadata remains English. We do not add unsupported manifest fields
or make extra per-language plugins.

## Country availability

The shared manifest sets `extensions.com.openai.publication.countries` to the
30 countries enabled for Lifexam EU:

```text
AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO
```

The ChatGPT ZIP includes this allowlist. After upload, verify the imported
country availability in the OpenAI dashboard before publishing. The build
rejects a missing, empty, malformed, or duplicate country list; an empty list
would remove OpenAI's country restrictions.

Claude has no documented country-availability field in its plugin manifest.
Its repository package does not enforce these restrictions. Confirm an equivalent directory
restriction with Anthropic before publishing the Claude plugin; the shared
source records the intended audience, but cannot guarantee Claude distribution.

Country availability is separate from data residency. All three plugins connect to
`eu.lifexam.com`; restricting publication countries does not configure where
ChatGPT or Claude processes the information returned by Lifexam.

## Upload and review

The public release repository is
[Lifexam/lifexam-plugins](https://github.com/Lifexam/lifexam-plugins). It stores
the package folders `chatgpt/lifexam-eu/`, `claude/lifexam-eu/`, and
`grok/lifexam-eu/`. The shared source and builder live in this repository. Building updates the ChatGPT
folder and ZIP while validating the maintained Claude and Grok packages. Commit
all package folders with shared-source changes.

For Claude directory submission, use the release repository URL and plugin path
`claude/lifexam-eu`. The package includes its own README and license, as required
by the [directory checklist](https://claude.com/docs/plugins/pre-submission-checklist).
Commit and push release files only when authorized.

Upload the ChatGPT ZIP to the existing plugin in the
[OpenAI Plugins dashboard](https://platform.openai.com/plugins). Claude's public
directory currently asks for a plugin bundle hosted on GitHub and its repository
URL through the [directory submission portal](https://claude.com/resources/articles/build-plugins-for-claude).
Each platform has its own review and publication process; building does not
upload or publish anything. Grok Bot package installation and Grok directory
submission are not established by the Grok Build compatibility documentation.

For ChatGPT MCP review, add a real, reviewer-accessible walkthrough URL to
`plugin.json` at `extensions.com.openai.review.demo_recording_url`. Rebuild so
the URL is included in the ChatGPT ZIP. The URL is optional for building, but
required for MCP review. The existing five positive and three negative cases
are retained; run them against a dedicated reviewer account with sample data.
Reviewer credentials belong in the portal's secure fields, never the source
or ZIP. Confirm domain/publisher verification, OAuth connection, country
availability, policy coverage, and any remaining portal requirements before
submitting. The builder validates package structure and local content, not
live sign-in, video accessibility, or directory approval.

To validate the maintained Claude package locally, run
`claude plugin validate --strict ./claude/lifexam-eu` when Claude Code is available. This checks the manifest; verify OAuth and actual reads in each
host separately.

Format references:

- [OpenAI package format](https://developers.openai.com/plugins/build/plugins)
- [OpenAI submission requirements](https://developers.openai.com/plugins/deploy/submission)
- [Claude manifest reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude upload requirements](https://platform.claude.com/docs/en/manage-claude/plugins-api#upload-requirements)

## Maintaining repository packages

Claude and Grok are published from their committed repository folders. Keep their
README, license, skill, and icons identical to the shared source. Update their
`.claude-plugin/plugin.json` manifests for shared metadata/version changes and
their `.mcp.json` files for server changes. The builder reports stale or missing
files and leaves those folders unchanged. The ChatGPT folder remains generated.
