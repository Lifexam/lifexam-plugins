# Lifexam EU

Connect your Lifexam EU account to explore your health records through
conversation. This plugin provides read-only access to eligible Profiles,
diagnostic reports, health markers and their history, and health concerns. It
connects to Lifexam's remote MCP server at `https://eu.lifexam.com/api/mcp` and
includes a skill that guides the assistant in reading and summarizing records.

## Connect your account

Install the plugin in your assistant, then follow its OAuth sign-in flow for
Lifexam EU. You need a Lifexam account with connected-app access and must
separately enable app-sharing consent in Lifexam under **Account → Consent**.
Signing in or reconnecting does not grant that consent.

Start by asking the assistant to list your Profiles, then choose one of the
returned Profiles before requesting its records. For example:

- "Show the profiles in my Lifexam account."
- "Summarize the latest reports for my selected Lifexam profile."
- "Show my latest health markers and any recent trends."

## Eligible records and limitations

Human Profiles require a known valid birth date showing an age of 16 or older.
Cat and dog Profiles are also eligible. Unknown age or species is blocked.
Do not request records containing information about children under 16, including
information embedded in family, pregnancy, or genetic records.

The plugin reads existing records. It cannot upload documents, edit or delete
records, diagnose a condition, or recommend treatment. Summaries do not replace
professional medical advice. Responses follow the user's language in English,
Italian, French, Spanish, Portuguese, or German while preserving record values,
units, dates, codes, and medical meaning.

## Data handling

The package contains instructions, public connection configuration, and icons.
It runs no local MCP server or hooks and bundles no credentials or health records.
The remote server checks the connected account's access and current sharing
consent before returning records.

When requested, retrieved records are sent to the connected assistant provider
under that provider's terms, privacy policy, retention, and account settings.
You can withdraw app-sharing consent in Lifexam to block future retrieval by all
connected apps without disconnecting them. Withdrawal does not erase copies
already received by the provider.

## Links and license

- [Lifexam EU](https://eu.lifexam.com/en)
- [Privacy policy](https://eu.lifexam.com/en/privacy-policy)
- [Terms and conditions](https://eu.lifexam.com/en/terms-and-conditions)
- [Support](https://eu.lifexam.com/en/privacy-policy#15-contact)

The files in this plugin package are distributed under the MIT license in
`LICENSE`. This license does not cover the hosted Lifexam application or grant
access to its service or users' records.

## Grok Build installation

This package also ships as `grok/lifexam-eu/` in the release repository. Grok Build
loads the Claude-compatible plugin format. From the repository root, run:

```sh
grok --plugin-dir ./grok/lifexam-eu
```

Open `/mcps` to inspect the Lifexam connection and complete OAuth sign-in.
Enable app-sharing consent in Lifexam separately, then list and select a Profile.
Package checks do not verify live Grok sign-in or record retrieval. This package
targets Grok Build; installation in Grok Bot has not been verified.
