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
  'journal deletion preserves member data and refuses dependent objects',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_journal_${randomBytes(8).toString('hex')}`
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
        (name) => name.endsWith('.ts') && !name.includes('drop_legacy_member_migration_journals')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query('CREATE TABLE legacy_member_migrations (legacy_id bigint PRIMARY KEY, source_data jsonb)')
      await db.query("INSERT INTO legacy_member_migrations VALUES (1, '{\"name\":\"old name\"}')")
      await db.query('CREATE TABLE public_users (id integer PRIMARY KEY, password text)')
      await db.query("INSERT INTO public_users VALUES (1, 'existing-credential')")
      await db.query('CREATE TABLE profiles (id integer PRIMARY KEY, user_id integer, fullname text)')
      await db.query("INSERT INTO profiles VALUES (1, 1, 'Preserved member')")
      const users = (await db.query('SELECT * FROM public_users')).rows
      const profiles = (await db.query('SELECT * FROM profiles')).rows
      await db.query('CREATE VIEW journal_dependency AS SELECT * FROM legacy_member_migrations')
      await ace(['migration:run', '--force'], 1)
      assert.equal((await db.query('SELECT count(*) FROM legacy_member_migrations')).rows[0].count, '1')
      await db.query('DROP VIEW journal_dependency')
      await ace(['migration:run', '--force'])
      await ace(['migration:run', '--force'])
      assert.equal((await db.query("SELECT to_regclass('legacy_member_migrations') AS journal")).rows[0].journal, null)
      assert.deepEqual((await db.query('SELECT * FROM public_users')).rows, users)
      assert.deepEqual((await db.query('SELECT * FROM profiles')).rows, profiles)
      await ace(['migration:rollback', '--step=1', '--force'], 1)

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
