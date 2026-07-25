import { asyncHandler } from "../utils/asyncHandler.js";
import { buildProjectAccessWhere } from "./projectFields.js";
import { parseProjectTaskId } from "./projectTaskFields.js";
import {
  decryptTrelloCredentials,
  normalizeTrelloMappings,
  processTrelloWebhook,
  serializeTrelloConnection,
  verifyTrelloWebhookSignature,
} from "./trello.service.js";

const safeError = (error) => String(error?.message || "Trello integration failed.").slice(0, 500);

const requireAdmin = (req, res, isGlobalAdmin) => {
  if (req.user?.roleName === "Admin" || isGlobalAdmin(req.user)) return true;
  res.status(403).json({ error: "Administrator access is required to configure Trello." });
  return false;
};

const buildCallbackUrl = (baseUrl, connectionId) => {
  const base = String(baseUrl || "").trim().replace(/\/$/, "");
  return base ? `${base}/${connectionId}` : "";
};

export const createTrelloHandlers = ({
  prisma,
  isGlobalAdmin,
  secretCrypto,
  trelloClient,
  trelloSync,
  webhookBaseUrl,
}) => {
  const loadProject = async (req, res) => {
    const projectId = parseProjectTaskId(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: "Project id must be a valid number." });
      return null;
    }
    const project = await prisma.project.findFirst({
      where: buildProjectAccessWhere({
        projectId,
        organizationId: req.user.organizationId,
        globalAccess: isGlobalAdmin(req.user),
      }),
      select: { id: true, organizationId: true },
    });
    if (!project) res.status(404).json({ error: "Project not found." });
    return project;
  };

  const resolveCredentials = (body, existing) => {
    if (!secretCrypto) throw new Error("Set OAUTH_TOKEN_ENCRYPTION_KEY before configuring Trello.");
    const stored = existing ? decryptTrelloCredentials(existing, secretCrypto) : {};
    const credentials = {
      apiKey: String(body?.apiKey || stored.apiKey || "").trim(),
      apiToken: String(body?.apiToken || stored.apiToken || "").trim(),
      appSecret: String(body?.appSecret || stored.appSecret || "").trim(),
    };
    if (!credentials.apiKey || !credentials.apiToken || !credentials.appSecret) {
      throw new Error("Trello API key, token, and application secret are required.");
    }
    return credentials;
  };

  return {
    get: async (req, res) => {
      const project = await loadProject(req, res);
      if (!project) return;
      const connection = await prisma.trelloConnection.findUnique({
        where: { organizationId: project.organizationId },
      });
      const recentErrors = await prisma.projectTask.findMany({
        where: { projectId: project.id, organizationId: project.organizationId, trelloSyncStatus: "ERROR" },
        select: { id: true, title: true, trelloLastError: true, trelloCardUrl: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      return res.json({ connection: serializeTrelloConnection(connection), recentErrors });
    },

    discover: async (req, res) => {
      if (!requireAdmin(req, res, isGlobalAdmin)) return;
      const project = await loadProject(req, res);
      if (!project) return;
      const existing = await prisma.trelloConnection.findUnique({ where: { organizationId: project.organizationId } });
      try {
        const credentials = resolveCredentials(req.body, existing);
        const boardId = String(req.body?.boardId || existing?.boardId || "").trim();
        if (!boardId) return res.status(400).json({ error: "Trello board id is required." });
        return res.json(await trelloClient.discoverBoard(credentials, boardId));
      } catch (error) {
        return res.status(400).json({ error: safeError(error) });
      }
    },

    save: async (req, res) => {
      if (!requireAdmin(req, res, isGlobalAdmin)) return;
      const project = await loadProject(req, res);
      if (!project) return;
      const existing = await prisma.trelloConnection.findUnique({ where: { organizationId: project.organizationId } });
      try {
        const credentials = resolveCredentials(req.body, existing);
        const boardId = String(req.body?.boardId || existing?.boardId || "").trim();
        if (!boardId) return res.status(400).json({ error: "Trello board id is required." });
        const discovered = await trelloClient.discoverBoard(credentials, boardId);
        const requestedMappings = normalizeTrelloMappings(req.body?.statusMappings);
        if (!requestedMappings) return res.status(400).json({ error: "Every task status must map to a Trello list." });
        if (new Set(Object.values(requestedMappings).map((mapping) => mapping.listId)).size !== Object.keys(requestedMappings).length) {
          return res.status(400).json({ error: "Each task status must map to a different Trello list." });
        }
        const listNames = new Map(discovered.lists.map((list) => [list.id, list.name]));
        if (Object.values(requestedMappings).some((mapping) => !listNames.has(mapping.listId))) {
          return res.status(400).json({ error: "Every mapped list must belong to the selected open Trello board." });
        }
        const statusMappings = Object.fromEntries(Object.entries(requestedMappings).map(([status, mapping]) => [
          status, { listId: mapping.listId, listName: listNames.get(mapping.listId) },
        ]));
        let connection = await prisma.trelloConnection.upsert({
          where: { organizationId: project.organizationId },
          create: {
            organizationId: project.organizationId,
            apiKeyEncrypted: secretCrypto.encrypt(credentials.apiKey),
            apiTokenEncrypted: secretCrypto.encrypt(credentials.apiToken),
            appSecretEncrypted: secretCrypto.encrypt(credentials.appSecret),
            boardId: discovered.board.id,
            boardName: discovered.board.name,
            boardUrl: discovered.board.url,
            statusMappings,
            status: "ACTIVE",
          },
          update: {
            apiKeyEncrypted: secretCrypto.encrypt(credentials.apiKey),
            apiTokenEncrypted: secretCrypto.encrypt(credentials.apiToken),
            appSecretEncrypted: secretCrypto.encrypt(credentials.appSecret),
            boardId: discovered.board.id,
            boardName: discovered.board.name,
            boardUrl: discovered.board.url,
            statusMappings,
            status: "ACTIVE",
            lastError: null,
          },
        });

        const callbackUrl = buildCallbackUrl(webhookBaseUrl, connection.id);
        let webhookError = "";
        if (!callbackUrl) {
          webhookError = "Set TRELLO_WEBHOOK_BASE_URL to enable inbound Trello synchronization.";
        } else if (!connection.webhookId || connection.webhookCallbackUrl !== callbackUrl || existing?.boardId !== discovered.board.id) {
          if (connection.webhookId) {
            await trelloClient.request(`webhooks/${encodeURIComponent(connection.webhookId)}`, {
              method: "DELETE", credentials,
            }).catch(() => null);
            connection = await prisma.trelloConnection.update({
              where: { id: connection.id },
              data: { webhookId: null, webhookCallbackUrl: null },
            });
          }
          try {
            const webhook = await trelloClient.request("webhooks", {
              method: "POST",
              credentials,
              body: { description: "Dev ERP project task sync", callbackURL: callbackUrl, idModel: discovered.board.id },
            });
            connection = await prisma.trelloConnection.update({
              where: { id: connection.id },
              data: { webhookId: webhook.id, webhookCallbackUrl: callbackUrl, lastError: null },
            });
          } catch (error) {
            webhookError = safeError(error);
          }
        }
        if (webhookError) {
          connection = await prisma.trelloConnection.update({
            where: { id: connection.id }, data: { lastError: webhookError },
          });
        }
        return res.json({ connection: serializeTrelloConnection(connection), webhookError: webhookError || null });
      } catch (error) {
        return res.status(400).json({ error: safeError(error) });
      }
    },

    syncTask: async (req, res) => {
      const project = await loadProject(req, res);
      if (!project) return;
      const taskId = parseProjectTaskId(req.params.taskId);
      if (!taskId) return res.status(400).json({ error: "Task id must be a valid number." });
      const task = await prisma.projectTask.findFirst({ where: { id: taskId, projectId: project.id, organizationId: project.organizationId } });
      if (!task) return res.status(404).json({ error: "Task not found." });
      return res.json(await trelloSync.syncTask(task.id));
    },

    webhookHead: (_req, res) => res.sendStatus(200),

    webhook: async (req, res) => {
      const connectionId = parseProjectTaskId(req.params.connectionId);
      if (!connectionId) return res.status(404).end();
      const connection = await prisma.trelloConnection.findUnique({ where: { id: connectionId } });
      if (!connection?.webhookCallbackUrl) return res.status(404).end();
      let credentials;
      try {
        credentials = decryptTrelloCredentials(connection, secretCrypto);
      } catch {
        return res.status(503).json({ error: "Trello webhook verification is unavailable." });
      }
      const valid = verifyTrelloWebhookSignature({
        rawBody: req.rawBody,
        signature: req.headers["x-trello-webhook"],
        callbackUrl: connection.webhookCallbackUrl,
        appSecret: credentials.appSecret,
      });
      if (!valid) return res.status(401).json({ error: "Invalid Trello webhook signature." });
      try {
        const result = await processTrelloWebhook({
          prisma,
          connection,
          payload: req.body,
          clientIdentifier: req.headers["x-trello-client-identifier"],
        });
        return res.json({ ok: true, ...result });
      } catch (error) {
        const actionId = String(req.body?.action?.id || "").trim();
        const actionType = String(req.body?.action?.type || "unknown").slice(0, 120);
        const cardId = String(req.body?.action?.data?.card?.id || "").trim() || null;
        const message = safeError(error);
        if (actionId) {
          await prisma.trelloWebhookEvent.upsert({
            where: { actionId },
            create: { organizationId: connection.organizationId, connectionId: connection.id, actionId, actionType, cardId, status: "ERROR", error: message },
            update: { status: "ERROR", error: message },
          }).catch(() => null);
        }
        await prisma.trelloConnection.update({ where: { id: connection.id }, data: { lastError: message } }).catch(() => null);
        return res.status(500).json({ error: "Trello webhook processing failed." });
      }
    },
  };
};

export const registerTrelloRoutes = (app, dependencies) => {
  if (dependencies.emailSync) {
    const loadEmailProject = async (req, res) => {
      const projectId = parseProjectTaskId(req.params.projectId);
      if (!projectId) {
        res.status(400).json({ error: "Project id must be a valid number." });
        return null;
      }
      const project = await dependencies.prisma.project.findFirst({
        where: buildProjectAccessWhere({
          projectId,
          organizationId: req.user.organizationId,
          globalAccess: dependencies.isGlobalAdmin(req.user),
        }),
        select: { id: true, organizationId: true },
      });
      if (!project) res.status(404).json({ error: "Project not found." });
      return project;
    };

    app.get(
      "/api/projects/:projectId/trello",
      dependencies.authMiddleware,
      asyncHandler(async (req, res) => {
        const project = await loadEmailProject(req, res);
        if (!project) return;
        const recentErrors = await dependencies.prisma.projectTask.findMany({
          where: {
            projectId: project.id,
            organizationId: project.organizationId,
            trelloSyncStatus: "ERROR",
          },
          select: { id: true, title: true, trelloLastError: true, trelloCardUrl: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        res.json({
          delivery: dependencies.emailSync.getConfiguration(),
          connection: null,
          recentErrors,
        });
      })
    );
    app.post(
      "/api/projects/:projectId/trello/tasks/:taskId/sync",
      dependencies.authMiddleware,
      asyncHandler(async (req, res) => {
        const project = await loadEmailProject(req, res);
        if (!project) return;
        const taskId = parseProjectTaskId(req.params.taskId);
        if (!taskId) return res.status(400).json({ error: "Task id must be a valid number." });
        const task = await dependencies.prisma.projectTask.findFirst({
          where: { id: taskId, projectId: project.id, organizationId: project.organizationId },
          select: { id: true },
        });
        if (!task) return res.status(404).json({ error: "Task not found." });
        return res.json(await dependencies.emailSync.syncTask(task.id));
      })
    );
    return;
  }

  const handlers = createTrelloHandlers(dependencies);
  const base = "/api/projects/:projectId/trello";
  app.get(base, dependencies.authMiddleware, asyncHandler(handlers.get));
  app.post(`${base}/discover`, dependencies.authMiddleware, asyncHandler(handlers.discover));
  app.patch(`${base}/connection`, dependencies.authMiddleware, asyncHandler(handlers.save));
  app.post(`${base}/tasks/:taskId/sync`, dependencies.authMiddleware, asyncHandler(handlers.syncTask));
  app.head("/api/webhooks/trello/:connectionId", handlers.webhookHead);
  app.post("/api/webhooks/trello/:connectionId", asyncHandler(handlers.webhook));
};
