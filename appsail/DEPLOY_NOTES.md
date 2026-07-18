# AppSail — runtime notes

## Local (working, wired end-to-end)

All four AppSail ML services run locally via `catalyst serve` and read the **real cloud
Data Store**. The frontend calls the Node gateway (`/server/rainfall-node-api/execute`),
which role-filters (PRD §4), hash-chains an audit row, then proxies to the AppSail service.

Start everything with [`serve-local.sh`](../serve-local.sh), then open
`http://localhost:3000/app/index.html`. The console header shows **● Live · AppSail ML**
when the backend is reachable; otherwise the UI falls back to the bundled sample so it
never dies.

What it took to get AppSail serving locally on this Windows box:
- **Stack** `python_3_9` → `python_3_10` in every `app-config.json` (we have 3.10, not 3.9).
- `catalyst config:set python3_10.bin="…/Python310/python.exe"`.
- A `python3.exe` copy next to `python.exe` (the app-config command is literally `python3`,
  which Windows doesn't resolve; keeping the copy beside the real interpreter keeps its DLLs).
- `pip install flask zcatalyst-sdk` into that Python 3.10.
- **Real bug fixed:** the SDK method is `zcql().execute_query(...)`, not `execute_zcql_query`
  (was wrong in every `catalyst_io.py` — would have failed in the cloud too).
- APIG rules added in `catalyst-user-rules.json` for the client assets and the gateway route
  (needed in the cloud as well, not just local).
- `ALLOW_ACTOR_EMAIL_OVERRIDE=true` — **local/dev only**, lets the demo pick a role without a
  Catalyst Auth session. It is set via the serve env and also present in the function's
  `catalyst-config.json` for local serve; **remove it before any real deploy** (it lets a
  caller assert any role).

## Cloud container deploy — still open

The AppSail **cloud** container previously returned "Execution failed — check startup command
or port" for every request. That is a platform/console-side item (needs the AppSail runtime
logs in the console) and is independent of the code, which is now proven correct locally.
When deploying to the cloud, set each service's real URL on the Node function via env vars
`APPSAIL_ER`, `APPSAIL_MO`, `APPSAIL_ANALYTICS`, `APPSAIL_LEGAL` (they default to the local
`catalyst serve` ports).
