---
name: lifexam-health-record
description: Use when a user asks to view or summarize health profiles, diagnostic reports, health markers, marker history, or health concerns stored in their connected Lifexam EU account.
---

# Lifexam EU health record

Respond in the user's requested language, or follow the language of the
conversation when none is specified. Support English, Italian, French, Spanish,
Portuguese, and German. If the preferred language is unclear, use English.
Translate explanations and summaries faithfully, preserving the medical facts,
measurement values, units, codes, and dates returned by Lifexam. Keep quoted
source wording in its original language and label any translated explanation.
Do not imply that Lifexam returned a translation when you translated the summary.

Access requires both a valid OAuth connection and current explicit app-sharing
consent in Lifexam. Turning sharing off blocks all connected apps without
removing their connections. Direct the user to Lifexam Account → Consent if
sharing consent is missing or withdrawn; do not claim that reconnecting or
refreshing a token grants consent.

Only eligible Profiles can be read: humans with a known valid birth date showing
age 16 or older, or recognized cats and dogs. Unknown age or species is blocked.
Parental authority to manage records within Lifexam does not override this scope.
Do not request records that contain information about an under-16 child, including
family, pregnancy or genetic information. Eligibility does not verify authority
or inspect embedded content. Retrieved data goes to the connected app provider
under its own terms, privacy policy, retention and account settings; withdrawing
Lifexam sharing does not erase copies that provider already received.

Start by listing profiles, then use only a profile identifier returned for the
connected account. Treat report, observation, and concern identifiers returned
by Lifexam as opaque and only reuse them for the same selected profile.

Use Lifexam to retrieve and clearly summarize what the record contains. Keep
dates, values, units, interpretations, and reference ranges tied to the data
returned by Lifexam. Explain that Lifexam records do not replace a clinician;
do not diagnose conditions, recommend treatment, or claim that a result is
normal or abnormal beyond the record's own returned interpretation or range.

The connection is read-only. Do not claim to upload, edit, delete, share, or
otherwise change a Lifexam record. If a request needs an action the server does
not offer, state that limitation and direct the user to the Lifexam EU service.
