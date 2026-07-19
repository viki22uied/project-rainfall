# AppSail — deploy notes

## Cloud deploy: FIXED (2026-07-18)

**Root cause of "Execution failed. Please check the startup command or port.":**
AppSail's cloud build does **not** run `pip install` — dependencies must be vendored
into the build directory (alongside `app.py`) *before* `catalyst deploy` uploads it, via
a local `predeploy` lifecycle script. Ours had none; `flask`/`zcatalyst-sdk` were only
listed in `requirements.txt`, which nothing ever installed. The container started,
`python3 -u app.py` hit `ModuleNotFoundError` immediately, the process exited before
binding a port, and Catalyst reported the generic "check startup command or port" error
— which is what made it look like a config/port problem when the real cause was a
missing install step. This explains every earlier symptom: the *minimal bare-Flask*
repro failed identically (also missing the vendoring step), and switching stacks
(`python_3_9` ↔ `python_3_10`) made no difference (installation, not runtime version,
was the blocker).

**Fix:** each `appsail/*/app-config.json` now has a `predeploy` script that vendors
`flask` + `zcatalyst-sdk` (and their transitive deps) into the build directory as
Linux/cp310 wheels, cross-downloaded from this Windows machine via pip's
`--platform manylinux2014_x86_64 --implementation cp --python-version 3.10 --abi cp310
--only-binary=:all:` flags (matches the target container's Python 3.10/x86_64 Linux
runtime, not the local dev machine's). `catalyst deploy` runs this automatically before
upload (`--ignore-scripts` to skip it). Vendored packages are gitignored — see
`.gitignore` — regenerated fresh on every deploy, never committed.

Verified live in the cloud (2026-07-18): all four services respond on `/health` and do
real work — ER `/resolve` and `/candidates` (against the real Data Store), MO `/cluster`
(4 clusters found), analytics `/risk`, legal `/seal` (real SHA-256 + persisted evidence
record). Cloud URLs:
- `https://entityresolution-50044055970.development.catalystappsail.in`
- `https://moclustering-50044055970.development.catalystappsail.in`
- `https://analytics-50044055970.development.catalystappsail.in`
- `https://legal-50044055970.development.catalystappsail.in`

These are wired into the deployed Node function via `APPSAIL_ER/MO/ANALYTICS/LEGAL` env
vars in `functions/rainfall-node-api/catalyst-config.json` (committed — they're just
public service URLs, not secrets).

**One CLI gotcha along the way:** a hand-written APIG rule for the Node gateway
(`catalyst-user-rules.json`) initially 404'd/`INVALID_URL`'d in the cloud even though the
shape looked plausible. The console silently normalizes/backfills `target`/`target_id`
for function rules on `catalyst deploy --only apig` — running `catalyst pull apig
--overwrite` afterwards shows the corrected, authoritative version. `catalyst-user-rules.json`
in this repo now reflects that pulled, console-verified shape.

To redeploy from scratch on a new machine:
```bash
catalyst config:set python3_10.bin="<path-to-Python310>/python.exe"
# python3.exe copy next to python.exe (AppSail's startup command literally runs `python3`)
export PATH="<Python310 dir>:$PATH"
catalyst deploy --only "appsail:entityresolution,appsail:moclustering,appsail:analytics,appsail:legal"
catalyst deploy --only "functions:rainfall-node-api,client,apig"
```

## Local (`catalyst serve`) — unaffected, still works

All four AppSail services also run locally via `catalyst serve` against the **real**
cloud Data Store — useful for fast iteration without redeploying. See
[`serve-local.sh`](../serve-local.sh), then open `http://localhost:3000/app/index.html`.
The local path is unrelated to the vendoring fix above (`catalyst serve` uses the
system-installed `flask`/`zcatalyst-sdk`, not the vendored copies) and needed its own
one-time setup on this Windows box:
- Stack `python_3_10` (we have 3.10, not the docs' default 3.9).
- `catalyst config:set python3_10.bin="…/Python310/python.exe"`.
- A `python3.exe` copy next to `python.exe` (same startup-command quirk as above).
- `pip install flask zcatalyst-sdk` into that Python 3.10 (system install, not vendored).
- **Real bug fixed:** the SDK method is `zcql().execute_query(...)`, not
  `execute_zcql_query` (was wrong in every `catalyst_io.py` — would have failed in the
  cloud too, independent of the deploy blocker above).

## Auth: HACKATHON_DEMO_MODE (2026-07-18)

There is no login UI, and no real Catalyst Auth accounts exist for the 4 demo users —
Catalyst Auth setup is console-only and we don't have console access for this build. The
gateway (`functions/rainfall-node-api/index.js`) always prefers a real authenticated
Catalyst user; `HACKATHON_DEMO_MODE=true` (committed in `catalyst-config.json`, on in
both local and production) is a **narrow, labeled exception** for this submission only:
a caller may assert one of the 4 seeded `@rainfall.demo` emails (regex-locked to that
domain — not an arbitrary email) when there's no real session. The frontend shows a
permanent banner next to the "Restricted" classification chip: *"Hackathon demo · role
switch unauthenticated."*

This intentionally re-opens the identity-assertion surface an earlier security pass had
closed. Judged acceptable here because: the four accounts are clearly fake demo users,
not real officers; the alternative was a production build with no working role-based
demo at all (nothing to actually judge); and the tradeoff is disclosed on-page, not
hidden. **A real production rollout must replace this with actual Catalyst Auth login
before removing the banner** — see the RBAC/audit code itself, which is otherwise
unaffected by this and enforces exactly the same role scoping either way.

## Voice input: Groq Whisper via the gateway (2026-07-18)

The mic button records audio in the browser and sends it to the gateway's `transcribe`
action, which forwards it server-side to Groq's Whisper API (`whisper-large-v3-turbo`)
and returns the transcribed text — which then goes straight into the query box and gets
asked, same as before. This replaced the old browser-only Web Speech API path so voice
input runs through our own infrastructure end to end and works in any browser with a
microphone, not just Chrome/Edge.

**`GROQ_API_KEY` is a real secret and is deliberately NOT in `catalyst-config.json`** —
unlike the AppSail URLs or `HACKATHON_DEMO_MODE`, this one can't be committed to a public
repo. Two places it needs to be set, neither of them a tracked file:
- **Local**: put `GROQ_API_KEY=...` in a gitignored `.env.local` at the repo root.
  `serve-local.sh` reads it and injects it into a throwaway copy of the deployed
  function's config for that run only, restoring the clean committed file on exit (same
  pattern the `HACKATHON_DEMO_MODE` flag used before it became permanent).
- **Production**: set it via the Catalyst console — Functions → rainfall-node-api →
  Configuration → Environment Variables — for the Development/Production environment
  actually in use. This is a manual, one-time step; there's no CLI command for it
  (`catalyst functions:config` only supports `--memory`), and console access isn't
  available from this build environment, so whoever has console access needs to do it.
  Until it's set, `/transcribe` fails cleanly with "voice transcription is not
  configured" rather than crashing — the rest of the app is unaffected.

Verified end-to-end locally with real recorded speech through the full path (browser →
gateway → Groq → back), with audit logging on every call.
