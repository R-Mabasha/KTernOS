import { AuditLogger } from '../audit/AuditLogger'
import type { ApprovalDecision, ApprovalPayload, SAPLandscape, SubTask } from '../types'

export class ApprovalRejectedError extends Error {
  constructor(public readonly payload: ApprovalPayload) {
    super(`Approval rejected for ${payload.action} on ${payload.target}`)
  }
}

export type ApprovalNotifier = (event: { type: 'approval:required'; taskId: string; payload: ApprovalPayload }) => void | Promise<void>

export class ApprovalGate {
  private readonly destructivePattern = /\b(deploy|undeploy|delete|assign|unassign|bind|unbind|configure|set)\b/i
  private readonly pendingApprovals = new Map<
    string,
    {
      payload: ApprovalPayload
      resolve: (decision: ApprovalDecision) => void
      reject: (error: Error) => void
    }
  >()

  constructor(
    private readonly audit: AuditLogger,
    private readonly notifyApprovalRequired?: ApprovalNotifier,
  ) {}

  isDestructive(subtask: SubTask): boolean {
    return this.destructivePattern.test(subtask.description) || this.destructivePattern.test(subtask.apiTool || '')
  }

  async beforeExecution(
    taskId: string,
    subtask: SubTask,
    decision: ApprovalDecision | null,
    context: { landscape: SAPLandscape; system: string },
  ): Promise<void> {
    if (!this.isDestructive(subtask)) return

    const payload: ApprovalPayload = {
      action: subtask.apiTool || subtask.description,
      target: subtask.uiTarget || subtask.description,
      landscape: context.landscape,
      system: context.system,
      estimatedEffect:
        subtask.type === 'API'
          ? 'API write operation against SAP/BTP target system'
          : 'UI change against SAP screen and underlying business object',
    }

    const finalDecision = decision?.approved ? decision : await this.awaitConsultantApproval(taskId, payload)

    if (!finalDecision.approved) {
      await this.audit.log({
        timestamp: new Date().toISOString(),
        taskId,
        actor: 'consultant',
        action: payload.action,
        target: payload.target,
        landscape: payload.landscape,
        status: 'CANCELLED',
        error: 'Approval denied by consultant',
      })
      throw new ApprovalRejectedError(payload)
    }

    await this.audit.log({
      timestamp: new Date().toISOString(),
      taskId,
      actor: finalDecision.actor,
      action: payload.action,
      target: payload.target,
      landscape: payload.landscape,
      status: 'APPROVED',
    })
  }

  respond(taskId: string, approved: boolean): boolean {
    const pending = this.pendingApprovals.get(taskId)
    if (!pending) return false
    this.pendingApprovals.delete(taskId)
    pending.resolve({
      approved,
      actor: 'consultant',
      targetSystem: pending.payload.system,
      landscape: pending.payload.landscape,
    })
    return true
  }

  hasPending(taskId: string): boolean {
    return this.pendingApprovals.has(taskId)
  }

  private async awaitConsultantApproval(taskId: string, payload: ApprovalPayload): Promise<ApprovalDecision> {
    await this.notifyApprovalRequired?.({ type: 'approval:required', taskId, payload })
    return new Promise<ApprovalDecision>((resolve, reject) => {
      this.pendingApprovals.set(taskId, { payload, resolve, reject })
    })
  }
}
