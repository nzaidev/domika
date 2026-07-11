// Next.js instrumentation hook: structured logging for uncaught server
// errors (route handlers, server actions, RSC). A minimal observability
// starter — swap the sink for Sentry/Logtail when chosen (plan §10).

export function register() {
  // Reserved for tracer/SDK init when an observability vendor is picked.
}

type RequestContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: RequestContext,
) {
  const payload = {
    level: "error",
    at: "server",
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routePath: context.routePath,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  // Structured single-line JSON so log drains can parse it. Never logs
  // request bodies or headers (may carry tokens / PII).
  console.error(`[server-error] ${JSON.stringify(payload)}`);
}
