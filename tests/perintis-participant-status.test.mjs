import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

const STATUS_MIGRATION = '1793230000000_narrow_perintis_participant_statuses'
const RUN = [
  'create_perintis_tables',
  'relax_perintis_mentee_data',
  'narrow_perintis_participant_statuses',
]

function ace(root, configured, schema, args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, ['ace', ...args, '--force', '--disable-locks'], {
      cwd: root,
      env: {
        ...process.env,
        ...configured,
        NODE_ENV: 'test',
        DB_SCHEMA: schema,
        PGOPTIONS: `-c search_path=${schema}`,
      },
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('error', reject)
    child.on('exit', (code) => {
      try {
        assert.equal(code, 0, output)
        done()
      } catch (error) {
        reject(error)
      }
    })
  })
}

test('perintis participants are only active or inactive', { timeout: 90000 }, async () => {
  assert.ok(process.env.MIGRATION_TEST_ENV)
  const root = resolve(import.meta.dirname, '..')
  const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
  const schema = `migration_perintis_status_${randomBytes(8).toString('hex')}`
  const db = new pg.Client({
    host: configured.DB_HOST,
    port: Number(configured.DB_PORT),
    user: configured.DB_USER,
    password: configured.DB_PASSWORD,
    database: configured.DB_DATABASE,
  })
  await db.connect()
  try {
    await db.query(`CREATE SCHEMA "${schema}"`)
    await db.query(`SET search_path TO "${schema}"`)
    await db.query(
      'CREATE TABLE adonis_schema (id serial PRIMARY KEY, name varchar(255), batch integer, migration_time timestamptz DEFAULT now())'
    )
    await db.query('CREATE TABLE adonis_schema_versions (version integer PRIMARY KEY)')
    await db.query('INSERT INTO adonis_schema_versions VALUES (2)')
    // Every other migration counts as applied; only the Perintis ones run.
    for (const file of readdirSync(resolve(root, 'database/migrations')).filter(
      (name) => name.endsWith('.ts') && !RUN.some((part) => name.includes(part))
    )) {
      await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
        `database/migrations/${file.slice(0, -3)}`,
      ])
    }
    await db.query('CREATE TABLE public_users (id integer PRIMARY KEY, email text)')
    await db.query('CREATE TABLE universities (id integer PRIMARY KEY, name text)')
    await db.query('CREATE TABLE admin_users (id integer PRIMARY KEY, display_name text)')
    await db.query(
      "INSERT INTO public_users VALUES (1,'mentee@example.test'),(2,'mentor@example.test'),(3,'lain@example.test')"
    )
    await db.query("INSERT INTO universities VALUES (1,'ITB')")

    // Apply the two earlier Perintis migrations first and seed the old statuses.
    await db.query("INSERT INTO adonis_schema(name,batch) SELECT 'database/migrations/' || $1, 1", [
      STATUS_MIGRATION,
    ])
    await ace(root, configured, schema, ['migration:run'])
    await db.query(
      "INSERT INTO perintis_participants(user_id,is_mentor,status) VALUES(2,true,'reserve')"
    )
    await db.query(
      "INSERT INTO perintis_participants(user_id,is_mentee,status) VALUES(1,true,'pending')"
    )
    await db.query(
      "INSERT INTO perintis_participants(user_id,is_mentor,status,inactive_reason) VALUES(3,true,'inactive','Mundur')"
    )
    await db.query('DELETE FROM adonis_schema WHERE name=$1', [
      `database/migrations/${STATUS_MIGRATION}`,
    ])
    await ace(root, configured, schema, ['migration:run'])

    // Waiting statuses become active; inactive stays.
    assert.deepEqual(
      (await db.query('SELECT user_id, status FROM perintis_participants ORDER BY user_id')).rows,
      [
        { user_id: 1, status: 'active' },
        { user_id: 2, status: 'active' },
        { user_id: 3, status: 'inactive' },
      ]
    )
    await assert.rejects(
      db.query("UPDATE perintis_participants SET status='pending' WHERE user_id=1")
    )
    await assert.rejects(
      db.query("UPDATE perintis_participants SET status='reserve' WHERE user_id=2")
    )
    // The inactive-reason rule still holds.
    await assert.rejects(
      db.query("UPDATE perintis_participants SET status='inactive' WHERE user_id=1")
    )

    // Rolling back allows the old statuses again.
    await ace(root, configured, schema, ['migration:rollback', '--step=1'])
    await db.query("UPDATE perintis_participants SET status='pending' WHERE user_id=1")
  } finally {
    await db.query(`DROP SCHEMA "${schema}" CASCADE`)
    assert.equal(
      (await db.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount,
      0
    )
    await db.end()
    console.log(`Cleaned owned schema ${schema}`)
  }
})
