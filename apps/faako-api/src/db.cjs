const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("./runtimeConfig.cjs");

const pool = new Pool({
  connectionString: resolveDatabaseUrl()
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  query
};
