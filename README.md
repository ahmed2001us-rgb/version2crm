# Rep CRM – offline PWA

Everything runs in the phone. Data lives in IndexedDB (via Dexie). No server, no cloud, no accounts.

## Deploy to GitHub Pages (beginner steps)

1. Create a free account at https://github.com and sign in.
2. Click **+** (top right) → **New repository**. Name it `rep-crm` (lowercase, no spaces). Choose **Public**. Tick **Add a README file**. Click **Create repository**.
3. **(Optional but recommended) Get Dexie.** The app works without it using a built-in fallback that stores data the same way. On a computer, open
   https://unpkg.com/dexie@4.0.11/dist/dexie.min.js
   → right-click the page → **Save as…** → name it exactly `dexie.min.js`. Put it inside this project's `vendor` folder (you can delete `PUT-dexie.min.js-HERE.txt`).
4. Unzip the project. On your repository page click **Add file → Upload files**. Open the unzipped folder and drag in **everything inside it** (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `selftest.html`, and the `icons` and `vendor` folders). Folders must keep their names. Wait until all files are listed, then click **Commit changes**.
   - If drag-and-drop skips folders, open the repo → **Add file → Upload files** again and upload the contents of `icons` and `vendor` separately, typing `icons/` or `vendor/` is not needed – GitHub keeps folder structure when you drag the folder itself.
5. Go to **Settings → Pages**. Under **Build and deployment → Source** choose **Deploy from a branch**. Branch: **main**, folder: **/ (root)**. Click **Save**.
6. Wait 1–2 minutes. Refresh the Pages screen; it shows your address:
   `https://YOUR-USERNAME.github.io/rep-crm/`  (keep the trailing slash)
7. On the Android phone open that address in **Chrome**, wait ~10 seconds (it caches itself), then menu **⋮ → Install app** (or "Add to Home screen"). Open it from the new home-screen icon.

Why it works in a sub-folder: every path is relative (`./`), the manifest uses `start_url: "./"` and `scope: "./"`, and the service worker is served from the same folder, so its scope is `/rep-crm/`.

## Complete offline test

Automatic part
1. Open `https://YOUR-USERNAME.github.io/rep-crm/selftest.html` (online), tap **Run all tests**. If the "Service worker controls this page" line fails, reload once and run again.
2. Every line must say PASS. It creates and deletes temporary `__TEST__` records (product, pharmacy, doctor, link, visit, feedback) and checks saving, reloading, updating, cascade deletes and relationships.
3. Tap **Save reopen-marker**.

Offline part (phone)
4. Install the app (step 7 above), open it, tap **Backup → Load sample data** (or add a doctor).
5. Turn on **Airplane mode** (also Wi-Fi off).
6. Fully close the app (recents → swipe it away) and open it again from the home-screen icon. It must open, header shows **○ Offline · offline-ready**, and your data is there.
7. While offline: add a doctor, a pharmacy, a product, a visit (tick the product), a feedback entry; edit and delete one record; export a CSV and the full JSON backup.
8. Open `.../selftest.html` while still in airplane mode → **Run all tests** → all PASS. The marker line shows the marker from step 3 (data survived closing).
9. Close and reopen again: everything you added in step 7 is still there. Turn airplane mode off.

Desktop alternative: Chrome DevTools → Application → Service Workers → tick **Offline**, reload.

## Data safety
- Every change is written to the database immediately.
- **Backup** tab: full JSON export, JSON import (asks before adding; asks again before overwriting), CSV export per table, CSV import (asks before overwriting), integrity check, erase (asks).
- The Home screen warns if the last backup is more than 7 days old or never made.
- Keep backups outside the phone. Clearing Chrome's site data deletes the database.

## Updating the app later
Replace the files in GitHub and change `VERSION` in `sw.js` (e.g. `repcrm-v2`). Open the app online twice to receive the update. Database changes are handled by Dexie versions in `app.js` (`db.version(n)`); add a new version, never edit old ones.
