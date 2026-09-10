import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'tests/migration-checksums.json'), 'utf8'))
test('historical migration files remain unchanged', () => {
  for (const [file, digest] of Object.entries(manifest)) {
    assert.equal(
      createHash('sha256')
        .update(readFileSync(resolve(root, file)))
        .digest('hex'),
      digest,
      file
    )
  }
  assert.ok(
    readdirSync(resolve(root, 'database/migrations')).length >= Object.keys(manifest).length
  )
  assert.equal(existsSync(resolve(root, 'bin/server.ts')), false)
})

test('Ace migrations, seeders, and preflight on an owned schema', { timeout: 240000 }, async () => {
  const envFile = process.env.MIGRATION_TEST_ENV
  assert.ok(envFile, 'Set MIGRATION_TEST_ENV to the dedicated test database environment file')
  const configured = parseEnv(readFileSync(resolve(envFile), 'utf8'))
  const run = randomBytes(8).toString('hex')
  const schema = `migration_test_${run}`
  const marker = `migration-only test ${run}`
  const artifacts = resolve(root, 'tmp', run)
  mkdirSync(artifacts, { recursive: true })
  const record = { schema, marker, status: 'creating' }
  const save = () =>
    writeFileSync(resolve(artifacts, 'cleanup.json'), JSON.stringify(record, null, 2))
  save()
  const client = new pg.Client({
    host: configured.DB_HOST,
    port: Number(configured.DB_PORT),
    user: configured.DB_USER,
    password: configured.DB_PASSWORD,
    database: configured.DB_DATABASE,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  })
  await client.connect()
  const env = {
    ...process.env,
    ...configured,
    NODE_ENV: 'test',
    DB_SCHEMA: schema,
    PGOPTIONS: `-c search_path=${schema}`,
    ADMIN_BOOTSTRAP_EMAILS: 'migration-fixture@example.test',
  }
  let call = 0
  const ace = (args, expected = 0, extra = {}, built = false) => {
    const result = spawnSync(process.execPath, ['ace', ...args], {
      cwd: built ? resolve(root, 'build') : root,
      env: { ...env, ...extra },
      encoding: 'utf8',
      timeout: 180000,
      killSignal: 'SIGKILL',
    })
    const output = result.stdout + result.stderr
    writeFileSync(resolve(artifacts, `${++call}-${args[0].replaceAll(':', '-')}.log`), output)
    assert.equal(result.status, expected, output)
    return output
  }
  try {
    await client.query('BEGIN')
    try {
      await client.query(`CREATE SCHEMA "${schema}"`)
      await client.query(`COMMENT ON SCHEMA "${schema}" IS '${marker}'`)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    record.status = 'created'
    save()
    await client.query(`SET search_path TO "${schema}"`)
    ace(['migration:run', '--force'])
    const rows = await client.query('SELECT * FROM adonis_schema ORDER BY id')
    assert.equal(
      rows.rowCount,
      readdirSync(resolve(root, 'database/migrations')).filter((name) => name.endsWith('.ts'))
        .length
    )
    ace(['migration:run', '--force'])
    assert.deepEqual(
      (await client.query('SELECT * FROM adonis_schema ORDER BY id')).rows,
      rows.rows
    )
    ace(['migration:status'], 0, {}, true)
    const before = (await client.query('SELECT * FROM admin_users ORDER BY id')).rows
    assert.match(
      ace(['rbac:preflight'], 0, {
        PGOPTIONS: `-c search_path=${schema} -c default_transaction_read_only=on`,
        DB_SCHEMA: '',
      }),
      /RBAC preflight passed/
    )
    assert.deepEqual((await client.query('SELECT * FROM admin_users ORDER BY id')).rows, before)
    ace(['db:seed', '--files=database/seeders/admin_rbac_seeder.ts'])
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count,
      1
    )
    await client.query('UPDATE admin_users SET is_active=false')
    assert.match(ace(['rbac:preflight'], 1), /BOOTSTRAP_ADMIN_IS_INACTIVE/)
    await client.query('UPDATE admin_users SET is_active=true')
    ace(['db:seed', '--files=database/seeders/main_seeder.ts'])
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM public_users')).rows[0].count,
      10
    )
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM achievements')).rows[0].count,
      10
    )
    const passwords = (await client.query('SELECT password FROM public_users')).rows
    assert.ok(passwords.every((row) => row.password.startsWith('$scrypt$')))
    for (const table of ['countries', 'provinces', 'cities', 'universities']) {
      assert.ok(
        (await client.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count > 0
      )
    }
    ace(['rbac:preflight'], 0, {}, true)
    record.tests = 'passed'
  } finally {
    try {
      const owner = await client.query(
        'SELECT obj_description(oid) AS marker FROM pg_namespace WHERE nspname=$1',
        [schema]
      )
      if (owner.rowCount) {
        assert.equal(owner.rows[0].marker, marker, 'Refusing cleanup without ownership marker')
        await client.query(`DROP SCHEMA "${schema}" CASCADE`)
      }
      assert.equal(
        (await client.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount,
        0
      )
      record.status = 'cleaned'
      save()
    } finally {
      await client.end()
    }
  }
})
