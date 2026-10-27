// Only fixed, developer-authored diagnostics belong here. Never include env values.
const messages = {
  hosted_environment_invalid: "Set APP_ENV to staging or production and NODE_ENV to production.",
  migration_approval_mismatch: "TWE_MIGRATION_APPROVED_ENV must match APP_ENV.",
  initialise_invalid: "TWE_DB_INITIALISE must be true or false.",
  organisation_id_invalid: "TWE_ORGANISATION_ID must be a valid UUID.",
  runtime_url_invalid: "DATABASE_URL must be a PostgreSQL URL with a host and database name.",
  migration_url_invalid: "TWE_MIGRATION_DATABASE_URL must be a PostgreSQL URL with a host and database name.",
  runtime_url_options_forbidden: "Remove query parameters and fragments from DATABASE_URL; configure TLS using TWE_DATABASE_TLS and TWE_DATABASE_CA.",
  migration_url_options_forbidden: "Remove query parameters and fragments from TWE_MIGRATION_DATABASE_URL; configure TLS using TWE_DATABASE_TLS and TWE_DATABASE_CA.",
  database_tls_disabled: "TWE_DATABASE_TLS cannot disable TLS for hosted databases.",
  database_endpoint_mismatch: "DATABASE_URL and TWE_MIGRATION_DATABASE_URL must use the same host, port and database.",
  database_roles_not_separate: "Use distinct database usernames in DATABASE_URL and TWE_MIGRATION_DATABASE_URL.",
  database_username_invalid: "Database URL usernames must use valid percent encoding.",
  organisation_name_invalid: "Initialisation requires TWE_ORGANISATION_NAME containing 1–160 characters.",
  runtime_role_invalid: "DATABASE_URL username must start with a lowercase letter and contain only lowercase letters, digits or underscores (maximum 63 characters).",
};

export class DatabaseConfigurationError extends Error {
  constructor(code) {
    super(messages[code] || "Database configuration is invalid.");
    this.code = Object.hasOwn(messages, code) ? code : "database_configuration_invalid";
  }
}
