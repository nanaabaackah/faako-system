/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns 400 with a structured error list on failure.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(400).json({ error: "Validation failed", errors });
  }
  req.body = result.data;
  next();
};
