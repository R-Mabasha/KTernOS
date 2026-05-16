import { sendSAPApprovalResponse, sendSAPSession } from '@/lib/sap/client'
import type {
  SAPApprovalResponseMessage,
  SAPSessionPayload,
} from '@/lib/sap/types'

type SAPExtensionMessage =
  | { type: 'SAP_SESSION_PUSH'; payload: SAPSessionPayload }
  | { type: 'SAP_SESSION_GET_COOKIES'; domains: string[] }
  | SAPApprovalResponseMessage

const memoryState: { session: SAPSessionPayload | null } = { session: null }
const SERVER = 'http://127.0.0.1:9100/sap'

async function pollApprovalQueue() {
  try {
    const response = await fetch(`${SERVER}/approval/pending`)
    const data = await response.json() as { ok: boolean; event: { taskId: string; payload: { action: string; target: string; landscape: 'dev' | 'qa' | 'prod'; system: string; estimatedEffect: string } } | null }
    if (data.event) {
      await chrome.runtime.sendMessage({ type: 'SAP_APPROVAL_REQUIRED', taskId: data.event.taskId, payload: data.event.payload })
    }
  } catch {}
}

setInterval(() => {
  void pollApprovalQueue()
}, 1000)

chrome.runtime.onMessage.addListener((message: SAPExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'SAP_SESSION_PUSH') {
    memoryState.session = message.payload
    void sendSAPSession(message.payload).then((result) => sendResponse(result))
    return true
  }

  if (message.type === 'SAP_APPROVAL_RESPONSE') {
    void sendSAPApprovalResponse(message.taskId, message.approved).then((result) => sendResponse(result))
    return true
  }

  if (message.type === 'SAP_SESSION_GET_COOKIES') {
    void (async () => {
      const cookies = await Promise.all(
        message.domains.map(async (domain) => {
          const items = await chrome.cookies.getAll({ domain })
          return items.map((item) => [item.name, item.value] as const)
        }),
      )
      sendResponse({ ok: true, cookies: Object.fromEntries(cookies.flat()) })
    })()
    return true
  }

  return false
})

export function getSAPSessionMemory() {
  return memoryState.session
}
