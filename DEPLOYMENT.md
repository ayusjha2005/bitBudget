# SafePay AI — Production Deployment Guide

SafePay AI is architected as a container-ready full-stack application. The Express backend serves the API and statically hosts the optimized React Vite frontend on port `5000`.

---

## 1. Environment Variables Checklist

When deploying to any cloud host, configure the following environment variables:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production caching and disables test fixtures |
| `PORT` | `5000` (or host assigned) | Port the Express server listens on |
| `DATABASE_URL` | `postgresql://postgres.nugibqqofwivadkpmobj:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` | Your live Supabase PostgreSQL connection string |
| `DB_SSL` | `true` | Required for Supabase SSL connections |
| `USE_EMBEDDED_POSTGRES` | `false` | Instructs the server to use external Supabase PostgreSQL |
| `ACTION_SIGNING_SECRET` | *(64-char random hex)* | HMAC secret for deterministic action tokens |
| `JWT_SECRET` | *(64-char random hex)* | JWT signing secret |
| `GEMINI_API_KEY` | *(Optional)* | Google Gemini API key for live AI perceptual model |
| `OPENAI_API_KEY` | *(Optional)* | OpenAI API key for secondary perceptual model |

---

## 2. Deploying to Render.com (Recommended)

1. Push this repository to **GitHub** or **GitLab**.
2. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New +** → **Web Service**.
3. Select your repository.
4. Set:
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm --prefix client ci && npm --prefix client run build`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Free or Starter
5. Under **Environment Variables**, add the variables from the checklist above.
6. Click **Create Web Service**. SafePay AI will build the Vite frontend and launch the server!

---

## 3. Deploying to Railway.app

1. Go to **[railway.app](https://railway.app)** → **New Project** → **Deploy from GitHub repo**.
2. Railway automatically detects the [Dockerfile](file:///c:/Users/Ayush/safepay/Dockerfile).
3. In **Variables**, paste:
   ```env
   DATABASE_URL=postgresql://postgres.nugibqqofwivadkpmobj:Ayushjha%402005@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
   DB_SSL=true
   USE_EMBEDDED_POSTGRES=false
   PORT=5000
   ```
4. Click **Deploy**. Railway will build the multi-stage Docker container and assign a live public `.up.railway.app` HTTPS domain.

---

## 4. Deploying via Docker (Any VPS / Cloud)

Run directly with Docker:

```bash
# Build container image
docker build -t safepay-ai:latest .

# Run with Supabase connection
docker run -d -p 5000:5000 \
  -e DATABASE_URL="postgresql://postgres.nugibqqofwivadkpmobj:Ayushjha%402005@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres" \
  -e DB_SSL="true" \
  -e USE_EMBEDDED_POSTGRES="false" \
  --name safepay \
  safepay-ai:latest
```

---

## 5. Live Supabase Verification

When the server starts in production:
```
[SafePay AI] Initializing database schema and seed records...
[SafePay AI] Connected to existing schema in database.
[SafePay AI] Database initialized successfully.
[SafePay AI] Server running securely on port 5000
```
- Open your live domain in any browser.
- The **Two-Way Voice Assistant** (Speech-to-Text and Text-to-Speech) will immediately activate using the browser's native Web Speech & SpeechSynthesis APIs over HTTPS.
