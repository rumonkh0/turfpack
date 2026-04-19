# TurfSlot Desktop (SQLite + EXE)

This project is now configured for:

- SQLite database (local file): `server/data/turfslot.sqlite`
- Electron desktop shell
- Windows installer build (`.exe`) via `electron-builder`
- Linux Debian package (`.deb`) via `electron-builder`

## What changed

- Backend persistence migrated from MongoDB/Mongoose to SQLite (`better-sqlite3`)
- API routes/controllers now use SQLite helper layer in `server/db/sqlite.js`
- Express now serves frontend build in production/desktop mode
- Electron entry added at `desktop/main.js`
- Root packaging config added in `package.json`

## Build Windows EXE

From project root:

1. Install root tooling:
   - `npm install`
2. Build and package:
   - `npm run desktop:pack:win`

Output location:

- `release/` (contains installer `.exe`)

## Build Linux DEB

From project root:

1. Install Linux packaging tools (Debian/Ubuntu):
   - `sudo apt update && sudo apt install -y fakeroot dpkg`
2. Install root tooling:
   - `npm install`
3. Build and package:
   - `npm run desktop:pack:deb`

Output location:

- `release/` (contains `.deb` package)

Install generated package:

- `sudo apt install ./release/<generated-file>.deb`

## Run desktop app locally

From project root:

- `npm run desktop:start`

This starts Express + SQLite and opens Electron window.

## Notes

- No MongoDB is required anymore.
- The app data is stored locally in SQLite DB file.
- For cloud image uploads, Cloudinary env values are still required if you use upload features.
