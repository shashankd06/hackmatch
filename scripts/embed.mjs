import { pool, query } from "../lib/db.mjs";
import { embed, vector } from "../lib/embedding.mjs";
try {
  for (const p of (
    await query(
      `SELECT p.user_id,p.bio,p.preferred_role,coalesce(string_agg(s.name,', '),'') skills FROM profiles p JOIN users u ON u.id=p.user_id LEFT JOIN participant_skills ps ON ps.user_id=p.user_id LEFT JOIN skills s ON s.id=ps.skill_id WHERE u.role='participant' GROUP BY p.user_id`,
    )
  ).rows) {
    await query("UPDATE profiles SET embedding=$1::vector WHERE user_id=$2", [
      vector(await embed([p.preferred_role, p.bio, p.skills].join(". "))),
      p.user_id,
    ]);
    console.log("Embedded profile", p.user_id);
  }
  for (const o of (await query("SELECT * FROM openings")).rows) {
    await query("UPDATE openings SET embedding=$1::vector WHERE id=$2", [
      vector(await embed(o.title + ". " + o.description)),
      o.id,
    ]);
  }
  console.log("Embeddings ready.");
} finally {
  await pool.end();
}
