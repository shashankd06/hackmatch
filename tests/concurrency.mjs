import pg from "pg";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL) throw Error("Set DATABASE_URL in .env");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const name = "test_hackmatch_" + Date.now();
try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`CREATE SCHEMA ${name}`);
  const c = await pool.connect();
  try {
    await c.query(`SET search_path TO ${name},public`);
    await c.query(
      await readFile(new URL("../sql/001_schema.sql", import.meta.url), "utf8"),
    );
    await c.query(
      `INSERT INTO tracks(name,description,max_members) VALUES('Concurrency','Concurrent last-place acceptance',2);INSERT INTO users(name,email,password_hash) VALUES('Captain','c@test.local','test'),('One','a@test.local','test'),('Two','b@test.local','test');INSERT INTO profiles(user_id) SELECT id FROM users;INSERT INTO teams(name,idea,track_id) VALUES('Test team','Last-slot atomic acceptance',1);INSERT INTO memberships VALUES(1,1,true);INSERT INTO applications(user_id,team_id,message) VALUES(2,1,'First applicant'),(3,1,'Second applicant');`,
    );
  } finally {
    c.release();
  }
  const accept = async (aid) => {
    const c = await pool.connect();
    try {
      await c.query(`SET search_path TO ${name},public`);
      await c.query("SELECT accept_application(1,$1)", [aid]);
    } finally {
      c.release();
    }
  };
  const results = await Promise.allSettled([accept(1), accept(2)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const check = await pool.query(
    `SELECT (SELECT count(*) FROM ${name}.memberships) members,(SELECT count(*) FROM ${name}.applications WHERE status='accepted') accepted,(SELECT count(*) FROM ${name}.applications WHERE status='pending') pending`,
  );
  assert.deepEqual(check.rows[0], {
    members: "2",
    accepted: "1",
    pending: "1",
  });
  console.log(
    "PASS: exactly one concurrent acceptance wins the final place; failed application remains pending.",
  );
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
  await pool.end();
}
