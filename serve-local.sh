#!/usr/bin/env bash
# Run the full Project-Rainfall stack locally: client + Node RBAC gateway + all 4 AppSail
# ML services, wired together via `catalyst serve`. Locally-served functions/AppSail still
# read the real cloud Data Store, so this is the live system.
#
# HACKATHON_DEMO_MODE and the production AppSail URLs are committed directly in
# functions/rainfall-node-api/catalyst-config.json now (no local-only override needed —
# see DEPLOY_NOTES.md for what that flag means and why it's intentionally on in prod too).
#
# GROQ_API_KEY is different: it's a real secret, so it stays OUT of the committed config.
# `catalyst serve` only reads env vars from catalyst-config.json (not the shell's exported
# env), so if a gitignored .env.local exists with GROQ_API_KEY=..., we inject it into a
# throwaway copy of the config for this run only and restore the clean file on exit.
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

CFG="functions/rainfall-node-api/catalyst-config.json"
if [ -f .env.local ]; then
  GROQ_KEY=$(grep -E '^GROQ_API_KEY=' .env.local | cut -d= -f2-)
  if [ -n "$GROQ_KEY" ]; then
    cp "$CFG" "$CFG.bak"
    restore() { mv -f "$CFG.bak" "$CFG" 2>/dev/null || true; }
    trap restore EXIT INT TERM
    node -e "const fs=require('fs'),p=process.argv[1],k=process.argv[2],c=JSON.parse(fs.readFileSync(p));c.deployment.env_variables.GROQ_API_KEY=k;fs.writeFileSync(p,JSON.stringify(c,null,'\t')+'\n');" "$CFG" "$GROQ_KEY"
    echo "GROQ_API_KEY loaded from .env.local for this local run only (not written to git)."
  fi
fi

catalyst serve \
  --only "client,functions:rainfall-node-api,appsail:entityresolution,appsail:moclustering,appsail:analytics,appsail:legal" \
  --no-open --http 3000
