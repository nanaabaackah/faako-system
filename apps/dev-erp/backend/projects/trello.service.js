import crypto from "node:crypto";
import { writeAuditLog } from "../audit/audit.service.js";
import { PROJECT_TASK_STATUSES, resolveProjectTaskCompletion } from "./projectTaskFields.js";

const DEFAULT_TRELLO_API_BASE_URL = "https://api.trello.com/1";
const REQUEST_TIMEOUT_MS = 10_000;

const safeText = (value, max = 500) => String(value || "").trim().slice(0, max);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

export const normalizeTrelloMappings = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const mappings = {};
  for (const status of PROJECT_TASK_STATUSES) {
    const entry = value[status];
    const listId = safeText(typeof entry === "string" ? entry : entry?.listId, 120);
    if (!listId) return null;
    mappings[status] = {
      listId,
      listName: safeText(entry?.listName, 180) || null,
    };
  }
  return mappings;
};

export const getMappedTrelloListId = (connection, status) =>
  connection?.statusMappings?.[status]?.listId
  || (typeof connection?.statusMappings?.[status] === "string" ? connection.statusMappings[status] : null);

export const getStatusForTrelloList = (connection, listId) =>
  Array.from(PROJECT_TASK_STATUSES).find(
    (status) => getMappedTrelloListId(connection, status) === listId
  ) || null;

export const buildTrelloCardPayload = (task, connection) => ({
  name: task.title,
  desc: task.description || "",
  due: task.dueDate ? new Date(task.dueDate).toISOString() : null,
  dueComplete: task.status === "DONE",
  idList: getMappedTrelloListId(connection, task.status),
});

const parseResponse = async (response) => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Trello request failed (${response.status}): ${safeText(text, 240) || "Unknown error"}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export const createTrelloClient = ({
  fetchImpl = globalThis.fetch,
  apiBaseUrl = process.env.TRELLO_API_BASE_URL || DEFAULT_TRELLO_API_BASE_URL,
} = {}) => {
  const request = async (path, { method = "GET", credentials, body, clientIdentifier } = {}) => {
    if (!fetchImpl) throw new Error("Trello requests are unavailable in this runtime.");
    const url = new URL(`${String(apiBaseUrl).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`);
    url.searchParams.set("key", credentials.apiKey);
    url.searchParams.set("token", credentials.apiToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(clientIdentifier ? { "X-Trello-Client-Identifier": clientIdentifier } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return parseResponse(response);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Trello request timed out.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    request,
    async discoverBoard(credentials, boardId) {
      const [board, lists] = await Promise.all([
        request(`boards/${encodeURIComponent(boardId)}?fields=name,url,closed`, { credentials }),
        request(`boards/${encodeURIComponent(boardId)}/lists?filter=open&fields=id,name,closed`, { credentials }),
      ]);
      if (board.closed) throw new Error("The selected Trello board is archived.");
      return {
        board: { id: board.id, name: board.name, url: board.url || null },
        lists: Array.isArray(lists)
          ? lists.filter((list) => !list.closed).map((list) => ({ id: list.id, name: list.name }))
          : [],
      };
    },
  };
};

export const decryptTrelloCredentials = (connection, secretCrypto) => {
  if (!secretCrypto) throw new Error("Trello secret encryption is not configured.");
  return {
    apiKey: secretCrypto.decrypt(connection.apiKeyEncrypted),
    apiToken: secretCrypto.decrypt(connection.apiTokenEncrypted),
    appSecret: secretCrypto.decrypt(connection.appSecretEncrypted),
  };
};

export const serializeTrelloConnection = (connection) => connection ? ({
  id: connection.id,
  organizationId: connection.organizationId,
  boardId: connection.boardId,
  boardName: connection.boardName,
  boardUrl: connection.boardUrl,
  statusMappings: connection.statusMappings,
  status: connection.status,
  webhookConfigured: Boolean(connection.webhookId && connection.webhookCallbackUrl),
  webhookId: connection.webhookId || null,
  lastSyncAt: connection.lastSyncAt || null,
  lastError: connection.lastError || null,
  updatedAt: connection.updatedAt,
}) : null;

export const createTrelloSyncService = ({ prisma, secretCrypto, trelloClient }) => ({
  async syncTask(taskId) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      include: { organization: { include: { trelloConnection: true } } },
    });
    const connection = task?.organization?.trelloConnection;
    if (!task || !connection || connection.status === "DISABLED" || task.archivedAt) {
      return { synced: false, skipped: true };
    }

    try {
      const credentials = decryptTrelloCredentials(connection, secretCrypto);
      const payload = buildTrelloCardPayload(task, connection);
      if (!payload.idList) throw new Error(`No Trello list is mapped for ${task.status}.`);
      const clientIdentifier = `dev-erp:${connection.id}:${task.id}:${Date.now()}`;
      const card = task.trelloCardId
        ? await trelloClient.request(`cards/${encodeURIComponent(task.trelloCardId)}`, {
            method: "PUT", credentials, body: payload, clientIdentifier,
          })
        : await trelloClient.request("cards", {
            method: "POST", credentials, body: payload, clientIdentifier,
          });
      const now = new Date();
      const updatedTask = await prisma.projectTask.update({
        where: { id: task.id },
        data: {
          trelloCardId: task.trelloCardId || card.id,
          trelloCardUrl: card.url || card.shortUrl || task.trelloCardUrl || null,
          trelloSyncStatus: "SYNCED",
          trelloLastSyncSource: "DEV_ERP",
          trelloLastSyncedAt: now,
          trelloLastError: null,
        },
      });
      await prisma.trelloConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now, lastError: null },
      });
      return { synced: true, task: updatedTask };
    } catch (error) {
      const message = safeText(error?.message || "Trello synchronization failed.", 500);
      const updatedTask = await prisma.projectTask.update({
        where: { id: task.id },
        data: { trelloSyncStatus: "ERROR", trelloLastError: message },
      }).catch(() => null);
      await prisma.trelloConnection.update({
        where: { id: connection.id }, data: { lastError: message },
      }).catch(() => null);
      return { synced: false, error: message, task: updatedTask };
    }
  },
});

