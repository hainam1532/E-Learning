-- Add default course categories
INSERT INTO course_categories (code, name_vi, name_en, name_zh, "createdAt", "updatedAt") VALUES
('SUSTAINABILITY', 'Bền vững', 'Sustainability', '可持续性', NOW(), NOW()),
('LEADERSHIP', 'Khả năng lãnh đạo', 'Leadership', '领导力', NOW(), NOW()),
('CREATIVITY', 'Sáng tạo', 'Creativity', '创新', NOW(), NOW()),
('DIGITAL', 'Số hóa', 'Digital Transformation', '数字化', NOW(), NOW()),
('SOFT_SKILLS', 'Kỹ năng mềm', 'Soft Skills', '软技能', NOW(), NOW()),
('TECHNICAL', 'Kỹ thuật', 'Technical', '技术', NOW(), NOW()),
('MANAGEMENT', 'Quản lý', 'Management', '管理', NOW(), NOW()),
('COMMUNICATION', 'Giao tiếp', 'Communication', '沟通', NOW(), NOW()),
('TEAMWORK', 'Làm việc nhóm', 'Teamwork', '团队合作', NOW(), NOW()),
('PROBLEM_SOLVING', 'Giải quyết vấn đề', 'Problem Solving', '解决问题', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
