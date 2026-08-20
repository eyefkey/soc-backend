# SOC Backend

Incident-response API for a Security Operations Centre: incidents, the alerts
and evidence attached to them, the assets they affect, and the investigations
and findings that come out of them — with a correlation engine, a risk score,
and an audit trail over the whole thing.

Built with [NestJS](https://nestjs.com) 11, [Prisma](https://prisma.io) 7 and
PostgreSQL 17.

## Quick start

The whole stack (frontend, backend, database) runs from the repository root:

```bash
cp .env.example .env && docker compose up --build
```

The backend listens on `http://localhost:4000`, the frontend on
`http://localhost:3000`. Migrations are applied automatically on startup.

To run only the backend and its database:

```bash
docker compose up --build postgres backend
```

### Running outside Docker

Requires Node 22+ and a reachable PostgreSQL instance.

```bash
cd soc-backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run start:dev
```

## Environment

`soc-backend/.env` configures the app itself; the root `.env` supplies secrets
to `docker compose`. Both have a committed `.env.example`.

| Variable         | Required | Default                 | Notes                                                 |
| ---------------- | -------- | ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL`   | yes      | —                       | Host is `localhost` locally, `postgres` under compose |
| `JWT_SECRET`     | yes      | —                       | No fallback: the app refuses to start without it      |
| `JWT_EXPIRES_IN` | no       | `1h`                    | Any `ms`-style duration                               |
| `PORT`           | no       | `4000`                  |                                                       |
| `CORS_ORIGIN`    | no       | `http://localhost:3000` | Allowed browser origin                                |

Generate a signing key:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Authentication

Every route requires a bearer token unless explicitly marked public. Only
`GET /`, `GET /health`, `GET /health/ready` and `POST /auth/login` are open.

### First run

The system starts with no accounts. **The first account registered becomes an
`ADMIN`**, which bootstraps the instance:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@soc.local","username":"admin","password":"a-long-password"}'
```

Once any account exists, registration requires an `ADMIN` caller — anonymous
requests are rejected with `403`. Accounts created afterwards default to
`VIEWER` unless the ADMIN specifies a `role`.

### Logging in

```bash
curl -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin","password":"a-long-password"}'
```

`identifier` accepts either the username or the email address. The response
carries `accessToken`; send it as `Authorization: Bearer <token>`.

### Roles

Roles are ranked, so a higher role satisfies any lower requirement.

| Role      | May                                                                             |
| --------- | ------------------------------------------------------------------------------- |
| `VIEWER`  | Read everything                                                                 |
| `ANALYST` | Everything above, plus create and update                                        |
| `ADMIN`   | Everything above, plus delete, manage accounts, and write audit entries by hand |

Passwords are hashed with `scrypt` from the Node standard library. Tuning
parameters are stored in each hash record, so they can be raised later without
invalidating existing passwords.

Because the role is re-read from the database on every request rather than
trusted from the token, a role change or deactivation applies immediately.
The cost is one primary-key lookup per request, which stands in for the
token revocation the service does not yet have.

### Rate limiting

Ordinary traffic is capped at 120 requests a minute. The credential
endpoints are much tighter — 5 a minute for `/auth/login` and
`/auth/change-password`, 10 for `/auth/register` — and the limiter runs
before authentication, so a flood is refused before it costs a password
hash. Health probes are exempt.

Counters are held in memory, so limits are **per instance**: running more
than one replica needs a shared store.

## API

All list endpoints accept `skip` and `take` (default 25, max 100) and return:

```json
{ "data": [], "meta": { "total": 0, "skip": 0, "take": 25 } }
```

### Auth

| Method  | Path                    | Role                                       |
| ------- | ----------------------- | ------------------------------------------ |
| `POST`  | `/auth/register`        | ADMIN (or anonymous for the first account) |
| `POST`  | `/auth/login`           | public                                     |
| `GET`   | `/auth/me`              | any                                        |
| `POST`  | `/auth/change-password` | any (own account)                          |
| `GET`   | `/auth/users`           | ADMIN                                      |
| `PATCH` | `/auth/users/:id`       | ADMIN                                      |

An ADMIN can change another account's `role` or set `isActive: false` to
disable it. Both take effect on the next request rather than at token
expiry, and an ADMIN cannot demote or disable their own account — that would
be a one-click lockout.

### Health

| Method | Path            | Notes                                                                           |
| ------ | --------------- | ------------------------------------------------------------------------------- |
| `GET`  | `/health`       | Liveness. Does not touch the database, so an outage cannot cause a restart loop |
| `GET`  | `/health/ready` | Readiness. Checks the database; returns `503` when it is unreachable            |

### Incidents

| Method   | Path             | Role    | Notes                                            |
| -------- | ---------------- | ------- | ------------------------------------------------ |
| `POST`   | `/incidents`     | ANALYST |                                                  |
| `GET`    | `/incidents`     | any     | Filters: `status`, `severity`                    |
| `GET`    | `/incidents/:id` | any     | Includes alerts, evidence, assets, investigation |
| `PATCH`  | `/incidents/:id` | ANALYST | Status transitions live here                     |
| `DELETE` | `/incidents/:id` | ADMIN   | Cascades to evidence, asset links, investigation |

### Alerts

| Method   | Path          | Role    | Notes                                                        |
| -------- | ------------- | ------- | ------------------------------------------------------------ |
| `POST`   | `/alerts`     | ANALYST |                                                              |
| `GET`    | `/alerts`     | any     | Filters: `severity`, `incidentId`, `source`                  |
| `GET`    | `/alerts/:id` | any     |                                                              |
| `PATCH`  | `/alerts/:id` | ANALYST | Set `incidentId` to move between incidents, `null` to detach |
| `DELETE` | `/alerts/:id` | ADMIN   |                                                              |

### Assets

| Method   | Path                                | Role    | Notes                                  |
| -------- | ----------------------------------- | ------- | -------------------------------------- |
| `POST`   | `/assets`                           | ANALYST |                                        |
| `GET`    | `/assets`                           | any     | Filters: `type`, `status`, `ipAddress` |
| `GET`    | `/assets/:id`                       | any     |                                        |
| `PATCH`  | `/assets/:id`                       | ANALYST |                                        |
| `DELETE` | `/assets/:id`                       | ADMIN   |                                        |
| `POST`   | `/assets/:id/incidents/:incidentId` | ANALYST | Attach; idempotent                     |
| `DELETE` | `/assets/:id/incidents/:incidentId` | ANALYST | Detach                                 |

### Evidence

| Method   | Path            | Role    | Notes                            |
| -------- | --------------- | ------- | -------------------------------- |
| `POST`   | `/evidence`     | ANALYST |                                  |
| `GET`    | `/evidence`     | any     | Filters: `type`, `incidentId`    |
| `GET`    | `/evidence/:id` | any     |                                  |
| `PATCH`  | `/evidence/:id` | ANALYST | The owning incident is immutable |
| `DELETE` | `/evidence/:id` | ADMIN   |                                  |

### Investigations

One investigation per incident; creating a second returns the existing one.

| Method  | Path                               | Role    | Notes                                       |
| ------- | ---------------------------------- | ------- | ------------------------------------------- |
| `POST`  | `/investigations`                  | ANALYST |                                             |
| `GET`   | `/investigations`                  | any     | Filters: `status`, `assignedTo`             |
| `GET`   | `/investigations/:id`              | any     |                                             |
| `PATCH` | `/investigations/:id`              | ANALYST | `status`, `assignedTo`, `conclusion`        |
| `GET`   | `/investigations/:id/timeline`     | any     | Merged case history                         |
| `GET`   | `/investigations/:id/events`       | any     | Typed events with metadata                  |
| `GET`   | `/investigations/:id/summary`      | any     | Everything about the case in one response   |
| `GET`   | `/investigations/:id/risk`         | any     | Score, level, contributing factors          |
| `GET`   | `/investigations/:id/correlations` | any     |                                             |
| `GET`   | `/investigations/:id/explanation`  | any     | Plain-language rationale for the risk level |

`completedAt` is derived, never set by the client: reaching `RESOLVED` or
`CLOSED` stamps it, and reopening clears it.

### Findings

| Method   | Path                                            | Role    |
| -------- | ----------------------------------------------- | ------- |
| `POST`   | `/investigations/:investigationId/findings`     | ANALYST |
| `GET`    | `/investigations/:investigationId/findings`     | any     |
| `GET`    | `/investigations/:investigationId/findings/:id` | any     |
| `PATCH`  | `/investigations/:investigationId/findings/:id` | ANALYST |
| `DELETE` | `/investigations/:investigationId/findings/:id` | ADMIN   |

### Correlations

| Method | Path                              | Role |
| ------ | --------------------------------- | ---- |
| `GET`  | `/correlations/investigation/:id` | any  |

### Audit

| Method | Path                              | Role  | Notes                                             |
| ------ | --------------------------------- | ----- | ------------------------------------------------- |
| `GET`  | `/audit`                          | any   | Filters: `entity`, `action`, `entityId`, `userId` |
| `GET`  | `/audit/entity/:entity/:entityId` | any   | Full trail for one record                         |
| `POST` | `/audit`                          | ADMIN | Manual entry, for backfills                       |

## How it fits together

### Audit trail

Every write is recorded, and the audit entry is written **inside the same
transaction** as the change it describes — an entry cannot be committed
without its change, or the reverse.

Attribution is ambient rather than threaded through every call. Middleware
opens an `AsyncLocalStorage` store with the caller's IP and user agent, the
JWT guard adds the actor once the token is verified, and `AuditService` reads
it. No service signature mentions the current user.

Audit rows carry no foreign key, so the trail for a deleted incident outlives
the incident.

### Correlation and risk

Both run over one loaded snapshot of an investigation
(`InvestigationContextService`), and the rule evaluation and scoring are pure
functions over that snapshot — so they are unit tested without a database.

Correlation rules:

1. **Alert to asset** — alert target IP matches an asset IP.
2. **Alert to evidence** — an alert IP appears in an evidence value. An exact
   match scores `HIGH`, a substring match `MEDIUM`.
3. **Evidence to asset** — evidence contains an asset IP.
4. **Finding to investigation** — carries the finding's own stated confidence.

Risk is additive and capped at 100: alert severity (5–35 each), an external
source IP (15), an affected asset (20), supporting evidence (15), more than
one alert (10), a high-confidence finding (15). Bands: `LOW` below 30,
`MEDIUM` 30–59, `HIGH` 60–79, `CRITICAL` 80+.

### Timeline vs events

`/timeline` is a flat merged history — incident, alerts, evidence, and
audit entries in one ordered list. `/events` is the typed view, with per-event
metadata, for a client that wants to render each kind differently.

## Development

```bash
npm run start:dev      # watch mode
npm test               # unit tests
npm run test:cov       # coverage
npm run lint           # eslint, autofix
npm run format         # prettier, write
npm run format:check   # prettier, verify
```

### Database

```bash
npx prisma migrate dev --name <change>   # create and apply a migration
npx prisma migrate deploy                # apply pending migrations
npx prisma studio                        # browse data
```

### Tests

Unit specs mock every injected dependency, which means they cannot catch a
provider that is used but never exported from — or imported into — its module.
[`src/app.module.spec.ts`](src/app.module.spec.ts) closes that gap: it compiles
the real module graph with only `PrismaService` stubbed, so wiring mistakes
fail in the test run rather than at container boot.

End-to-end specs (`npm run test:e2e`) run the real stack — guards, pipes,
Prisma, PostgreSQL — against a dedicated `soc_e2e` database that is created
and migrated automatically, so a run never touches development data. They
need PostgreSQL up (`docker compose up -d postgres`) and run serially,
since they share one database and the rate limiter counts per process.

### Build output

TypeScript roots the build at the project directory, not `src`, because
`prisma.config.ts` and the generated client sit outside it. The entry point is
therefore `dist/src/main.js` — which is what `start:prod` runs.
