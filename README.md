# Smart Telecom Revenue & Churn Command Center

Three parts, one repo:

| Folder | Owns | Language |
| --- | --- | --- |
| `engine/` | all modelling: prices, hazard model, Engine 1, Engine 2, coupling; `worker.py` serves them over JSON lines | Python |
| `server/` | HTTP API, caching, background jobs, serving the built UI; zero npm dependencies | Node.js |
| `ui/` | the dashboard: five pages, React + Tailwind CSS, built with Vite | React |
| `tests/` | API test, browser end-to-end test, offline bundle check | Node.js |

## Run it

Needs Node.js 20.19+ or 22.12+ (Vite's requirement) and Python 3.12 with the pinned libraries.

    npm run check                   # Node, npm, git, Python, pinned libraries, dataset
    pip install -r engine/requirements.txt
    npm run api                     # API on http://localhost:8787 (starts two Python workers, ~5 s)

UI, first time only (scaffold with the official template, then drop in this repo's files):

    npm create vite@latest ui-scaffold -- --template react
    cd ui-scaffold && npm install && npm install tailwindcss @tailwindcss/vite
    cp -r ../ui/src ../ui/index.html ../ui/vite.config.js .   # replace the template's versions
    cd .. && rm -rf ui && mv ui-scaffold ui

Then:

    npm run ui                      # http://localhost:5173, /api is proxied to 8787
    npm run build:ui                # production build into ui/dist, served by the API at http://localhost:8787

## Test it

    npm run test:api                # with the API running
    npm i -D playwright && npx playwright install chromium
    npm run test:e2e                # with the API running and ui/dist built
    npm run verify                  # 73 model checks; npm run verify:coupling adds stage H

## What was verified before handover (offline sandbox, 1 CPU)

- API + Python workers: health, meta, Engine 1, Engine 2, validation errors, background coupling job, concurrency.
- Browser end-to-end: 11 steps from page load to CSV export, against the real API.
- UI source bundled with esbuild + React 19.2.5. NOT verified offline: Vite 8 build, Tailwind 4 styling
  (packages not installable offline). Day 1 of the plan checks both.

## Tools

- `node tools/create-issues.mjs` creates one GitHub issue per day (Days 2-10); needs `gh auth login`. Add `--dry-run` to preview.
- `docs/day1-baseline.md` is where you record your laptop's Day 1 timings next to the reference ones.
