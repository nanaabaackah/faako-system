import { asyncHandler } from "../utils/asyncHandler.js";
import { buildProjectAccessWhere } from "./projectFields.js";
import {
  buildProjectActivityWhere,
  serializeProjectActivity,
} from "./projectActivity.js";
import { parseProjectTaskId } from "./projectTaskFields.js";

export const createProjectActivityHandlers = ({ prisma, isGlobalAdmin }) => ({
  list: async (req, res) => {
    const projectId = parseProjectTaskId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ error: "Project id must be a valid number." });
    }

    const project = await prisma.project.findFirst({
      where: buildProjectAccessWhere({
        projectId,
        organizationId: req.user.organizationId,
        globalAccess: isGlobalAdmin(req.user),
      }),
      select: { id: true, organizationId: true },
    });
    if (!project) return res.status(404).json({ error: "Project not found." });

    const entries = await prisma.auditLog.findMany({
      where: buildProjectActivityWhere({
        projectId: project.id,
        organizationId: project.organizationId,
      }),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({ activity: entries.map(serializeProjectActivity) });
  },
});

export const registerProjectActivityRoutes = (
  app,
  { prisma, authMiddleware, isGlobalAdmin }
) => {
  const handlers = createProjectActivityHandlers({ prisma, isGlobalAdmin });
  app.get(
    "/api/projects/:projectId/activity",
    authMiddleware,
    asyncHandler(handlers.list)
  );
};
