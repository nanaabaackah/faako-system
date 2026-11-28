export class ContentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ContentError";
    this.status = status;
    this.code = code;
  }
}
