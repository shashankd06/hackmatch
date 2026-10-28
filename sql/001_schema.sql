BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 email text UNIQUE NOT NULL CHECK(email = lower(email) AND position('@' in email)>1),
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'participant' CHECK(role IN ('participant','admin')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id bigint NOT NULL REFERENCES users ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE profiles(user_id bigint PRIMARY KEY REFERENCES users ON DELETE CASCADE,
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=2000), preferred_role text NOT NULL DEFAULT 'Developer',
 availability text NOT NULL DEFAULT 'Evenings' CHECK(availability IN ('Mornings','Evenings','Weekends','Flexible')),
 looking boolean NOT NULL DEFAULT true, embedding vector(384));
CREATE TABLE skills(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text UNIQUE NOT NULL CHECK(length(name) BETWEEN 1 AND 40));
CREATE TABLE participant_skills(user_id bigint REFERENCES users ON DELETE CASCADE,skill_id bigint REFERENCES skills ON DELETE CASCADE,PRIMARY KEY(user_id,skill_id));
CREATE TABLE tracks(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text UNIQUE NOT NULL CHECK(length(name) BETWEEN 2 AND 80),description text NOT NULL CHECK(length(description) BETWEEN 5 AND 2000),max_members integer NOT NULL CHECK(max_members BETWEEN 2 AND 8),registration_open boolean NOT NULL DEFAULT true);
CREATE TABLE teams(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text UNIQUE NOT NULL CHECK(length(name) BETWEEN 2 AND 80),idea text NOT NULL CHECK(length(idea) BETWEEN 10 AND 2000),track_id bigint NOT NULL REFERENCES tracks,created_at timestamptz DEFAULT now());
CREATE TABLE memberships(user_id bigint PRIMARY KEY REFERENCES users,team_id bigint NOT NULL REFERENCES teams ON DELETE CASCADE,is_captain boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX one_captain_per_team ON memberships(team_id) WHERE is_captain;
CREATE INDEX membership_team ON memberships(team_id);
CREATE TABLE openings(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,team_id bigint NOT NULL REFERENCES teams ON DELETE CASCADE,title text NOT NULL CHECK(length(title) BETWEEN 2 AND 80),description text NOT NULL CHECK(length(description) BETWEEN 5 AND 2000),embedding vector(384));
CREATE TABLE applications(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id bigint NOT NULL REFERENCES users,team_id bigint NOT NULL REFERENCES teams ON DELETE CASCADE,message text NOT NULL CHECK(length(message) BETWEEN 5 AND 1000),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn','closed')),created_at timestamptz DEFAULT now(),UNIQUE(user_id,team_id));
CREATE INDEX applications_team_status ON applications(team_id,status);
CREATE INDEX profile_vectors ON profiles USING hnsw(embedding vector_cosine_ops);
CREATE INDEX opening_vectors ON openings USING hnsw(embedding vector_cosine_ops);
CREATE FUNCTION enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lim integer; occupied integer;
BEGIN
 PERFORM 1 FROM teams WHERE id=NEW.team_id FOR UPDATE;
 SELECT max_members INTO lim FROM tracks JOIN teams ON teams.track_id=tracks.id WHERE teams.id=NEW.team_id;
 SELECT count(*) INTO occupied FROM memberships WHERE team_id=NEW.team_id AND user_id<>NEW.user_id;
 IF occupied>=lim THEN RAISE EXCEPTION 'Team is full'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER team_capacity BEFORE INSERT OR UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION enforce_capacity();
CREATE FUNCTION guard_track_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.max_members<OLD.max_members THEN RAISE EXCEPTION 'Team limits cannot be reduced after track creation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER track_limit BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION guard_track_limit();
CREATE FUNCTION accept_application(actor bigint,application_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a applications%ROWTYPE; open_reg boolean;
BEGIN
 SELECT * INTO a FROM applications WHERE id=application_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
 PERFORM 1 FROM teams WHERE id=a.team_id FOR UPDATE;
 PERFORM 1 FROM users WHERE id=a.user_id FOR UPDATE;
 SELECT * INTO a FROM applications WHERE id=application_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM memberships WHERE user_id=actor AND team_id=a.team_id AND is_captain) THEN RAISE EXCEPTION 'Captain access required'; END IF;
 SELECT registration_open INTO open_reg FROM tracks JOIN teams ON teams.track_id=tracks.id WHERE teams.id=a.team_id;
 IF NOT open_reg THEN RAISE EXCEPTION 'Registration is closed'; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Application is no longer pending'; END IF;
 IF EXISTS(SELECT 1 FROM memberships WHERE user_id=a.user_id) THEN RAISE EXCEPTION 'Applicant already belongs to a team'; END IF;
 INSERT INTO memberships(user_id,team_id) VALUES(a.user_id,a.team_id);
 UPDATE applications SET status='accepted' WHERE id=a.id;
 UPDATE applications SET status='closed' WHERE user_id=a.user_id AND id<>a.id AND status='pending';
 UPDATE profiles SET looking=false WHERE user_id=a.user_id;
END $$;
CREATE VIEW team_overview AS SELECT t.*,tr.name track_name,tr.max_members,tr.registration_open,count(m.user_id)::integer member_count,
 tr.max_members-count(m.user_id)::integer slots FROM teams t JOIN tracks tr ON tr.id=t.track_id LEFT JOIN memberships m ON m.team_id=t.id GROUP BY t.id,tr.id;
CREATE VIEW track_stats AS SELECT tr.id,tr.name,tr.max_members,tr.registration_open,count(DISTINCT t.id)::integer teams,count(m.user_id)::integer participants FROM tracks tr LEFT JOIN teams t ON t.track_id=tr.id LEFT JOIN memberships m ON m.team_id=t.id GROUP BY tr.id;
COMMIT;
