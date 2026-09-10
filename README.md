# Kaderisasi database maintenance

Agent contribution rules: [AGENTS.md](AGENTS.md). `CLAUDE.md` imports the same rules.

This repository owns the PostgreSQL migrations shared by the Go admin API and
the Adonis public API. It contains no HTTP server, routes, controllers, storage
adapter, or scheduled business jobs. The API and all three jobs run from
[`kaderisasi-admin-be-go`](https://github.com/salman-digital-lab/kaderisasi-admin-be-go).

## Setup and commands

Use Node 24 and run `npm ci`. Supply the database variables from `.env.example`
through the process environment or a local `.env`. Existing backend environment
files remain compatible; HTTP, Google, mail, and storage credentials are no longer
required. `DB_SCHEMA` optionally restricts connections to one schema, with no
`public` fallback. Omit it for the normal PostgreSQL search path.

```sh
node ace migration:status
node ace make:migration <name>
node ace migration:run
node ace rbac:preflight
node ace db:seed --files=database/seeders/admin_rbac_seeder.ts
```

For a fresh database, set `ADMIN_BOOTSTRAP_EMAILS` to the explicitly chosen
administrator email(s) before migration. RBAC preflight is read-only and checks
the selected schema. The RBAC seeder preserves other assignments and refuses to
reactivate inactive accounts.

The optional `database/seeders/main_seeder.ts` imports reference CSV data and
creates random demo accounts and achievements. Run it only when demo data is
intended; ordinary deployment needs migrations and preflight, not demo seeding.
Models and factories under `database/` exist only to support these seeders.

All 34 historical migrations retain their original contents and filenames.
Create future migrations here and check compatibility with both backends. The
RBAC reset migration is forward-only: do not use reset/fresh/rollback as a way to
switch API implementations. Bulk import tools remain in `../db-migrate`.

## Build and verification

```sh
npm run lint
npm run typecheck
npm run build
MIGRATION_TEST_ENV=../docs/.env.test.be npm test
```

Tests require a dedicated test PostgreSQL environment file and schema-creation
permission. They create a uniquely named schema, execute the real Ace migration
and seeder commands, verify preflight behavior and password hashing, then delete
only that schema after checking its ownership marker. Logs and cleanup evidence
are written under `tmp/<run-id>/`. The test fails if integration configuration is
missing; it does not silently skip database checks.

The compiled console can be distributed from `build/` with
`npm ci --omit=dev`, then invoked with `node ace migration:status` or other Ace
maintenance commands. The generic Adonis build banner mentions `bin/server.js`;
that entrypoint is intentionally absent. There is no `npm start` or `npm run dev`.
The workspace launcher starts the Go API on port 3334 by default.

## Historical API reference

The last Adonis API revision is
`dd8d0ff409c34eaaebb8c2e3ec8a046efbf11356`. It remains in Git history for rollback
and differential testing. In the Go repository, `make prepare-reference` creates
a detached checkout under `.artifacts/legacy-admin-be` at the recorded revision.
Tests use that checkout for old API behavior and this repository for migrations.
Production rollback uses the retained Coolify image described in the Go repo's
`docs/COOLIFY.md`; changing this repository does not switch live traffic.
