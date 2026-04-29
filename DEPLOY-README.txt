ASK MIAN BACKEND — FIXED
========================

DEPLOY STEPS:
1. Push these files to GitHub repo: askmian-backend
2. Railway → New Project → Deploy from GitHub
3. Add environment variables (see .env.example)
4. Deploy

HEALTH CHECK FIXED:
- /health endpoint now imports from correct path (api/queries/connection)
- Tests database connection properly

NO DOCKERFILE — uses Railway Nixpacks
