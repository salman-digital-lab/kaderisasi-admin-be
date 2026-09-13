import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const environment = args.find((arg) => arg.startsWith('--environment='))?.split('=')[1]
if (!['prod', 'test'].includes(environment))
  throw new Error('Supply --environment=prod or --environment=test')
const configured = parseEnv(
  readFileSync(new URL(`../../docs/.env.${environment}.be`, import.meta.url), 'utf8')
)
const retirement = args.includes('--retirement')
const pauseMembers = args.includes('--pause-members')
if (retirement && pauseMembers) throw new Error('Select only one migration directory')
const schema = args.find((arg) => arg.startsWith('--schema='))?.slice('--schema='.length)
if (schema && (environment !== 'test' || !/^legacy_member_test_[a-f0-9]+$/.test(schema)))
  throw new Error('Schema override requires an owned legacy_member_test_ schema in test')
const command = args.filter(
  (arg) =>
    !arg.startsWith('--environment=') && !arg.startsWith('--schema=') && arg !== '--retirement' && arg !== '--pause-members'
)
if (!['legacy-members:migrate', 'public-users:normalize-emails', 'migration:run', 'migration:status', 'migration:rollback'].includes(command[0]))
  throw new Error('Unsupported maintenance command')
if (retirement && command[0] !== 'migration:run')
  throw new Error('--retirement requires migration:run')
if (command[0] === 'migration:rollback' && !pauseMembers) throw new Error('Only the temporary write-pause migration may be rolled back')
if (['legacy-members:migrate', 'public-users:normalize-emails'].includes(command[0])) command.push(`--environment=${environment}`)
const child = spawnSync(process.execPath, ['ace', ...command], {
  cwd: new URL('../', import.meta.url),
  env: {
    ...process.env,
    ...configured,
    NODE_ENV: environment === 'prod' ? 'production' : 'test',
    DB_SCHEMA: schema || 'public',
    PGOPTIONS: `-c search_path=${schema || 'public'}`,
    LEGACY_MEMBER_ENVIRONMENT: environment,
    LEGACY_MEMBER_RETIREMENT: retirement ? '1' : '',
    LEGACY_MEMBER_PAUSE: pauseMembers ? '1' : '',
    PGAPPNAME: 'legacy-member-maintenance',
  },
  stdio: 'inherit',
})
if (child.error) throw child.error
process.exitCode = child.status ?? 1
