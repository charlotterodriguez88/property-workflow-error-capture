import { z } from "zod";
import type { CaptureException } from "./infrai_errors.js";

export const propertyFailureSchema = z.discriminatedUnion("workflow", [
  z.object({
    requestId: z.string().uuid(),
    propertyId: z.string().min(1),
    workflow: z.literal("maintenance_request"),
    maintenanceRequestId: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().min(1),
  }),
  z.object({
    requestId: z.string().uuid(),
    propertyId: z.string().min(1),
    workflow: z.literal("tenant_document"),
    documentId: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().min(1),
  }),
  z.object({
    requestId: z.string().uuid(),
    propertyId: z.string().min(1),
    workflow: z.literal("inspection_reminder"),
    reminderId: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().min(1),
  }),
]);

export type PropertyFailure = z.infer<typeof propertyFailureSchema>;

export function toCaptureException(failure: PropertyFailure): CaptureException {
  return {
    title: `${failure.workflow} failed for property ${failure.propertyId}`,
    message: failure.message,
    level: "error",
    fingerprint: [failure.propertyId, failure.workflow],
    exception: failure.stack,
    context: failure,
  };
}
