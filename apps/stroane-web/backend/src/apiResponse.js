export class HttpError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}

export const createHttpError = (message, statusCode = 400, details = undefined) =>
  new HttpError(message, statusCode, details);

export const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error?.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        error: error.message,
        details: error.details || undefined,
      });
    }

    return next(error);
  }
};

export const sendOk = (res, payload = {}) => res.json({ ok: true, ...payload });

export const sendCreated = (res, payload = {}) => res.status(201).json({ ok: true, ...payload });
