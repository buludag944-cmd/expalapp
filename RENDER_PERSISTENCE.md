# Keep accounts after Render redeploys

**Easiest setup:** follow **[RENDER_DATABASE_SETUP.md](./RENDER_DATABASE_SETUP.md)** (click-by-click with Render Postgres).

**Netlify redeploys do not delete accounts.** The website (Netlify) and your data (Render API) are separate.

If you lose your profile, posts, or login after a deploy, the **Render backend database was wiped** — not Netlify.

## Why it happens

On Render’s free tier, the server disk is **ephemeral**. The default SQLite file (`expal.db`) is recreated empty whenever Render redeploys or restarts.

Google sign-in still works, but you get a **new empty user** — it feels like your account was deleted.

## Fix (pick one)

### Option A — Render Postgres (recommended)

1. Render dashboard → **New** → **PostgreSQL** (free tier).
2. Copy the **Internal Database URL** (or External if required).
3. On **expalapp-1** → **Environment** → add:
   ```
   DATABASE_URL=postgresql://...
   ```
4. **Remove** `DB_FORCE_RESET` if it is set to `1`.
5. **Manual Deploy** the backend.

The app auto-uses Postgres when `DATABASE_URL` is set.

### Option B — Persistent disk + SQLite

1. **expalapp-1** → **Disks** → add a disk (e.g. 1 GB), mount path `/var/data`.
2. Environment:
   ```
   DATABASE_PATH=/var/data/expal.db
   ```
3. Remove `DB_FORCE_RESET=1` if present.
4. Redeploy.

## Checklist

| Check | Action |
|--------|--------|
| `DB_FORCE_RESET` | Must be **unset** on Render (wipes DB every boot if `1`) |
| `JWT_SECRET` | Keep the **same** value across deploys (or everyone is logged out) |
| `DATABASE_URL` or `DATABASE_PATH` | Set one of these for persistence |
| Netlify | Safe to redeploy anytime — does not touch user data |

## Verify

Open:

```
https://expalapp-1.onrender.com/health
```

Look for:

```json
"database": { "dialect": "postgres", "persistent": true }
```

or

```json
"database": { "dialect": "sqlite", "persistent": true, "storage": "/var/data/expal.db" }
```

If you see `"persistent": false`, accounts will reset on the next Render deploy.

## AI assistant

For full chat (not just navigation tips), add on Render:

```
OPENAI_API_KEY=sk-...
```

Optional: `OPENAI_MODEL=gpt-4o-mini`

`/health` shows `"assistant": { "openai": true }` when configured.
