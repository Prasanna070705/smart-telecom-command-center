# Smart Telecom Revenue & Churn Command Center

Three parts, one repo:

| Folder | Owns | Language |
| --- | --- | --- |
| `engine/` | all modelling: prices, hazard model, Engine 1, Engine 2, coupling; `worker.py` serves them over JSON lines | Python |
| `server/` | HTTP API, caching, background jobs, serving the built UI; zero npm dependencies | Node.js |
| `ui/` | the dashboard: five pages, React + Tailwind CSS, built with Vite | React |
| `tests/` | API test, browser end-to-end test, offline bundle check | Node.js |

## Run it

Needs Node.js 20.19+ or 22.12+ (Vite's requirement) and Python 3.12 or newer with the pinned libraries (all 76 model checks run on 3.12.3 and 3.14.3).
From a fresh clone (macOS / Linux shell; on Windows activate with `.venv\Scripts\activate`). In zsh, run `setopt interactivecomments` first or the `# notes` break pasted lines:

    npm ci                          # root: Playwright for the browser test
    npm --prefix ui ci              # UI: React, Vite, Tailwind (versions locked in ui/package-lock.json)
    python3 -m venv .venv && source .venv/bin/activate
    pip install --only-binary=:all: -r engine/requirements.txt
    npm run check                   # Node, npm, git, Python, pinned libraries, dataset
    npm run build:ui                # production build into ui/dist
    npm run api                     # API + two Python workers on http://localhost:8787, serving the built UI

The first `npm run api` after installing the libraries can take ~40 s while Python compiles them; after that ~1.5 s.
On Windows (PowerShell), the same steps; the CI run in `.github/workflows/windows.yml` passes every test on
windows-latest (it installs into the runner's Python, so the venv lines below are standard but not exercised by CI):

    npm ci
    npm --prefix ui ci
    python -m venv .venv; .venv\Scripts\Activate.ps1
    pip install --only-binary=:all: -r engine/requirements.txt
    npm run check; npm run build:ui; npm run api

If PowerShell refuses to run `Activate.ps1`, its execution policy blocks scripts (see `Get-Help about_Execution_Policies`).
Port 8787 busy on Windows: `Get-NetTCPConnection -LocalPort 8787 -State Listen | % { Stop-Process -Id $_.OwningProcess }`.

For UI work, `npm run ui` serves http://localhost:5173 with hot reload and proxies /api to 8787.

## Run it with Docker

With Docker Desktop (or any Docker engine) running, from the repo root:

    docker compose up --build       # first build downloads ~300 MB; then http://localhost:8787
    docker compose down             # stop

The image holds the API, both Python engine workers and the built UI (Python 3.12, Node 22, non-root user, health check
on /api/health). Finished jobs are kept in `./results`. The tests run from the host against the container as usual:
`npm run test:api`, `npm run test:e2e`. `.github/workflows/docker.yml` does exactly that on Linux for every push to v2.

## Test it

    npm run test:api                # with the API running
    npx playwright install chromium # once per machine
    npm run test:e2e                # with the API running and ui/dist built
    npm run verify                  # 73 of verify.py's 76 checks (stages A-G, I, J); npm run verify:coupling runs the other 3 (stage H)

## What was verified before handover (offline sandbox, 1 CPU)

- API + Python workers: health, meta, Engine 1, Engine 2, validation errors, background coupling job, concurrency.
- Browser end-to-end: 11 steps from page load to CSV export, against the real API.
- UI source bundled with esbuild + React 19.2.5. NOT verified offline: Vite 8 build, Tailwind 4 styling
  (packages not installable offline). Day 1 of the plan checks both.

## Where it has run

| Machine | Node / Python | API ready | Engine 1 | Engine 2 | Coupling (3 budgets) | verify (73 checks) | test:api | test:e2e |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sandbox, Linux, 1 CPU, 3 GB | 22.22.2 / 3.12.3 | 4.2-4.6 s | 0.6 s | 7.4 s | 16 s | 81 s, 67 PASS + 6 expected FAIL | all match | 11 steps PASS |
| GitHub windows-latest (CI) | 22.23.3 / 3.12.10 | 4.1 s | 0.81 s | 3.1 s | 10.3 s (5 budgets) | 41.8 s, 67 PASS + 6 expected FAIL | all match | 16/16 PASS |
| Docker on the MacBook Air (arm64) | 22 / 3.12 in the image | 1.5 s | 0.63 s | 1.8 s | 6.7 s (5 budgets) | — | all match | 19/19 PASS |
| Docker on GitHub ubuntu-latest (amd64, CI) | 22 / 3.12 in the image | (healthy in CI) | 0.81 s | 3.0 s | 10.5 s (5 budgets) | — | all match | 19/19 PASS |
| MacBook Air, macOS 27.0.1 | 24.12.0 / 3.14.3 | 1.3 s | 0.27 s | 1.6 s | 4.0 s | 38.2 s, 67 PASS + 6 expected FAIL | all match | 16/16 PASS (Chrome, Chromium, WebKit) |

## Your own data (planned)

The engines run on the IBM file only; uploading other data is planned, not built. `data/templates/customers-monthly.csv`
is the template for monthly customer history: one row per customer per month, the 19 fields the engines read, and a few
made-up example rows. The full specification (required columns, optional `prices` / `offers` / `costs` sheets, and how
new data changes each engine's output) is on the showcase site:
https://prasanna070705.github.io/smart-telecom-showcase/data.html

## Tools

- `node tools/create-issues.mjs` creates one GitHub issue per day (Days 2-10); needs `gh auth login`. Add `--dry-run` to preview.
- `docs/day1-baseline.md` is where you record your laptop's Day 1 timings next to the reference ones.
