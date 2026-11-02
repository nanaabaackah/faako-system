import { Router } from "express";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@faako/api-contracts";
import { ContentError } from "../content/schema.js";
const issue = z
  .object({
    subject: z.string().trim().min(1).max(255),
    approvalReference: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/),
  })
  .strict();
export function invitationRoutes(service, auth) {
  const router = Router();
  const send = (req, res, result) =>
    res
      .set("Cache-Control", "private, no-store")
      .json(createSuccessResponse(result, { requestId: req.requestId }));
  router.get("/activation", auth.requireAccessIdentity, async (req, res) =>
    send(req, res, await service.identityStatus(req.accessIdentity)),
  );
  router.post(
    "/activation/preview",
    auth.requireAccessIdentity,
    auth.requireAccessMutation,
    async (req, res) => {
      const input = z
        .object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .strict()
        .parse(req.body);
      send(req, res, await service.preview(req.accessIdentity, input.code));
    },
  );
  router.post(
    "/activation/claim",
    auth.requireAccessIdentity,
    auth.requireAccessMutation,
    async (req, res) => {
      const input = z
        .object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .strict()
        .parse(req.body);
      send(
        req,
        res,
        await service.claim(req.accessIdentity, input.code, req.requestId),
      );
    },
  );
  router.post(
    "/activation/owner-invitation",
    auth.requireAccessIdentity,
    auth.requireAccessMutation,
    async (req, res) =>
      send(
        req,
        res,
        await service.issue({
          ...issue.parse(req.body),
          identity: req.accessIdentity,
          requestId: req.requestId,
        }),
      ),
  );
  router.post(
    "/activation/owner-invitation/:id/revoke",
    auth.requireAccessIdentity,
    auth.requireAccessMutation,
    async (req, res) =>
      send(
        req,
        res,
        await service.revoke({
          identity: req.accessIdentity,
          id: z.string().uuid().parse(req.params.id),
          requestId: req.requestId,
        }),
      ),
  );
  router.get(
    "/invitations",
    auth.requireStaff,
    auth.requireOwner,
    async (req, res) =>
      send(req, res, { items: await service.list(req.staff) }),
  );
  router.post(
    "/invitations",
    auth.requireStaff,
    auth.requireMutation,
    auth.requireOwner,
    async (req, res) =>
      send(
        req,
        res,
        await service.issue({
          ...issue.parse(req.body),
          actor: req.staff,
          requestId: req.requestId,
        }),
      ),
  );
  router.post(
    "/invitations/:id/revoke",
    auth.requireStaff,
    auth.requireMutation,
    auth.requireOwner,
    async (req, res) =>
      send(
        req,
        res,
        await service.revoke({
          actor: req.staff,
          id: z.string().uuid().parse(req.params.id),
          requestId: req.requestId,
        }),
      ),
  );
  router.use((error, req, res, next) => {
    if (!(error instanceof ContentError) && !(error instanceof z.ZodError))
      return next(error);
    res
      .status(error.status || 400)
      .json(
        createErrorResponse(
          {
            code:
              error instanceof ContentError ? error.code : "validation_error",
            message:
              error instanceof ContentError
                ? error.message
                : "Check the invitation details.",
          },
          { requestId: req.requestId },
        ),
      );
  });
  return router;
}
