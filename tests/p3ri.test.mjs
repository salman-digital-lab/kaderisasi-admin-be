import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

test('p3ri migrations create registrations with their rules', { timeout: 60000 }, async () => {
  assert.ok(process.env.MIGRATION_TEST_ENV)
  const root = resolve(import.meta.dirname, '..')
  const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
  const schema = `migration_p3ri_${randomBytes(8).toString('hex')}`
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
      (name) => name.endsWith('.ts') && !name.includes('p3ri_registration')
    )) {
      await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
        `database/migrations/${file.slice(0, -3)}`,
      ])
    }
    await db.query('CREATE TABLE public_users (id integer PRIMARY KEY, email text)')
    await db.query('CREATE TABLE admin_users (id integer PRIMARY KEY, display_name text)')
    await db.query(
      "INSERT INTO public_users VALUES (1,'calon@example.test'),(2,'calon2@example.test')"
    )
    await db.query("INSERT INTO admin_users VALUES (1,'Panitia P3RI')")
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

    // One registration per member, 1-3 choices, accepted division among the choices.
    const answers = JSON.stringify({ nama_lengkap: 'Calon Panitia' })
    await db.query(
      "INSERT INTO p3ri_registrations(user_id,choices,answers) VALUES(1,ARRAY['berbuka','sahur'],$1)",
      [answers]
    )
    assert.equal(
      (await db.query("SELECT status, answers->>'nama_lengkap' AS name FROM p3ri_registrations"))
        .rows[0].status,
      'terdaftar'
    )
    await assert.rejects(
      db.query("INSERT INTO p3ri_registrations(user_id,choices) VALUES(1,ARRAY['tarawih'])")
    )
    await assert.rejects(
      db.query('INSERT INTO p3ri_registrations(user_id,choices) VALUES(2,ARRAY[]::text[])')
    )
    await assert.rejects(
      db.query("INSERT INTO p3ri_registrations(user_id,choices) VALUES(2,ARRAY['a','b','c','d'])")
    )
    await assert.rejects(
      db.query("INSERT INTO p3ri_registrations(user_id,choices,answers) VALUES(2,ARRAY['a'],'[]')")
    )
    await assert.rejects(db.query("UPDATE p3ri_registrations SET status='lulus'"))
    // Only terdaftar and diterima remain.
    await assert.rejects(db.query("UPDATE p3ri_registrations SET status='seleksi_berkas'"))
    await assert.rejects(db.query("UPDATE p3ri_registrations SET status='tidak_diterima'"))
    await assert.rejects(db.query("UPDATE p3ri_registrations SET status='diterima'"))
    await assert.rejects(
      db.query("UPDATE p3ri_registrations SET status='diterima', accepted_division='tarawih'")
    )
    await db.query(
      "UPDATE p3ri_registrations SET status='diterima', accepted_division='sahur', status_updated_by=1, status_updated_at=now()"
    )
    await assert.rejects(db.query("UPDATE p3ri_registrations SET status='wawancara'"))

    // A member with a registration cannot be deleted from under it.
    await assert.rejects(db.query('DELETE FROM public_users WHERE id=1'))
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
