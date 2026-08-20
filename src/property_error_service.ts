import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { capturePropertyException, InfraiError } from "./infrai_errors.js";
import { propertyFailureSchema, toCaptureException } from "./property_workflows.js";

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/property-errors") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const failure = propertyFailureSchema.parse(await readJson(request));
    const captured = await capturePropertyException(
      toCaptureException(failure),
      `property-error:${failure.requestId}`,
    );
    json(response, 202, {
      accepted: true,
      groupingKey: [failure.propertyId, failure.workflow],
      captured,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid property failure body" });
      return;
    }
    if (error instanceof InfraiError && error.status < 500) {
      json(response, error.status, { error: error.code });
      return;
    }
    json(response, 502, { error: "Error capture could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Property error service listening on http://localhost:${port}`);
});
