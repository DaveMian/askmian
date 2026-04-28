import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { env } from "../lib/env";

export const adminAuthRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string().min(1) }))
    .mutation(({ input }) => {
      const expected = env.adminPassword;
      if (!expected || expected === "") {
        return { success: false, error: "Admin password not configured" };
      }
      if (input.password === expected) {
        return { success: true, token: "askmian-admin-session" };
      }
      return { success: false, error: "Invalid password" };
    }),

  verify: publicQuery.query(() => {
    return { configured: !!env.adminPassword && env.adminPassword !== "" };
  }),
});
