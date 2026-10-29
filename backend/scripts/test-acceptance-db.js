import { spawnSync } from 'node:child_process'
const url = process.env.ACCEPTANCE_DATABASE_URL ?? 'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
if (new URL(url).pathname !== '/multi_warehouse_m4_test') throw new Error('Only the dedicated multi_warehouse_m4_test database is allowed')
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/acceptance', '--maxWorkers=1'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, DEMO_MODE: 'true', ACCEPTANCE_DB_TEST: '1' } })
process.exit(result.status ?? 1)
