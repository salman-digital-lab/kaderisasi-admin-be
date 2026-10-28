import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
import pg from 'pg'

test(
  'perintis migration creates participants, journals and reports with their rules',
  { timeout: 60000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_perintis_${randomBytes(8).toString('hex')}`
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
        (name) => name.endsWith('.ts') && !name.includes('create_perintis_tables')
      )) {
        await db.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await db.query('CREATE TABLE public_users (id integer PRIMARY KEY, email text)')
      await db.query('CREATE TABLE universities (id integer PRIMARY KEY, name text)')
      await db.query('CREATE TABLE admin_users (id integer PRIMARY KEY, display_name text)')
      await db.query(
        "INSERT INTO public_users VALUES (1,'mentee@example.test'),(2,'mentor@example.test'),(3,'koordinator@example.test')"
      )
      await db.query("INSERT INTO universities VALUES (1,'ITB')")
      await db.query("INSERT INTO admin_users VALUES (1,'Pengelola')")
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

      // Participants: roles, mentee fields, status reason.
      await db.query('INSERT INTO perintis_participants(user_id,is_coordinator) VALUES(3,true)')
      await db.query(
        'INSERT INTO perintis_participants(user_id,is_mentor,coordinator_user_id) VALUES(2,true,3)'
      )
      await assert.rejects(db.query('INSERT INTO perintis_participants(user_id) VALUES(1)'))
      await assert.rejects(
        db.query('INSERT INTO perintis_participants(user_id,is_mentee) VALUES(1,true)')
      )
      await db.query(
        "INSERT INTO perintis_participants(user_id,is_mentee,nim,university_id,kip_k,category,mentor_user_id) VALUES(1,true,'10525107',1,true,'biaya_hidup',2)"
      )
      await assert.rejects(
        db.query("UPDATE perintis_participants SET status='inactive' WHERE user_id=1")
      )
      await assert.rejects(
        db.query('UPDATE perintis_participants SET coordinator_user_id=3 WHERE user_id=1')
      )
      await assert.rejects(
        db.query("UPDATE perintis_participants SET category='lain' WHERE user_id=1")
      )

      // Journals: one per mentee per month, first day of a month, rules per status.
      await db.query(
        "INSERT INTO perintis_journals(mentee_user_id,month,mentor_user_id,category,form_version,answers) VALUES(1,'2026-12-01',2,'biaya_hidup',1,$1)",
        [JSON.stringify({ s1b: 'baris satu\nbaris dua' })]
      )
      assert.equal(
        (await db.query("SELECT answers->>'s1b' AS a FROM perintis_journals")).rows[0].a,
        'baris satu\nbaris dua'
      )
      await assert.rejects(
        db.query(
          "INSERT INTO perintis_journals(mentee_user_id,month,category,form_version) VALUES(1,'2026-12-01','dasar',1)"
        )
      )
      await assert.rejects(
        db.query(
          "INSERT INTO perintis_journals(mentee_user_id,month,category,form_version) VALUES(1,'2026-12-02','dasar',1)"
        )
      )
      await assert.rejects(
        db.query(
          "INSERT INTO perintis_journals(mentee_user_id,month,category,form_version) VALUES(1,'2026-10-01','dasar',1)"
        )
      )
      await assert.rejects(db.query("UPDATE perintis_journals SET status='submitted'"))
      await db.query(
        "UPDATE perintis_journals SET status='submitted', submitted_at=now(), honesty_confirmed_at=now()"
      )
      await assert.rejects(db.query("UPDATE perintis_journals SET status='accepted'"))
      await assert.rejects(db.query('UPDATE perintis_journals SET pulse_finance=6'))
      await assert.rejects(db.query("UPDATE perintis_journals SET flag_trigger='both'"))
      await db.query(
        "UPDATE perintis_journals SET flag_trigger='both', flag_status='open', flag_due_at=now()"
      )
      await assert.rejects(db.query("UPDATE perintis_journals SET flag_status='handled'"))
      await assert.rejects(db.query("UPDATE perintis_journals SET flag_status='resolved'"))

      // Reports: submission needs a date and a photo; verified needs a review.
      await db.query(
        "INSERT INTO perintis_session_reports(mentor_user_id,month) VALUES(2,'2026-12-01')"
      )
      await assert.rejects(
        db.query("UPDATE perintis_session_reports SET status='submitted', submitted_at=now()")
      )
      await db.query(
        "UPDATE perintis_session_reports SET status='submitted', submitted_at=now(), session_date='2026-12-20', photos=$1",
        [JSON.stringify([{ key: 'k', name: 'a.jpg', mime: 'image/jpeg', size: 1 }])]
      )
      await assert.rejects(
        db.query("UPDATE perintis_session_reports SET status='verified', verified_at=now()")
      )
      await assert.rejects(db.query("UPDATE perintis_session_reports SET case_note='x'"))

      // A participant with journals cannot be deleted from under them.
      await assert.rejects(db.query('DELETE FROM perintis_participants WHERE user_id=1'))
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
