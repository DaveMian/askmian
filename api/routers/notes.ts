import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applicationNotes } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const notesRouter = createRouter({
  list: publicQuery
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(applicationNotes)
        .where(eq(applicationNotes.applicationId, input.applicationId))
        .orderBy(desc(applicationNotes.createdAt));
      return rows;
    }),

  create: publicQuery
    .input(
      z.object({
        applicationId: z.number(),
        note: z.string().min(1),
        createdBy: z.string().default("admin"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(applicationNotes).values({
        applicationId: input.applicationId,
        note: input.note,
        createdBy: input.createdBy,
      });
      return { id: Number(result[0].insertId) };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(applicationNotes).where(eq(applicationNotes.id, input.id));
      return { success: true };
    }),
});
