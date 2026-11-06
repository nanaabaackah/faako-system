/**
 * Minimal Notion 2025-09-03 adapter. No SDK or other dependencies.
 * Only the existing Faako Notebook component and journal data sources may be edited.
 * No destructive APIs, no page content replacement, no AI-generated copy.
 */
import {REGISTRY_DS, JOURNAL_DS} from "./sync-core.mjs";

const API = "https://api.notion.com/v1";
const ROOT = "40f53ad7-303d-8171-92fd-c3a541ff715f";
const REGISTRY_DB = "1f653608-59f8-4451-aeaa-2d55e5e67321";
const JOURNAL_DB = "ca3c79c7-8a80-4621-a06e-4bcd2471bf64";
const UUID = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
const normalizeId = value => String(value).replaceAll("-", "").toLowerCase();
const parentId = item => item?.parent?.page_id;

export class NotionApi {
  constructor(token, fetchImpl = fetch) {
    if (!token || typeof token !== "string") throw new Error("Missing Faako Notebook integration token");
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, route, body) {
    if (!route.startsWith("/") || route.includes("..")) throw new Error("Invalid Notion API path");
    const response = await this.fetchImpl(API + route, {
      method,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      // Do not log Notion response bodies or tokens.
      throw new Error(`Notion ${method} ${route.split("?")[0]} failed (HTTP ${response.status})`);
    }
    return response.json();
  }

  async assertNotebookScope() {
    const root = await this.request("GET", `/pages/${ROOT}`);
    if (normalizeId(root?.id) !== normalizeId(ROOT)) throw new Error("Notebook root unavailable");
    for (const databaseId of [REGISTRY_DB, JOURNAL_DB]) {
      const database = await this.request("GET", `/databases/${databaseId}`);
      if (normalizeId(parentId(database)) !== normalizeId(ROOT)) {
        throw new Error("Notion database is not a direct child of the authorized notebook");
      }
    }
    // IDs are fixed to the previously validated notebook; never accept an arbitrary
    // URL or database ID from a pull request, event payload or CLI flag.
    return true;
  }

  async query(dataSourceId, property, value) {
    if (![REGISTRY_DS, JOURNAL_DS].includes(dataSourceId)) {
      throw new Error("Notion data source not allowlisted");
    }
    if (!((dataSourceId === REGISTRY_DS && property === "Path") ||
          (dataSourceId === JOURNAL_DS && property === "Sync Key"))) {
      throw new Error("Notion query property not allowlisted");
    }
    const result = await this.request("POST", `/data_sources/${dataSourceId}/query`, {
      filter: {property, rich_text: {equals: value}},
      page_size: 10,
    });
    // Too many matching rows are ambiguous, including beyond a first page.
    if (result.has_more || result.results?.length > 9) {
      throw new Error("Ambiguous Notion matching rows; manual review required");
    }
    return result.results || [];
  }

  async findRegistryByPath(path) {
    return this.query(REGISTRY_DS, "Path", path);
  }

  async findJournalBySyncKey(syncKey) {
    return this.query(JOURNAL_DS, "Sync Key", syncKey);
  }

  async hasPageMarker(pageId, marker) {
    if (!UUID.test(pageId)) throw new Error("Invalid Notion page ID");
    let cursor;
    let examined = 0;
    do {
      const qs = new URLSearchParams({page_size: "100"});
      if (cursor) qs.set("start_cursor", cursor);
      const list = await this.request("GET", `/blocks/${pageId}/children?${qs.toString()}`);
      examined += (list.results || []).length;
      if (examined > 1000) throw new Error("Large Notion page; marker scan needs manual review");
      for (const block of list.results || []) {
        const text = (block[block.type]?.rich_text || [])
          .map(chunk => chunk.plain_text ?? chunk.text?.content ?? "").join("");
        if (text === marker) return true;
      }
      cursor = list.has_more ? list.next_cursor : null;
      if (list.has_more && !cursor) throw new Error("Notion pagination cursor missing");
    } while (cursor);
    return false;
  }

  async createJournal(properties, blocks) {
    return this.request("POST", "/pages", {
      parent: {type: "data_source_id", data_source_id: JOURNAL_DS},
      properties,
      children: blocks,
    });
  }

  async appendChangeNote(pageId, blocks) {
    if (!UUID.test(pageId)) throw new Error("Invalid Notion page ID");
    return this.request("PATCH", `/blocks/${pageId}/children`, {children: blocks});
  }
}
