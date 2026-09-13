# Legacy member migration and retirement

Run these commands from this repository. The runner loads `../docs/.env.prod.be`
or `../docs/.env.test.be` into the child environment without replacing `.env`.
Use a reviewed release checkout containing only intended pending migrations.
Never run a general production migration command without checking its pending list.

## Review and resolve

```sh
mkdir -p tmp/legacy-members
chmod 700 tmp/legacy-members
node scripts/maintenance.mjs --environment=prod migration:status
node scripts/maintenance.mjs --environment=prod legacy-members:migrate --report=tmp/legacy-members/dry-run.json
```

Dry run is a PostgreSQL read-only, repeatable-read transaction and works before
the journal migration is installed. Exit code 1 means unresolved blockers. Reports
contain personal information, are written with mode 0600, and must remain outside
Git. Never upload them to deployment logs. Passwords are excluded.

Match by trimmed, case-insensitive email. Duplicate public matches require an
explicit `publicUserId` belonging to the matching candidates. Duplicate source
emails, multiple profiles, invalid fields, and changed previously migrated rows
block apply. A correction must not redirect a member to an unrelated account.

Supply reviewed corrections in a JSON file:

```json
{
  "members": {
    "123": { "publicUserId": 456 },
    "789": { "fields": { "intake_year": null, "email": null } }
  }
}
```

Keys are legacy IDs. Omit unresolved decisions; do not guess an account or a year.
Allowed source corrections: name, gender, email, phone, line_id, intake_year,
ssc, lmd, spectra. Corrected email matching uses the corrected address; review
identity ownership before approving a correction. Raw source values and the
approved resolution remain in the journal. Integer-valued years such as `2023.0`
become 2023 automatically. Nonempty years outside 1900–2100 or abbreviated years
require resolution. Malformed emails require correction or explicit nulling.

Existing credentials, IDs, account statuses, and populated profile fields remain
unchanged. Zero is a populated level, not a missing value. Existing badges are
normalized using the public application's null/text/array conventions and combined
with source badges without duplicates. SSC/LMD/SPECTRA history is preserved as
badges and in the original source journal, even when an existing level wins.
The report records profile conflicts; the selected fill-gaps policy resolves them
by keeping current values. Empty profiles are created from the legacy information.

New email-bearing accounts are active with null passwords. New records without
email use `no_account`. Password login requires the existing password-reset flow;
verified Google sign-in remains available. No reset emails are sent by migration.

## Cutover

### Approved duplicate and malformed-email cleanup

The approved rule keeps the lowest public user ID in each normalized-email group
and deletes higher-ID duplicate accounts. Keep the lower account's password,
member ID, status, and populated profile fields; fill missing profile values from
the duplicate, union badges, and transfer non-overlapping activity registrations
without changing their registration IDs or statuses. Unknown linked data and
overlapping registrations block deletion. All remaining public emails are trimmed
and lowercased after duplicates are removed, respecting the existing unique key.

The user also approved deleting legacy records with malformed emails. The
`--discard-invalid-legacy-emails` option deletes only nonempty invalid addresses;
it retains the email-less member. It does not delete members with uncertain intake
years. Those values still require a separate resolution.

```sh
node scripts/maintenance.mjs --environment=prod public-users:normalize-emails --discard-invalid-legacy-emails --report=tmp/legacy-members/email-cleanup-dry.json
node scripts/backup-public-users.mjs --environment=prod
node scripts/maintenance.mjs --environment=prod public-users:normalize-emails --discard-invalid-legacy-emails --backup=/absolute/path/to/manifest.json --report=tmp/legacy-members/email-cleanup-applied.json --apply
```

Use a new report filename per invocation. The backup command takes a consistent
full database dump, restores it into an owned temporary database using the test
environment, checks data fingerprints, and removes the restore database. The
restricted backup and manifest remain in `tmp/public-email-backup-*`. Application
locks the affected tables and refuses to proceed if user, profile, registration,
or legacy data has changed since that verified snapshot. Refresh the backup and
retry if this happens. No partial deletions commit on failure.

This cleanup requires no new schema migration and must precede the legacy-member
backfill. Re-run the legacy dry run afterwards; earlier counts and conflict
reports become historical evidence.

### Legacy backfill and table retirement

1. Pass isolated tests and review a blocker-free production dry run with the
   approved resolution file. Inventory pending migrations and deployed consumers,
   including any local processes connected to production.
