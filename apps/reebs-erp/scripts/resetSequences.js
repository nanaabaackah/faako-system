/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../runtimeEnv.js";
import { Client } from "pg";

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

const main = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const sequencesRes = await client.query(
      `SELECT n.nspname AS schema_name,
              c.relname AS sequence_name,
              t.relname AS table_name,
              a.attname AS column_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
       JOIN pg_class t ON d.refobjid = t.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       WHERE c.relkind = 'S'
         AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       ORDER BY n.nspname, t.relname, a.attname`
    );

    const sequences = sequencesRes.rows || [];
    if (sequences.length === 0) {
      console.log("No sequences found to reset.");
      return;
    }

    let updated = 0;
    for (const sequence of sequences) {
      const schema = sequence.schema_name || "public";
      const tableRef = `${quoteIdent(schema)}.${quoteIdent(sequence.table_name)}`;
      const columnRef = quoteIdent(sequence.column_name);
      const sequenceRef = `${quoteIdent(schema)}.${quoteIdent(sequence.sequence_name)}`;

      const maxRes = await client.query(
        `SELECT COALESCE(MAX(${columnRef}), 0) AS max_id FROM ${tableRef}`
      );
      const maxId = Number(maxRes.rows?.[0]?.max_id) || 0;
      const nextId = maxId + 1;

      await client.query(`SELECT setval($1::regclass, $2, false)`, [
        sequenceRef,
        nextId,
      ]);
      updated += 1;
      console.log(
        `✅ ${sequence.table_name}.${sequence.column_name} -> ${sequence.sequence_name} set to ${nextId}`
      );
    }

    console.log(`Done. Updated ${updated} sequence(s).`);
  } catch (err) {
    console.error("❌ Sequence reset failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

main();
