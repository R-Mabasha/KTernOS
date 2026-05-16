import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AuditEntry } from '../types'

export class AuditLogger {
  private readonly logDir: string

  constructor(logDir = 'logs') {
    this.logDir = logDir
    mkdirSync(logDir, { recursive: true })
  }

  async log(entry: AuditEntry): Promise<void> {
    const safe = {
      ...entry,
    }
    const date = new Date().toISOString().slice(0, 10)
    const path = join(this.logDir, `audit-${date}.jsonl`)
    appendFileSync(path, JSON.stringify(safe) + '\n', 'utf8')
  }

  async query(filter: Partial<Pick<AuditEntry, 'taskId' | 'action' | 'landscape' | 'status'>>): Promise<AuditEntry[]> {
    const { readdirSync, readFileSync, existsSync } = await import('node:fs')
    if (!existsSync(this.logDir)) return []
    const files = readdirSync(this.logDir).filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
    const entries: AuditEntry[] = []
    for (const file of files) {
      const lines = readFileSync(join(this.logDir, file), 'utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry
          const match = Object.entries(filter).every(([k, v]) => entry[k as keyof AuditEntry] === v)
          if (match) entries.push(entry)
        } catch {}
      }
    }
    return entries
  }
}
