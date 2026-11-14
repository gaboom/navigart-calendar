# The Google API key: how it is handled and why

Everything about the key in one place: what it is, why it is masked in the source, how to change it, what to do when something is wrong, and what we learned. Short rules for agents are in [`AGENTS.md`](AGENTS.md) ("API key"); the decisions are SPEC D1 to D4.

**Never write the plain key anywhere** (source, docs, issues, chat, logs, screenshots, commit messages). This file does not contain it either. The masked form in the source and the shortened form `AIza…7NN8` (first and last four characters) are fine.

## 1. What it is

- A Google Calendar API v3 **browser key**, in the Google Cloud project "Navigart", key name "Navigart.net OceanSailing".
- The browser of every visitor calls `https://www.googleapis.com/calendar/v3/calendars/<id>/events?key=...` directly. There is no backend (D1, D2), so the key is **necessarily visible** to everyone: in the shipped JS and in the browser's network tab. The older inline version on WordPress also exposes it in the page source.
- It only works because the club calendar is **public**. If the calendar is made private, the key-only access stops working.

## 2. Security model (read this first)

| Layer | What it does | Is it security? |
|---|---|---|
| Key restrictions in Google Cloud: **API restriction** = Calendar API only; **website restriction** = HTTP referrers (list below) | Google refuses the key for any other API and for requests whose `Referer` is not allowed | **Yes, the only real protection.** It limits what a stolen key can do and where it works. |
| Quota cap and usage alert on the key | Limits the damage and tells us early if the key is abused | Yes, a safety net (see "To do" in section 6) |
| XOR + base64 masking in the source | Stops secret scanners from flagging the repo, and casual copy and paste from the file | **No.** Camouflage only, anyone can decode it in seconds. This is not encryption. |

Consequences:
- Someone who copies the key can use it only for the Calendar API, and a browser request from another website is refused. A script or `curl` that sets its own `Referer` header can still use it, within the quota. That is why the cap and the alert matter, and why the calendar must hold nothing private.
- Never remove or widen the restrictions "to make a test work". Use an allowed host (`localhost`, `127.0.0.1`) or test mode instead.

Allowed referrers (keep in sync with `AGENTS.md`, `SPEC.md` sections 7 and 8, and the README "Requirements" section):
`*.navigart.net/*`, `navigart.net/*`, `oceansailing.meder.hu/*`, `localhost/*`, `127.0.0.1/*`, `gaboom.github.io/*` (GitHub Pages fallback address). Referrers are port-less.

## 3. How the masking works

In `src/oceansailing-calendar.js`:
```
var MASK = 'oceansailing';
var API_KEY_MASKED = '<base64 of (key XOR MASK repeated)>';
function unmask(s, k) { ...atob, XOR each char with k... }   // decoded at run time
```
- `API_KEY_MASKED` is the plain key XORed with `MASK` (repeated over the length), then base64 encoded.
- The key is **part of the codebase**: no `.env`, no environment variable, no build-time injection (D4).
- `scripts/mask.mjs` creates the masked value; `scripts/build.mjs` checks it (next section).

## 4. Build checks and commands

`npm run build` (`scripts/build.mjs`):
1. Takes the shipped `unmask` function **out of the source text** with a regular expression and runs it on the shipped `API_KEY_MASKED`, so it checks what visitors actually get, not a copy of the logic.
2. Fails unless the result looks like a Google key (`AIza` + 35 characters of `A-Za-z0-9_-`).
3. Fails if the plain key appears in any file in `docs/`.
4. Prints the key shortened: `Key decoded from the built file: AIza…7NN8`. Compare that with the key's end in Google Cloud to be sure the deployed key is the intended one.

| Command | Purpose |
|---|---|
| `npm run build` | build, check, print the shortened key |
| `npm run mask -- <key>` | print the masked value for a new key |
| `npm run build:show-key` | print the **full** key. Owner only, on the owner's own machine. **Agents never run it**, and never in CI, shared terminals or screen shares. |

## 5. Procedures