2. Back up production using `pg_dump` with credentials supplied through environment
   variables. Keep the backup restricted. Verify its SHA-256 and restore it into
   an isolated database; compare table counts and constraints. Record the backup
   path and verification evidence. Never restore over the shared application DB.
3. Pause authentication and member/profile writes in all production API instances
   and scheduled/import processes. The dedicated cutover migration blocks writes
   to users, profiles, and legacy members unless the connection identifies itself
   as `legacy-member-maintenance`. The maintenance runner sets that application
   name; normal API reads and existing password login remain available. Create the
   journal first, then pause writes and take the final consistent backup:

```sh
node scripts/maintenance.mjs --environment=prod migration:run --force
node scripts/maintenance.mjs --environment=prod --pause-members migration:run --force
node scripts/backup-public-users.mjs --environment=prod
```

   The pause is reversible without changing member data. If the cutover fails
   before retirement, and the pause is still the most recent migration batch, use
   `node scripts/maintenance.mjs --environment=prod --pause-members migration:rollback --force`.
   This rolls back only the temporary write guard, never the journal or historical
   application migrations. Successful retirement removes the guard automatically.
4. Run the approved ordinary Ace migrations to create `legacy_member_migrations`.
   Do not run unrelated pending migrations as part of this release.
5. Run the same command with `--apply` and the reviewed resolutions:

```sh
node scripts/maintenance.mjs --environment=prod migration:run --force
node scripts/maintenance.mjs --environment=prod legacy-members:migrate --resolutions=tmp/legacy-members/resolutions.json --report=tmp/legacy-members/applied.json --apply
node scripts/maintenance.mjs --environment=prod legacy-members:migrate --resolutions=tmp/legacy-members/resolutions.json --report=tmp/legacy-members/reconciled.json
```

All plans are validated before writes. Application uses batches of 500 inside
one transaction. A failure rolls back users, profiles, and journal entries;
PostgreSQL sequences may retain gaps. A report is provisional if transaction
commit fails; a successful rerun is the source of truth. Never edit the journal
to bypass changed-source or changed-target checks.

6. Deploy the cleaned public API. Verify normal login, null-password rejection,
   registration conflict, and Google/recovery behavior using controlled accounts.
   Do not send reset emails to members as a smoke test. Preserve existing API/JWT
   envelopes. Keep writes paused for real members.
7. Create a restricted cutover evidence JSON with these fields:

```json
{
  "environment": "prod",
  "schema": "public",
  "backupPath": "/absolute/path/to/verified-backup.dump",
  "backupSha256": "sha256-of-that-file",
  "restoreVerified": true,
  "deploymentRef": "verified-public-api-commit-or-deployment-id",
  "authenticationVerified": true,
  "writesPaused": true,
  "verifiedAt": "ISO-8601-time-of-verification",
  "sourceCount": 40504
}
```

Use the actual reconciled count and actual verification results. The evidence must
be less than an hour old. These fields are operator attestations; the migration
checks the backup checksum and database reconciliation itself, but cannot query
the deployment platform or prove that all API instances have stopped writing.

```sh
LEGACY_MEMBER_CUTOVER_FILE=/absolute/path/to/cutover.json node scripts/maintenance.mjs --environment=prod --retirement migration:run --force
```

Retirement uses a separate migration directory, so ordinary deploys cannot drop
the table. Under locks it checks every source fingerprint, destination user and
profile, target fingerprint, and row count. `DROP TABLE` never uses `CASCADE`.
Unresolved dependencies or any changed data abort the retirement transaction.

8. Resume writes and verify `/health`, authentication errors, and member totals.
   Keep the backup, reports, resolutions, and deployment evidence restricted.

The journal retains historical IDs without foreign keys so normal member deletion
continues to work after retirement. Retirement explicitly checks referential
integrity while the source table still exists. Its source payload has no password.

If any gate fails, keep the legacy table and pause the cutover. Neither journal
nor retirement migration supports rollback. Post-drop recovery requires the
verified backup and a coordinated application/database recovery, not migration
rollback or resets of shared tables.

## Tests

```sh
npm run lint
npm run typecheck
npm run build
MIGRATION_TEST_ENV=../docs/.env.test.be npm test
```

Tests use uniquely owned schemas with no public fallback, exercise real Ace
commands, and record cleanup in `tmp`. Suites run sequentially because Lucid's
migration advisory lock is shared across schemas. Public authentication regression
tests run with `node scripts/test-google-auth.mjs` in `kaderisasi-web-be`; that
fixture deliberately omits the legacy table.
