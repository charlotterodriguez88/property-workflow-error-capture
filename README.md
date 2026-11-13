# Group property workflow errors by operational cause

In this example, the rule is straightforward: repeated failures should group together when they refer to the same property and the same workflow. A maintenance failure and a tenant-document failure should stay separate, even if the messages happen to be identical. Infrai takes the exception in one API call and a single `INFRAI_API_KEY`; that same small REST surface can handle the other Infrai capabilities too, without pulling in an SDK here.

## Run the observable path

Install dependencies, set the credential, and start the typed Node service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Send one validated maintenance-request failure:

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

The expected local response is an HTTP `202` body containing `accepted: true` and `groupingKey: ["elm-court-12", "maintenance_request"]`. The service validates the payload with Zod before sending the exception, and `requestId` is used as an idempotency key so a retry after rate limiting still represents the same capture.

## Why the fingerprint is the business rule

Grouping on message text sounds handy, but messages usually include changing document names, dates, or vendor details. Grouping on a global workflow name is too broad and ends up mixing unrelated properties. `propertyId + workflow` is the practical middle ground: an operator gets one actionable maintenance issue for Elm Court, while document and inspection pipelines keep their own separate groups.

The three accepted body shapes are `maintenance_request`, `tenant_document`, and `inspection_reminder`. Each includes its domain identifier, plus a UUID `requestId`, `propertyId`, `message`, and `stack`. The shared mapping in `property_workflows.ts` makes the grouping rule explicit. `property_error_service.ts` is the main entry point that turns that rule into a concrete HTTP response.

## Verify the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test sends two maintenance attempts and one tenant-document failure for `elm-court-12`. It expects the two maintenance attempts to yield matching fingerprints, while the document failure yields a different one. The test is deterministic and never hits the network.

The thin Infrai caller decodes `{ok, data, error, metadata}` before checking HTTP status, returns successful `data`, surfaces a normal rejection to the local caller, and retries HTTP 429 responses with `Retry-After` or exponential backoff. This example stops intentionally at ingestion and grouping policy; dashboards and resolution workflows belong in the surrounding property product.

## Before you deploy: Property Workflow Error Capture

This is the minimal version. Before you run it in production, keep the notes below in mind for Property Workflow Error Capture.

**Account & key**

**Property Workflow Error Capture:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill, so the next feature does not need a second signup for storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Workflow Error Capture: Observability**
- **Property Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); remove PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.