ASK MIAN BACKEND — NO DOCKERFILE
================================

This package uses Railway's Nixpacks builder (NOT Docker).

DEPLOY STEPS:
1. Push these files to GitHub repo: askmian-backend
2. Railway → New Project → Deploy from GitHub repo
3. Add environment variables (see .env.example)
4. Click Deploy

IMPORTANT:
- There is NO Dockerfile in this package
- There is NO .dockerignore
- Railway will auto-detect Node.js and use Nixpacks

If Railway asks for builder type, choose "Nixpacks" (not Docker).

Health check: https://askmian-production-792b.up.railway.app/health