### Rotate or replace the key
1. Google Cloud console > APIs & Services > Credentials: create the new key (or use "Regenerate" if available). Set both restrictions at once (Calendar API; website list above). Check that the key works before deleting the old one.
2. On your own machine: `npm run mask -- <new key>`. Paste the output into `API_KEY_MASKED`. Do not paste the key itself into chat or tickets; if it leaks, rotate again.
3. `npm run build`, confirm the shortened key in the output is the new one, `npm run dev` and run the real-data smoke test at `http://localhost:8765/` (no `?test`).
4. Commit and push; wait for GitHub Pages (1 to 15 minutes) and the script cache (`max-age=600`, about 10 minutes). Check on the live `/naptar/`.
5. Anything else that still carries the old key (the older inline snippet in the `osse-wip` repo, other WordPress pages) keeps working only until the old key is deleted. Delete the old key last. Remember that old versions stay readable in git history and in the published page revisions; the old key must be deleted in Google Cloud, not only replaced.

### Add an allowed domain
Google Cloud console > APIs & Services > Credentials > the key > Application restrictions > Websites > add `https://example.org/*` style entries (the console may want the form `example.org/*` or `https://example.org/*`; keep the format of the existing entries). Changes take a few minutes to apply. Update the four lists named in section 2. Alternatively use the iframe, which needs no change (README, "Requirements and the referrer policy").

### Verify the restrictions still hold
- From the real site: Network tab, `googleapis.com/calendar` must be 200.
- From a non-allowed origin the same call must be refused. In a browser: open any other site, console: `fetch('https://www.googleapis.com/calendar/v3/calendars/oceansailingse%40gmail.com/events?key=...')` must give 403 "referer ... blocked". Do this on your own machine and never paste the real key anywhere shared.
- Same key for another Google API (for example the Maps API) must be refused too (API restriction).

### The key is abused or leaked
1. In Google Cloud, **delete or regenerate** the key (the console shows usage graphs per key; look for a spike or unknown traffic).
2. Create a new key with restrictions (rotate procedure above).
3. Check that no private data is in the calendar (it is public by design, so nothing private should be there).
4. Note what happened in this file.

## 6. Best practices and lessons learned

Maintainability
- **One place.** The key lives only in `API_KEY_MASKED`. Do not copy it into the README, tests, fixtures or WordPress notes.
- **Do not reformat `unmask`.** The build finds it with a regular expression (`function unmask(` up to the first line that is exactly two spaces plus `}`). If you move or reindent the function, the build fails loudly (good); fix the regular expression or keep the layout.
- **Do not change `MASK` without re-masking.** `MASK` and `API_KEY_MASKED` belong together; changing one needs `npm run mask` again.
- **Keep the build checks.** They are the only thing that notices a wrong paste (not a Google-shaped key) or a plain key reaching `docs/`.
- The key's referrer list is duplicated in four documents; update all of them in the same change.

Hygiene
- The build prints only `AIza…abcd` on purpose. Earlier it printed the full key into terminal logs (and so into an AI assistant's session history). That was changed. A shortened print is enough to compare and leaks nothing usable.
- PowerShell swallows the first `--` in `npm run build -- --show-key`; that is why `build:show-key` exists as its own script.
- **Browser testing tools print request URLs including `key=...`.** Playwright's network request list does this. Filter, or strip `key=` before printing (see `TESTING.md`). Do not paste network logs or HAR files anywhere.
- Screenshots of the network tab or the Google Cloud credentials page can show the key. Crop or avoid.
- We started with the key in a git-ignored `.env.local` plus build-time injection. That was dropped: the published file contains the masked key anyway, so the extra moving parts (env files, lookups, "where is the key") bought nothing. An old `.env.local` containing the plain key was deleted; do not recreate it.
- A key pasted into chat or an email is considered exposed. Because ours is referrer-restricted, that is tolerable, but rotate when in doubt.
- GitHub's secret scanning recognises Google API keys. The masked form is not flagged; a plain one would be (and push protection may block the push). If a plain key was ever committed, treat it as leaked: rotate, do not just remove it in a later commit.

Operations
- **Set a quota cap and a usage alert** on the key (Google Cloud console > APIs & Services > Calendar API > Quotas, and Monitoring or Billing alerts). Not done yet; owner action. Pick a cap far above real traffic but far below a billing problem. The Calendar API has no direct cost at normal quota, but an alert tells you when the key is misused.
- Re-check the website list after any new domain or sub-domain appears. A 403 on a new host is almost always this, or a `no-referrer` policy (README).
- The key name and project are listed above so a successor knows where to look; access to the Google Cloud project belongs to the owner, not to this repo.
- Keep the calendar public. If the club ever wants a private calendar, the architecture must change (a backend that holds a secret, D1/D2 alternatives in SPEC).
