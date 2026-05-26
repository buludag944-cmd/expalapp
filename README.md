# EXPal backend

## Deploy to Railway

See **[RAILWAY.md](./RAILWAY.md)** for GitHub + Railway setup, environment variables, public URL, and linking Netlify (`REACT_APP_API_URL`).

## Local dev (ports)

| Service   | Port | Command              |
|-----------|------|----------------------|
| Frontend  | 3000 | `cd frontend && npm start` |
| Backend   | 3001 | `cd backend && npm run dev`  |

`npm start` runs `prestart`, which frees port 3001 if another process (e.g. CRA) is using it.

If you must use another API port: `PORT=3002 npm start` and set `REACT_APP_API_URL=http://localhost:3002` in `frontend/.env`, then restart the React dev server.

Health check: `curl http://localhost:3001/health` → `{"ok":true}`

## Resend verification (end-to-end)

1. Fill in real values in `backend/.env` (Gmail App Password or provider SMTP).
2. `npm start` — expect `[email] Using SMTP transport: host=…` and `[auth] /api/auth mounted`.
3. `npm run verify:smtp-resend -- your@email.com` (backend must be running).
4. In the app: **Resend verification email** → enter email → **Send verification email**.
5. DevTools: `[resend] preparing`, Network `POST …/api/auth/resend-verification`.
6. Backend: `[resend] email=… sent=true reason=resent` and `[email] SMTP accepted message`.

**Troubleshooting**

| Symptom | Fix |
|---------|-----|
| No POST in Network tab | Submit the form (second click); check email is filled |
| POST but no backend log | `REACT_APP_API_URL` must be `http://localhost:3001`; restart frontend |
| `[resend]` but no SMTP accepted | Edit `backend/.env`, restart backend |
| SMTP accepted, no inbox | Check Spam/Promotions; verify `MAIL_FROM` with provider |

## Email verification (SMTP)

Verification emails use **real SMTP only** (no Ethereal). Copy `.env.example` to `.env` and configure:

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | Gmail App Password (not your login password) |
| `MAIL_FROM` | `"EXPal" <you@gmail.com>` |
| `CLIENT_URL` | `http://localhost:3000` |

**Gmail:** Enable 2-Step Verification, then create an [App Password](https://myaccount.google.com/apppasswords). Use port `587` and `SMTP_SECURE=false`.

**Brevo / Mailgun / Mailersend:** Use SMTP credentials from the provider dashboard. Set `MAIL_FROM` to a verified sender. For production, add SPF and DKIM on your domain.

On `npm start`, expect: `[email] Using SMTP transport: host=… port=… secure=…`

After register, expect: `[email] SMTP accepted message <messageId>`
