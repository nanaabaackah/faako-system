const LOCAL_APP_ENVS = new Set(["development", "dev", "local", "test"]);

const normalizeAppEnv = (value) => String(value || "").trim().toLowerCase();

const getAppEnv = () =>
  normalizeAppEnv(process.env.APP_ENV || process.env.CONTEXT || process.env.NODE_ENV || "");

const isLocalAppEnv = () => LOCAL_APP_ENVS.has(getAppEnv());

const resolveDatabaseUrl = () => {
  if (isLocalAppEnv()) {
    const localDatabaseUrl =
      process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL_LOCAL || "";

    if (localDatabaseUrl) {
      return localDatabaseUrl;
    }

    if (process.env.ALLOW_PRODUCTION_DATABASE_IN_DEV === "true") {
      return (
        process.env.DATABASE_URL_PRODUCTION ||
        process.env.DATABASE_URL ||
        process.env.DATABASE_URL_DEVELOPMENT ||
        ""
      );
    }

    throw new Error(
      "APP_ENV=development requires DATABASE_URL_DEVELOPMENT or DATABASE_URL_LOCAL. Refusing to use the production database in local development.",
    );
  }

  return (
    process.env.DATABASE_URL_PRODUCTION ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_DEVELOPMENT ||
    process.env.DATABASE_URL_LOCAL ||
    ""
  );
};

module.exports = {
  getAppEnv,
  isLocalAppEnv,
  resolveDatabaseUrl,
};
