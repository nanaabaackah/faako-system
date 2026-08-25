import assert from "node:assert/strict";
import test from "node:test";
import {
  documentBytesMatchMimeType,
  sanitizeDocumentFileName,
} from "./documents.js";

test("document names cannot retain client path traversal", () => {
  assert.equal(sanitizeDocumentFileName("../../private/report.pdf"), "report.pdf");
  assert.equal(sanitizeDocumentFileName("C:\\temp\\invoice.pdf"), "invoice.pdf");
});

test("document content must match the declared MIME type", () => {
  const pdf = Buffer.from("%PDF-1.7\nexample", "utf8");
  assert.equal(documentBytesMatchMimeType(pdf, "application/pdf"), true);
  assert.equal(documentBytesMatchMimeType(pdf, "image/png"), false);
  assert.equal(documentBytesMatchMimeType(Buffer.from([0, 1, 2]), "text/plain"), false);
});
