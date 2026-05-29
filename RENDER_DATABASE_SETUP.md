# Make your Expal database permanent on Render (free)

Do this **once**. After that, redeploying Netlify or Render will **not** delete accounts.

You need about **5 minutes** in the Render dashboard.

---

## Step 1 — Open Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Sign in with the account that owns **expalapp-1**

---

## Step 2 — Create a free Postgres database

1. Click the purple **New +** button (top right)
2. Click **PostgreSQL**
3. **Name:** `expal-db` (any name is fine)
4. **Database:** leave default
5. **User:** leave default
6. **Region:** pick the **same region** as `expalapp-1` (e.g. Frankfurt)
7. **Instance type:** **Free**
8. Click **Create Database**

Wait until the database status is **Available** (green).

---

## Step 3 — Connect the database to your API

1. Open your **expal-db** (Postgres) service
2. Scroll to **Connections**
3. Under **Connect a service**, click **Connect** (or **Add connection**)
4. Choose your web service: **expalapp-1**
5. Confirm

Render will automatically add **`DATABASE_URL`** to **expalapp-1**. You do **not** need to copy/paste the URL yourself.

---

## Step 4 — Remove anything that wipes the database

1. Open **expalapp-1** (your API, not the database)
2. Click **Environment**
3. If you see **`DB_FORCE_RESET`** with value `1` → click the trash icon and **delete** it
4. Click **Save Changes** if you changed anything

---

## Step 5 — Deploy the API again

1. Still on **expalapp-1**
2. Click **Manual Deploy** → **Deploy latest commit**

Wait until deploy status is **Live** (can take 2–5 minutes on free tier).

---

## Step 6 — Check it worked

Open in your browser:

**https://expalapp-1.onrender.com/health**

You want to see something like:

```json
"database": {
  "dialect": "postgres",
  "persistent": true,
  "storage": "DATABASE_URL"
}
```

If you still see `"persistent": false`, the database is not connected yet — repeat Step 3.

---

## After this

- Sign in with **Google** again (first time after switch you may need to re-fill **Profile**)
- New accounts and posts **stay** after Render redeploys
- **Netlify** redeploys are safe — they only update the website

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Deploy fails on Postgres | Make sure the latest backend code is deployed (includes `pg` package) |
| `persistent: false` | Connect Postgres to expalapp-1 (Step 3) |
| Logged out but data gone | Old SQLite data is not migrated; users re-register via Google |
| Health has no `database` field | Redeploy backend with newest code from GitHub |

---

## Optional: keep using SQLite on a disk instead

If you prefer not to use Postgres:

1. **expalapp-1** → **Disks** → Add disk, mount **`/var/data`**
2. Environment: `DATABASE_PATH` = `/var/data/expal.db`
3. Remove `DB_FORCE_RESET`
4. Redeploy

Postgres (above) is easier on Render free tier.
