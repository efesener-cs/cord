import express, { Router } from "express";
import { mkdir, writeFile, rm, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Database } from "@cord/database";
import { z } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";
import { requireSession } from "../auth/required.ts";
import type { AuthService } from "../auth/service.ts";
import type { SessionTransportOptions } from "../auth/transport.ts";
import type { AccessService } from "../communication/access.ts";

export function createUploadRouter(
  database: Database,
  auth: AuthService,
  session: SessionTransportOptions,
  access: AccessService,
  directory: string,
) {
  const router = Router();
  const root = resolve(directory);
  router.use(requireSession(auth, session));
  router.post(
    "/",
    express.raw({ type: "application/octet-stream", limit: "10mb" }),
    async (request, response) => {
      const input = z
        .strictObject({
          name: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[^\p{Cc}\/\\]+$/u),
          mediaType: z
            .string()
            .min(1)
            .max(127)
            .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/),
        })
        .safeParse(request.query);
      if (!input.success || !Buffer.isBuffer(request.body) || request.body.length === 0)
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid attachment.");
      const ownerId = response.locals.user.id as string;
      const staged = await database.attachment.count({ where: { ownerId, messageId: null } });
      if (staged >= 20)
        throw new HttpError(
          429,
          "RATE_LIMITED",
          "Remove unused attachments before uploading more.",
        );
      const id = randomUUID();
      await mkdir(root, { recursive: true });
      await writeFile(join(root, id), request.body, { mode: 0o600, flag: "wx" });
      try {
        const attachment = await database.attachment.create({
          data: { id, ownerId, ...input.data, size: request.body.length },
          select: { id: true, name: true, mediaType: true, size: true },
        });
        response.status(201).json({ attachment });
      } catch (error) {
        await rm(join(root, id), { force: true });
        throw error;
      }
    },
  );
  router.get("/:id", async (request, response) => {
    const parsed = z.uuid().safeParse(request.params.id);
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid attachment.");
    const row = await database.attachment.findUnique({
      where: { id: parsed.data },
      include: { message: { select: { channelId: true, conversationId: true } } },
    });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Attachment not found.");
    if (row.message)
      await access.target(
        response.locals.user.id,
        row.message.channelId
          ? { kind: "channel", id: row.message.channelId }
          : { kind: "conversation", id: row.message.conversationId! },
      );
    else if (row.ownerId !== response.locals.user.id)
      throw new HttpError(404, "NOT_FOUND", "Attachment not found.");
    response.setHeader("Content-Type", "application/octet-stream");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.download(join(root, row.id), row.name, (error) => {
      if (error && !response.headersSent) response.status(404).end();
    });
  });
  router.delete("/:id", async (request, response) => {
    const parsed = z.uuid().safeParse(request.params.id);
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid attachment.");
    const deleted = await database.attachment.deleteMany({
      where: { id: parsed.data, ownerId: response.locals.user.id, messageId: null },
    });
    if (deleted.count) await rm(join(root, parsed.data), { force: true });
    response.status(204).end();
  });
  return router;
}

// Reclaim staged uploads after one day and files orphaned by account/resource deletion.
export async function cleanUploads(database: Database, directory: string): Promise<void> {
  const root = resolve(directory);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await database.attachment.deleteMany({ where: { messageId: null, createdAt: { lt: cutoff } } });
  const files = await readdir(root).catch(() => [] as string[]);
  for (const id of files) {
    if (!z.uuid().safeParse(id).success) continue;
    if ((await stat(join(root, id))).mtime > cutoff) continue;
    if (!(await database.attachment.findUnique({ where: { id }, select: { id: true } })))
      await rm(join(root, id), { force: true });
  }
}
