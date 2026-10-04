# Smart Telecom Command Center: the API, both Python engine workers and the built UI in one image.
#   docker compose up --build        then open http://localhost:8787
# Stage 1 builds the UI with Node; stage 2 is Python plus just the Node binary (the API has no npm dependencies).

FROM node:22-bookworm-slim AS ui
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ui/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
COPY --from=ui /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY engine/requirements.txt engine/requirements.txt
RUN pip install --no-cache-dir --only-binary=:all: -r engine/requirements.txt \
 # first import of these libraries is slow (30-40 s on a fresh install); do it once here, not at every start
 && python -c "import numpy, pandas, scipy.optimize, scipy.sparse, sklearn.linear_model"
COPY engine/ engine/
COPY server/ server/
COPY --from=ui /app/ui/dist ui/dist
RUN python -m compileall -q engine \
 && useradd --create-home --uid 1000 app && mkdir -p results && chown app results
USER app
ENV PORT=8787 PYTHON=python3 PYTHONUNBUFFERED=1 \
    # One maths thread per process. OpenBLAS otherwise starts a thread per host core and, under a CPU quota
    # (cloud hosts, --cpus), they fight: at 0.5 CPU Engine 1 took 24 s with them and 0.6 s without.
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/api/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.mjs"]
