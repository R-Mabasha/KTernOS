import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { SubTask } from '../types'

interface PlaybookStep {
  id: string
  type: 'API' | 'UI'
  tool?: string
  uiTarget?: string
  description: string
  params?: Record<string, unknown>
  dependsOn?: string[]
}

interface Playbook {
  name: string
  description: string
  steps: PlaybookStep[]
}

interface ExecuteOptions {
  onStep: (step: SubTask) => Promise<void>
}

export class PlaybookEngine {
  private readonly libraryDir: string

  constructor(libraryDir?: string) {
    this.libraryDir = libraryDir || join(process.cwd(), 'packages/sap-agent/src/playbooks/library')
  }

  async execute(name: string, opts: ExecuteOptions): Promise<{ name: string; completed: number; total: number }> {
    const playbook = this.load(name)
    let completed = 0
    for (const step of playbook.steps) {
      const subtask: SubTask = {
        id: step.id,
        type: step.type,
        description: step.description,
        apiTool: step.tool,
        uiTarget: step.uiTarget,
        params: step.params,
        dependsOn: step.dependsOn,
      }
      await opts.onStep(subtask)
      completed++
    }
    return { name: playbook.name, completed, total: playbook.steps.length }
  }

  private load(name: string): Playbook {
    const normalized = name.endsWith('.yaml') ? name : `${name}.yaml`
    const path = join(this.libraryDir, normalized)
    const raw = readFileSync(path, 'utf8')
    return parseYaml(raw) as Playbook
  }
}
