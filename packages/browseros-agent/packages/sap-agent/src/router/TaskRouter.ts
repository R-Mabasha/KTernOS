import type { RoutedTask, SAPTaskContext, SubTask } from '../types'

const KNOWN_API_OPS: Record<string, { apiTool: string; requiresApproval: boolean }> = {
  'deploy-mta': { apiTool: 'cf_deploy_mta', requiresApproval: true },
  'deploy mta': { apiTool: 'cf_deploy_mta', requiresApproval: true },
  'bind-service': { apiTool: 'cf_bind_service', requiresApproval: true },
  'bind service': { apiTool: 'cf_bind_service', requiresApproval: true },
  'set-destination': { apiTool: 'btp_set_destination', requiresApproval: true },
  'set destination': { apiTool: 'btp_set_destination', requiresApproval: true },
  'assign-role': { apiTool: 'xsuaa_assign_role', requiresApproval: true },
  'assign role': { apiTool: 'xsuaa_assign_role', requiresApproval: true },
  'create-service-instance': { apiTool: 'cf_create_service_instance', requiresApproval: true },
  'create service instance': { apiTool: 'cf_create_service_instance', requiresApproval: true },
  'delete-service-instance': { apiTool: 'cf_delete_service_instance', requiresApproval: true },
  'delete service instance': { apiTool: 'cf_delete_service_instance', requiresApproval: true },
  'schedule-job': { apiTool: 'job_schedule', requiresApproval: false },
  'schedule job': { apiTool: 'job_schedule', requiresApproval: false },
  'assign-fiori-catalog': { apiTool: 'launchpad_assign_catalog', requiresApproval: true },
  'assign fiori catalog': { apiTool: 'launchpad_assign_catalog', requiresApproval: true },
}

const KNOWN_UI_OPS: string[] = [
  'navigate', 'open', 'click', 'fill', 'select', 'search',
  'monitor', 'check idoc', 'we02', 'cpi', 'iflow', 'ltmc', 'fiori launchpad',
]

const DESTRUCTIVE_OPS_UI_BLOCKED = /\b(delete|undeploy|unassign|unbind)\b/i

export class TaskRouter {
  route(task: string, context?: SAPTaskContext): RoutedTask {
    const lower = task.toLowerCase()
    const matched = this.matchKnownApiOp(lower)
    if (matched) {
      return {
        original: task,
        type: 'API',
        requiresApproval: matched.requiresApproval,
        subtasks: [{
          id: crypto.randomUUID(),
          type: 'API',
          description: task,
          apiTool: matched.apiTool,
        }],
      }
    }
    if (DESTRUCTIVE_OPS_UI_BLOCKED.test(lower)) {
      return {
        original: task,
        type: 'API',
        requiresApproval: true,
        subtasks: [{
          id: crypto.randomUUID(),
          type: 'API',
          description: task,
          apiTool: this.inferApiToolFromDestructive(lower),
        }],
      }
    }
    const isUiOp = KNOWN_UI_OPS.some((op) => lower.includes(op))
    if (isUiOp) {
      return {
        original: task,
        type: 'UI',
        requiresApproval: false,
        subtasks: [{
          id: crypto.randomUUID(),
          type: 'UI',
          description: task,
          uiTarget: task,
        }],
      }
    }
    return this.fallbackStructuredPlan(task)
  }

  private matchKnownApiOp(lower: string) {
    for (const [key, value] of Object.entries(KNOWN_API_OPS)) {
      if (lower.includes(key)) return value
    }
    return null
  }

  private inferApiToolFromDestructive(lower: string): string {
    if (lower.includes('service')) return 'cf_delete_service_instance'
    if (lower.includes('role')) return 'xsuaa_unassign_role'
    return 'cf_undeploy_mta'
  }

  private fallbackStructuredPlan(task: string): RoutedTask {
    const requiresApproval = /\b(deploy|delete|assign|configure|bind|set)\b/i.test(task)
    const subtasks: SubTask[] = [{
      id: crypto.randomUUID(),
      type: 'API',
      description: task,
      apiTool: undefined,
    }]
    return {
      original: task,
      type: 'API',
      requiresApproval,
      subtasks,
    }
  }
}
