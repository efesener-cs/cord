import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiErrorCode, ApiErrorResponse } from "@cord/contracts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const requestContext: RequestHandler = (request, response, next) => {
  // Generate our own ID; do not trust arbitrary inbound identifiers.
  const requestId = randomUUID();
  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("Cache-Control", "no-store");
  const startedAt = performance.now();
  response.on("finish", () => {
    // Do not log bodies, credentials, cookies, headers, or query strings.
    console.info(
      JSON.stringify({
        event: "http_request",
        requestId,
        method: request.method,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
  next();
};

function errorBody(code: ApiErrorCode, message: string, requestId: string): ApiErrorResponse {
  return { error: { code, message, requestId } };
}

export const notFound: RequestHandler = (_request, response) => {
  response
    .status(404)
    .json(errorBody("NOT_FOUND", "API endpoint not found.", String(response.locals.requestId)));
};

export const handleError: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const type =
    typeof error === "object" && error !== null && "type" in error ? error.type : undefined;
  const requestId = String(response.locals.requestId);
  if (error instanceof HttpError) {
    response.status(error.status).json(errorBody(error.code, error.message, requestId));
  } else if (type === "entity.parse.failed") {
    response
      .status(400)
      .json(errorBody("INVALID_JSON", "Request body must be valid JSON.", requestId));
  } else if (type === "entity.too.large") {
    response
      .status(413)
      .json(errorBody("PAYLOAD_TOO_LARGE", "Request body exceeds the size limit.", requestId));
  } else {
    console.error(JSON.stringify({ event: "request_error", requestId }));
    response
      .status(500)
      .json(errorBody("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
  }
};
