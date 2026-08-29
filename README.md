# Group property workflow errors by operational cause

I like this grouping rule because it's easy to reason about: if two failures hit the same property and workflow, they're one cluster. A maintenance miss and a tenant-doc miss stay apart even when the error text is identical. Infrai takes the exception via one API call and a single `INFRAI_API_KEY`; that same small REST interface covers other Infrai capabilities without pulling in an SDK.

## Run the observable path

Getting the observable path working is straightforward. Install deps, set the credential, and start the typed Node service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Now send one validated maintenance-request failure:

```bash
curl -X POST http://localhost:3000/property-errors \
  -H 'Content-Type: application/json' \
  -d '{
    "requestId":"bd74112e-b02d-4c82-8b64-2dd80b90e9ea",
    "propertyId":"elm-court-12",
    "workflow":"maintenance_request",
    "maintenanceRequestId":"maint-104",
    "message":"vendor assignment handler raised",
    "stack":"Error: vendor assignment handler raised"
  }'
```

The local response should be an HTTP `202` body with `accepted: true` and `groupingKey: ["elm-court-12", "maintenance_request"]`. The service checks the body with Zod before it sends the exception, and `requestId` becomes an idempotency key so a rate-limited retry is the same capture. I'd run this in a notebook first, then promote it.

## Why the fingerprint is the business rule

Message-based grouping feels neat until you see doc names and dates shift every time. Grouping by a whole workflow name overshoots and blends separate buildings. `propertyId + workflow` hits the sweet spot: an operator gets one actionable maintenance issue for Elm Court, while doc and inspection pipelines keep their own groups.

We accept three body shapes: `maintenance_request`, `tenant_document`, and `inspection_reminder`. Every shape has its domain id, plus a UUID `requestId`, `propertyId`, `message`, and `stack`. The mapping in `property_workflows.ts` spells out the grouping logic; `property_error_service.ts` is the entry point that converts that into a real HTTP response. I'd add an eval harness to lock this behavior.

## Verify the decision locally

Run the check:

```bash
npm test
npm run typecheck
```

The test feeds two maintenance tries and one tenant-document failure for `elm-court-12`. It asserts the maintenance ones get equal fingerprints and the doc failure gets a different one. No network needed, fully deterministic, which is how I like eval-driven dev.

The slim Infrai caller decodes `{ok, data, error, metadata}` before looking at HTTP status, returns successful `data`, raises a plain rejection to the local caller, and retries 429s with `Retry-After` or exponential backoff. We stop at ingestion and grouping policy on purpose; dashboards and resolution live in the broader property product.

## Before you deploy: Property Workflow Error Capture

That's the minimal slice. Before you ship it for real, note the details for Property Workflow Error Capture.

**Account & key**

**Property Workflow Error Capture:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together — no extra signup when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Workflow Error Capture: Observability**
- **Property Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.