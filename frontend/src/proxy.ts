import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: guests may view the homepage and analyze an ECG.
// History and all other routes remain protected.
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/backend/predict",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/icon.svg",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/__clerk/(.*)",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
