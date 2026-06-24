-- Fix video names: update name from file path if name is null
-- This script extracts video names from the 'path' column

-- Update videos table - set name from file path if name is null/empty
UPDATE videos 
SET name = COALESCE(
  name, 
  CASE 
    WHEN path LIKE '%.mp4' THEN regexp_replace(path, '.*/([^/]+)\.mp4$', '\1')
    WHEN path LIKE '%.m3u8' THEN regexp_replace(path, '.*/([^/]+)\.m3u8$', '\1')
    ELSE 'Video ' || id::text
  END
)
WHERE name IS NULL OR name = '';

-- Update lessons table - set title from video name or use lesson title from video
UPDATE lessons l
SET title = COALESCE(
  l.title, 
  v.name, 
  'Video ' || l.id::text
)
FROM videos v
WHERE l."videoId" = v.id 
AND (l.title IS NULL OR l.title = '' OR l.title LIKE 'Video %');

-- Verify the updates
SELECT 
  v.id as "videoId",
  v.name as "videoName",
  v.path,
  l.id as "lessonId",
  l.title as "lessonTitle"
FROM videos v
LEFT JOIN lessons l ON l."videoId" = v.id
ORDER BY v.id
LIMIT 20;
