import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

const FLOOR_MIGRATION = '1793240000000_drop_perintis_month_floor'
const RUN = [
  'create_perintis_tables',
  'relax_perintis_mentee_data',
  'narrow_perintis_participant_statuses',
  'drop_perintis_month_floor',
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

test(
  'perintis months only need to be the 1st, not after a start date',
  { timeout: 90000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_perintis_floor_${randomBytes(8).toString('hex')}`
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
        "INSERT INTO public_users VALUES (1,'mentee@example.test'),(2,'mentor@example.test')"
      )
      await db.query("INSERT INTO universities VALUES (1,'ITB')")

      // Apply the earlier Perintis migrations first: November is the floor.
      await db.query(
        "INSERT INTO adonis_schema(name,batch) SELECT 'database/migrations/' || $1, 1",
        [FLOOR_MIGRATION]
      )
      await ace(root, configured, schema, ['migration:run'])
      await db.query(
        "INSERT INTO perintis_participants(user_id,is_mentor,status) VALUES(2,true,'active')"
      )
      await db.query(
        "INSERT INTO perintis_participants(user_id,is_mentee,status) VALUES(1,true,'active')"
      )
      const journal = (month) =>
        db.query(
          "INSERT INTO perintis_journals(mentee_user_id,month,category,form_version) VALUES(1,$1,'dasar',1)",
          [month]
        )
      const report = (month) =>
        db.query('INSERT INTO perintis_session_reports(mentor_user_id,month) VALUES(2,$1)', [month])
      await assert.rejects(journal('2026-09-01'))
      await assert.rejects(report('2026-09-01'))

      await db.query('DELETE FROM adonis_schema WHERE name=$1', [
        `database/migrations/${FLOOR_MIGRATION}`,
      ])
      await ace(root, configured, schema, ['migration:run'])

      // Any 1st of a month is accepted; other days are not.
      await journal('2026-09-01')
      await report('2026-09-01')
      await assert.rejects(journal('2026-10-02'))
      await assert.rejects(report('2026-10-02'))

      // Rolling back restores the November floor for new rows and keeps September.
      await ace(root, configured, schema, ['migration:rollback', '--step=1'])
      await assert.rejects(journal('2026-10-01'))
      await assert.rejects(report('2026-10-01'))
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM perintis_journals WHERE month='2026-09-01'"
          )
        ).rows[0].n,
        1
      )
    } finally {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`)
      assert.equal(
        (await db.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount,
        0
      )
      await db.end()
      console.log(`Cleaned owned schema ${schema}`)
    }
  }
)
