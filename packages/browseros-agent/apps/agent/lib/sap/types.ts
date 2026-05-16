export interface SAPSessionPayload {
  cfToken: string
  xsuaaToken: string
  cookies: Record<string, string>
  expiresAt: number
}

export interface SAPApprovalPayload {
  action: string
  target: string
  landscape: 'dev' | 'qa' | 'prod'
  system: string
  estimatedEffect: string
}

export interface SAPApprovalRequestMessage {
  type: 'SAP_APPROVAL_REQUIRED'
  taskId: string
  payload: SAPApprovalPayload
}

export interface SAPApprovalResponseMessage {
  type: 'SAP_APPROVAL_RESPONSE'
  taskId: string
  approved: boolean
}
