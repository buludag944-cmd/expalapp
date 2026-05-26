# Deploy backend to Railway

Deploy the **`backend/`** folder as a Node web service. Railway runs `npm install` and starts with `node src/server.js` (see `railway.toml`).

## 1. Push code to GitHub (required)

Railway deploys from Git. From the project root:

```bash
cd /path/to/expal
git init
git add .
git commit -m "Initial commit"
```

Create a repo on [github.com/new](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/expal.git
git branch -M main
git push -u origin main
```

Do **not** commit `backend/.env` or `backend/.env.local` (they are in `.gitignore`).

## 2. Create the Railway service

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select your `expal` repository.
3. **Settings** → **Root Directory** → set to **`backend`**.
4. Railway detects Node and uses `railway.toml` for the start command and health check (`/health`).

## 3. Environment variables

In Railway → your service → **Variables**, add:

| Variable | Example |
|----------|---------|
| `CLIENT_URL` | `https://expalapp.netlify.app` |
| `JWT_SECRET` | long random string (not `change-me-in-production`) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | Gmail App Password |
| `MAIL_FROM` | `"EXPal" <you@gmail.com>` |

Do **not** set `PORT` — Railway injects it automatically.

### Optional: keep SQLite data across restarts

By default the DB file lives on ephemeral disk and can reset on redeploy.

1. Railway → service → **Volumes** → **Add Volume** → mount path **`/data`**
2. Add variable: `DATABASE_PATH` = `/data/expal.db`
3. Redeploy

## 4. Public URL

1. **Settings** → **Networking** → **Generate Domain**
2. Copy the URL, e.g. `https://expal-backend-production.up.railway.app`

Test:

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
```

Expected: `{"ok":true}`

## 5. Point the Netlify frontend at Railway

Edit `frontend/.env.production`:

```env
REACT_APP_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

Rebuild and redeploy Netlify:

```bash
cd frontend
npm run build
```

Upload the new `build/` folder to Netlify (or trigger a Netlify deploy if connected to Git).

## Local dev (unchanged)

```bash
cd backend
npm run dev
```

Uses nodemon on port 3001 with `.env` / `.env.local`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Root Directory must be `backend` |
| Health check fails | Open `/health` in browser; check deploy logs |
| Login works locally, not on Netlify | Rebuild frontend with correct `REACT_APP_API_URL` |
| Emails missing verify link | `CLIENT_URL` must be `https://expalapp.netlify.app` |
| Data lost after redeploy | Add volume + `DATABASE_PATH=/data/expal.db` |
