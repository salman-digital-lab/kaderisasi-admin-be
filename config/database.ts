import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const schema = env.get('DB_SCHEMA')
if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid DB_SCHEMA')

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
        ...(schema ? { options: `-c search_path=${schema}` } : {}),
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        afterCreate(
          conn: { query: (sql: string, cb: (err: Error | null) => void) => void },
          done: (err: Error | null, conn: unknown) => void
        ) {
          conn.query('SELECT 1', (err) => done(err, conn))
        },
      },
      migrations: {
        naturalSort: true,
        paths: [
          process.env.LEGACY_MEMBER_PAUSE === '1'
            ? 'database/cutover'
            : process.env.LEGACY_MEMBER_RETIREMENT === '1'
              ? 'database/retirement'
              : 'database/migrations',
        ],
      },
    },
  },
})

export default dbConfig
