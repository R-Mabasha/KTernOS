import type {
  SAPApprovalPayload,
  SAPSessionPayload,
} from './types'

const SERVER = 'http://127.0.0.1:9100/sap'

export async function sendSAPSession(session: SAPSessionPayload) {
  const response = await fetch(`${SERVER}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(session),
  })
  return response.json()
}

export async function executeSAPTask(
  task: string,
  context?: Record<string, unknown>,
  approval?: { approved: boolean; actor: 'consultant'; targetSystem: string; landscape: 'dev' | 'qa' | 'prod' },
  params?: Record<string, unknown>,
) {
  const response = await fetch(`${SERVER}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, context, approval, params }),
  })
  return response.json() as Promise<{ ok: boolean; approvalRequired?: boolean; payload?: SAPApprovalPayload }>
}

export async function sendSAPApprovalResponse(taskId: string, approved: boolean) {
  const response = await fetch(`${SERVER}/approval/respond`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ taskId, approved }),
  })
  return response.json()
}
