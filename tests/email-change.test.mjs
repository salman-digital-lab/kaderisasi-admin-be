import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

const INDEX = '1794035764157_add_public_users_lower_email_unique_index'
const TABLE = '1794035765462_create_public_user_email_changes_table'

test(
  'member emails are unique ignoring case and email changes keep one open request',
  { timeout: 120000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_email_change_${randomBytes(8).toString('hex')}`
    const db = new pg.Client({
      host: configured.DB_HOST,
      port: Number(configured.DB_PORT),
      user: configured.DB_USER,
      password: configured.DB_PASSWORD,
      database: configured.DB_DATABASE,
    })
    const ace = (args, expected = 0) => {
      const result = spawnSync(process.execPath, ['ace', ...args, '--force', '--disable-locks'], {
        cwd: root,
        env: {
          ...process.env,
          ...configured,
          NODE_ENV: 'test',
          DB_SCHEMA: schema,
          PGOPTIONS: `-c search_path=${schema}`,
        },
        encoding: 'utf8',
        timeout: 30000,
      })
      assert.equal(result.status, expected, result.stdout + result.stderr)
      return result.stdout + result.stderr
    }
    const emails = async () =>
      (await db.query('SELECT email FROM public_users ORDER BY id')).rows.map((r) => r.email)
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
        (name) => name.endsWith('.ts') && !name.startsWith(INDEX) && !name.startsWith(TABLE)
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query(
        'CREATE TABLE public_users (id serial PRIMARY KEY, email varchar(255) UNIQUE, updated_at timestamptz)'
      )

      // Case-only duplicates stop the migration before anything is created.
      await db.query(
        "INSERT INTO public_users(email) VALUES ('Dup@example.test'),('dup@example.test'),(' Upper@Example.test '),(NULL)"
      )
      assert.match(ace(['migration:run'], 1), /differ only by case/)
      assert.equal(
        (await db.query("SELECT to_regclass('public_user_email_changes') v")).rows[0].v,
        null
      )

      // Without duplicates, emails are normalized and the unique index applies.
      await db.query("DELETE FROM public_users WHERE email='Dup@example.test'")
      ace(['migration:run'])
      assert.deepEqual(await emails(), ['dup@example.test', 'upper@example.test', null])
      await assert.rejects(db.query("INSERT INTO public_users(email) VALUES ('DUP@example.test')"))
      await db.query('INSERT INTO public_users(email) VALUES (NULL)')

      const open = (user) =>
        db.query(
          `INSERT INTO public_user_email_changes(user_id,old_email,new_email,created_at,updated_at)
           VALUES ($1,'dup@example.test','new@example.test',now(),now()) RETURNING id`,
          [user]
        )
      const { id } = (await open(2)).rows[0]
      await assert.rejects(open(2), /public_user_email_changes_open_user_unique/)
      await db.query('UPDATE public_user_email_changes SET cancelled_at=now() WHERE id=$1', [id])
      await open(2)
      await assert.rejects(
        db.query('UPDATE public_user_email_changes SET code_attempts=-1 WHERE user_id=2')
      )
      await db.query('DELETE FROM public_users WHERE id=2')
      assert.equal(
        (await db.query('SELECT count(*)::int n FROM public_user_email_changes')).rows[0].n,
        0
      )

      // Rollback removes the table, then the index; running again is idempotent.
      ace(['migration:rollback'])
      assert.equal(
        (await db.query("SELECT to_regclass('public_user_email_changes') v")).rows[0].v,
        null
      )
      assert.equal(
        (await db.query("SELECT to_regclass('public_users_lower_email_unique') v")).rows[0].v,
        null
      )
      ace(['migration:run'])
      await db.query('DELETE FROM adonis_schema WHERE name=$1', [`database/migrations/${INDEX}`])
      ace(['migration:run'])
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