export const verifyTrelloWebhookSignature = ({ rawBody, signature, callbackUrl, appSecret }) => {
  if (!Buffer.isBuffer(rawBody) || !signature || !callbackUrl || !appSecret) return false;
  const content = Buffer.concat([rawBody, Buffer.from(callbackUrl, "utf8")]);
  const expected = crypto.createHmac("sha1", appSecret).update(content).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(String(signature));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const getInboundTaskUpdate = ({ payload, connection, task }) => {
  const card = payload?.action?.data?.card || {};
  const listId = payload?.action?.data?.listAfter?.id || card.idList || null;
  const data = {};
  const changedFields = [];
  const mappedStatus = listId ? getStatusForTrelloList(connection, listId) : null;
  if (mappedStatus && mappedStatus !== task.status) {
    data.status = mappedStatus;
    data.completedAt = resolveProjectTaskCompletion({
      status: mappedStatus,
      currentCompletedAt: task.completedAt,
    });
    changedFields.push("status");
  } else if (card.dueComplete === true && task.status !== "DONE") {
    data.status = "DONE";
    data.completedAt = resolveProjectTaskCompletion({ status: "DONE", currentCompletedAt: task.completedAt });
    changedFields.push("status");
  }
  if (hasOwn(card, "due")) {
    const parsedDue = card.due ? new Date(card.due) : null;
    if (!parsedDue || !Number.isNaN(parsedDue.getTime())) {
      data.dueDate = parsedDue;
      changedFields.push("dueDate");
    }
  }
  if (card.closed === true && !task.archivedAt) {
    data.archivedAt = new Date();
    changedFields.push("archivedAt");
  }
  if (changedFields.length) {
    data.trelloSyncStatus = "SYNCED";
    data.trelloLastSyncSource = "TRELLO";
    data.trelloLastSyncedAt = new Date();
    data.trelloLastError = null;
  }
  return { data, changedFields };
};

export const processTrelloWebhook = async ({ prisma, connection, payload, clientIdentifier }) => {
  const actionId = safeText(payload?.action?.id, 160);
  const actionType = safeText(payload?.action?.type, 120) || "unknown";
  const cardId = safeText(payload?.action?.data?.card?.id, 160) || null;
  if (!actionId) return { status: "IGNORED", reason: "missing_action_id" };
  const existing = await prisma.trelloWebhookEvent.findUnique({ where: { actionId } });
  if (existing?.status !== "ERROR" && existing) return { status: "IGNORED", duplicate: true };
  if (existing?.status === "ERROR") {
    await prisma.trelloWebhookEvent.delete({ where: { actionId } });
  }

  const task = cardId
    ? await prisma.projectTask.findFirst({ where: { organizationId: connection.organizationId, trelloCardId: cardId } })
    : null;
  if (String(clientIdentifier || "").startsWith("dev-erp:")) {
    await prisma.trelloWebhookEvent.create({ data: {
      organizationId: connection.organizationId, connectionId: connection.id, taskId: task?.id || null,
      actionId, actionType, cardId, clientIdentifier: safeText(clientIdentifier, 1000), status: "IGNORED", processedAt: new Date(),
    }});
    return { status: "IGNORED", loopPrevented: true };
  }
  if (!task) {
    await prisma.trelloWebhookEvent.create({ data: {
      organizationId: connection.organizationId, connectionId: connection.id,
      actionId, actionType, cardId, status: "IGNORED", processedAt: new Date(), error: "Linked task not found.",
    }});
    return { status: "IGNORED", reason: "task_not_found" };
  }

  const { data, changedFields } = getInboundTaskUpdate({ payload, connection, task });
  if (!changedFields.length) {
    await prisma.trelloWebhookEvent.create({ data: {
      organizationId: connection.organizationId, connectionId: connection.id, taskId: task.id,
      actionId, actionType, cardId, status: "IGNORED", processedAt: new Date(),
    }});
    return { status: "IGNORED", reason: "unsupported_change" };
  }

  const updatedTask = await prisma.projectTask.update({ where: { id: task.id }, data });
  await prisma.trelloWebhookEvent.create({ data: {
    organizationId: connection.organizationId, connectionId: connection.id, taskId: task.id,
    actionId, actionType, cardId, status: "PROCESSED", processedAt: new Date(),
  }});
  await writeAuditLog(prisma, {
    organizationId: connection.organizationId,
    action: data.archivedAt ? "TASK_ARCHIVED" : data.status === "DONE" ? "TASK_COMPLETED" : "TASK_UPDATED",
    targetType: "ProjectTask",
    targetId: String(task.id),
    source: "projects",
    category: "project_activity",
    actorType: "integration",
    actorLabel: "Trello",
    summary: `Updated task ${task.title} from Trello.`,
    metadata: { projectId: task.projectId, taskId: task.id, taskTitle: task.title, syncSource: "TRELLO", changedFields, trelloActionId: actionId },
  });
  return { status: "PROCESSED", task: updatedTask, changedFields };
};
