# GitHub upload checklist

## WRONG (what you have now)

```
package.json
server.js          ← should be inside src/
User.js            ← should be inside src/models/
auth.js            ← should be inside src/routes/ OR src/middleware/
```

No `src/` folder on GitHub = Render/Node **will fail**.

## RIGHT (what you must see on GitHub)

```
package.json
package-lock.json
README.md
render.yaml
src/               ← blue FOLDER (click it → server.js inside)
```

Inside `src/` on GitHub:

```
src/server.js
src/bootstrapModels.js
src/config/
src/models/
src/routes/
src/services/
src/middleware/
```

## Upload steps (Mac Finder)

1. Open **Documents → expal → expal-backend-github**
2. **Do not double-click `src`** — stay in `expal-backend-github`
3. Select these items together (⌘-click):
   - `package.json`
   - `package-lock.json`
   - `README.md`
   - `render.yaml`
   - `railway.toml`
   - `GITHUB_UPLOAD.md`
   - **`src`** (the folder icon)
4. Drag to GitHub → Upload files → Commit
5. Refresh GitHub — you must see **`src/`** as a folder, not `User.js` at the top level

## Or use Terminal (replaces bad upload)

```bash
cd /Users/baharuludag/Documents/expal/expal-backend-github
git init
git add .
git commit -m "Correct src folder layout"
git branch -M main
git remote add origin https://github.com/buludag944-cmd/EXpalappl.git
git push -u origin main --force
```
