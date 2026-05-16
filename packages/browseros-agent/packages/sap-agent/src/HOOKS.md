# SAP Go-Live Agent Hook Map

## Primary BrowserOS hook points

1. `apps/server/src/api/server.ts`
- Registers SAP-specific HTTP routes.
- Mount point for `/sap/*` endpoints.

2. `apps/server/src/api/services/chat-service.ts`
- Future orchestration hook to auto-route SAP intent from chat requests.
- Best location to attach `sapContext` to a conversation session.

3. `apps/server/src/agent/ai-sdk-agent.ts`
- Future agent-loop integration point for pre-execution middleware and runtime orchestration.

4. `apps/server/src/tools/framework.ts`
- Existing guarded tool execution path.
- Candidate hard-safety enforcement location for UI actions.

5. `apps/agent/entrypoints/background/index.ts`
- Chrome extension message listener for SAP session capture and in-memory relay.

## Current implementation choices
- Session capture uses extension messaging and background in-memory cache.
- Approval enforcement runs before every routed subtask.
- API work is orchestrated through SAP runtime + MCP tool registry.
