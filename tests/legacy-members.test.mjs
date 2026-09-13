import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

test(
  'legacy member migration, reconciliation, and guarded retirement',
  { timeout: 240000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV, 'Dedicated test environment required')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const root = resolve(import.meta.dirname, '..')
    const schema = `legacy_member_test_${randomBytes(8).toString('hex')}`
    const artifact = resolve(root, 'tmp', schema)
    mkdirSync(artifact, { recursive: true, mode: 0o700 })
    const reportPath = resolve(artifact, 'report.json')
    const resolutionPath = resolve(artifact, 'resolutions.json')
    const evidencePath = resolve(artifact, 'evidence.json')
    const client = new pg.Client({
      host: configured.DB_HOST,
      port: Number(configured.DB_PORT),
      user: configured.DB_USER,
      password: configured.DB_PASSWORD,
      database: configured.DB_DATABASE,
      connectionTimeoutMillis: 10000,
    })
    const env = {
      ...process.env,
      ...configured,
      NODE_ENV: 'test',
      DB_SCHEMA: schema,
      PGOPTIONS: `-c search_path=${schema}`,
      LEGACY_MEMBER_ENVIRONMENT: 'test',
      LEGACY_MEMBER_RETIREMENT: '',
      LEGACY_MEMBER_CUTOVER_FILE: '',
      PGAPPNAME: 'legacy-member-maintenance',
    }
    let call = 0
    function ace(args, expected = 0, extra = {}) {
      const result = spawnSync(process.execPath, ['ace', ...args], {
        cwd: root,
        env: { ...env, ...extra },
        encoding: 'utf8',
        timeout: 120000,
      })
      const output = result.stdout + result.stderr
      writeFileSync(resolve(artifact, `${++call}.log`), output, { mode: 0o600 })
      assert.equal(result.status, expected, output)
    }
    function migrate(args = [], expected = 0) {
      ace(
        ['legacy-members:migrate', '--environment=test', `--report=${reportPath}`, ...args],
        expected
      )
      return JSON.parse(readFileSync(reportPath, 'utf8'))
    }
    await client.connect()
    try {
      await client.query(`CREATE SCHEMA "${schema}"`)
      await client.query(`COMMENT ON SCHEMA "${schema}" IS 'Owned legacy member migration test'`)
      await client.query(`SET search_path TO "${schema}"`)
      ace(['migration:run', '--force'])
      const user = (
        await client.query(
          "INSERT INTO public_users(email,password,member_id,account_status,created_at) VALUES ('EXISTING@example.test','retained-hash','retained-member','inactive',now()) RETURNING id"
        )
      ).rows[0].id
      const profile = (
        await client.query(
          "INSERT INTO profiles(user_id,name,whatsapp,level,badges) VALUES ($1,'Current name','',0,'[\"SSC-5\",\"CUSTOM\"]') RETURNING id",
          [user]
        )
      ).rows[0].id
      const missingProfile = (
        await client.query(
          "INSERT INTO public_users(email,password,created_at) VALUES ('missing-profile@example.test','other-hash',now()) RETURNING id"
        )
      ).rows[0].id
      const duplicateIds = (
        await client.query(
          "INSERT INTO public_users(email,created_at) VALUES ('ambiguous@example.test',now()),('AMBIGUOUS@example.test',now()) RETURNING id"
        )
      ).rows.map((r) => r.id)
      await client.query(
        "INSERT INTO profiles(user_id,name,badges) VALUES ($1,'Existing ambiguous profile',null)",
        [duplicateIds[0]]
      )
      await client.query(`INSERT INTO legacy_members(id,name,email,gender,phone,line_id,intake_year,password,ssc,lmd,spectra) VALUES
      (1,'New','new@example.test','L','08123','line','2023.0','md5-not-imported',5,10,2),
      (2,'Old name',' existing@example.test ','P','08765','old-line','2020','md5-not-imported',5,10,null),
      (3,'No email',null,null,null,null,null,null,null,null,null),
      (4,'Missing profile','missing-profile@example.test',null,null,null,'2001',null,null,null,null),
      (5,'Ambiguous','ambiguous@example.test',null,null,null,null,null,null,null,null),
      (6,'Bad year','year@example.test',null,null,null,'19',null,null,null,null),
      (7,'Bad email','not-an-email',null,null,null,null,null,null,null,null)`)
      const before = (await client.query('SELECT * FROM public_users ORDER BY id')).rows
      ace(['migration:run', '--force'], 0, { LEGACY_MEMBER_PAUSE: '1' })
      await assert.rejects(client.query("UPDATE public_users SET email=email WHERE id=$1", [user]), /MEMBER_MAINTENANCE/)
      ace(['migration:rollback', '--force'], 0, { LEGACY_MEMBER_PAUSE: '1' })
      await client.query('UPDATE public_users SET email=email WHERE id=$1', [user])
      ace(['migration:run', '--force'], 0, { LEGACY_MEMBER_PAUSE: '1' })
      await client.query("SET application_name='legacy-member-maintenance'")
      const dry = migrate([], 1)
      assert.deepEqual(
        new Set(dry.blockers.map((b) => b.reason)),
        new Set(['AMBIGUOUS_OR_INVALID_ACCOUNT_MATCH', 'INVALID_INTAKE_YEAR', 'INVALID_EMAIL'])
      )
      assert.equal(dry.sourceCount, 7)
      assert.equal(statSync(reportPath).mode & 0o777, 0o600)
      assert.ok(!readFileSync(reportPath, 'utf8').includes('md5-not-imported'))
      migrate(['--apply'], 1)
      assert.deepEqual((await client.query('SELECT * FROM public_users ORDER BY id')).rows, before)
      assert.equal(
        (await client.query('SELECT count(*)::int AS n FROM legacy_member_migrations')).rows[0].n,
        0
      )
      writeFileSync(
        resolutionPath,
        JSON.stringify({
          members: {
            5: { publicUserId: duplicateIds[0] },
            6: { fields: { intake_year: null } },
            7: { fields: { email: null } },
          },
        }),
        { mode: 0o600 }
      )
      const resolutionArg = `--resolutions=${resolutionPath}`
      const resolved = migrate([resolutionArg])
      assert.equal(resolved.blockers.length, 0)
      assert.equal(resolved.createUsers, 4)
      assert.equal(resolved.mergeUsers, 3)
      assert.deepEqual((await client.query('SELECT * FROM public_users ORDER BY id')).rows, before)
      // A late database failure must roll back earlier users, profiles, and mappings.
      await client.query(
        "ALTER TABLE profiles ADD CONSTRAINT reject_fixture CHECK (name <> 'Bad email')"
      )
      ace(
        [
          'legacy-members:migrate',
          '--environment=test',
          `--report=${reportPath}`,
          resolutionArg,
          '--apply',
        ],
        1
      )
      assert.deepEqual((await client.query('SELECT * FROM public_users ORDER BY id')).rows, before)
      assert.equal(
        (await client.query('SELECT count(*)::int AS n FROM legacy_member_migrations')).rows[0].n,
        0
      )
      await client.query('ALTER TABLE profiles DROP CONSTRAINT reject_fixture')
      const applied = migrate([resolutionArg, '--apply'])
      assert.equal(applied.destinations.length, 7)
      for (const previous of before)
        assert.deepEqual(
          (await client.query('SELECT * FROM public_users WHERE id=$1', [previous.id])).rows[0],
          previous
        )
      const current = (await client.query('SELECT * FROM profiles WHERE id=$1', [profile])).rows[0]
      assert.equal(current.name, 'Current name')
      assert.equal(current.whatsapp, '08765')
      assert.equal(current.level, 0)
      assert.deepEqual(current.badges, ['SSC-5', 'CUSTOM', 'LMD-10'])
      assert.ok(applied.conflicts.some((c) => c.field === 'name'))
      assert.equal(
        (await client.query('SELECT name FROM profiles WHERE user_id=$1', [missingProfile])).rows[0]
          .name,
        'Missing profile'
      )
      const fresh = (
        await client.query(
          "SELECT u.*,p.intake_year,p.level,p.badges FROM public_users u JOIN profiles p ON p.user_id=u.id WHERE email='new@example.test'"
        )
      ).rows[0]
      assert.equal(fresh.password, null)
      assert.equal(fresh.member_id, String(fresh.id).padStart(8, '0'))
      assert.equal(fresh.account_status, 'active')
      assert.equal(fresh.intake_year, 2023)
      assert.equal(fresh.level, 10)
      assert.deepEqual(fresh.badges, ['SSC-5', 'LMD-10', 'SPECTRA-2'])
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM public_users WHERE email IS NULL AND account_status='no_account'"
          )
        ).rows[0].n,
        2
      )
      const rerun = migrate([resolutionArg, '--apply'])
      assert.equal(rerun.alreadyMigrated, 7)
      assert.equal(rerun.createUsers, 0)
      await client.query(`INSERT INTO legacy_members(id,name,email)
      SELECT id, 'Batch member ' || id, 'batch-' || id || '@example.test' FROM generate_series(8,508) id`)
      const batched = migrate([resolutionArg, '--apply'])
      assert.equal(batched.alreadyMigrated, 7)
      assert.equal(batched.createUsers, 501)
      assert.equal(batched.destinations.length, 508)
      assert.equal(migrate([resolutionArg]).alreadyMigrated, 508)
      await client.query("UPDATE legacy_members SET name='Changed source' WHERE id=1")
      assert.equal(migrate([], 1).blockers[0].reason, 'MIGRATED_ROW_CHANGED')
      await client.query("UPDATE legacy_members SET name='New' WHERE id=1")
      ace(['migration:run', '--force'], 1, { LEGACY_MEMBER_RETIREMENT: '1' })
      const backupPath = resolve(artifact, 'fixture-backup.json')
      writeFileSync(
        backupPath,
        JSON.stringify((await client.query('SELECT * FROM legacy_members')).rows),
        { mode: 0o600 }
      )
      const evidence = {
        environment: 'test',
        schema,
        backupPath,
        backupSha256: createHash('sha256').update(readFileSync(backupPath)).digest('hex'),
        restoreVerified: true,
        deploymentRef: 'isolated-test-fixture',
        authenticationVerified: true,
        writesPaused: true,
        verifiedAt: new Date().toISOString(),
        sourceCount: 508,
      }
      writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 })
      const retirementEnv = {
        LEGACY_MEMBER_RETIREMENT: '1',
        LEGACY_MEMBER_CUTOVER_FILE: evidencePath,
      }
      await client.query("UPDATE profiles SET name='Unexpected change' WHERE id=$1", [profile])
      ace(['migration:run', '--force'], 1, retirementEnv)
      assert.equal(migrate([], 1).blockers[0].reason, 'MIGRATED_ROW_CHANGED')
      await client.query("UPDATE profiles SET name='Current name' WHERE id=$1", [profile])
      await client.query('CREATE VIEW legacy_dependency AS SELECT id FROM legacy_members')
      ace(['migration:run', '--force'], 1, retirementEnv)
      await client.query('DROP VIEW legacy_dependency')
      ace(['migration:run', '--force'], 0, retirementEnv)
      assert.equal(
        (await client.query("SELECT to_regclass('legacy_members') AS name")).rows[0].name,
        null
      )
      assert.equal(
        (await client.query('SELECT count(*)::int AS n FROM legacy_member_migrations')).rows[0].n,
        508
      )
      await client.query("SET application_name='ordinary-application'")
      await client.query('DELETE FROM public_users WHERE id=$1', [fresh.id])
      assert.equal(
        (await client.query('SELECT count(*)::int AS n FROM legacy_member_migrations')).rows[0].n,
        508
      )
    } finally {
      await client.query(`DROP SCHEMA "${schema}" CASCADE`)
      await client.end()
      writeFileSync(
        resolve(artifact, 'cleanup.json'),
        JSON.stringify({ schema, status: 'cleaned', storageObjects: [] })
      )
    }
  }
)
