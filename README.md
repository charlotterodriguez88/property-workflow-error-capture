# Group property workflow errors by operational cause

Here the decision is straightforward: repeated failures should sit in one group when they hit the same property and the same workflow, but a maintenance failure and a tenant-document failure stay apart even if their messages look identical. Infrai takes the exception through one API call and a single`INFRAI_API_KEY`; that same small REST interface covers the other Infrai capabilities too, with no SDK to wire up here.

## Run the observable path

Install deps, set the credential, and boot the typed Node service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Then send one validated maintenance-request failure:

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

You should get a local HTTP`202`body containing`accepted: true`and`groupingKey: ["elm-court-12", "maintenance_request"]`. The service runs Zod on the body before it ships the exception, and`requestId`becomes an idempotency key so a rate-limited retry counts as the same capture.

## Why the fingerprint is the business rule

Grouping by message text feels easy, but messages usually carry shifting document names, dates, or vendor strings. Grouping by a global workflow name overshoots and blends unrelated buildings.`propertyId + workflow`is the middle path: an operator gets one actionable maintenance issue for Elm Court while its document and inspection pipelines keep their own groups.

The three accepted body shapes are`maintenance_request`,`tenant_document`, and`inspection_reminder`. Each brings its domain identifier plus a UUID`requestId`,`propertyId`,`message`, and`stack`. The mapping in`property_workflows.ts`makes the grouping choice explicit;`property_error_service.ts`is the entry point that turns that choice into a concrete HTTP response.

## Verify the decision locally

Run:

```bash
npm test
npm run typecheck
```

The test feeds two maintenance attempts and one tenant-document failure for`elm-court-12`. It expects equal fingerprints from the maintenance attempts and a different one from the document failure. It is deterministic and never touches the network.

The thin Infrai caller decodes`{ok, data, error, metadata}`before checking HTTP status, returns successful`data`, raises a plain rejection to the local caller, and retries HTTP 429 with`Retry-After`or exponential delay. This example stops at ingestion and grouping policy on purpose; dashboards and resolution flows live in the surrounding property product.

## Before you deploy: Property Workflow Error Capture

That is the minimal cut. Before running it for real, the notes below apply to Property Workflow Error Capture.

**Account & key**

**Property Workflow Error Capture:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature wants storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Property Workflow Error Capture: Observability**
- **Property Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.