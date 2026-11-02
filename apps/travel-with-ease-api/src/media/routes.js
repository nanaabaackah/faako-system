import express, { Router } from "express";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@faako/api-contracts";
import { ContentError } from "../content/schema.js";
import { MAX_UPLOAD_BYTES } from "./images.js";
import { driveId } from "./drive.js";
import { mediaMetadataSchema } from "./service.js";

export function mediaRoutes({ service, auth }) {
  const router = Router();
  router.use(auth.requirePermission("media.read"));
  const id = (value) => z.string().uuid().parse(value);
  router.get("/", async (req, res) =>
    res.json(
      createSuccessResponse(await service.list(), { requestId: req.requestId }),
    ),
  );
  router.get(
    "/drive",
    auth.requirePermission("media.write"),
    async (req, res) => {
      const pageToken = z
        .string()
        .max(2048)
        .parse(req.query.pageToken || "");
      res.json(
        createSuccessResponse(await service.listDrive(pageToken), {
          requestId: req.requestId,
        }),
      );
    },
  );
  router.post(
    "/drive/import",
    auth.requireMutation,
    auth.requirePermission("media.write"),
    async (req, res) => {
      const input = mediaMetadataSchema
        .extend({
          fileId: driveId,
          version: z.string().regex(/^\d{1,30}$/),
        })
        .strict()
        .parse(req.body);
      res
        .status(201)
        .json(
          createSuccessResponse(
            await service.importDrive(input, req.staff, req.requestId),
            { requestId: req.requestId },
          ),
        );
    },
  );
  router.get("/:id/preview", async (req, res) => {
    const bytes = await service.preview(id(req.params.id));
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Disposition", "inline; filename=preview.webp");
    res.send(bytes);
  });
  const upload = async (req, res) => {
    let metadata;
    try {
      metadata = {
        alt: decodeURIComponent(req.get("X-Media-Alt") || ""),
        rights: decodeURIComponent(req.get("X-Media-Rights") || ""),
      };
    } catch {
      throw new ContentError(
        400,
        "validation_error",
        "Image metadata is invalid.",
      );
    }
    const result = await service.upload(
      req.body,
      req.get("Content-Type"),
      metadata,
      req.staff,
      req.requestId,
      req.params.id ? id(req.params.id) : null,
    );
    res
      .status(201)
      .json(createSuccessResponse(result, { requestId: req.requestId }));
  };
  router.post(
    "/upload",
    auth.requireMutation,
    auth.requirePermission("media.write"),
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES, inflate: false }),
    upload,
  );
  router.post(
    "/:id/replace",
    auth.requireMutation,
    auth.requirePermission("media.write"),
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES, inflate: false }),
    upload,
  );
  router.post(
    "/:id/archive",
    auth.requireMutation,
    auth.requirePermission("media.write"),
    async (req, res) => {
      await service.archive(id(req.params.id), req.staff, req.requestId);
      res.json(
        createSuccessResponse({ archived: true }, { requestId: req.requestId }),
      );
    },
  );
  router.use((error, req, res, next) => {
    if (!(error instanceof z.ZodError) && !(error instanceof ContentError))
      return next(error);
    res
      .status(error.status || 400)
      .json(
        createErrorResponse(
          {
            code: error.code || "validation_error",
            message:
              error instanceof z.ZodError
                ? "Check the image details."
                : error.message,
          },
          { requestId: req.requestId },
        ),
      );
  });
  return router;
}
