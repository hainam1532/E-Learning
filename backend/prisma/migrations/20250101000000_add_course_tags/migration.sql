-- Create CourseTag table
CREATE TABLE "course_tags" (
    id SERIAL PRIMARY KEY,
    name_vi TEXT NOT NULL,
    name_en TEXT,
    name_zh TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE "course_tags" IS 'Thẻ khóa học - Course Tags';

-- Insert some default tags
INSERT INTO "course_tags" (name_vi, name_en, name_zh) VALUES
('Lập trình', 'Programming', '编程'),
('Frontend', 'Frontend', '前端'),
('Backend', 'Backend', '后端'),
('ReactJS', 'ReactJS', 'ReactJS'),
('JavaScript', 'JavaScript', 'JavaScript'),
('TypeScript', 'TypeScript', 'TypeScript'),
('NodeJS', 'NodeJS', 'NodeJS'),
('HTML/CSS', 'HTML/CSS', 'HTML/CSS'),
('Database', 'Database', '数据库'),
('API', 'API', 'API');
