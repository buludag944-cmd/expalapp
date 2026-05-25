# Email on Render (free tier)

## Why Gmail SMTP fails

Render **free** web services **block outbound SMTP** (ports 25, 465, 587).

Logs like this mean the block — not a wrong password:

```
[email] sendMail failed: Connection timeout
[forgot] reset email failed: Connection timeout
```

Gmail App Password cannot fix this on **free** Render.

## Option A — Resend (recommended, free, HTTPS)

1. Sign up: https://resend.com  
2. **API Keys** → create key → copy `re_...`  
3. Render → **Environment**:

| Variable | Value |
|----------|--------|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `MAIL_FROM` | `EXPal <onboarding@resend.dev>` (testing) |
| `CLIENT_URL` | `https://expalapp.netlify.app` |

4. **Remove** or leave unused: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (SMTP is ignored when `RESEND_API_KEY` is set)

5. **Manual Deploy**

**Testing:** On Resend free tier, `onboarding@resend.dev` can only send **to the email address of your Resend account**. For any user email, verify a domain at resend.com.

6. Redeploy → sign up / forgot password → logs should show:

```
[email] Using Resend HTTP API
[email] Resend accepted message
[forgot] email=... issued=true
```

## Option B — Upgrade Render (paid)

Upgrade the web service to a **paid** instance. Then Gmail SMTP on port 587 works with your existing `SMTP_*` variables.

## Local development

- **Mac:** keep using Gmail `SMTP_*` in `backend/.env` (no `RESEND_API_KEY`), or use Resend for parity.
