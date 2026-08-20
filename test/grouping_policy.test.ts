import assert from "node:assert/strict";
import test from "node:test";
import { propertyFailureSchema, toCaptureException } from "../src/property_workflows.js";

test("maintenance retries for one property share a group without merging document failures", () => {
  const common = {
    propertyId: "elm-court-12",
    message: "workflow handler raised",
    stack: "Error: workflow handler raised",
  };
  const first = propertyFailureSchema.parse({
    ...common,
    requestId: "bd74112e-b02d-4c82-8b64-2dd80b90e9ea",
    workflow: "maintenance_request",
    maintenanceRequestId: "maint-104",
  });
  const retry = propertyFailureSchema.parse({
    ...common,
    requestId: "49abe89b-364a-45db-8164-bbc5bd1ee248",
    workflow: "maintenance_request",
    maintenanceRequestId: "maint-104",
  });
  const document = propertyFailureSchema.parse({
    ...common,
    requestId: "63d9ef2c-ee77-462a-a502-a922eb5f8bde",
    workflow: "tenant_document",
    documentId: "lease-88",
  });

  assert.deepEqual(toCaptureException(first).fingerprint, toCaptureException(retry).fingerprint);
  assert.notDeepEqual(toCaptureException(first).fingerprint, toCaptureException(document).fingerprint);
});
