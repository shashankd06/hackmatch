-- Run against a seeded development database. These reads are non-destructive.
-- JOIN + aggregation: recruitment by track.
SELECT tr.name, count(t.id) AS teams FROM tracks tr LEFT JOIN teams t ON t.track_id=tr.id GROUP BY tr.id ORDER BY teams DESC;
-- HAVING: tracks with recruiting teams (change threshold to 3 for a larger dataset).
SELECT track_name,count(*) FROM team_overview WHERE slots>0 GROUP BY track_name HAVING count(*)>=1;
-- Subquery: participants without teams.
SELECT name,email FROM users WHERE role='participant' AND id NOT IN(SELECT user_id FROM memberships);
SELECT * FROM track_stats;
SELECT * FROM team_overview ORDER BY slots DESC;
-- Distance demonstration between embedded candidates and first opening.
SELECT u.name,p.embedding <=> (SELECT embedding FROM openings WHERE embedding IS NOT NULL ORDER BY id LIMIT 1) AS cosine_distance
FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.embedding IS NOT NULL AND p.looking
ORDER BY cosine_distance LIMIT 5;
-- Safe DDL showcase: creates only a disposable demonstration table, then rolls back.
BEGIN;
CREATE TABLE rubric_demo(id integer PRIMARY KEY);
ALTER TABLE rubric_demo ADD COLUMN note text;
INSERT INTO rubric_demo VALUES(1,'initial');
UPDATE rubric_demo SET note='updated' WHERE id=1;
SELECT * FROM rubric_demo;
DELETE FROM rubric_demo WHERE id=1;
DROP TABLE rubric_demo;
ROLLBACK;
