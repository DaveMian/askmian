ASK MIAN BACKEND — FIXED BUILD
==============================

This backend uses a build script (scripts/build.cjs) that fixes
the esbuild quote escaping issue that caused the "module" crash.

1. Push these files to GitHub repo: askmian-backend
2. Railway → New Project → Deploy from GitHub
3. Add environment variables (see .env.example)
4. Deploy
