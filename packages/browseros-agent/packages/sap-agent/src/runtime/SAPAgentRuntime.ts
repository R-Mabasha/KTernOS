import { ApprovalGate, ApprovalRejectedError, type ApprovalNotifier } from '../approval/ApprovalGate'
import { AuditLogger } from '../audit/AuditLogger'
import { loadSAPConfig } from '../config/sap.config'
import { SAPMCPServer } from '../mcp/SAPMCPServer'
import { PlaybookEngine } from '../playbooks/PlaybookEngine'
import { TaskRouter } from '../router/TaskRouter'
import { SAPSessionBridge } from '../session/SAPSessionBridge'
import type { ApprovalDecision, SAPExecutionResult, SAPTaskContext } from '../types'

export class SAPAgentRuntime {
  private readonly config = loadSAPConfig()
  private readonly router = new TaskRouter()
  private readonly sessions = new SAPSessionBridge()
  private readonly audit = new AuditLogger()
  private readonly approval: ApprovalGate
  private readonly mcp = new SAPMCPServer(this.sessions)
  private readonly playbooks = new PlaybookEngine()

  constructor(notifyApprovalRequired?: ApprovalNotifier) {
    this.approval = new ApprovalGate(this.audit, notifyApprovalRequired)
  }

  get sessionBridge() {
    return this.sessions
  }

  async route(task: string, context?: SAPTaskContext) {
    return this.router.route(task, context)
  }

  async executeTask(
    task: string,
    context?: SAPTaskContext,
    approvalDecision?: ApprovalDecision | null,
    params?: Record<string, unknown>,
  ): Promise<SAPExecutionResult> {
    const taskId = crypto.randomUUID()
    const routed = this.router.route(task, context)
    const landscape = context?.landscape || this.config.landscape
    const system = context?.system || this.config.defaultSystem || 'sap-system'
    const results: Array<Record<string, unknown>> = []

    for (const step of routed.subtasks) {
      await this.approval.beforeExecution(taskId, step, approvalDecision || null, { landscape, system })
      if (step.type === 'API' && step.apiTool) {
        const result = await this.mcp.executeTool(step.apiTool, params || step.params || {})
        results.push({ stepId: step.id, result })
      } else {
        results.push({ stepId: step.id, result: { ok: true, summary: `UI step planned for ${step.uiTarget || step.description}` } })
      }
      await this.audit.log({
        timestamp: new Date().toISOString(),
        taskId,
        actor: 'agent',
        action: step.apiTool || 'ui-step',
        target: step.uiTarget || step.description,
        landscape,
        status: 'COMPLETED',
      })
    }
    return { taskId, routed, results }
  }

  async runPlaybook(
    name: string,
    context?: SAPTaskContext,
    approvalDecision?: ApprovalDecision | null,
    params?: Record<string, unknown>,
  ) {
    const taskId = crypto.randomUUID()
    const landscape = context?.landscape || this.config.landscape
    const system = context?.system || this.config.defaultSystem || 'sap-system'
    const result = await this.playbooks.execute(name, {
      onStep: async (step) => {
        await this.approval.beforeExecution(taskId, step, approvalDecision || null, { landscape, system })
        if (step.apiTool) {
          await this.mcp.executeTool(step.apiTool, params || step.params || {})
        }
        await this.audit.log({
          timestamp: new Date().toISOString(),
          taskId,
          actor: 'agent',
          action: step.apiTool || 'ui-step',
          target: step.uiTarget || step.description,
          landscape,
          status: 'COMPLETED',
        })
      },
    })
    return { taskId, result }
  }

  async queryAudit(filter: Parameters<AuditLogger['query']>[0]) {
    return this.audit.query(filter)
  }

  respondToApproval(taskId: string, approved: boolean) {
    return this.approval.respond(taskId, approved)
  }
}

export { ApprovalRejectedError }
