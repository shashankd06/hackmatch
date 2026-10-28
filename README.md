# HackMatch

A multi-track hackathon teammate discovery platform. Next.js App Router + PostgreSQL + pgvector. Designed as a two-person DBMS Level 3 project.

## Start on Ubuntu

Prerequisites: Node.js 22.13+ (24 LTS recommended), npm, Docker Engine and Docker Compose plugin. First dependency install and embedding model download require internet. Models subsequently run locally on CPU, with no paid API.

Extract this folder into `/home/shashankd/Documents/sem5/dbms/hackmatch`, then:

```bash
cd /home/shashankd/Documents/sem5/dbms/hackmatch
cp .env.example .env
# Edit .env: choose SEED_PASSWORD (10+ characters).
ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm install
docker compose up -d --wait
npm run db:init
npm run db:seed
npm run embed
npm run dev
```

Open http://localhost:3000. Use exactly this origin; using 127.0.0.1 requires changing APP_ORIGIN. Do not commit .env. If port 5432 is occupied, change the Compose host port and DATABASE_URL together.

Accounts: `admin@hackmatch.local`, `arjun@hackmatch.local`, `ananya@hackmatch.local`, `riya@hackmatch.local`, `kabir@hackmatch.local`, `meera@hackmatch.local`, `dev@hackmatch.local`. All use your SEED_PASSWORD. New registrations always become participants; administrator assignment is not exposed to the client.

`db:init` and `db:seed` run once on an empty database. They deliberately fail instead of silently overwriting an existing installation. `npm run embed` can be repeated after profile changes and team creation. It generates 384-dimensional vectors for all profiles/openings. A profile save invalidates its old vector, so stale skills are not silently matched. The UI explicitly explains this step. Queries can be embedded on demand. This is a small-project batch refresh design, not a background job service.

## Commands

```bash
npm run build
npm start
npm test
npm run test:db
npm run test:semantic
```

`npm test` runs isolated SQL integration tests in PGlite (real embedded PostgreSQL + vector); it does not touch your application database. `npm run test:db` runs a separate-schema concurrency test against PostgreSQL using DATABASE_URL. See docs/TESTING.md for details and verification results.

## Demo in five minutes

1. Sign in as admin; view registration metrics and add a track or close/reopen it.
2. Sign in as Arjun; inspect PhishGuard, its open ML developer role and crew.
3. Find teammates: search "text classification and transformers" or use the team's opening shortcut. Ananya is a relevant candidate (ordering is model-dependent).
4. In a separate browser/private window, sign in as Ananya and apply to PhishGuard from Explore. Submit a short contribution message.
5. As Arjun, accept the application. Both accounts show updated membership, and other pending applications for Ananya close atomically.
6. Attempt duplicate application, full-team acceptance and unauthorized decisions; show database test results alongside the interface.
7. Return as admin and show updated track counts. Walk through SQL views, transaction function, indexes, triggers and vector query.

## Features

- Email/password accounts, scrypt password hashing, random server-side sessions with hashed tokens and HttpOnly cookies.
- Participant and administrator authorization, plus team-scoped captain permissions.
- Tracks, exact name/skill search, team discovery, recruitment openings and participant profiles.
- Applications, acceptance/rejection/withdrawal, leadership transfer, leaving and confirmed team deletion.
- Semantic candidate and team-opening search using MiniLM + pgvector cosine distance.
- Team-capacity dashboard, registration controls, seeded sample content and responsive UI.

## How the code fits together

- `app/page.js`: responsive participant/admin interface.
- `app/api/[...path]/route.js`: validated API routes and role/ownership checks.
- `lib/db.mjs`: parameterized PostgreSQL queries and transaction helper.
- `lib/auth.mjs`: password hashes, sessions and cookies.
- `lib/embedding.mjs`: locally cached MiniLM inference and vector validation.
- `sql/001_schema.sql`: schema, constraints, triggers, function, views, indexes.
- `scripts/`: one-time schema setup, seeded data and repeatable embeddings.
- `docs/`: design, rubric mapping, queries, contributions and tests.

## Configuration and practical limits

Local Docker binds PostgreSQL to loopback only. The default database password is local development configuration; change it consistently in Compose and DATABASE_URL for any shared deployment. For HTTPS hosting, set APP_ORIGIN to the deployed origin and COOKIE_SECURE=true; configure database TLS according to your provider. Never disable certificate checks globally.

This archive is a local application, not a hosted deployment. It has no chat, external hackathon scraping or automated team generation. There is no password reset/email verification, distributed rate limiter or background embedding worker; add these before an Internet-facing launch. Core operations use validated parameterized queries, database constraints and server-side permission checks. The configured database user owns the schema for a college demo; a production deployment should use a least-privileged runtime role.

The app intentionally supports one hackathon with multiple tracks and one team per participant. SQL migrations are first-install schema scripts; add versioned migrations for subsequent schema changes. Keep your own Git history with real contributions: no individual commit history is fabricated in this download.

## References

- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/api-reference/functions/cookies
- https://github.com/pgvector/pgvector
- https://huggingface.co/Xenova/all-MiniLM-L6-v2
- https://www.postgresql.org/docs/current/explicit-locking.html
