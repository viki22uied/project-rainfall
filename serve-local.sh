#!/usr/bin/env bash
# Run the full Project-Rainfall stack locally: client + Node RBAC gateway + all 4 AppSail
# ML services, wired together via `catalyst serve`. Locally-served functions/AppSail still
# read the real cloud Data Store, so this is the live system — the cloud AppSail container
# deploy is a separate, still-open item (see appsail/DEPLOY_NOTES.md).
#
# One-time prep already done on this machine (repeat only on a fresh setup):
#   - catalyst config:set python3_10.bin="<Python310>/python.exe"
#   - copy Python310/python.exe -> Python310/python3.exe   (the app-config command is `python3`)
#   - "<Python310>/python.exe" -m pip install flask zcatalyst-sdk
#
# Then open http://localhost:3000/app/index.html
set -e
PY310="/c/Users/Vignesh Kumar U/AppData/Local/Programs/Python/Python310"
export PATH="$PY310:$PATH"
export ALLOW_ACTOR_EMAIL_OVERRIDE=true   # DEV/LOCAL ONLY — never set this in a cloud deploy
catalyst serve \
  --only "client,functions:rainfall-node-api,appsail:entityresolution,appsail:moclustering,appsail:analytics,appsail:legal" \
  --no-open --http 3000
