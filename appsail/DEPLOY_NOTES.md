# AppSail deployment — known blocker

**Status:** entity-resolution AppSail deploys successfully (`catalyst deploy --only appsail:entityresolution`) but every request returns:

```
{"status":"failure","data":{"message":"Execution failed. Please check the startup command or port.","error_code":"INTERNAL_SERVER_ERROR"}}
```

**This is NOT a code or dependency problem — bisected:**
- Fails with the full ER app, and equally with a **minimal bare-Flask** `app.py` (only `flask` in requirements).
- Config matches Catalyst's own Flask-on-AppSail guide exactly: `app-config.json` command `python3 -u app.py`; app binds `0.0.0.0` on `int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", 9000))`.
- Tried stacks `python_3_10` and `python_3_9` — same result.

**Most likely cause:** the container's startup command / health-check port must be confirmed in the **console** (Serverless → AppSail → entityresolution → Configuration), or a platform-side provisioning issue. The runtime logs (console only) will show the exact traceback — I couldn't reach them headless.

**Next step when back at a browser:** open the AppSail service logs in the console to read the container's stderr; verify the "Startup command" field in the console Configuration is set to `python3 -u app.py`; redeploy.

**The ER logic itself is done and proven** — `python eval_local.py` scores it against the real data (pairwise F1 0.76, entity recall 1.00 after confirmation). Deployment is the only open item, and it's environmental.
