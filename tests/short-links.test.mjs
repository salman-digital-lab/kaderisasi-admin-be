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
  'short-link migration adopts existing rows and preserves them on rollback',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_short_${randomBytes(8).toString('hex')}`
    const db = new pg.Client({
      host: configured.DB_HOST,
      port: Number(configured.DB_PORT),
      user: configured.DB_USER,
      password: configured.DB_PASSWORD,
      database: configured.DB_DATABASE,
    })
    await db.connect()
    const env = {
      ...process.env,
      ...configured,
      NODE_ENV: 'test',
      DB_SCHEMA: schema,
      PGOPTIONS: `-c search_path=${schema}`,
    }
    const ace = (args, expected = 0) =>
      new Promise((done, reject) => {
      const child = spawn(process.execPath, ['ace', ...args, '--disable-locks'], { cwd: root, env })
        let output = ''
        child.stdout.on('data', (chunk) => (output += chunk))
        child.stderr.on('data', (chunk) => (output += chunk))
        child.on('error', reject)
        child.on('exit', (code) => {
          try {
            assert.equal(code, expected, output)
            done(output)
          } catch (error) {
            reject(error)
          }
        })
      })
    try {
      await db.query(`CREATE SCHEMA "${schema}"`)
      await db.query(`SET search_path TO "${schema}"`)
      await db.query(
        'CREATE TABLE adonis_schema (id serial PRIMARY KEY, name varchar(255), batch integer, migration_time timestamptz DEFAULT now())'
      )
      await db.query('CREATE TABLE adonis_schema_versions (version integer PRIMARY KEY)')
      await db.query('INSERT INTO adonis_schema_versions VALUES (2)')
      for (const file of readdirSync(resolve(root, 'database/migrations')).filter(
        (name) => name.endsWith('.ts') && !name.includes('create_create_urls')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query(
        'CREATE TABLE urls (id varchar(10) PRIMARY KEY, original_url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), visit_count bigint NOT NULL DEFAULT 0)'
      )
      await db.query(
        "INSERT INTO urls VALUES ('legacy','https://example.com/old', '2020-01-01', 42)"
      )
      const before = (await db.query('SELECT * FROM urls')).rows
      await ace(['migration:run', '--force'])
      assert.deepEqual((await db.query('SELECT * FROM urls')).rows, before)
      await ace(['migration:rollback', '--step=1', '--force'])
      assert.deepEqual((await db.query('SELECT * FROM urls')).rows, before)
      await db.query("INSERT INTO urls (id,original_url) VALUES ('health','https://example.com')")
      await ace(['migration:run', '--force'], 1)
      assert.equal((await db.query('SELECT count(*) FROM urls')).rows[0].count, '2')
      await db.query("DELETE FROM urls WHERE id='health'")
      await db.query('ALTER TABLE urls ALTER COLUMN id TYPE varchar(64)')
      await ace(['migration:run', '--force'], 1)
      assert.deepEqual((await db.query('SELECT * FROM urls')).rows, before)
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
