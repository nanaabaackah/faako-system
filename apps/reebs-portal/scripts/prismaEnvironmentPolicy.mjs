import { isDeployedEnvironment, parseAppEnvironment } from "@faako/config";

const isTrue = (value) => String(value || "").trim().toLowerCase() === "true";

export const assertPrismaCommandAllowed = ({
  environment,
  command,
  commandArgs = [],
  env = {},
}) => {
  const appEnvironment = parseAppEnvironment(environment);
  const migrationAction = command === "migrate" ? commandArgs[0] : "";

  if (isDeployedEnvironment(appEnvironment) && ["dev", "reset"].includes(migrationAction)) {
    throw new Error(
      `Prisma migrate ${migrationAction} is disabled in ${appEnvironment}; deployed environments must use migrate deploy.`
    );
  }

  if (
    appEnvironment === "development"
    && migrationAction === "reset"
    && !isTrue(env.REEBS_ALLOW_DEVELOPMENT_RESET)
  ) {
    throw new Error(
      "Development reset blocked. Set REEBS_ALLOW_DEVELOPMENT_RESET=true only for an isolated development database."
    );
  }

  if (appEnvironment === "production" && migrationAction === "deploy") {
    const explicitlyApproved = isTrue(env.REEBS_ALLOW_PRODUCTION_MIGRATION);
    const railwayProduction = String(env.RAILWAY_ENVIRONMENT_NAME || "")
      .trim()
      .toLowerCase() === "production";
    if (!explicitlyApproved && !railwayProduction) {
      throw new Error(
        "Production migration blocked. Run from the Railway production environment or set REEBS_ALLOW_PRODUCTION_MIGRATION=true for an intentional one-off migration job."
      );
    }
  }

  return appEnvironment;
};
