# EXPal API (backend)

Node.js + Express + SQLite API for the [EXPal](https://expalapp.netlify.app) frontend.

## Deploy (Render or Railway)

| Setting | Value |
|--------|--------|
| **Root Directory** | *(empty — repo root is this folder)* |
| **Build Command** | `npm install` |
| **Start Command** | `node src/server.js` |
| **Health check** | `/health` |

### Environment variables (required)

Set these in Render / Railway **Environment** — do not commit `.env`:

| Variable | Example |
|----------|---------|
| `CLIENT_URL` | `https://expalapp.netlify.app` |
| `JWT_SECRET` | long random secret |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | your Gmail |
| `SMTP_PASS` | Gmail App Password |
| `MAIL_FROM` | `"EXPal" <you@gmail.com>` |

Do not set `PORT` — the host sets it automatically.

### After deploy

1. Open `https://YOUR-API-URL/health` → `{"ok":true}`
2. Set Netlify `REACT_APP_API_URL` to that URL and rebuild the frontend.

## Local dev

```bash
cp .env.example .env   # if you add .env.example locally
npm install
npm run dev
```

API: `http://localhost:3001/health`

## Folder layout

```
src/
├── server.js
├── bootstrapModels.js
├── config/
├── models/
├── routes/
├── services/
└── middleware/
```
