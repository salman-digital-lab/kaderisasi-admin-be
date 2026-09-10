# Database maintenance rules

This repository is **database maintenance only**. It owns the shared PostgreSQL
migrations, seeders, RBAC preflight, and the helpers those commands require.
When working in the full workspace, also read `../AGENTS.md`.

## Boundaries

- Admin API features, authentication, permissions enforcement, uploads, exports,
  certificates, and scheduled business jobs belong in `../kaderisasi-admin-be-go`.
  Do not add an HTTP server, routes, controllers, middleware, or business scheduler here.
- The Go admin API serves port **3334**. This repository serves no port and has no
  `npm run dev` or `npm start`. The generic Adonis build banner is not a reason to
  recreate `bin/server.ts`.
- `../kaderisasi-web-be` remains the AdonisJS public API on **3333**. Both APIs
  consume the schema maintained here.

## Database changes

- Create and run migrations using AdonisJS Ace from this repository only.
  Preserve applied migration files; add migrations for later schema changes.
- Check affected Go SQL/types and public-backend Lucid models/queries/validators.
  Update the Go sqlc snapshot and regenerate its queries when needed. Do not
  introduce a separate Go migration runner.
- Keep models under `database/models` limited to seed dependencies and shared
  migration helpers under `database/support`. Do not rebuild an API model layer.
- `database/constants/admin_roles.ts` lists codes for RBAC preflight. Runtime
  role/permission definitions live in the Go repository's `internal/auth` catalogs;
  keep the code list consistent with approved role changes.
- Keep RBAC seeding transactional, idempotent, and protected by its advisory lock.
  Preserve other role assignments and reject inactive bootstrap accounts.
  RBAC preflight must stay read-only and respect the selected schema.
- `DB_SCHEMA` is optional; when supplied, its search path must not fall back to
  `public`. Preserve the normal application's default behavior when it is omitted.
- Do not run general demo seeding on production/shared application data. The
  main seeder creates demo accounts and achievements in addition to reference data.
- The historical RBAC reset migration is forward-only. Never reset shared tables
  or roll back migrations simply to switch between API implementations.

## Commands and verification

```sh
npm ci
node ace make:migration <name>
node ace migration:status
node ace migration:run
node ace rbac:preflight
# Only for an intended targeted bootstrap seed:
node ace db:seed --files=database/seeders/admin_rbac_seeder.ts
```

Supply the intended database environment explicitly. `README.md` and `.env.example`
describe configuration. Never print or commit secret values.

For migration, seeder, preflight, or configuration changes:

```sh
npm run lint
npm run typecheck
npm run build
MIGRATION_TEST_ENV=../docs/.env.test.be npm test
```

Tests must use a dedicated test environment and uniquely owned schemas. Retain
the historical migration integrity assertions, exercise real Ace commands and
database effects, and record cleanup after success or failure. Clean only owned
fixture resources. Documentation-only changes need consistency checks instead.

The old API is preserved in Git history for compatibility comparisons and
rollback. The Go repository's `make prepare-reference` creates its pinned test
checkout. Do not modify that historical checkout for new features.
