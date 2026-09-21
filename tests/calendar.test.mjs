import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

test(
  'calendar migration preserves independent events when activities are deleted',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_calendar_${randomBytes(8).toString('hex')}`
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
      for (const file of readdirSync(resolve(root, 'database/migrations')).filter(
        (name) => name.endsWith('.ts') && !name.includes('create_calendar_events')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query('CREATE TABLE activities (id integer PRIMARY KEY, name text)')
      await db.query("INSERT INTO activities VALUES (1,'Existing activity')")
      await new Promise((done, reject) => {
        const child = spawn(
          process.execPath,
          ['ace', 'migration:run', '--force', '--disable-locks'],
          {
            cwd: root,
            env: {
              ...process.env,
              ...configured,
              NODE_ENV: 'test',
              DB_SCHEMA: schema,
              PGOPTIONS: `-c search_path=${schema}`,
            },
          }
        )
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
      assert.equal(
        (await db.query('SELECT count(*)::int AS count FROM calendar_events')).rows[0].count,
        0
      )
      assert.equal(
        (await db.query('SELECT name FROM activities WHERE id=1')).rows[0].name,
        'Existing activity'
      )
      await db.query(
        "INSERT INTO calendar_events(title,starts_at,ends_at,all_day,activity_id) VALUES('Independent event','2026-09-21T00:00:00+07:00','2026-09-23T00:00:00+07:00',true,1)"
      )
      await assert.rejects(
        db.query(
          "INSERT INTO calendar_events(title,starts_at,ends_at) VALUES('Invalid',now(),now())"
        )
      )
      await db.query('DELETE FROM activities WHERE id=1')
      const event = (await db.query('SELECT * FROM calendar_events')).rows[0]
      assert.equal(event.title, 'Independent event')
      assert.equal(event.activity_id, null)
      assert.equal(event.starts_at.toISOString(), '2026-09-20T17:00:00.000Z')
      assert.ok(event.created_at)
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
