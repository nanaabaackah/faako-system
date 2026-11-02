import { Router } from "express";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@faako/api-contracts";
import { ContentError } from "../content/schema.js";
const revision = z.number().int().min(0).max(2147483646);
const actionSchema = z.discriminatedUnion("type", [
  ...["start", "resume", "restart", "next", "back", "skip", "complete"].map(
    (type) => z.object({ type: z.literal(type), revision }).strict(),
  ),
  z
    .object({ type: z.literal("toggle"), enabled: z.boolean(), revision })
    .strict(),
  z
    .object({
      type: z.literal("launch"),
      tutorialId: z.string().max(40),
      revision,
    })
    .strict(),
]);
export function tutorialRoutes(service, auth) {
  const router = Router();
  router.use("/tutorials", auth.requireStaff);
  router.get("/tutorials", async (req, res) =>
    res.json(
      createSuccessResponse(await service.run(req.staff), {
        requestId: req.requestId,
      }),
    ),
  );
  router.post("/tutorials", auth.requireMutation, async (req, res) =>
    res.json(
      createSuccessResponse(
        await service.run(req.staff, actionSchema.parse(req.body)),
        { requestId: req.requestId },
      ),
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
                : "Check the tutorial action.",
          },
          { requestId: req.requestId },
        ),
      );
  });
  return router;
}
