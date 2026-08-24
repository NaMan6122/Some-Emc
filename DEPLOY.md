# Deployment Runbook (T-031)

Target per TDD §12: single Node container + PostgreSQL 16. Everything below is
idempotent; re-running after a failed deploy is safe.

## 1. Required runtime environment

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` — reachable from the app |
| `AUTH_SECRET` | **required, ≥16 chars** (e.g. `openssl rand -hex 32`) |

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
