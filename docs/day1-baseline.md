# Day 1 baseline

Fill the "This laptop" column from the output of `npm run test:api` and `npm run verify`.
The reference column comes from the verification sandbox (Linux, 1 CPU, 3 GB RAM).

| Measure | Reference | This laptop |
| --- | --- | --- |
| API and both workers ready | 4.2-4.6 s | |
| POST /api/engine1 | 0.6 s | |
| POST /api/engine2 | 7.4 s | |
| Coupling job, 3 budgets (api test) | 16 s | |
| npm run verify (stages A-G, I, J) | 81 s, 67 PASS + 6 expected FAIL | |
| Node.js / Python versions | 22.22.2 / 3.12.3 | |
| Operating system | Linux | |
