import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

const root = resolve(import.meta.dirname, '..')
test(
  'scoring migration preserves registrations and stores publication history',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_scoring_${randomBytes(8).toString('hex')}`
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
        (name) => name.endsWith('.ts') && !name.includes('create_create_activity_scorings')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query('CREATE TABLE activities (id integer PRIMARY KEY)')
      await db.query('CREATE TABLE admin_users (id integer PRIMARY KEY)')
      await db.query(
        'CREATE TABLE activity_registrations (id integer PRIMARY KEY, activity_id integer REFERENCES activities(id), questionnaire_answer jsonb, guest_data jsonb)'
      )
      await db.query('INSERT INTO activities VALUES (1)')
      await db.query('INSERT INTO admin_users VALUES (1)')
      await db.query(
        `INSERT INTO activity_registrations VALUES (1,1,'{"answer":"preserve"}','{"name":"Guest"}')`
      )
      const before = (await db.query('SELECT * FROM activity_registrations')).rows[0]
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
      assert.deepEqual((await db.query('SELECT * FROM activity_registrations')).rows[0], {
        ...before,
        scoring_data: null,
      })
      await assert.rejects(db.query(`UPDATE activity_registrations SET scoring_data='[]'`))
      await db.query(
        `INSERT INTO activity_scoring_publications(activity_id,registration_id,revision,action,snapshot,actor_id,created_at) VALUES(1,1,1,'publish','{"schema_version":1}',1,now())`
      )
      await assert.rejects(db.query('DELETE FROM activity_registrations WHERE id=1'))
      await assert.rejects(
        db.query(
          `INSERT INTO activity_scoring_publications(activity_id,registration_id,revision,action,snapshot,actor_id,created_at) VALUES(1,1,2,'withdraw','{}',1,now())`
        )
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
