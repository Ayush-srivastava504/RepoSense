-- database/migrations/005_repo_docs.sql
CREATE TABLE repo_docs (
    repo_name TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    readme_content TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (repo_name, user_id)
);