# Day 1 baseline

Fill the "This laptop" column from the output of `npm run test:api` and `npm run verify`.
The reference column comes from the verification sandbox (Linux, 1 CPU, 3 GB RAM).

| Measure | Reference | This laptop |
| --- | --- | --- |
| API and both workers ready | 4.2-4.6 s | 1.3 s (listening 0.09 s) |
| POST /api/engine1 | 0.6 s | 0.27 s |
| POST /api/engine2 | 7.4 s | 1.6 s |
| Coupling job, 3 budgets (api test) | 16 s | 4.0 s |
| npm run verify (73 of 76 checks, stages A-G, I, J) | 81 s, 67 PASS + 6 expected FAIL | 38.8 s, 67 PASS + 6 expected FAIL |
| Node.js / Python versions | 22.22.2 / 3.12.3 | 24.12.0 / 3.14.3 |
| npm run test:e2e (fresh build) | 11 steps | 12/12 PASS, 4.6 s |
| Operating system | Linux | macOS 27.0.1 (MacBook Air) |

Mac column measured 2026-10-04 at commit 8786476: API cold start = process start to `/api/health` ok;
engine timings are the first (uncached) calls in `npm run test:api`; verify is wall-clock from `time npm run verify`.
