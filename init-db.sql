-- Database initialization script
-- Creates tables and indexes for Professional Website Builder

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for future multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (stores portfolio data sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL,
    theme VARCHAR(100) DEFAULT 'modern',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Source files table (tracks uploaded documents)
CREATE TABLE IF NOT EXISTS source_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    extracted_text TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- API keys table (encrypted storage for user API keys)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    key_hash TEXT NOT NULL,  -- Hashed API key (never store plaintext)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, provider)
);

-- Generated websites table (tracks generated sites)
CREATE TABLE IF NOT EXISTS generated_websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    theme VARCHAR(100) NOT NULL,
    output_path TEXT NOT NULL,
    generation_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- LLM processing logs (for debugging and analytics)
CREATE TABLE IF NOT EXISTS llm_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL,  -- 'tier1', 'tier2', or 'tier3'
    model VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

CREATE INDEX idx_source_files_session_id ON source_files(session_id);
CREATE INDEX idx_source_files_status ON source_files(processing_status);
CREATE INDEX idx_source_files_created_at ON source_files(created_at DESC);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_provider ON api_keys(provider);

CREATE INDEX idx_generated_websites_session_id ON generated_websites(session_id);
CREATE INDEX idx_generated_websites_status ON generated_websites(generation_status);

CREATE INDEX idx_llm_logs_session_id ON llm_logs(session_id);
CREATE INDEX idx_llm_logs_provider ON llm_logs(provider);
CREATE INDEX idx_llm_logs_created_at ON llm_logs(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (for development)
INSERT INTO users (email) VALUES ('admin@example.com')
ON CONFLICT (email) DO NOTHING;

-- Create view for session summary
CREATE OR REPLACE VIEW session_summary AS
SELECT
    s.id,
    s.user_id,
    s.theme,
    s.status,
    s.created_at,
    s.updated_at,
    COUNT(DISTINCT sf.id) as file_count,
    COUNT(DISTINCT gw.id) as website_count,
    MAX(gw.completed_at) as last_generated_at
FROM sessions s
LEFT JOIN source_files sf ON s.id = sf.session_id
LEFT JOIN generated_websites gw ON s.id = gw.session_id
GROUP BY s.id, s.user_id, s.theme, s.status, s.created_at, s.updated_at;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pwbuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pwbuser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pwbuser;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
END
$$;
