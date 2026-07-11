import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Deny-by-default while the product is pre-launch: every route requires a
// Clerk session except auth pages and machine endpoints that carry their
// own verification (Meta webhook signatures, cron bearer secret).
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  // Consumer-facing shared listings (owner data excluded at the DB level)
  // and their images — social crawlers must be able to read them.
  "/p(.*)",
  "/api/media(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Always run auth on API routes, even those ending in an image
    // extension (e.g. /api/documents/…​.jpg) — otherwise the private
    // documents endpoint would skip Clerk and its session check.
    "/(api|trpc)(.*)",
  ],
};
