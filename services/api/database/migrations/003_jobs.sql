CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    url TEXT UNIQUE,
    source TEXT,
    posted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);