import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

test(
  'email cleanup preserves lower IDs and linked history and deletes only malformed legacy email rows',
  { timeout: 120000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `legacy_member_test_${randomBytes(8).toString('hex')}`
    const root = resolve(import.meta.dirname, '..')
    const directory = resolve(root, 'tmp', schema)
    mkdirSync(directory, { mode: 0o700, recursive: true })
    const client = new pg.Client({
      host: configured.DB_HOST,
      port: Number(configured.DB_PORT),
      user: configured.DB_USER,
      password: configured.DB_PASSWORD,
      database: configured.DB_DATABASE,
    })
    const env = {
      ...process.env,
      ...configured,
      NODE_ENV: 'test',
      DB_SCHEMA: schema,
      PGOPTIONS: `-c search_path=${schema}`,
      LEGACY_MEMBER_ENVIRONMENT: 'test',
      LEGACY_MEMBER_RETIREMENT: '',
    }
    let call = 0
    function ace(args, expected = 0) {
      const result = spawnSync(process.execPath, ['ace', ...args], {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 90000,
      })
      writeFileSync(resolve(directory, `${++call}.log`), result.stdout + result.stderr, {
        mode: 0o600,
      })
      assert.equal(result.status, expected, result.stdout + result.stderr)
    }
    function cleanup(args = [], expected = 0) {
      const path = resolve(directory, `report-${call}.json`)
      ace(
        [
          'public-users:normalize-emails',
          '--environment=test',
          '--discard-invalid-legacy-emails',
          `--report=${path}`,
          ...args,
        ],
        expected
      )
      return JSON.parse(readFileSync(path, 'utf8'))
    }
    await client.connect()
    try {
      await client.query(`CREATE SCHEMA "${schema}"`)
      await client.query(`SET search_path TO "${schema}"`)
      ace(['migration:run', '--force'])
      await client.query(`INSERT INTO public_users(id,email,password,member_id,account_status,created_at) VALUES
      (1,'OWNER@example.test','keep-password','keep-id','active',now()),
      (2,'owner@example.test','discard-password','discard-id','inactive',now()),
      (3,'OTHER@example.test',null,'other-id','no_account',now())`)
      await client.query(`INSERT INTO profiles(id,user_id,name,whatsapp,badges) VALUES
      (1,1,'Keep name',null,'["SSC-1"]'),(2,2,'Duplicate name','08123','["LMD-2"]')`)
      await client.query(
        "INSERT INTO activities(id,name,slug) VALUES (1,'One','one'),(2,'Two','two')"
      )
      await client.query(
        "INSERT INTO activity_registrations(id,user_id,activity_id,status) VALUES (1,1,1,'registered'),(2,2,2,'passed')"
      )
      await client.query(
        "INSERT INTO legacy_members(id,name,email) VALUES (1,'Bad','invalid-email'),(2,'Good','UPPER@example.test'),(3,'No email',null)"
      )
      const dry = cleanup()
      assert.deepEqual(dry.duplicates, [{ keepId: 1, deleteId: 2, email: 'owner@example.test' }])
      assert.equal(dry.lowercaseCount, 2)
      assert.equal(dry.transferredRegistrations, 1)
      assert.deepEqual(dry.discardedLegacyIds, ['1'])
      assert.equal((await client.query('SELECT count(*)::int AS n FROM public_users')).rows[0].n, 3)
      const backupPath = resolve(directory, 'backup.fixture')
      writeFileSync(backupPath, 'owned test backup', { mode: 0o600 })
      const manifestPath = resolve(directory, 'manifest.json')
      function manifest(fingerprint) {
        writeFileSync(
          manifestPath,
          JSON.stringify({
            environment: 'test',
            path: backupPath,
            sha256: createHash('sha256').update(readFileSync(backupPath)).digest('hex'),
            restoreVerified: true,
            fingerprint,
          }),
          { mode: 0o600 }
        )
      }
      manifest(dry.fingerprint)
      await client.query("UPDATE profiles SET whatsapp='changed' WHERE id=1")
      ace(
        [
          'public-users:normalize-emails',
          '--environment=test',
          `--report=${resolve(directory, 'stale.json')}`,
          '--apply',
          `--backup=${manifestPath}`,
        ],
        1
      )
      await client.query('UPDATE profiles SET whatsapp=null WHERE id=1')
      await client.query("INSERT INTO achievements(user_id,name) VALUES (2,'Preserve this')")
      assert.ok(cleanup([], 1).blockers.some((b) => b.startsWith('LINKED_RECORDS:2:achievements')))
      await client.query('DELETE FROM achievements WHERE user_id=2')
      await client.query('UPDATE activity_registrations SET activity_id=1 WHERE id=2')
      assert.ok(cleanup([], 1).blockers.includes('OVERLAPPING_ACTIVITY_REGISTRATIONS:2'))
      await client.query('UPDATE activity_registrations SET activity_id=2 WHERE id=2')
      const result = cleanup(['--apply', `--backup=${manifestPath}`])
      assert.equal(result.applied, true)
      const kept = (await client.query('SELECT * FROM public_users WHERE id=1')).rows[0]
      assert.equal(kept.email, 'owner@example.test')
      assert.equal(kept.password, 'keep-password')
      assert.equal(kept.member_id, 'keep-id')
      assert.equal((await client.query('SELECT id FROM public_users WHERE id=2')).rowCount, 0)
      const profile = (await client.query('SELECT * FROM profiles WHERE user_id=1')).rows[0]
      assert.equal(profile.name, 'Keep name')
      assert.equal(profile.whatsapp, '08123')
      assert.deepEqual(profile.badges, ['SSC-1', 'LMD-2'])
      assert.deepEqual(
        (await client.query('SELECT id,user_id,status FROM activity_registrations ORDER BY id'))
          .rows,
        [
          { id: 1, user_id: 1, status: 'registered' },
          { id: 2, user_id: 1, status: 'passed' },
        ]
      )
      assert.deepEqual(
        (await client.query('SELECT id FROM legacy_members ORDER BY id')).rows.map((r) => r.id),
        [2, 3]
      )
      assert.equal(
        (await client.query('SELECT email FROM public_users WHERE id=3')).rows[0].email,
        'other@example.test'
      )
      const repeated = cleanup()
      assert.equal(repeated.duplicates.length, 0)
      assert.equal(repeated.lowercaseCount, 0)
      assert.deepEqual(repeated.discardedLegacyIds, [])
    } finally {
      await client.query(`DROP SCHEMA "${schema}" CASCADE`)
      await client.end()
      writeFileSync(
        resolve(directory, 'cleanup.json'),
        JSON.stringify({ schema, status: 'cleaned', storageObjects: [] })
      )
    }
  }
)
