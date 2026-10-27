# Fridge Scan — MVP Starter

Responsive photo-to-fridge-inventory and grocery-list web app.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Persistence: SQLite (`better-sqlite3`)
- AI: adapter placeholder for a vision model; starter runs in clearly labeled demo mode

## Prerequisites
- Node.js 20+ (Node 22 LTS recommended)
- npm

## Run locally
Open two terminals:

### Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
Windows PowerShell: `Copy-Item .env.example .env`

### Frontend
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173).

The backend creates `server/data/fridge-scan.sqlite` automatically.

## Important starter behavior
- Demo analysis returns clearly labeled sample detections. It does **not** claim to recognize uploaded photos with AI yet.
- The uploaded photo bytes are processed in memory and are not written to disk. They are discarded after the request.
- Browser camera access requires HTTPS in deployment (localhost is allowed).
- Recipe catalog is intentionally limited to American-style dishes.
- Recipes are marked “Ready to cook” only when all required ingredients are confirmed available. Recipes with missing ingredients are marked “Missing ingredients”.
- Low-stock items can be added to the grocery list, where users can edit or delete them.

## Before production
1. Add a vision model integration in `server/src/ai/analyzeFridge.js` and configure its API key as an environment variable. Never expose the key in the frontend.
2. Improve quantity estimation and confidence handling; ask users to confirm uncertain quantities.
3. Add deployment configuration and persistent disk/volume for SQLite, or migrate to a managed database if the hosting platform has ephemeral storage.
4. Add automated tests, rate limiting, upload limits, privacy notice/consent, and a clear photo retention policy.
5. Use HTTPS for camera access online.

## GitHub
Create the empty repository at `https://github.com/Jerushli/fridge-scan`, then from this folder:
```bash
git init
git add .
git commit -m "chore: add Fridge Scan MVP starter"
git branch -M main
git remote add origin https://github.com/Jerushli/fridge-scan.git
git push -u origin main
```
If the repository already contains commits, inspect its state before pushing; do not force-push blindly.
