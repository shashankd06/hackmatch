"use client";
import { useEffect, useState } from "react";
const empty = {
  tracks: [],
  teams: [],
  people: [],
  members: [],
  applications: [],
  openings: [],
};
export default function Home() {
  const [user, U] = useState(null),
    [ready, R] = useState(false),
    [data, D] = useState(empty),
    [page, P] = useState("Explore"),
    [tab, T] = useState("Teams"),
    [filter, F] = useState(""),
    [search, S] = useState(""),
    [error, E] = useState(""),
    [notice, N] = useState(""),
    [busy, B] = useState(false),
    [modal, M] = useState(null),
    [results, V] = useState(null),
    [admin, A] = useState(null),
    [register, G] = useState(false);
  async function api(path, body) {
    const r = await fetch(
      "/api/" + path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }
  async function load() {
    const m = await api("me");
    U(m.user);
    if (m.user) {
      D(await api("data"));
      if (m.user.role === "admin") A(await api("admin"));
    }
    R(true);
  }
  useEffect(() => {
    load().catch((e) => {
      E(e.message);
      R(true);
    });
  }, []);
  async function run(fn) {
    B(true);
    E("");
    N("");
    try {
      await fn();
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  async function submit(e, path, extra = {}) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      const r = await api(path, { ...b, ...extra });
      await load();
      M(null);
      N(r.message || "Saved successfully.");
    });
  }
  const me = data.people.find((p) => p.id === user?.id),
    membership = data.members.find((m) => m.user_id === user?.id),
    team = data.teams.find((t) => t.id === membership?.team_id),
    isCaptain = membership?.is_captain;
  const navigate = (p) => {
    P(p);
    V(null);
    E("");
    N("");
  };
  const tag = (s) => (
    <span className="tag" key={s}>
      {s}
    </span>
  );
  const act = async (path, b) =>
    run(async () => {
      await api(path, b);
      await load();
      N("Updated successfully.");
    });
  const person = (p) => (
    <article className="card person" key={p.id}>
      <div className="avatar">
        {p.name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")}
      </div>
      <span className="status">
        {p.looking === false ? "In a team" : "Looking for a team"}
      </span>
      <h3>{p.name}</h3>
      <p className="accent">{p.preferred_role}</p>
      <p>{p.bio || "Profile coming soon."}</p>
      <div className="tags">{p.skills?.map(tag)}</div>
      <footer>
        <span>◷ {p.availability}</span>
        {p.relevance !== undefined && (
          <span>Semantic rank #{results?.indexOf(p) + 1}</span>
        )}
      </footer>
    </article>
  );
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          h<span>m</span>
          <b>HackMatch</b>
        </a>
        <div className="event-label">
          CAMPUS HACKATHON <span>2026</span>
        </div>
        <nav>
          {[
            "Explore",
            "Find teammates",
            "My team",
            "My profile",
            ...(user?.role === "admin" ? ["Admin"] : []),
          ].map((p, i) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => navigate(p)}
            >
              <span>{["◈", "⌕", "♧", "◎", "▦"][i]}</span>
              {p}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="mini-mark">✳</div>
          <h4>
            Great ideas need
            <br />
            great teammates.
          </h4>
          <p>
            Find the missing piece.
            <br />
            Build something that matters.
          </p>
          {user && (
            <>
              <hr />
              <p>
                {user.name}
                <br />
                <small>{user.role}</small>
              </p>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", {});
                    U(null);
                    D(empty);
                  })
                }
              >
                Sign out ↗
              </button>
            </>
          )}
        </div>
      </aside>
      <main>
        <header>
          <span className="breadcrumb">
            Workspace <span>/</span> {page}
          </span>
          <div className="header-right">
            <span className="live-dot" /> Team formation is open{" "}
            {user && <span className="avatar small">{user.name[0]}</span>}
          </div>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => E("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {!ready ? (
          <div className="loading">Loading your workspace…</div>
        ) : !user ? (
          <section className="login-layout">
            <div>
              <div className="eyebrow">YOUR NEXT BIG THING STARTS HERE</div>
              <h1>
                Find your people.
                <br />
                <em>Build your idea.</em>
              </h1>
              <p className="lead">
                Discover tracks, meet complementary minds, and turn a promising
                idea into a hackathon team.
              </p>
              <div className="orbit">
                <span>DESIGN</span>
                <span>CODE</span>
                <strong>✳</strong>
                <span>BUILD</span>
              </div>
            </div>
            <form
              className="card auth"
              onSubmit={(e) =>
                submit(e, register ? "auth/register" : "auth/login")
              }
            >
              <div className="eyebrow">WELCOME TO HACKMATCH</div>
              <h2>
                {register ? "Create your account" : "Your team is out there."}
              </h2>
              <p>
                {register
                  ? "Tell us who you are."
                  : "Sign in to start making connections."}
              </p>
              {register && (
                <label>
                  Name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  minLength={10}
                  maxLength={128}
                  required
                  autoComplete={register ? "new-password" : "current-password"}
                />
              </label>
              <button disabled={busy} className="primary">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account →"
                    : "Sign in →"}
              </button>
              <button
                type="button"
                className="link"
                onClick={() => G(!register)}
              >
                {register
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
              <small>
                Seeded accounts and local setup are documented in README.
              </small>
            </form>
          </section>
        ) : (
          <>
            {page === "Explore" && (
              <>
                <section className="hero">
                  <div>
                    <div className="eyebrow">
                      DIFFERENT SKILLS. SHARED AMBITION.
                    </div>
                    <h1>
                      Your next team.
                      <br />
                      <em>Your next big idea.</em>
                    </h1>
                    <p>
                      Find a track that excites you and the people
                      <br />
                      who can help bring your idea to life.
                    </p>
                    <button
                      className="primary"
                      disabled={!!membership || user.role === "admin"}
                      onClick={() => M({ type: "create" })}
                    >
                      ＋ Create a team
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-label one">&lt;/&gt; DEVELOP</div>
                    <div className="art-label two">✦ DESIGN</div>
                    <div className="art-label three">↗ INNOVATE</div>
                    <div className="big-star">✳</div>
                    <div className="ring" />
                    <span className="art-caption">BETTER TOGETHER.</span>
                  </div>
                </section>
                <div className="stats">
                  {[
                    [data.tracks.length, "Tracks to explore"],
                    [data.teams.length, "Teams building"],
                    [
                      data.people.filter((p) => p.looking).length,
                      "People looking",
                    ],
                    [
                      data.teams.reduce((n, t) => n + Math.max(0, t.slots), 0),
                      "Open team places",
                    ],
                  ].map(([n, l]) => (
                    <div key={l}>
                      <strong>{n.toString().padStart(2, "0")}</strong>
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
                <div className="section-head">
                  <div>
                    <h2>Find your starting point</h2>
                    <p>A good team starts with a shared direction.</p>
                  </div>
                  <div className="tabs">
                    {["Teams", "Tracks", "People"].map((t) => (
                      <button
                        className={tab === t ? "selected" : ""}
                        key={t}
                        onClick={() => T(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filters">
                  <input
                    aria-label="Search teams and people"
                    placeholder="⌕  Search by name, idea or skill…"
                    value={search}
                    onChange={(e) => S(e.target.value)}
                  />
                  <select
                    aria-label="Filter track"
                    value={filter}
                    onChange={(e) => F(e.target.value)}
                  >
                    <option value="">All tracks</option>
                    {data.tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid">
                  {tab === "Tracks"
                    ? data.tracks.map((t, i) => (
                        <article key={t.id} className="card track">
                          <div className={"track-icon color" + (i % 4)}>
                            {["✦", "◇", "↗", "❋"][i % 4]}
                          </div>
                          <span className="status">
                            {t.registration_open
                              ? "Registration open"
                              : "Registration closed"}
                          </span>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                          <footer>
                            <span>Up to {t.max_members} members</span>
                            <button
                              className="link"
                              onClick={() => {
                                T("Teams");
                                F(t.id);
                              }}
                            >
                              Explore →
                            </button>
                          </footer>
                        </article>
                      ))
                    : tab === "People"
                      ? data.people
                          .filter((p) =>
                            (p.name + " " + p.bio + " " + p.skills.join(" "))
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map(person)
                      : data.teams
                          .filter(
                            (t) =>
                              (!filter || t.track_id === filter) &&
                              (t.name + " " + t.idea)
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                          )
                          .map((t) => (
                            <article className="card" key={t.id}>
                              <div className="card-top">
                                <span className="track-chip">
                                  {t.track_name}
                                </span>
                                <span
                                  className={t.slots > 0 ? "status" : "muted"}
                                >
                                  {t.slots > 0
                                    ? `${t.slots} spots open`
                                    : "Team full"}
                                </span>
                              </div>
                              <h3>{t.name}</h3>
                              <p>{t.idea}</p>
                              <div className="tags">
                                {data.openings
                                  .filter((o) => o.team_id === t.id)
                                  .map((o) => tag(o.title))}
                              </div>
                              <div className="capacity">
                                <div
                                  style={{
                                    width:
                                      (t.member_count / t.max_members) * 100 +
                                      "%",
                                  }}
                                />
                              </div>
                              <footer>
                                <span>
                                  {t.member_count} / {t.max_members} members
                                </span>
                                <button
                                  className="link"
                                  onClick={() => M({ type: "team", team: t })}
                                >
                                  View team ↗
                                </button>
                              </footer>
                            </article>
                          ))}
                </div>
                {tab === "Teams" && !data.teams.length && (
                  <div className="empty">
                    No teams yet. Create the first one.
                  </div>
                )}
              </>
            )}
            {page === "Find teammates" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">COMPLEMENT YOUR SKILLS</div>
                  <h1>Find the missing piece.</h1>
                  <p>
                    Describe what you need. Semantic search looks beyond exact
                    keywords.
                  </p>
                </div>
                <form
                  className="search-panel card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const b = Object.fromEntries(new FormData(e.currentTarget));
                    run(async () =>
                      V(
                        (await api("matches?" + new URLSearchParams(b)))
                          .results,
                      ),
                    );
                  }}
                >
                  <label>
                    What are you looking for?
                    <textarea
                      name="q"
                      placeholder="Someone who can classify phishing messages using NLP…"
                      minLength={3}
                      maxLength={1000}
                      required
                    />
                  </label>
                  <div className="row">
                    <select name="mode">
                      <option value="people">Find people</option>
                      <option value="teams">Find team openings</option>
                    </select>
                    <button className="primary" disabled={busy}>
                      {busy ? "Searching…" : "Find matches ✦"}
                    </button>
                  </div>
                  <small>
                    Local MiniLM embeddings · cosine similarity · available
                    candidates only
                  </small>
                </form>
                {isCaptain && (
                  <div className="opening-actions">
                    {data.openings
                      .filter((o) => o.team_id === team.id)
                      .map((o) => (
                        <button
                          key={o.id}
                          onClick={() =>
                            run(async () =>
                              V((await api("matches?opening=" + o.id)).results),
                            )
                          }
                        >
                          Find candidates for {o.title} →
                        </button>
                      ))}
                  </div>
                )}
                <div className="grid">
                  {results === null ? (
                    <div className="empty">
                      Search for a role, skill or project interest to see ranked
                      results.
                    </div>
                  ) : results.length ? (
                    results.map((p) =>
                      p.team_id ? (
                        <article className="card" key={p.id}>
                          <span className="track-chip">{p.track_name}</span>
                          <h3>{p.name}</h3>
                          <h4>{p.title}</h4>
                          <p>{p.description}</p>
                          <button
                            className="link"
                            onClick={() =>
                              M({
                                type: "team",
                                team: data.teams.find(
                                  (t) => t.id === p.team_id,
                                ),
                              })
                            }
                          >
                            View team →
                          </button>
                        </article>
                      ) : (
                        person(p)
                      ),
                    )
                  ) : (
                    <div className="empty">
                      No eligible embedded results. Check recruitment status and
                      run npm run embed.
                    </div>
                  )}
                </div>
              </>
            )}
            {page === "My profile" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">LET YOUR SKILLS SPEAK</div>
                  <h1>Your builder profile.</h1>
                  <p>
                    A thoughtful bio makes it easier for the right team to find
                    you.
                  </p>
                </div>
                {me ? (
                  <form
                    key={me.id + me.bio}
                    className="card profile-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const b = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      run(async () => {
                        const r = await api("profile", {
                          ...b,
                          skills: b.skills
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                          looking: b.looking === "on",
                        });
                        await load();
                        N(r.message);
                      });
                    }}
                  >
                    <label>
                      Preferred role
                      <input
                        name="preferred_role"
                        defaultValue={me.preferred_role}
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Bio
                      <textarea
                        name="bio"
                        defaultValue={me.bio}
                        required
                        minLength={10}
                        maxLength={2000}
                      />
                    </label>
                    <label>
                      Skills, separated by commas
                      <input
                        name="skills"
                        defaultValue={me.skills.join(", ")}
                        placeholder="Python, React, PostgreSQL"
                      />
                    </label>
                    <label>
                      Availability
                      <select
                        name="availability"
                        defaultValue={me.availability}
                      >
                        {["Mornings", "Evenings", "Weekends", "Flexible"].map(
                          (a) => (
                            <option key={a}>{a}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="looking"
                        defaultChecked={me.looking}
                      />
                      Show me as looking for a team
                    </label>
                    <p className="muted">
                      Saving clears the old embedding. Refresh vectors using npm
                      run embed before demonstrating matching.
                    </p>
                    <button className="primary" disabled={busy}>
                      Save profile →
                    </button>
                  </form>
                ) : (
                  <div className="empty">
                    Admin accounts manage the event. Sign in as a participant to
                    create a builder profile.
                  </div>
                )}
              </>
            )}
            {page === "My team" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">BUILD SOMETHING TOGETHER</div>
                  <h1>{team?.name || "Your team starts here."}</h1>
                  <p>
                    {team?.idea ||
                      "Explore recruiting teams or create one around your idea."}
                  </p>
                </div>
                {team ? (
                  <>
                    <div className="section-head">
                      <h2>
                        Your crew · {team.member_count}/{team.max_members}
                      </h2>
                      {isCaptain ? (
                        <button
                          className="danger"
                          onClick={() => M({ type: "delete", team })}
                        >
                          Delete team
                        </button>
                      ) : (
                        <button
                          onClick={() => act("membership", { action: "leave" })}
                          disabled={busy}
                        >
                          Leave team
                        </button>
                      )}
                    </div>
                    <div className="grid">
                      {data.members.map((m) => (
                        <article className="card" key={m.user_id}>
                          <span className="avatar">{m.name[0]}</span>
                          <h3>{m.name}</h3>
                          <span className="tag">
                            {m.is_captain ? "Captain" : "Member"}
                          </span>
                          {isCaptain && !m.is_captain && (
                            <button
                              className="link"
                              onClick={() =>
                                act("membership", {
                                  action: "transfer",
                                  user_id: m.user_id,
                                })
                              }
                            >
                              Transfer leadership →
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                    {isCaptain && (
                      <h2 className="spaced">Incoming applications</h2>
                    )}
                  </>
                ) : (
                  <button
                    className="primary"
                    onClick={() => navigate("Explore")}
                  >
                    Explore teams →
                  </button>
                )}
                <div className="application-list">
                  {data.applications
                    .filter((a) => isCaptain || a.user_id === user.id)
                    .map((a) => (
                      <article className="card application" key={a.id}>
                        <div>
                          <h3>
                            {a.user_id === user.id ? a.team_name : a.name}
                          </h3>
                          <p>{a.message}</p>
                          <span className={"tag " + a.status}>{a.status}</span>
                        </div>
                        {a.status === "pending" && (
                          <div className="row">
                            {a.user_id === user.id ? (
                              <button
                                onClick={() =>
                                  act("applications", {
                                    id: a.id,
                                    action: "withdraw",
                                  })
                                }
                                disabled={busy}
                              >
                                Withdraw
                              </button>
                            ) : (
                              <>
                                <button
                                  className="primary"
                                  onClick={() =>
                                    act("applications", {
                                      id: a.id,
                                      action: "accept",
                                    })
                                  }
                                  disabled={busy}
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() =>
                                    act("applications", {
                                      id: a.id,
                                      action: "reject",
                                    })
                                  }
                                  disabled={busy}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                </div>
                {!data.applications.length && (
                  <div className="empty">
                    No applications yet. Your application updates will appear
                    here.
                  </div>
                )}
              </>
            )}
            {page === "Admin" && admin && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">EVENT CONTROL ROOM</div>
                  <h1>A clearer view of your hackathon.</h1>
                  <p>Track participation and keep team formation moving.</p>
                </div>
                <div className="stats">
                  {Object.entries(admin.totals).map(([k, v]) => (
                    <div key={k}>
                      <strong>{v}</strong>
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
                <div className="section-head">
                  <h2>Tracks & registration</h2>
                  <button
                    className="primary"
                    onClick={() => M({ type: "track" })}
                  >
                    ＋ Add track
                  </button>
                </div>
                <div className="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th>Track</th>
                        <th>Teams</th>
                        <th>Participants</th>
                        <th>Team limit</th>
                        <th>Registration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admin.stats.map((t) => (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td>{t.teams}</td>
                          <td>{t.participants}</td>
                          <td>{t.max_members}</td>
                          <td>
                            <button
                              onClick={() =>
                                act("admin/tracks", {
                                  action: "toggle",
                                  id: t.id,
                                })
                              }
                              disabled={busy}
                            >
                              {t.registration_open
                                ? "Open · Close"
                                : "Closed · Open"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        <footer className="main-footer">
          <span>HackMatch / Find your people.</span>
          <span>Small teams. Big possibilities. ✳</span>
        </footer>
      </main>
      {modal && (
        <div className="overlay" onClick={() => M(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Team action"
            className="modal card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => M(null)}
              aria-label="Close dialog"
            >
              ×
            </button>
            {modal.type === "create" ? (
              <form onSubmit={(e) => submit(e, "teams")}>
                <div className="eyebrow">START SOMETHING</div>
                <h2>Create your team</h2>
                <label>
                  Team name
                  <input name="name" required minLength={2} maxLength={80} />
                </label>
                <label>
                  Project idea
                  <textarea
                    name="idea"
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </label>
                <label>
                  Track
                  <select name="track_id" required>
                    {data.tracks
                      .filter((t) => t.registration_open)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Who are you looking for?
                  <input
                    name="title"
                    placeholder="ML developer"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <label>
                  Role requirements
                  <textarea
                    name="description"
                    placeholder="Python, NLP, text classification…"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Create team →
                </button>
              </form>
            ) : modal.type === "team" ? (
              <>
                <span className="track-chip">{modal.team.track_name}</span>
                <h2>{modal.team.name}</h2>
                <p>{modal.team.idea}</p>
                <h4>Open roles</h4>
                {data.openings
                  .filter((o) => o.team_id === modal.team.id)
                  .map((o) => (
                    <div className="opening" key={o.id}>
                      <h3>{o.title}</h3>
                      <p>{o.description}</p>
                    </div>
                  ))}
                <p>
                  {modal.team.member_count}/{modal.team.max_members} members
                </p>
                {!membership &&
                user.role === "participant" &&
                modal.team.slots > 0 &&
                modal.team.registration_open ? (
                  <form
                    onSubmit={(e) =>
                      submit(e, "apply", { team_id: modal.team.id })
                    }
                  >
                    <label>
                      Introduce yourself
                      <textarea
                        name="message"
                        minLength={5}
                        maxLength={1000}
                        required
                        placeholder="Here's what I can contribute…"
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      Apply to join →
                    </button>
                  </form>
                ) : (
                  <p className="muted">
                    {membership
                      ? "You already belong to a team."
                      : "This team is not accepting applications for your account."}
                  </p>
                )}
              </>
            ) : modal.type === "delete" ? (
              <>
                <h2>Delete {modal.team.name}?</h2>
                <p>
                  Members will become available again. Team applications and
                  openings will be removed.
                </p>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("team/delete", { team_id: modal.team.id });
                      M(null);
                      await load();
                    })
                  }
                >
                  Delete team
                </button>
              </>
            ) : (
              <form onSubmit={(e) => submit(e, "admin/tracks")}>
                <h2>Create a track</h2>
                <label>
                  Name
                  <input name="name" minLength={2} maxLength={80} required />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    minLength={5}
                    maxLength={2000}
                    required
                  />
                </label>
                <label>
                  Maximum team size
                  <input
                    type="number"
                    name="max_members"
                    defaultValue={4}
                    min={2}
                    max={8}
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Create track
                </button>
              </form>
            )}
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
