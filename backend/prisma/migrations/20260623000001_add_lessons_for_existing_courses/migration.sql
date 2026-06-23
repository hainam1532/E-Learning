-- Migration: Add lessons for existing courses
-- This migration creates Lesson records for courses that have courseVideos but no lessons

-- Create lessons for courses that have videos but no lessons
INSERT INTO lessons (title, "courseId", "videoId", "order", "createdAt", "updatedAt")
SELECT 
    COALESCE(v.name, 'Video ' || cv.order::text) as title,
    cv."courseId",
    cv."videoId",
    cv."order",
    NOW(),
    NOW()
FROM "course_videos" cv
LEFT JOIN "lessons" l ON cv."courseId" = l."courseId" AND cv."videoId" = l."videoId"
JOIN "videos" v ON cv."videoId" = v.id
WHERE l.id IS NULL
ORDER BY cv."courseId", cv."order"
ON CONFLICT DO NOTHING;

-- Verify: Show courses and their lesson counts
SELECT 
    c.id as "courseId",
    c."title_vi" as "courseTitle",
    COUNT(DISTINCT cv.id) as "totalVideos",
    COUNT(DISTINCT l.id) as "totalLessons",
    COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN l.id END) as "lessonsWithVideos"
FROM "courses" c
LEFT JOIN "course_videos" cv ON c.id = cv."courseId"
LEFT JOIN "lessons" l ON c.id = l."courseId"
GROUP BY c.id, c."title_vi"
HAVING COUNT(DISTINCT cv.id) > 0
ORDER BY c.id;
