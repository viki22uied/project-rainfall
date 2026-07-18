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
cd "$(dirname "$0")"
PY310="/c/Users/Vignesh Kumar U/AppData/Local/Programs/Python/Python310"
export PATH="$PY310:$PATH"

# SECURITY: the actor_email role override is a LOCAL-ONLY convenience (no Catalyst Auth
# session in the browser demo). It must never ship in the deployed function config, so we
# inject it into a throwaway copy here and restore the clean committed config on exit.
CFG="functions/rainfall-node-api/catalyst-config.json"
cp "$CFG" "$CFG.bak"
restore() { mv -f "$CFG.bak" "$CFG" 2>/dev/null || true; }
trap restore EXIT INT TERM
node -e "const fs=require('fs'),p=process.argv[1],c=JSON.parse(fs.readFileSync(p));c.deployment.env_variables=c.deployment.env_variables||{};c.deployment.env_variables.ALLOW_ACTOR_EMAIL_OVERRIDE='true';fs.writeFileSync(p,JSON.stringify(c,null,'\t')+'\n');" "$CFG"

catalyst serve \
  --only "client,functions:rainfall-node-api,appsail:entityresolution,appsail:moclustering,appsail:analytics,appsail:legal" \
  --no-open --http 3000
