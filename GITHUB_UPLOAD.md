# Upload this folder to a new GitHub repo

Everything is already in the correct layout. Use **one** of these methods.

## Option A — Git push (recommended)

```bash
cd /Users/baharuludag/Documents/expal/expal-backend-github
git init
git add .
git commit -m "EXPal backend API"
git branch -M main
git remote add origin https://github.com/buludag944-cmd/YOUR-NEW-REPO-NAME.git
git push -u origin main
```

Replace `YOUR-NEW-REPO-NAME` with the empty repo you created on GitHub.

## Option B — GitHub website (drag folder)

1. Create a **new empty** repository on GitHub (no README).
2. On the repo page: **Add file** → **Upload files**.
3. Open Finder → go to `Documents/expal/expal-backend-github`.
4. Select **all items inside** that folder (`package.json`, `src`, `README.md`, etc.).
5. Drag them into GitHub and commit.

**Important:** Upload the **contents** of `expal-backend-github`, not the parent `expal` folder.  
On GitHub you should see `src/` as a folder, not loose `User.js` files at the root.

## Connect Render

**Important:** If Render shows **Ruby** / `bundle install`, you cannot switch to Node on that service. **Delete it** and create a new one (steps below).

### Create a new Web Service (Node)

1. [dashboard.render.com](https://dashboard.render.com) → delete the old Ruby service (Settings → Delete).
2. **New +** → **Web Service** (not Static Site, not Ruby template).
3. Connect repo `EXpalappl`.
4. On the **create** screen (before first deploy), set:
   - **Language / Runtime:** Node
   - **Root Directory:** *(empty)*
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
5. Add environment variables from `README.md`.
6. **Create Web Service**.

If `package.json` is at the repo root, Render should detect **Node** automatically.

### Or use Blueprint (`render.yaml`)

1. Ensure `render.yaml` is in the repo root on GitHub.
2. **New +** → **Blueprint** → connect repo → Render applies Node settings from the file.

## Zip (optional)

```bash
cd /Users/baharuludag/Documents/expal
zip -r expal-backend-github.zip expal-backend-github -x "*.DS_Store"
```

Upload the zip to GitHub only if your browser supports extracting; Git push is easier.
