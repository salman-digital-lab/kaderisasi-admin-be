import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

test(
  'talent migration preserves admin accounts and enforces one draft/current result',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_talent_${randomBytes(8).toString('hex')}`
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
        (name) => name.endsWith('.ts') && !name.includes('create_talent_assessments')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query('CREATE TABLE admin_users (id integer PRIMARY KEY, display_name text)')
      await db.query("INSERT INTO admin_users VALUES (1,'Existing administrator')")
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
        (await db.query('SELECT display_name FROM admin_users WHERE id=1')).rows[0].display_name,
        'Existing administrator'
      )
      const answers = JSON.stringify(Array(170).fill(0))
      await db.query(
        "INSERT INTO talent_assessment_drafts(admin_user_id,draft_id,definition_version,answers) VALUES(1,'draft-a','v1',$1)",
        [answers]
      )
      await assert.rejects(
        db.query(
          "INSERT INTO talent_assessment_drafts(admin_user_id,draft_id,definition_version,answers) VALUES(1,'draft-b','v1',$1)",
          [answers]
        )
      )
      await assert.rejects(
        db.query('UPDATE talent_assessment_drafts SET current_question=171 WHERE admin_user_id=1')
      )
      await assert.rejects(
        db.query('UPDATE talent_assessment_drafts SET revision=0 WHERE admin_user_id=1')
      )
      await assert.rejects(
        db.query("UPDATE talent_assessment_drafts SET answers='[]' WHERE admin_user_id=1")
      )
      await db.query(
        "INSERT INTO talent_assessment_results(admin_user_id,submission_id,definition_version,answers,result) VALUES(1,'submission-a','v1',$1,'{}')",
        [JSON.stringify(Array(170).fill(6))]
      )
      await assert.rejects(
        db.query(
          "INSERT INTO talent_assessment_results(admin_user_id,submission_id,definition_version,answers,result) VALUES(1,'submission-b','v1',$1,'{}')",
          [answers]
        )
      )
      await db.query('DELETE FROM admin_users WHERE id=1')
      for (const table of ['talent_assessment_drafts', 'talent_assessment_results']) {
        assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0)
      }
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
