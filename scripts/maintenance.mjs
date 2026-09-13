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
const command = args.filter((arg) => !arg.startsWith('--environment='))
if (!['migration:run', 'migration:status'].includes(command[0]))
  throw new Error('Unsupported maintenance command')
const child = spawnSync(process.execPath, ['ace', ...command], {
  cwd: new URL('../', import.meta.url),
  env: {
    ...process.env,
    ...configured,
    NODE_ENV: environment === 'prod' ? 'production' : 'test',
    DB_SCHEMA: 'public',
    PGOPTIONS: '-c search_path=public',
  },
  stdio: 'inherit',
})
if (child.error) throw child.error
process.exitCode = child.status ?? 1
