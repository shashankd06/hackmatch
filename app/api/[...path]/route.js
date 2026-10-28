import { NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "../../../lib/db.mjs";
import {
  currentUser,
  hashPassword,
  verifyPassword,
  signIn,
  signOut,
} from "../../../lib/auth.mjs";
import { embed, vector } from "../../../lib/embedding.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const str = (min, max) => z.string().trim().min(min).max(max);
const id = z.coerce.number().int().positive();
const account = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
});
function fail(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
async function captain(uid, tid) {
  if (
    !(
      await query(
        "SELECT 1 FROM memberships WHERE user_id=$1 AND team_id=$2 AND is_captain",
        [uid, tid],
      )
    ).rowCount
  )
    fail("Captain access required", 403);
}
async function handler(req, ctx) {
  try {
    const path = (await ctx.params).path.join("/"),
      url = new URL(req.url),
      method = req.method;
    if (
      method !== "GET" &&
      req.headers.get("origin") !== process.env.APP_ORIGIN
    )
      fail("Invalid request origin", 403);
    const b = method === "GET" ? {} : await req.json();
    if (path === "auth/register" && method === "POST") {
      const a = account.extend({ name: str(2, 80) }).parse(b);
      const uid = await transaction(async (c) => {
        const u = (
          await c.query(
            "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
            [a.name, a.email, hashPassword(a.password)],
          )
        ).rows[0];
        await c.query("INSERT INTO profiles(user_id) VALUES($1)", [u.id]);
        return u.id;
      });
      await signIn(uid);
      return NextResponse.json({ ok: true });
    }
    if (path === "auth/login" && method === "POST") {
      const a = account.parse(b);
      const u = (await query("SELECT * FROM users WHERE email=$1", [a.email]))
        .rows[0];
      if (!u || !verifyPassword(a.password, u.password_hash))
        fail("Incorrect email or password", 401);
      await signIn(u.id);
      return NextResponse.json({ ok: true });
    }
    if (path === "auth/logout" && method === "POST") {
      await signOut();
      return NextResponse.json({ ok: true });
    }
    const u = await currentUser();
    if (path === "me" && method === "GET")
      return NextResponse.json({ user: u });
    if (!u) fail("Please sign in", 401);
    if (path === "data" && method === "GET") {
      const [tracks, teams, people, own, apps, openings] = await Promise.all([
        query("SELECT * FROM tracks ORDER BY id"),
        query("SELECT * FROM team_overview ORDER BY created_at DESC"),
        query(
          `SELECT u.id,u.name,p.bio,p.preferred_role,p.availability,p.looking,p.embedding IS NOT NULL embedded,coalesce(array_agg(s.name) FILTER(WHERE s.name IS NOT NULL),'{}') skills FROM users u JOIN profiles p ON p.user_id=u.id LEFT JOIN participant_skills ps ON ps.user_id=u.id LEFT JOIN skills s ON s.id=ps.skill_id WHERE u.role='participant' GROUP BY u.id,p.user_id ORDER BY u.name`,
        ),
        query(
          "SELECT m.*,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.team_id=(SELECT team_id FROM memberships WHERE user_id=$1)",
          [u.id],
        ),
        query(
          `SELECT a.*,u.name,t.name team_name FROM applications a JOIN users u ON u.id=a.user_id JOIN teams t ON t.id=a.team_id WHERE a.user_id=$1 OR a.team_id IN(SELECT team_id FROM memberships WHERE user_id=$1 AND is_captain) ORDER BY a.created_at DESC`,
          [u.id],
        ),
        query(
          "SELECT id,team_id,title,description,embedding IS NOT NULL embedded FROM openings ORDER BY id",
        ),
      ]);
      return NextResponse.json({
        tracks: tracks.rows,
        teams: teams.rows,
        people: people.rows,
        members: own.rows,
        applications: apps.rows,
        openings: openings.rows,
        user: u,
      });
    }
    if (path === "profile" && method === "POST") {
      const a = z
        .object({
          bio: str(10, 2000),
          preferred_role: str(2, 80),
          availability: z.enum([
            "Mornings",
            "Evenings",
            "Weekends",
            "Flexible",
          ]),
          looking: z.boolean(),
          skills: z.array(str(1, 40)).max(15),
        })
        .parse(b);
      if (u.role !== "participant") fail("Participant access required", 403);
      await transaction(async (c) => {
        await c.query(
          "UPDATE profiles SET bio=$1,preferred_role=$2,availability=$3,looking=$4,embedding=NULL WHERE user_id=$5",
          [a.bio, a.preferred_role, a.availability, a.looking, u.id],
        );
        await c.query("DELETE FROM participant_skills WHERE user_id=$1", [
          u.id,
        ]);
        for (const s of new Set(a.skills)) {
          await c.query(
            "INSERT INTO skills(name) VALUES($1) ON CONFLICT DO NOTHING",
            [s],
          );
          await c.query(
            "INSERT INTO participant_skills SELECT $1,id FROM skills WHERE name=$2",
            [u.id, s],
          );
        }
      });
      return NextResponse.json({
        ok: true,
        message: "Profile saved. Run npm run embed to refresh search vectors.",
      });
    }
    if (path === "teams" && method === "POST") {
      if (u.role !== "participant") fail("Participant access required", 403);
      const a = z
        .object({
          name: str(2, 80),
          idea: str(10, 2000),
          track_id: id,
          title: str(2, 80),
          description: str(5, 2000),
        })
        .parse(b);
      await transaction(async (c) => {
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
        const tr = (
          await c.query("SELECT * FROM tracks WHERE id=$1 FOR SHARE", [
            a.track_id,
          ])
        ).rows[0];
        if (!tr?.registration_open) fail("Track registration is closed");
        const t = (
          await c.query(
            "INSERT INTO teams(name,idea,track_id) VALUES($1,$2,$3) RETURNING id",
            [a.name, a.idea, a.track_id],
          )
        ).rows[0];
        await c.query("INSERT INTO memberships VALUES($1,$2,true)", [
          u.id,
          t.id,
        ]);
        await c.query(
          "INSERT INTO openings(team_id,title,description) VALUES($1,$2,$3)",
          [t.id, a.title, a.description],
        );
        await c.query(
          "UPDATE applications SET status='closed' WHERE user_id=$1 AND status='pending'",
          [u.id],
        );
        await c.query("UPDATE profiles SET looking=false WHERE user_id=$1", [
          u.id,
        ]);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "apply" && method === "POST") {
      if (u.role !== "participant") fail("Participant access required", 403);
      const a = z.object({ team_id: id, message: str(5, 1000) }).parse(b);
      await transaction(async (c) => {
        await c.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [
          a.team_id,
        ]);
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
        if (
          (await c.query("SELECT 1 FROM memberships WHERE user_id=$1", [u.id]))
            .rowCount
        )
          fail("You already belong to a team");
        const t = (
          await c.query("SELECT * FROM team_overview WHERE id=$1", [a.team_id])
        ).rows[0];
        if (!t || !t.registration_open || t.slots <= 0)
          fail("Team is full or registration is closed");
        await c.query(
          "INSERT INTO applications(user_id,team_id,message) VALUES($1,$2,$3)",
          [u.id, a.team_id, a.message],
        );
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "applications" && method === "POST") {
      const a = z
        .object({ id, action: z.enum(["accept", "reject", "withdraw"]) })
        .parse(b);
      if (a.action === "accept")
        await query("SELECT accept_application($1,$2)", [u.id, a.id]);
      else {
        const app = (
          await query("SELECT * FROM applications WHERE id=$1", [a.id])
        ).rows[0];
        if (!app) fail("Application not found", 404);
        if (a.action === "withdraw") {
          if (app.user_id !== u.id) fail("Access denied", 403);
        } else await captain(u.id, app.team_id);
        const changed = await query(
          "UPDATE applications SET status=$1 WHERE id=$2 AND status='pending'",
          [a.action === "withdraw" ? "withdrawn" : "rejected", a.id],
        );
        if (!changed.rowCount) fail("Application is no longer pending");
      }
      return NextResponse.json({ ok: true });
    }
    if (path === "membership" && method === "POST") {
      const a = z
        .object({
          action: z.enum(["leave", "transfer"]),
          user_id: id.optional(),
        })
        .parse(b);
      await transaction(async (c) => {
        const current = (
          await c.query("SELECT * FROM memberships WHERE user_id=$1", [u.id])
        ).rows[0];
        if (!current) fail("No team found");
        await c.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [
          current.team_id,
        ]);
        const m = (
          await c.query("SELECT * FROM memberships WHERE user_id=$1", [u.id])
        ).rows[0];
        if (!m || m.team_id !== current.team_id)
          fail("Team changed. Refresh and retry");
        if (a.action === "transfer") {
          if (!m.is_captain) fail("Captain access required", 403);
          if (!a.user_id || a.user_id === u.id) fail("Choose another member");
          if (
            !(
              await c.query(
                "SELECT 1 FROM memberships WHERE user_id=$1 AND team_id=$2",
                [a.user_id, m.team_id],
              )
            ).rowCount
          )
            fail("Member not found");
          await c.query(
            "UPDATE memberships SET is_captain=false WHERE user_id=$1",
            [u.id],
          );
          await c.query(
            "UPDATE memberships SET is_captain=true WHERE user_id=$1",
            [a.user_id],
          );
        } else {
          if (m.is_captain)
            fail("Transfer leadership before leaving, or delete your team");
          await c.query("DELETE FROM memberships WHERE user_id=$1", [u.id]);
          await c.query("UPDATE profiles SET looking=true WHERE user_id=$1", [
            u.id,
          ]);
        }
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "team/delete" && method === "POST") {
      const tid = id.parse(b.team_id);
      await transaction(async (c) => {
        await c.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [tid]);
        if (
          !(
            await c.query(
              "SELECT 1 FROM memberships WHERE user_id=$1 AND team_id=$2 AND is_captain",
              [u.id, tid],
            )
          ).rowCount
        )
          fail("Captain access required", 403);
        await c.query(
          "UPDATE profiles SET looking=true WHERE user_id IN(SELECT user_id FROM memberships WHERE team_id=$1)",
          [tid],
        );
        await c.query("DELETE FROM teams WHERE id=$1", [tid]);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "matches" && method === "GET") {
      const mode = url.searchParams.get("mode") || "people";
      let v;
      const oid = url.searchParams.get("opening");
      if (oid) {
        const o = (
          await query("SELECT * FROM openings WHERE id=$1", [id.parse(oid)])
        ).rows[0];
        if (!o) fail("Opening not found", 404);
        await captain(u.id, o.team_id);
        if (!o.embedding)
          fail("This opening needs embeddings. Run npm run embed.");
        v = o.embedding;
      } else {
        const text = str(3, 1000).parse(url.searchParams.get("q"));
        v = vector(await embed(text));
      }
      // pg returns vector columns as their PostgreSQL string representation.
      if (mode === "teams")
        return NextResponse.json({
          results: (
            await query(
              `SELECT o.id,o.title,o.description,t.name,t.id team_id,t.track_name,1-(o.embedding <=> $1::vector) relevance FROM openings o JOIN team_overview t ON t.id=o.team_id WHERE o.embedding IS NOT NULL AND t.slots>0 AND t.registration_open ORDER BY o.embedding <=> $1::vector LIMIT 12`,
              [v],
            )
          ).rows,
        });
      return NextResponse.json({
        results: (
          await query(
            `SELECT u.id,u.name,p.bio,p.preferred_role,p.availability,1-(p.embedding <=> $1::vector) relevance FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.embedding IS NOT NULL AND p.looking AND u.role='participant' AND u.id<>$2 AND NOT EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id) ORDER BY p.embedding <=> $1::vector LIMIT 12`,
            [v, u.id],
          )
        ).rows,
      });
    }
    if (path === "admin" && method === "GET") {
      if (u.role !== "admin") fail("Admin access required", 403);
      return NextResponse.json({
        stats: (await query("SELECT * FROM track_stats ORDER BY id")).rows,
        totals: (
          await query(
            `SELECT (SELECT count(*) FROM users WHERE role='participant') participants,(SELECT count(*) FROM teams) teams,(SELECT count(*) FROM applications WHERE status='pending') pending,(SELECT count(*) FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.embedding IS NOT NULL AND u.role='participant') embedded`,
          )
        ).rows[0],
      });
    }
    if (path === "admin/tracks" && method === "POST") {
      if (u.role !== "admin") fail("Admin access required", 403);
      if (b.action === "toggle") {
        await query(
          "UPDATE tracks SET registration_open=NOT registration_open WHERE id=$1",
          [id.parse(b.id)],
        );
      } else {
        const a = z
          .object({
            name: str(2, 80),
            description: str(5, 2000),
            max_members: z.coerce.number().int().min(2).max(8),
          })
          .parse(b);
        await query(
          "INSERT INTO tracks(name,description,max_members) VALUES($1,$2,$3)",
          [a.name, a.description, a.max_members],
        );
      }
      return NextResponse.json({ ok: true });
    }
    fail("Not found", 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        },
        { status: 400 },
      );
    if (e.code === "23505")
      return NextResponse.json(
        {
          error:
            "Already exists: email, team name, membership or application must be unique.",
        },
        { status: 409 },
      );
    if (e.code === "23503" || e.code === "23514")
      return NextResponse.json(
        { error: "Invalid data or missing referenced record." },
        { status: 400 },
      );
    if (e.code === "P0001")
      return NextResponse.json({ error: e.message }, { status: 409 });
    console.error(e);
    return NextResponse.json(
      {
        error: e.status
          ? e.message
          : "Server unavailable. Check the database and model setup in README.",
      },
      { status: e.status || 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
