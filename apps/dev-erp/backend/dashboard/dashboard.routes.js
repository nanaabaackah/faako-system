import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeAuditLog } from "../audit/audit.service.js";

const RANGE_HOURS = { "24h": 24, "7d": 168, "30d": 720 };

export const registerDashboardRoutes = (
  app,
  { authMiddleware, getDashboardVerseHandler, getDashboardWeatherHandler, prisma }
) => {
  app.get("/api/dashboard/verse-of-day", authMiddleware, asyncHandler(getDashboardVerseHandler));
  app.get("/api/dashboard/weather", authMiddleware, asyncHandler(getDashboardWeatherHandler));

  app.get(
    "/api/dashboard/activity",
    authMiddleware,
    asyncHandler(async (req, res) => {
      const range = RANGE_HOURS[req.query.range] ? req.query.range : "7d";
      const hours = RANGE_HOURS[range];
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const organizationId = Number(req.user?.organizationId);

      const orgWhere =
        Number.isInteger(organizationId) && organizationId > 0
          ? {
              OR: [{ organizationId }, { organizationId: null }],
            }
          : {};

      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          ...orgWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true },
          })
        : [];
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      const entries = logs.map((log) => {
        const user = log.userId ? (userMap[log.userId] ?? null) : null;
        return {
          ...serializeAuditLog(log),
          user: user ? { id: user.id, fullName: user.fullName } : null,
        };
      });

      const activeUserCount = new Set(logs.map((l) => l.userId).filter(Boolean)).size;

      return res.json({ entries, range, since: since.toISOString(), activeUserCount });
    })
  );
};
