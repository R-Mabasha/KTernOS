import { z } from 'zod'
import type { SAPSessionBridge } from '../session/SAPSessionBridge'

export class SAPAPIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly sapErrorCode?: string,
  ) {
    super(message)
    this.name = 'SAPAPIError'
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (err instanceof SAPAPIError && (err.httpStatus === 429 || err.httpStatus === 503)) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
        continue
      }
      throw err
    }
  }
  throw lastError
}

const CfDeployMtaSchema = z.object({
  mtaArchivePath: z.string().min(1),
  cfApiEndpoint: z.string().min(1),
  spaceGuid: z.string().min(1),
})

const CfBindServiceSchema = z.object({
  appGuid: z.string().min(1),
  serviceInstanceGuid: z.string().min(1),
  cfApiEndpoint: z.string().min(1),
})

const BtpSetDestinationSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  subdomain: z.string().min(1),
  region: z.string().min(1),
  destinationObject: z.record(z.unknown()),
})

const XsuaaAssignRoleSchema = z.object({
  userId: z.string().min(1),
  groupId: z.string().min(1),
  subdomain: z.string().min(1),
  region: z.string().min(1),
})

const LaunchpadAssignCatalogSchema = z.object({
  catalogId: z.string().min(1),
  roleId: z.string().min(1),
  subdomain: z.string().min(1),
  region: z.string().min(1),
})

const JobScheduleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  action: z.string().url(),
  cron: z.string().min(1),
  subdomain: z.string().min(1),
  region: z.string().min(1),
})

type ToolResult = { success: boolean; result: unknown; summary: string }

export class SAPMCPServer {
  constructor(private readonly sessions: SAPSessionBridge) {}

  async executeTool(tool: string, rawParams: Record<string, unknown>): Promise<ToolResult> {
    switch (tool) {
      case 'cf_deploy_mta': return this.cfDeployMta(rawParams)
      case 'cf_bind_service': return this.cfBindService(rawParams)
      case 'btp_set_destination': return this.btpSetDestination(rawParams)
      case 'xsuaa_assign_role': return this.xsuaaAssignRole(rawParams)
      case 'launchpad_assign_catalog': return this.launchpadAssignCatalog(rawParams)
      case 'job_schedule': return this.jobSchedule(rawParams)
      default:
        throw new SAPAPIError('UNKNOWN_TOOL', `Unknown SAP MCP tool: ${tool}`, 400)
    }
  }

  private async cfDeployMta(params: Record<string, unknown>): Promise<ToolResult> {
    const p = CfDeployMtaSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const res = await fetch(`https://${p.cfApiEndpoint}/v3/deployments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relationships: { space: { data: { guid: p.spaceGuid } } },
          metadata: { mtaArchivePath: p.mtaArchivePath },
        }),
      })
      if (!res.ok) throw new SAPAPIError('CF_DEPLOY_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `MTA deployment started in space ${p.spaceGuid}. Deployment ID: ${result.guid}` }
    })
  }

  private async cfBindService(params: Record<string, unknown>): Promise<ToolResult> {
    const p = CfBindServiceSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const res = await fetch(`https://${p.cfApiEndpoint}/v3/service_bindings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'app',
          relationships: {
            app: { data: { guid: p.appGuid } },
            service_instance: { data: { guid: p.serviceInstanceGuid } },
          },
        }),
      })
      if (!res.ok) throw new SAPAPIError('CF_BIND_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `Service ${p.serviceInstanceGuid} bound to app ${p.appGuid}` }
    })
  }

  private async btpSetDestination(params: Record<string, unknown>): Promise<ToolResult> {
    const p = BtpSetDestinationSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const url = `https://${p.subdomain}.destination-configuration.cfapps.${p.region}.hana.ondemand.com/destination-configuration/v1/subaccountDestinations`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.xsuaaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(p.destinationObject),
      })
      if (!res.ok) throw new SAPAPIError('BTP_DEST_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `Destination '${p.name}' created/updated in subaccount ${p.subdomain}` }
    })
  }

  private async xsuaaAssignRole(params: Record<string, unknown>): Promise<ToolResult> {
    const p = XsuaaAssignRoleSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const url = `https://${p.subdomain}.authentication.${p.region}.hana.ondemand.com/Groups/${p.groupId}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.xsuaaToken}`, 'Content-Type': 'application/scim+json' },
        body: JSON.stringify({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [{ op: 'add', path: 'members', value: [{ value: p.userId }] }],
        }),
      })
      if (!res.ok) throw new SAPAPIError('XSUAA_ROLE_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `User ${p.userId} added to role collection group ${p.groupId}` }
    })
  }

  private async launchpadAssignCatalog(params: Record<string, unknown>): Promise<ToolResult> {
    const p = LaunchpadAssignCatalogSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const url = `https://${p.subdomain}.launchpad.${p.region}.hana.ondemand.com/v2/catalogs/${p.catalogId}/roles`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.xsuaaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: p.roleId }),
      })
      if (res.status === 501 || res.status === 404) {
        throw new SAPAPIError('LAUNCHPAD_API_UNSUPPORTED', 'Launchpad API returned 501/404 — UI fallback required', res.status)
      }
      if (!res.ok) throw new SAPAPIError('LAUNCHPAD_ASSIGN_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `Catalog ${p.catalogId} assigned to role ${p.roleId}` }
    })
  }

  private async jobSchedule(params: Record<string, unknown>): Promise<ToolResult> {
    const p = JobScheduleSchema.parse(params)
    const session = await this.sessions.getSession()
    return withRetry(async () => {
      const url = `https://${p.subdomain}.jobscheduler.${p.region}.hana.ondemand.com/scheduler/jobs`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.xsuaaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          description: p.description,
          action: p.action,
          active: true,
          schedules: [{ cron: p.cron, active: true }],
        }),
      })
      if (!res.ok) throw new SAPAPIError('JOB_SCHEDULE_FAILED', await res.text(), res.status)
      const result = await res.json()
      return { success: true, result, summary: `Job '${p.name}' scheduled with cron '${p.cron}'` }
    })
  }
}
