# KTernOS

SAP Go-Live Agent workspace built on top of BrowserOS (open-source Chromium fork).

## What is this?

This repository contains the **SAP Go-Live Agent** — a domain-specific agentic layer that lets SAP consultants automate BTP/Fiori go-live tasks using natural language.

## Architecture

```
packages/browseros-agent/
├── packages/sap-agent/          ← SAP agent core (all 6 phases)
│   ├── src/session/              ← SAP session bridge (CF + XSUAA tokens)
│   ├── src/router/               ← Natural language task router
│   ├── src/approval/             ← Approval gate (no bypass)
│   ├── src/audit/                ← JSONL audit logger
│   ├── src/mcp/                  ← SAP MCP tool server (CF, BTP, XSUAA, Launchpad)
│   ├── src/playbooks/            ← YAML playbook engine + 10 built-in playbooks
│   ├── src/ui5/                  ← SAP UI5 semantic adapter
│   └── src/runtime/              ← SAP agent runtime orchestrator
├── apps/server/src/api/routes/sap.ts   ← /sap/* HTTP routes
├── apps/agent/entrypoints/
│   ├── background/sap-session-bridge.ts  ← Chrome extension session relay
│   └── sidepanel/components/ApprovalPrompt.tsx  ← Consultant approval card
└── apps/agent/lib/sap/               ← Extension SAP types + API client
```

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /sap/session | Push SAP session from extension |
| POST | /sap/execute | Execute natural language SAP task |
| POST | /sap/route | Route task without executing |
| GET  | /sap/approval/pending | Poll for pending approval events |
| POST | /sap/approval/respond | Respond to approval request |
| POST | /sap/playbooks/:name/run | Run a named playbook |
| POST | /sap/audit/query | Query audit log |

## Built-in playbooks

- `deploy-btp-app` — CF push + bind services + set destinations
- `assign-fiori-catalog` — assign catalog to role via Launchpad API
- `assign-xsuaa-role` — SCIM call to assign role collection
- `create-service-instance` — CF API v3 create + bind
- `create-btp-destination` — POST to Destination Service
- `check-idoc-errors` — navigate WE02, filter errors
- `configure-cpi-iflow` — navigate CPI, open iFlow
- `run-smoke-test` — Fiori launchpad validation
- `mtls-cert-rotation` — cert update + rebind
- `landscape-smoke-suite` — smoke across dev/qa/prod

## Engineering rules

- No credentials ever touch disk. Session tokens in memory only.
- Approval gate cannot be bypassed. No flag, no env var, no config disables it.
- Semantic UI5 selectors only. No auto-generated CSS classes.
- All MCP tool inputs validated with Zod before execution.
