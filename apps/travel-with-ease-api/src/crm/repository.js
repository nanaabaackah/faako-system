import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class MemoryLeadRepository {
  constructor(initial = []) { this.records = [...initial]; }
  async createLeadWithInquiry(record) { this.records.unshift(record); return record; }
  async listLeads() { return [...this.records]; }
}

export class FileLeadRepository {
  constructor(filePath) { this.filePath = path.resolve(filePath); this.queue = Promise.resolve(); }

  async readRecords() {
    try {
      const payload = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(payload.leads) ? payload.leads : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async createLeadWithInquiry(record) {
    this.queue = this.queue.then(async () => {
      const leads = await this.readRecords();
      leads.unshift(record);
      await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ leads }, null, 2), { mode: 0o600 });
      await rename(temporary, this.filePath);
      return record;
    });
    return this.queue;
  }

  async listLeads() { await this.queue; return this.readRecords(); }
}
