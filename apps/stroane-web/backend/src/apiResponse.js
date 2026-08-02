import {
  createCompatibleErrorResponse,
  errorCodeForStatus,
  safeMessageForErrorCode,
} from "@faako/api-contracts";

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

export const sendApiError = (
  req,
  res,
  {
    status = 500,
    code = errorCodeForStatus(status),
    message = safeMessageForErrorCode(code),
    issues,
    details,
    legacy = {},
    exposeServerMessage = false,
  } = {},
) => {
  const safeMessage =
    status >= 500 && !exposeServerMessage
      ? safeMessageForErrorCode(code)
      : message;
  return res.status(status).json(
    createCompatibleErrorResponse(
      {
        code,
        message: safeMessage,
        issues,
        details,
      },
      {
        requestId: req?.requestId,
        legacy,
      },
    ),
  );
};

export const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error?.statusCode && error.statusCode < 500) {
      return sendApiError(req, res, {
        status: error.statusCode,
        message: error.message,
        details: error.details,
      });
    }

    return next(error);
  }
};

export const sendOk = (res, payload = {}) => res.json({ ok: true, ...payload });

export const sendCreated = (res, payload = {}) => res.status(201).json({ ok: true, ...payload });
