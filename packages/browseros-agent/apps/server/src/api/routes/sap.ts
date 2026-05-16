import { Hono } from 'hono'
import { ApprovalRejectedError, SAPAgentRuntime } from '@browseros/sap-agent'

const approvalEvents: Array<{ taskId: string; payload: { action: string; target: string; landscape: 'dev' | 'qa' | 'prod'; system: string; estimatedEffect: string } }> = []
const runtime = new SAPAgentRuntime(async (event) => {
  approvalEvents.push({ taskId: event.taskId, payload: event.payload })
})

export function createSapRoutes() {
  return new Hono()
    .get('/health', async (c) => c.json({ ok: true }))
    .get('/approval/pending', async (c) => {
      const event = approvalEvents.shift() || null
      return c.json({ ok: true, event })
    })
    .post('/approval/respond', async (c) => {
      const body = await c.req.json()
      const resolved = runtime.respondToApproval(body.taskId, Boolean(body.approved))
      return c.json({ ok: resolved })
    })
    .post('/session', async (c) => {
      const body = await c.req.json()
      runtime.sessionBridge.acceptFromExtension(body)
      return c.json({ ok: true, expiresAt: body.expiresAt })
    })
    .post('/route', async (c) => {
      const body = await c.req.json()
      const routed = await runtime.route(body.task, body.context)
      return c.json({ ok: true, routed })
    })
    .post('/execute', async (c) => {
      const body = await c.req.json()
      try {
        const execution = await runtime.executeTask(body.task, body.context, body.approval || null, body.params)
        return c.json({ ok: true, ...execution })
      } catch (error) {
        if (error instanceof ApprovalRejectedError) {
          return c.json({ ok: false, cancelled: true, payload: error.payload }, 409)
        }
        throw error
      }
    })
    .post('/playbooks/:name/run', async (c) => {
      const body = await c.req.json().catch(() => ({}))
      const name = c.req.param('name')
      try {
        const result = await runtime.runPlaybook(name, body.context, body.approval || null, body.params)
        return c.json({ ok: true, ...result })
      } catch (error) {
        if (error instanceof ApprovalRejectedError) {
          return c.json({ ok: false, cancelled: true, payload: error.payload }, 409)
        }
        throw error
      }
    })
    .post('/audit/query', async (c) => {
      const body = await c.req.json().catch(() => ({}))
      const entries = await runtime.queryAudit(body || {})
      return c.json({ ok: true, entries })
    })
}
