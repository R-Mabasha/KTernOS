export type SAPLandscape = 'dev' | 'qa' | 'prod'
export type RoutedTaskType = 'API' | 'UI' | 'HYBRID'
export type SubTaskType = 'API' | 'UI'
export type AuditStatus = 'APPROVED' | 'CANCELLED' | 'COMPLETED' | 'FAILED'

export interface SAPSession {
  cfToken: string
  xsuaaToken: string
  cookies: Record<string, string>
  expiresAt: number
}

export type SessionEvent =
  | { type: 'session:updated'; expiresAt: number }
  | { type: 'session:expired'; reason: string }

export interface SessionBridge {
  getSession(): Promise<SAPSession>
  watchSession(cb: (event: SessionEvent) => void): () => void
}

export interface SAPTaskContext {
  landscape?: SAPLandscape
  system?: string
}

export interface SubTask {
  id: string
  type: SubTaskType
  description: string
  apiTool?: string
  uiTarget?: string
  params?: Record<string, unknown>
  dependsOn?: string[]
}

export interface RoutedTask {
  original: string
  type: RoutedTaskType
  subtasks: SubTask[]
  requiresApproval: boolean
}

export interface ApprovalPayload {
  action: string
  target: string
  landscape: SAPLandscape
  system: string
  estimatedEffect: string
}

export interface ApprovalDecision {
  approved: boolean
  actor: 'consultant'
  targetSystem: string
  landscape: SAPLandscape
}

export interface AuditEntry {
  timestamp: string
  taskId: string
  actor: 'agent' | 'consultant'
  action: string
  target: string
  landscape: SAPLandscape
  status: AuditStatus
  error?: string
}

export interface SAPExecutionResult {
  taskId: string
  routed: RoutedTask
  results: Array<Record<string, unknown>>
}
