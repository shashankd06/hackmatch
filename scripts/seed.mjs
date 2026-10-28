import { randomBytes, scryptSync } from "node:crypto";
import { pool, transaction } from "../lib/db.mjs";
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 10)
  throw Error("Set SEED_PASSWORD with at least 10 characters");
const hash = () => {
  const s = randomBytes(16).toString("hex");
  return s + ":" + scryptSync(password, s, 64).toString("hex");
};
try {
  await transaction(async (c) => {
    if ((await c.query("SELECT count(*) FROM users")).rows[0].count !== "0")
      throw Error("Seed requires an empty database");
    for (const [name, description] of [
      ["AI & ML", "Build useful intelligence for real-world problems."],
      ["Cybersecurity", "Help people stay safe in a connected world."],
      ["Fintech", "Make money management accessible to everyone."],
      ["Sustainability", "Technology for a healthier planet."],
    ])
      await c.query(
        "INSERT INTO tracks(name,description,max_members) VALUES($1,$2,4)",
        [name, description],
      );
    const people = [
      [
        "Admin",
        "admin@hackmatch.local",
        "admin",
        "Event organiser",
        "Organiser",
      ],
      [
        "Arjun Mehta",
        "arjun@hackmatch.local",
        "participant",
        "Backend engineer building APIs with Node.js, PostgreSQL and Docker.",
        "Backend developer",
      ],
      [
        "Ananya Rao",
        "ananya@hackmatch.local",
        "participant",
        "Python and PyTorch developer exploring transformers, NLP and spam detection.",
        "ML developer",
      ],
      [
        "Riya Shah",
        "riya@hackmatch.local",
        "participant",
        "React frontend developer who loves accessible dashboards and data visualisation.",
        "Frontend developer",
      ],
      [
        "Kabir Singh",
        "kabir@hackmatch.local",
        "participant",
        "Security enthusiast working with networks, Linux and intrusion detection.",
        "Security engineer",
      ],
      [
        "Meera Nair",
        "meera@hackmatch.local",
        "participant",
        "Product designer using Figma and user research for intuitive experiences.",
        "Designer",
      ],
      [
        "Dev Patel",
        "dev@hackmatch.local",
        "participant",
        "Python developer interested in climate data, forecasting and machine learning.",
        "ML developer",
      ],
    ];
    for (const [name, email, role, bio, title] of people) {
      const u = (
        await c.query(
          "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id",
          [name, email, hash(), role],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO profiles(user_id,bio,preferred_role) VALUES($1,$2,$3)",
        [u.id, bio, title],
      );
      for (const skill of title === "ML developer"
        ? ["Python", "Machine learning"]
        : title === "Backend developer"
          ? ["Node.js", "PostgreSQL"]
          : title === "Frontend developer"
            ? ["React", "CSS"]
            : title === "Designer"
              ? ["Figma", "UX"]
              : ["Linux"]) {
        await c.query(
          "INSERT INTO skills(name) VALUES($1) ON CONFLICT DO NOTHING",
          [skill],
        );
        await c.query(
          "INSERT INTO participant_skills SELECT $1,id FROM skills WHERE name=$2",
          [u.id, skill],
        );
      }
    }
    for (const [name, idea, track, email, title, description] of [
      [
        "PhishGuard",
        "Detect phishing messages with natural language understanding.",
        2,
        "arjun@hackmatch.local",
        "ML developer",
        "Python NLP transformers and text classification for phishing detection",
      ],
      [
        "GreenPulse",
        "Make climate data understandable through beautiful dashboards.",
        4,
        "meera@hackmatch.local",
        "Frontend developer",
        "React dashboards charts and accessible data visualisation",
      ],
    ]) {
      const t = (
        await c.query(
          "INSERT INTO teams(name,idea,track_id) VALUES($1,$2,$3) RETURNING id",
          [name, idea, track],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO memberships(user_id,team_id,is_captain) SELECT id,$1,true FROM users WHERE email=$2",
        [t.id, email],
      );
      await c.query(
        "UPDATE profiles SET looking=false WHERE user_id IN(SELECT user_id FROM memberships)",
      );
      await c.query(
        "INSERT INTO openings(team_id,title,description) VALUES($1,$2,$3)",
        [t.id, title, description],
      );
    }
  });
  console.log(
    "Seeded. Accounts: admin, arjun, ananya, riya, kabir, meera, dev @hackmatch.local. Password is SEED_PASSWORD. Run npm run embed.",
  );
} finally {
  await pool.end();
}
