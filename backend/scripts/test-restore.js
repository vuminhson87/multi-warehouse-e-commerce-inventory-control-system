import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { runBackup, runRestore } from './db-backup-restore.js'
function sql(database, query) {
  const r = spawnSync('docker', ['exec', 'mw-postgres', 'psql', '-U', 'mw_user', '-d', database, '-tAc', query], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message)
  return r.stdout.trim()
}
const source = 'multi_warehouse_m4_test', target = 'multi_warehouse_m4_restore'
if (sql('postgres', `SELECT count(*) FROM pg_database WHERE datname='${target}'`) === '0') sql('postgres', `CREATE DATABASE ${target}`)
process.env.PG_DATABASE = source
const file = runBackup('tests/reports/restore-evidence.sql')
process.env.PG_DATABASE = target
runRestore(file)
const fingerprint = `SELECT md5(string_agg(tablename || ':' || rowdata, '|' ORDER BY tablename, rowdata)) FROM (SELECT 'products' AS tablename, row_to_json(p)::text AS rowdata FROM products p UNION ALL SELECT 'orders', row_to_json(o)::text FROM orders o UNION ALL SELECT 'inventories', row_to_json(i)::text FROM inventories i UNION ALL SELECT 'stock_reservations', row_to_json(s)::text FROM stock_reservations s UNION ALL SELECT 'payment_attempts', row_to_json(p)::text FROM payment_attempts p) x`
const before = sql(source, fingerprint), restored = sql(target, fingerprint)
assert.ok(before)
assert.equal(restored, before)
const report = { at: new Date().toISOString(), source, target, fingerprint: before, restoredFingerprint: restored, passed: true }
writeFileSync('tests/reports/latest-restore-result.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
