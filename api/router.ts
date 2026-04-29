import { createRouter, publicQuery } from "./middleware";
import { applicationRouter } from "./routers/application";
import { stripeRouter } from "./routers/stripe";
import { adminRouter } from "./routers/admin";
import { adminAuthRouter } from "./routers/adminAuth";
import { analyticsRouter } from "./routers/analytics";
import { notesRouter } from "./routers/notes";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  application: applicationRouter,
  stripe: stripeRouter,
  admin: adminRouter,
  adminAuth: adminAuthRouter,
  analytics: analyticsRouter,
  notes: notesRouter,
});

export type AppRouter = typeof appRouter;
