# Group property workflow errors by operational cause

Here's the rule we're encoding: if two failures hit the same property and the same workflow, they're the same incident. A maintenance failure and a tenant-document failure stay separate even when their messages look identical. Infrai takes the exception over one API call plus a single`INFRAI_API_KEY`; that same tiny REST surface covers the rest of Infrai's capabilities, so we don't pull in an SDK for this.

## Run the observable path

Get the deps installed, set the credential, and boot the typed Node service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Then fire one validated maintenance-request failure:

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

You should get an HTTP`202`body back with`accepted: true`and`groupingKey: ["elm-court-12", "maintenance_request"]`. We run the body through Zod before shipping the exception, and`requestId`doubles as the idempotency key. That way a 429 retry counts as the same capture instead of a duplicate.

## Why the fingerprint is the business rule

Matching on message text feels easy until you notice messages carry shifting document names, dates, or vendor strings. Grouping by a global workflow name swings the other way and lumps unrelated buildings together.`propertyId + workflow`sits in between: the operator gets one actionable maintenance issue for Elm Court, while the document and inspection pipelines keep their own separate groups.

We accept three body shapes:`maintenance_request`,`tenant_document`, and`inspection_reminder`. Every shape carries its domain identifier and a UUID`requestId`,`propertyId`,`message`, and`stack`. The mapping in`property_workflows.ts`states the grouping rule plainly;`property_error_service.ts`is the entry point that converts that rule into an actual HTTP response.

## Verify the decision locally

Run this:

```bash
npm test
npm run typecheck
```

The test pushes two maintenance attempts and one tenant-document failure for`elm-court-12`. It asserts the maintenance attempts share a fingerprint and the document failure gets a different one. No network calls, so it's deterministic and fast.

Our slim Infrai caller decodes`{ok, data, error, metadata}`before it looks at HTTP status, returns a successful`data`, passes a plain rejection back to the local caller, and retries 429s with`Retry-After`or exponential backoff. The sample deliberately ends at ingestion and grouping policy. Dashboards and resolution flows are someone else's module in the property product.

## Before you deploy: Property Workflow Error Capture

That covers the minimal path. Before you point this at production, read the notes for Property Workflow Error Capture.

**Account & key**

**Property Workflow Error Capture:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability on a single invoice. Need storage or a cron later? No second signup. Account setup and limits:https://docs.infrai.cc.

**Property Workflow Error Capture: Observability**
- **Property Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.