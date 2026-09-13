import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { randomBytes, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { accountFingerprintSql } from '../database/support/public_email_cleanup.ts'

const environment = process.argv.find((arg) => arg.startsWith('--environment='))?.split('=')[1]
if (!['prod', 'test'].includes(environment)) throw new Error('Explicit --environment=prod or test required')
const source = parseEnv(readFileSync(new URL(`../../docs/.env.${environment}.be`, import.meta.url), 'utf8'))
const target = parseEnv(readFileSync(new URL('../../docs/.env.test.be', import.meta.url), 'utf8'))
const run = randomBytes(8).toString('hex')
const directory = resolve(new URL('../tmp/', import.meta.url).pathname, `public-email-backup-${run}`)
mkdirSync(directory, { recursive: true, mode: 0o700 })
const path = resolve(directory, 'production.dump')
writeFileSync(path, '', { mode: 0o600 })
const restoredDatabase = `legacy_restore_${run}`
const clientOptions = (config, database = config.DB_DATABASE) => ({ host: config.DB_HOST, port: Number(config.DB_PORT), user: config.DB_USER, password: config.DB_PASSWORD, database, connectionTimeoutMillis: 10000 })
const pgEnvironment = (config, database = config.DB_DATABASE) => ({ ...process.env, PGHOST: config.DB_HOST, PGPORT: config.DB_PORT, PGUSER: config.DB_USER, PGPASSWORD: config.DB_PASSWORD, PGDATABASE: database })
const original = new pg.Client(clientOptions(source))
const admin = new pg.Client(clientOptions(target))
let created = false
const manifest = { environment, path, sha256: '', restoreVerified: false, fingerprint: {}, restoredDatabase, cleanup: 'not-created' }
function runCommand(command, args, env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 240000 })
  writeFileSync(resolve(directory, `${command}.log`), result.stderr || '', { mode: 0o600 })
  if (result.status !== 0) throw new Error(`${command} failed; restricted diagnostics are in ${directory}`)
}
await original.connect()
try {
  await original.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await original.query("SET LOCAL timezone='UTC'")
  const snapshot = (await original.query('SELECT pg_export_snapshot() AS id')).rows[0].id
  manifest.fingerprint = (await original.query(accountFingerprintSql)).rows[0]
  console.log('Creating consistent production backup')
  runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--snapshot=${snapshot}`, '--file', path], pgEnvironment(source))
  await original.query('COMMIT')
  manifest.sha256 = createHash('sha256').update(readFileSync(path)).digest('hex')
  await admin.connect()
  await admin.query(`CREATE DATABASE "${restoredDatabase}"`)
  created = true
  await admin.query(`COMMENT ON DATABASE "${restoredDatabase}" IS 'Owned public email backup restore ${run}'`)
  console.log('Verifying backup by restoring into an isolated database')
  runCommand('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', restoredDatabase, path], pgEnvironment(target, restoredDatabase))
  const restored = new pg.Client(clientOptions(target, restoredDatabase))
  await restored.connect()
  try {
    await restored.query("SET timezone='UTC'")
    const actual = (await restored.query(accountFingerprintSql)).rows[0]
    if (Object.keys(manifest.fingerprint).some((key) => actual[key] !== manifest.fingerprint[key])) throw new Error('Restored data fingerprints do not match backup snapshot')
    manifest.restoreVerified = true
  } finally { await restored.end() }
} finally {
  await original.end()
  if (created) {
    const owner = (await admin.query('SELECT shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [restoredDatabase])).rows[0]
    if (owner?.marker !== `Owned public email backup restore ${run}`) throw new Error('Restore database ownership marker mismatch; cleanup stopped')
    await admin.query(`DROP DATABASE "${restoredDatabase}"`)
    manifest.cleanup = 'isolated restore database removed'
  }
  await admin.end()
  writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })
}
console.log(JSON.stringify({ manifest: resolve(directory, 'manifest.json'), restoreVerified: manifest.restoreVerified, cleanup: manifest.cleanup }))
