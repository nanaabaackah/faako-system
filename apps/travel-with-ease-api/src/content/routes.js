import { Router } from "express";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@faako/api-contracts";
import { ContentError, pageSchema, saveContentSchema, versionSchema } from "./schema.js";

export function contentRoutes({ repository, publication, auth }) {
  const router = Router();
  router.use(auth.requirePermission("content.read"));
  const send = (req, res, data) => res.json(createSuccessResponse(data, { requestId: req.requestId }));
  const found = (value) => { if (!value) throw new ContentError(404, "not_found", "Content not found."); return value; };
  const publishing = () => { if (!publication) throw new ContentError(503, "service_unavailable", "Publication is not configured."); return publication; };
  router.get("/publication-jobs", async (req, res) => send(req, res, { items: await publishing().list() }));
  router.post("/publication-jobs/:id/retry", auth.requireMutation, auth.requirePermission("content.publish"), async (req, res) => send(req, res, await publishing().retry(z.string().uuid().parse(req.params.id), req.staff, req.requestId)));
  router.get("/", async (req, res) => send(req, res, { items: await repository.list() }));
  router.get("/:page", async (req, res) => send(req, res, found(await repository.get(pageSchema.parse(req.params.page)))));
  router.get("/:page/preview", async (req, res) => send(req, res, found(await repository.get(pageSchema.parse(req.params.page)))));
  router.get("/:page/revisions", async (req, res) => send(req, res, { items: await repository.history(pageSchema.parse(req.params.page)) }));
  router.post("/:page/draft", auth.requireMutation, auth.requirePermission("content.write"), async (req, res) => {
    const { body, expectedVersion } = saveContentSchema.parse(req.body);
    send(req, res, await repository.save(pageSchema.parse(req.params.page), body, expectedVersion, req.staff, req.requestId));
  });
  for (const action of ["publish", "unpublish"]) router.post(`/:page/${action}`, auth.requireMutation, auth.requirePermission("content.publish"), async (req, res) => {
    const { expectedVersion } = versionSchema.parse(req.body);
    send(req, res, await publishing().enqueue(pageSchema.parse(req.params.page), expectedVersion, action === "unpublish", req.staff, req.requestId));
  });
  router.post("/:page/revert/:revisionId", auth.requireMutation, auth.requirePermission("content.write"), async (req, res) => {
    const { expectedVersion } = versionSchema.parse(req.body);
    send(req, res, await repository.revert(pageSchema.parse(req.params.page), z.string().uuid().parse(req.params.revisionId), expectedVersion, req.staff, req.requestId));
  });
  router.use((error, req, res, next) => {
    if (!(error instanceof z.ZodError) && !(error instanceof ContentError)) return next(error);
    return res.status(error.status || 400).json(createErrorResponse({ code: error.code || "validation_error", message: error instanceof z.ZodError ? "Check the content fields." : error.message }, { requestId: req.requestId }));
  });
  return router;
}
