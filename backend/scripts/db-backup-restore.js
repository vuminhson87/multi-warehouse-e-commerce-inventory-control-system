// M3 - Nguyễn Anh Quân: Sao lưu (backup) và khôi phục (restore) CSDL PostgreSQL.
// Truy vết: NFR-REL-04, Test T22.
//
// Cách dùng:
//   node scripts/db-backup-restore.js backup  [đường_dẫn_file.sql]
//   node scripts/db-backup-restore.js restore <đường_dẫn_file.sql>
// Tự động dùng `docker exec mw-postgres pg_dump/psql` nếu không có `pg_dump` cài trực tiếp trên máy.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function buildBackupFileName(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    const stamp =
        `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_` +
        `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
    return `multi_warehouse_${stamp}.sql`
}

export function buildDockerPgDumpArgs({
    container = process.env.PG_CONTAINER ?? 'mw-postgres',
    user = process.env.PG_USER ?? 'mw_user',
    database = process.env.PG_DATABASE ?? 'multi_warehouse',
} = {}) {
    return ['exec', container, 'pg_dump', '-U', user, '-d', database, '--clean', '--if-exists']
}

export function buildDockerPsqlArgs({
    container = process.env.PG_CONTAINER ?? 'mw-postgres',
    user = process.env.PG_USER ?? 'mw_user',
    database = process.env.PG_DATABASE ?? 'multi_warehouse',
} = {}) {
    return ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database]
}

export function runBackup(targetPath) {
    const backupsDir = path.resolve(process.cwd(), 'backups')
    const outputFile = targetPath
        ? path.resolve(targetPath)
        : path.join(backupsDir, buildBackupFileName())

    fs.mkdirSync(path.dirname(outputFile), { recursive: true })

    const args = buildDockerPgDumpArgs()
    const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })

    if (result.status !== 0) {
        throw new Error(`Backup thất bại: ${result.stderr || result.error?.message}`)
    }

    fs.writeFileSync(outputFile, result.stdout, 'utf8')
    return outputFile
}

export function runRestore(sourcePath) {
    if (!sourcePath) {
        throw new Error('Cần truyền đường dẫn file .sql để restore.')
    }

    const inputFile = path.resolve(sourcePath)
    if (!fs.existsSync(inputFile)) {
        throw new Error(`Không tìm thấy file backup: ${inputFile}`)
    }

    const sql = fs.readFileSync(inputFile, 'utf8')
    const args = buildDockerPsqlArgs()
    const result = spawnSync('docker', args, {
        input: sql,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
    })

    if (result.status !== 0) {
        throw new Error(`Restore thất bại: ${result.stderr || result.error?.message}`)
    }

    return inputFile
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
    const [action, fileArg] = process.argv.slice(2)
    try {
        if (action === 'backup') {
            const out = runBackup(fileArg)
            console.log(`Đã sao lưu CSDL tới: ${out}`)
        } else if (action === 'restore') {
            const restored = runRestore(fileArg)
            console.log(`Đã khôi phục CSDL từ: ${restored}`)
        } else {
            console.error('Cú pháp: node scripts/db-backup-restore.js <backup|restore> [file.sql]')
            process.exitCode = 1
        }
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
