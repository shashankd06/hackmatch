import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
const schema = await readFile(
  new URL("../sql/001_schema.sql", import.meta.url),
  "utf8",
);
test("schema, membership integrity, transactions, views and vector retrieval", async (t) => {
  const db = new PGlite({ extensions: { vector } });
  try {
    await db.exec(schema);
    await db.exec(
      `INSERT INTO tracks(name,description,max_members) VALUES('Test','A test track',2);INSERT INTO users(name,email,password_hash) VALUES('Captain','captain@test.local','test'),('Applicant','applicant@test.local','test'),('Other','other@test.local','test'),('Captain Two','captain2@test.local','test');INSERT INTO profiles(user_id) SELECT id FROM users;INSERT INTO teams(name,idea,track_id) VALUES('First','A meaningful project idea',1),('Second','Another meaningful idea',1);INSERT INTO memberships VALUES(1,1,true),(4,2,true);INSERT INTO applications(user_id,team_id,message) VALUES(2,1,'I can build the backend'),(2,2,'I can help the other team'),(3,1,'I can design the frontend');`,
    );
    await t.test("authorization rejects a non-captain", async () => {
      await assert.rejects(
        db.query("SELECT accept_application(3,1)"),
        /Captain access/,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM memberships")).rows[0].n,
        2,
      );
    });
    await t.test(
      "successful acceptance atomically closes competing applications",
      async () => {
        await db.query("SELECT accept_application(1,1)");
        assert.deepEqual(
          (
            await db.query(
              "SELECT status FROM applications WHERE user_id=2 ORDER BY id",
            )
          ).rows.map((r) => r.status),
          ["accepted", "closed"],
        );
        assert.equal(
          (await db.query("SELECT looking FROM profiles WHERE user_id=2"))
            .rows[0].looking,
          false,
        );
      },
    );
    await t.test(
      "full team acceptance rolls back application and membership",
      async () => {
        await assert.rejects(
          db.query("SELECT accept_application(1,3)"),
          /Team is full/,
        );
        assert.equal(
          (await db.query("SELECT status FROM applications WHERE id=3")).rows[0]
            .status,
          "pending",
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM memberships WHERE user_id=3",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test("one team per user and one captain per team", async () => {
      await assert.rejects(
        db.exec("INSERT INTO memberships VALUES(2,2,false)"),
        /duplicate key/,
      );
      await assert.rejects(
        db.exec("UPDATE memberships SET is_captain=true WHERE user_id=2"),
        /duplicate key/,
      );
    });
    await t.test(
      "duplicate application and invalid capacity rejected",
      async () => {
        await assert.rejects(
          db.exec(
            "INSERT INTO applications(user_id,team_id,message) VALUES(2,1,'duplicate message')",
          ),
          /duplicate key/,
        );
        await assert.rejects(
          db.exec("UPDATE tracks SET max_members=1 WHERE id=1"),
          /cannot be reduced/,
        );
      },
    );
    await t.test("views report correct occupancy", async () => {
      const r = (
        await db.query(
          "SELECT slots,member_count FROM team_overview WHERE id=1",
        )
      ).rows[0];
      assert.equal(r.slots, 0);
      assert.equal(r.member_count, 2);
      assert.equal(
        (await db.query("SELECT participants FROM track_stats")).rows[0]
          .participants,
        3,
      );
    });
    await t.test(
      "cosine vector retrieval ranks aligned vectors ahead",
      async () => {
        const a = Array(384).fill(0),
          b = Array(384).fill(0);
        a[0] = 1;
        b[1] = 1;
        await db.query(
          "UPDATE profiles SET embedding=$1::vector WHERE user_id=2",
          [JSON.stringify(a)],
        );
        await db.query(
          "UPDATE profiles SET embedding=$1::vector WHERE user_id=3",
          [JSON.stringify(b)],
        );
        const r = await db.query(
          "SELECT user_id FROM profiles WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector",
          [JSON.stringify(a)],
        );
        assert.equal(r.rows[0].user_id, 2);
        await assert.rejects(
          db.query(
            "UPDATE profiles SET embedding='[1,2]'::vector WHERE user_id=2",
          ),
          /dimensions/,
        );
      },
    );
    await t.test("deletion cascades and frees team membership", async () => {
      await db.exec("DELETE FROM teams WHERE id=1");
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM memberships WHERE team_id=1",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM applications WHERE team_id=1",
          )
        ).rows[0].n,
        0,
      );
    });
  } finally {
    await db.close();
  }
});
