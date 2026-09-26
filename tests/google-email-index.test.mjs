import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

test(
  'concurrent email index supports reapply, invalid-build recovery and mixed-case duplicates',
  { timeout: 120000 },
  async () => {
    assert.ok(process.env.MIGRATION_TEST_ENV)
    const root = resolve(import.meta.dirname, '..')
    const configured = parseEnv(readFileSync(resolve(process.env.MIGRATION_TEST_ENV), 'utf8'))
    const schema = `migration_email_${randomBytes(8).toString('hex')}`
    const client = new pg.Client({
      host: configured.DB_HOST,
      port: Number(configured.DB_PORT),
      user: configured.DB_USER,
      password: configured.DB_PASSWORD,
      database: configured.DB_DATABASE,
    })
    const name = 'database/migrations/1790422468337_add_public_users_lower_email_index'
    const index = 'idx_public_users_lower_email'
    const ace = (command, expected = 0) => {
      const result = spawnSync(process.execPath, ['ace', command, '--force', '--disable-locks'], {
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
    }
    const valid = async () =>
      (
        await client.query(
          'SELECT indisvalid,indisunique FROM pg_index WHERE indexrelid=$1::regclass',
          [index]
        )
      ).rows[0]
    await client.connect()
    try {
      await client.query(`CREATE SCHEMA "${schema}"`)
      await client.query(`SET search_path TO "${schema}"`)
      await client.query(
        'CREATE TABLE public_users(id serial PRIMARY KEY,email varchar(255) UNIQUE)'
      )
      await client.query(
        'CREATE TABLE adonis_schema(id serial PRIMARY KEY,name varchar(255),batch integer,migration_time timestamptz DEFAULT now())'
      )
      await client.query('CREATE TABLE adonis_schema_versions(version integer PRIMARY KEY)')
      await client.query('INSERT INTO adonis_schema_versions VALUES(2)')
      for (const file of readdirSync(resolve(root, 'database/migrations')).filter(
        (f) => f.endsWith('.ts') && !f.includes('add_public_users_lower_email_index')
      )) {
        await client.query('INSERT INTO adonis_schema(name,batch) VALUES($1,1)', [
          `database/migrations/${file.slice(0, -3)}`,
        ])
      }
      await client.query(
        "INSERT INTO public_users(email) SELECT 'user'||n||'@example.test' FROM generate_series(1,10000) n"
      )
      await client.query(
        "INSERT INTO public_users(email) VALUES('Mixed@example.test'),('mixed@example.test')"
      )
      await client.query('ANALYZE public_users')
      const before = (
        await client.query(
          "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM public_users WHERE lower(email)='user5000@example.test'"
        )
      ).rows
      ace('migration:run')
      assert.deepEqual(await valid(), { indisvalid: true, indisunique: false })
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int total FROM public_users WHERE lower(email)='mixed@example.test'"
          )
        ).rows[0].total,
        2
      )
      const after = (
        await client.query(
          "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM public_users WHERE lower(email)='user5000@example.test'"
        )
      ).rows
      mkdirSync(resolve(root, 'tmp/email-index'), { recursive: true })
      writeFileSync(
        resolve(root, 'tmp/email-index/explain.json'),
        JSON.stringify({ before, after }, null, 2)
      )
      ace('migration:rollback')
      assert.equal(
        (await client.query('SELECT to_regclass($1) AS value', [index])).rows[0].value,
        null
      )
      ace('migration:run')
      await client.query('DELETE FROM adonis_schema WHERE name=$1', [name])
      ace('migration:run') // Existing valid index after lost migration acknowledgement.
      await client.query('DELETE FROM adonis_schema WHERE name=$1', [name])
      await client.query(`DROP INDEX ${index}`)
      await client.query(`CREATE INDEX ${index} ON public_users(email)`)
      ace('migration:run', 1)
      assert.match(
        (await client.query('SELECT pg_get_indexdef($1::regclass) AS definition', [index])).rows[0]
          .definition,
        /\(email\)/
      )
      await client.query(`DROP INDEX ${index}`)
      // Abort a real concurrent build after its catalog entry is committed, while
      // an older writer prevents the build from taking its first snapshot.
      const blocker = new pg.Client(client.connectionParameters)
      const builder = new pg.Client(client.connectionParameters)
      await blocker.connect()
      await builder.connect()
      try {
        await blocker.query(`SET search_path TO "${schema}"`)
        await builder.query(`SET search_path TO "${schema}"`)
        await blocker.query('BEGIN')
        await blocker.query("INSERT INTO public_users(email) VALUES('blocker@example.test')")
        const pid = (await builder.query('SELECT pg_backend_pid() pid')).rows[0].pid
        const building = builder
          .query(`CREATE INDEX CONCURRENTLY ${index} ON public_users(lower(email))`)
          .catch((error) => error)
        for (let attempt = 0; attempt < 100; attempt++) {
          if ((await client.query('SELECT to_regclass($1) value', [index])).rows[0].value) break
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        await client.query('SELECT pg_cancel_backend($1)', [pid])
        assert.ok((await building) instanceof Error)
        assert.equal((await valid()).indisvalid, false)
        await blocker.query('ROLLBACK')
      } finally {
        await blocker.end()
        await builder.end()
      }
      ace('migration:run')
      assert.deepEqual(await valid(), { indisvalid: true, indisunique: false })
    } finally {
      await client.query(`DROP SCHEMA "${schema}" CASCADE`)
      await client.end()
      console.log(`Cleaned owned schema ${schema}`)
    }
  }
)
