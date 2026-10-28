# Verification and test plan

Verified in the build environment:

- Next.js 16.4.3 production build compiled successfully.
- `npm test`: 9 passing tests, 0 failures, using real embedded PostgreSQL (PGlite) with pgvector.
- `npm run test:semantic`: real MiniLM model loaded; output has 384 dimensions, is normalized, and ranks the NLP candidate above an unrelated designer.
- Production server HTTP checks: home returns 200; anonymous identity returns 200 with null user; protected data returns 401; cross-origin mutation returns 403.

The SQL suite checks non-captain rejection, successful atomic acceptance, closure of competing applications, rollback on full-team acceptance, single-team membership, unique captain, duplicate application rejection, track-limit protection, occupancy views, cosine ranking, vector dimensional constraints and deletion cascades.

## PostgreSQL concurrency test

After local database setup:

```bash
npm run test:db
```

This test creates a unique temporary schema in the configured database, loads the schema, submits two acceptances concurrently through separate PostgreSQL connections, requires exactly one success, and checks two total members, one accepted application and one still-pending application. It drops only its temporary schema afterward. The pgvector extension may be created if absent and is retained. Do not run this test with a production database.

This separate multi-connection test was included but was not executed here because a standalone PostgreSQL/Docker service was unavailable. PGlite validates SQL logic but does not establish multi-client lock behavior.

## Manual application acceptance checklist

Full authenticated browser workflows and visual/responsive review remain to be exercised on your local installation:

| Scenario                                   | Expected result                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Register, log out, log in                  | Persistent HttpOnly session; participant role                               |
| Wrong password                             | Generic credentials error                                                   |
| Save profile/skills                        | Exact filters reflect edits; embedding cleared until refresh                |
| Create team while already a member         | Rejected; no orphan team                                                    |
| Create team in closed track                | Rejected                                                                    |
| Apply to another team while a member       | Rejected                                                                    |
| Accept candidate as another team's captain | Rejected                                                                    |
| Accept final slot twice concurrently       | Only one accepted; no partial application updates                           |
| Reject / withdraw                          | Pending application changes status; decided application cannot change again |
| Transfer captain then leave                | One captain remains; leaving participant returns to available pool          |
| Delete team after confirmation             | Members freed; dependent applications/openings removed                      |
| Search team opening after embeddings       | Ranked eligible candidates; no made-up compatibility percentage             |
| Admin toggles registration                 | Updated status and application restrictions                                 |
| Phone-width layout, keyboard navigation    | Readable cards/forms, visible focus, labelled controls                      |

## Verification scope

The archive contains functional source, not screenshots of unverified workflows or a completed student report. Add your own screenshots and local test evidence to the final submission. No externally hosted deployment is included.
