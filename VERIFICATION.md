# Migration-only conversion verification

Verified locally on September 10, 2026, with Node 24.14.1 and Go 1.26.8.
These results were recorded before committing the conversion. Production
deployment was outside the scope of these maintenance checks.

## Scope

Removed HTTP entrypoints, routes, controllers, middleware, API services,
validators, authorization handlers, integration adapters, and the three old
scheduled business commands. Removed their direct dependencies and regenerated
the lockfile. The remaining six runtime dependencies support Ace, Lucid, CSV
seeding, dates, PostgreSQL, and decorator metadata.

Kept all 34 historical migration files byte-for-byte. Seed-only models now live
under `database/models`; RBAC seed support and the preflight role-code catalog
also live under `database/`. Password creation still uses the original scrypt
settings. Reference-data seeding batches primary-key upserts; countries retain
the original code-based lookup because that column has no unique constraint.

The workspace launcher defaults to Go on port 3334. The Go differential harness
uses the immutable Adonis API revision
`dd8d0ff409c34eaaebb8c2e3ec8a046efbf11356`, while fixture migrations run from this
current migration repository. Go production API and job source did not change.

## Results

| Command / check | Result |
| --- | --- |
| `npm run lint` | Passed; existing upstream ESLint plugin deprecation notice remains |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; compiled console and CSV data produced, no server entrypoint |
| `node ace list` | Passed; RBAC preflight is discoverable, business job commands absent |
| `MIGRATION_TEST_ENV=../docs/.env.test.be npm test` | Both tests passed; no skips; about 18 seconds |
| Go `node scripts/check.mjs` | Formatting, vet, compilation, dependency verification, sqlc output, harness syntax, normalization tests passed |
| Go `make test-unit` | Full race-enabled Go suite passed, including cross-language crypto fixtures |
| Go inventory generation | Reproduced 139 routes, 54 validators, 16 roles from the historical reference |
| Go reference/auth/Google/image comparisons | 54 + 28 + 18 + 38 scenarios equivalent; zero differences |
| Final Go fixture create/reference/drop cycle | Three schemas migrated with 25 tables each; 54 reference scenarios equivalent; cleanup passed |
| `bash -n ../start-all.sh` | Passed |
| `../start-all.sh --check test` | Reported existing listeners on 3333, 3005, 3000; those services were left running |
| `git diff --check` | Passed |

The PostgreSQL test executes real Ace commands for fresh migrations, a repeated
migration run, compiled migration status, RBAC seeding, and the full demo seeder.
It checks read-only preflight without database changes, inactive-bootstrap
rejection, demo member and achievement counts, scrypt password storage, and
reference-data presence. Compiled RBAC preflight also passes.

The first demo-seeder test was stopped after excessive individual university
writes; its owned schema was cleaned. An intermediate batch-seeder check exposed
the missing unique constraint on country codes; that path now retains its
original lookup behavior. The final test passed after both fixes.

## Evidence and cleanup

The passing maintenance test is recorded in
`tmp/1138f965b9e5bb5d/`, including all Ace command logs and `cleanup.json` with
`tests: passed` and `status: cleaned`. Both earlier test schemas also have
recorded successful cleanup.

Go evidence remains under its ignored `.artifacts/` directory:

- `migration-only-go-unit.log` and `check.json`.
- `contracts/` records for reference, auth, Google, and images.
- Image comparison deleted all five recorded Adonis objects and all five Go
  objects. No bucket-wide configuration changes were needed.
- Final `schemas.json` records run `c14d2d14519a66be` as cleaned, with an empty
  storage-key list and all three schemas confirmed absent.

No shared application tables were reset. No production migrations, seeders,
deployments, or traffic changes were performed for this conversion. Browser
suites and the Linux Docker build were not rerun for this maintenance change;
the previous full rewrite/deployment evidence remains in the Go repository.
