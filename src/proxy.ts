import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Deny-by-default while the product is pre-launch: every route requires a
// Clerk session except auth pages and machine endpoints that carry their
// own verification (Meta webhook signatures, cron bearer secret).
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
