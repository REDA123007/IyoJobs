PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES (1);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('candidate','employer')),
 locale TEXT NOT NULL CHECK(locale IN ('ar','en','fr'))
);
CREATE TABLE IF NOT EXISTS sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
 title TEXT NOT NULL, description TEXT NOT NULL, country TEXT NOT NULL,
 locale TEXT NOT NULL, skills TEXT NOT NULL, remote INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))
);
CREATE TABLE IF NOT EXISTS profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, skills TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
 candidate_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','interview','offered','rejected','withdrawn')),
 UNIQUE(job_id,candidate_id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event TEXT NOT NULL, reference_id TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
 sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_search ON jobs(status,country);
CREATE INDEX IF NOT EXISTS applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created);
CREATE INDEX IF NOT EXISTS messages_application ON messages(application_id,created);
