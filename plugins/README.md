# Lifexam assistant plugins

Both publication packages use the same source: `lifexam-eu/` for the manifest
template, MCP configuration, health-record skill, package README and MIT license,
and `translations.json` for listing copy. Do not edit generated ZIPs. Icons are maintained
in `lifexam-eu/assets/`.
The existing plugin identity (`lifexam-eu`), version, author, endpoint, and
read-only behavior are shared by both targets.

## Build and verify

Requires the repository's Node/pnpm dependencies and the `zip` and `unzip`
utilities on `PATH`.

```sh
pnpm plugins:build
pnpm plugins:check
```

The build generates and inspects:

- `dist/plugins/lifexam-eu-chatgpt-<version>.zip`
- `dist/plugins/lifexam-eu-claude-<version>.zip`

`--check` checks both archives' exact file lists and bytes against the current
source. It rejects missing, stale, extra, or duplicate entries. Builds use fixed
timestamps and file order, so identical inputs produce identical ZIPs with the
same ZIP tools. Output files are replaced only after both packages have built
and passed inspection.

To prepare another release:

```sh
pnpm plugins:build --version 1.0.4 --release-notes "Describe the change"
pnpm plugins:build --out-dir dist/custom-plugins
pnpm plugins:check --out-dir dist/custom-plugins
```

Version and release-note options update the shared manifest after a successful
build. They cannot be combined with `--check`. The old `chatgpt:plugin:build`
command and `chatgpt-plugin/` source have been replaced by this workflow.

## Generated formats

| Component         | ChatGPT                                              | Claude                             |
| ----------------- | ---------------------------------------------------- | ---------------------------------- |
| Manifest          | Root `plugin.json` (portable Agent Plugins format)   | `.claude-plugin/plugin.json`       |
| MCP configuration | Root `mcp.json`, transport `streamable-http`         | Root `.mcp.json`, transport `http` |
| Skill             | `skills/lifexam-health-record/SKILL.md`              | Identical file and path            |
| Icons             | `assets/lifexam-icon.png`, `assets/lifexam-logo.png` | Identical files and paths          |
| Package docs      | Root `README.md` and `LICENSE`                       | Identical files and paths          |

The ChatGPT manifest preserves `extensions.com.openai`, including listing,
review cases, release notes, and any supplied video URL or country settings.
The Claude manifest derives its identity, description, author, display name,
icon, and policy/support links from that same manifest. OpenAI-specific review
and publication fields stay out of the Claude manifest. Claude release notes
are entered separately in its publication flow. The shared short description
is limited to 500 characters for Claude uploads; ChatGPT's longer listing text
remains available under `extensions.com.openai.interface.longDescription`.

## Languages

Listing subtitles and descriptions are maintained in
`plugins/lifexam-eu/translations.json`, keyed by locale (`en`, `it`, `fr`, `es`,
`pt`, `de`). The build uses this repository's
`SUPPORTED_LOCALES`, requires complete valid copy for every language, and adds
it to `extensions.com.openai.publication.translations` in the ChatGPT ZIP.
English also supplies its base listing fields. Release options update only the
manifest template, so translated copy is never duplicated into it.

The shared skill instructs both ChatGPT and Claude to follow the user's language
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
Its ZIP does not enforce these restrictions. Confirm an equivalent directory
restriction with Anthropic before publishing the Claude plugin; the shared
source records the intended audience, but cannot guarantee Claude distribution.

Country availability is separate from data residency. Both plugins connect to
`eu.lifexam.com`; restricting publication countries does not configure where
ChatGPT or Claude processes the information returned by Lifexam.

## Upload and review

The public release repository is
[Lifexam/lifexam-plugins](https://github.com/Lifexam/lifexam-plugins). It stores
the generated package contents in `chatgpt/lifexam-eu/` and
`claude/lifexam-eu/`. The shared source and builder live in this repository. Building updates both
platform folders as well as the ZIPs. Commit the generated folders together with
the source change so the directory sees the same version as the release archives.

For Claude directory submission, use the release repository URL and plugin path
`claude/lifexam-eu`. The package includes its own README and license, as required
by the [directory checklist](https://claude.com/docs/plugins/pre-submission-checklist).
Commit and push release files only when authorized.

Upload the ChatGPT ZIP to the existing plugin in the
[OpenAI Plugins dashboard](https://platform.openai.com/plugins). The Claude
ZIP is valid for personal or organization plugin uploads. Claude's public
directory currently asks for a plugin bundle hosted on GitHub and its repository
URL through the [directory submission portal](https://claude.com/resources/articles/build-plugins-for-claude).
Each platform has its own review and publication process; building a ZIP does
not upload or publish it.

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

To validate the generated Claude package locally, extract it into an empty
directory and run `claude plugin validate --strict <directory>` when Claude Code
is available. This checks the manifest; verify OAuth and actual reads in each
host separately.

Format references:

- [OpenAI package format](https://developers.openai.com/plugins/build/plugins)
- [OpenAI submission requirements](https://developers.openai.com/plugins/deploy/submission)
- [Claude manifest reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude upload requirements](https://platform.claude.com/docs/en/manage-claude/plugins-api#upload-requirements)
