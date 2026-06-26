-- Create exam_attempts table for tracking exam sessions
CREATE TABLE IF NOT EXISTS exam_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    training_plan_id INTEGER REFERENCES training_plans(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ONGOING',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMP,
    score NUMERIC(5,2),
    passed BOOLEAN,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    cheat_warnings INTEGER NOT NULL DEFAULT 0,
    is_fraud BOOLEAN NOT NULL DEFAULT false,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS exam_attempts_user_id_idx ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS exam_attempts_exam_session_id_idx ON exam_attempts(exam_session_id);
CREATE INDEX IF NOT EXISTS exam_attempts_status_idx ON exam_attempts(status);
