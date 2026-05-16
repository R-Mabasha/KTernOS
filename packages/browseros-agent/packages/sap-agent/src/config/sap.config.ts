import type { SAPLandscape } from '../types'

export interface SAPAgentConfig {
  landscape: SAPLandscape
  cfApiEndpoint: string
  btpSubdomain: string
  mcpPort: number
  launchpadServicePlan?: 'standard' | 'advanced'
  defaultSystem?: string
}

export function loadSAPConfig(env: Record<string, string | undefined> = process.env): SAPAgentConfig {
  return {
    landscape: (env.SAP_LANDSCAPE as SAPLandscape | undefined) || 'dev',
    cfApiEndpoint: env.SAP_CF_API_ENDPOINT || '',
    btpSubdomain: env.SAP_BTP_SUBDOMAIN || '',
    mcpPort: Number(env.SAP_MCP_PORT || 9494),
    launchpadServicePlan: (env.SAP_LAUNCHPAD_SERVICE_PLAN as 'standard' | 'advanced' | undefined) || 'standard',
    defaultSystem: env.SAP_DEFAULT_SYSTEM || undefined,
  }
}
