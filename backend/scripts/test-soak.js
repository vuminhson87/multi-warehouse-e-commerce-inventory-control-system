import { writeFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
const url = process.env.SOAK_API_URL ?? 'http://localhost:3001'
const duration = Number(process.env.SOAK_DURATION_SECONDS ?? 28800)
const interval = Number(process.env.SOAK_INTERVAL_SECONDS ?? 30)
if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(interval) || interval <= 0) throw new Error('Invalid duration/interval')
const start = Date.now(), samples = []
while (Date.now() - start < duration * 1000) {
  const at = Date.now()
  let ok = false, status = null
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10000) })
    status = response.status
    const data = await response.json()
    ok = response.ok && data.services?.database === 'ok'
  } catch { /* Failed probes are counted. */ }
  samples.push({ at: new Date(at).toISOString(), ok, status, ms: Date.now() - at })
  const elapsedSeconds = (Date.now() - start) / 1000
  const availability = samples.filter(s => s.ok).length / samples.length
  writeFileSync('tests/reports/latest-soak-result.json', JSON.stringify({ elapsedSeconds, requestedSeconds: duration, completed: elapsedSeconds >= duration, fullEightHourRun: elapsedSeconds >= 28800, sampledAvailability: availability, samples }, null, 2))
  await setTimeout(Math.max(0, Math.min(interval * 1000, duration * 1000 - (Date.now() - start))))
}
const report = { elapsedSeconds: (Date.now() - start) / 1000, requestedSeconds: duration, completed: true, fullEightHourRun: Date.now() - start >= 28800000, sampledAvailability: samples.filter(s => s.ok).length / samples.length, samples }
writeFileSync('tests/reports/latest-soak-result.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report, samples: samples.length }))
if (report.sampledAvailability < .99) process.exitCode = 1
