# Deployment Runbook (T-031)

Target per TDD §12: single Node container + managed PostgreSQL 16 (**Neon**, resolved 2026-08-24).

## 0. Environment split (IMPORTANT)

| File | Points at | Use |
|---|---|---|
| `.env` | local Docker (`localhost:5433`) | `npm run dev`, tests |
| `.env.production` | Neon pooled URL | prod deploys, migrations against prod |

`neon env pull` OVERWRITES `DATABASE_URL` in `.env` — re-check it afterwards and
keep local dev on Docker. Both files are gitignored; never commit credentials.
All commands below read the URL from the environment: `set -a && source
.env.production && set +a` for prod operations.

## 1. Required runtime environment

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` — reachable from the app |
| `AUTH_SECRET` | **required, ≥16 chars** (e.g. `openssl rand -hex 32`) |

### Managed database — Neon (recommended)

1. Create a Neon project (Postgres 16+) and copy the **pooled** connection string
   (hostname contains `-pooler`).
2. Append `?sslmode=require` if not present — Neon rejects non-TLS sessions.
3. Point migrations at it once, from anywhere:
   ```bash
   DATABASE_URL="postgresql://…neon.tech…?sslmode=require" npx prisma migrate deploy
   ```
4. Bootstrap the first admin against it:
   ```bash
   DATABASE_URL="…" npm run user:add        # prints the password once
   ```
5. Use the same pooled URL as the app's `DATABASE_URL`.

Notes: long-running containers can also use the direct (non-pooled) hostname;
serverless/Lambda-style hosting should always use the pooled one. The seed
pipeline (`seed:job1571`) is demo data — do NOT run it against a production
database; create real projects through the UI/API instead.

Missing/short values fail fast: API calls return **503 `{code:"SERVER_CONFIG"}`**
and the server log names the exact variable. An unreachable database returns
**503 `{code:"DB_UNAVAILABLE"}`**.

## 2. Container path (recommended)

```bash
docker build -t procare .
docker run -d --name procare \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  procare
```

Then, once:

```bash
docker exec procare npx prisma migrate deploy     # create/update schema
docker exec procare node --env-file=/dev/null scripts/user-add.mjs   # bootstrap admin (prints password once)
# optional demo dataset:
docker exec -it procare npm run seed:job1571      # needs .env-style DATABASE_URL in process env
```

Health check: `GET /api/health` → `{"app":"ok","db":"ok"}`.

## 3. Bare Node path

Node ≥ 20.9 required (`engines` field enforced).

```bash
npm ci                 # runs prisma generate via postinstall
npm run build
npm run db:migrate     # prisma migrate deploy (needs DATABASE_URL)
npm run start          # needs DATABASE_URL + AUTH_SECRET in env
```

Bootstrap the first admin with `npm run user:add`.

## 4. First-login checklist (the "500 on login" triage)

| Symptom | Cause | Fix |
|---|---|---|
| 503 `SERVER_CONFIG`, log says `AUTH_SECRET is not set` | env var absent/too short | set AUTH_SECRET ≥16 chars, restart |
| 503 `DB_UNAVAILABLE`, log shows connection error | wrong host/credentials/firewall | fix DATABASE_URL, restart |
| 401 `INVALID_CREDENTIALS` (correct password) | user table empty or migrated from nowhere | run migrate deploy + user:add |
| 500 with log `P2021/P2022 table does not exist` | migrations never applied | run migrate deploy |

Server logs always carry the precise reason one line above the response.
