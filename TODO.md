# Course Management Implementation TODO

## Phase 1: Database Schema Updates

### 1.1 Update Prisma Schema (schema.prisma)
- [ ] Add CourseCategory model
  - id, name_vi, name_en, name_zh, code, description
- [ ] Update Course model with new fields:
  - title_vi, title_en, title_zh (multilingual)
  - description_vi, description_en, description_zh
  - coverImage (URL)
  - isPublic (boolean - public/private course)
  - rating (number)
  - language (training language)
  - targetAudience
  - benefits (JSON array)
  - tags (JSON array)
  - academyId (relation to Academy)
  - categoryId (relation to CourseCategory)
  - instructorId (relation to User)
  - courseRules (JSON - anti-fast-forward, lock 1x, watermark, block download, completion condition)

### 1.2 Run Migration
- [ ] Generate and run Prisma migration

---

## Phase 2: Backend API Updates

### 2.1 Course Controller (course.controller.ts)
- [ ] Update getCourses to include relations (academy, category, instructor)
- [ ] Update createCourse to handle all new fields
- [ ] Update updateCourse to handle all new fields

### 2.2 Course Routes (course.routes.ts)
- [ ] Add routes for course categories CRUD
- [ ] Add route for getting courses by academy

### 2.3 Course Service (frontend/src/services/course.ts)
- [ ] Add CourseCategory types and API functions
- [ ] Add CRUD operations for courses

---

## Phase 3: Frontend Implementation

### 3.1 CourseManagement.tsx Page
- [ ] Create course list table with columns:
  - Cover image
  - Title (multilingual)
  - Description (multilingual)
  - Category (CourseCategory)
  - Academy
  - Instructor (User)
  - Rating
  - isPublic (Public/Private tag)
  - Actions (Edit)
- [ ] Add "Add New Course" button

### 3.2 Drawer with Tabs
- [ ] Tab 1: Thông tin cơ bản (Basic Info)
  - Upload cover image
  - Select academy
  - isPublic switch (Public/Private)
  - Title in VN/EN/ZH
  - Select category
  - Select instructor
  - Training language
  - Target audience
  - Benefits (list input)
  - Tags (tag input)
  - Description (rich text)
- [ ] Tab 2: Video
  - Attach video from Video Library
  - List attached videos
- [ ] Tab 3: Quy tắc (Rules)
  - Anti fast-forward (prevent skip)
  - Lock 1x speed
  - Show watermark
  - Block download
  - Completion condition (100% video)

---

## Phase 4: Integration

### 4.1 Add Route
- [ ] Add CourseManagement to routes/index.tsx

### 4.2 Add Menu Item
- [ ] Add to AdminLayout navigation

---

## Estimated Files to Edit:
1. backend/prisma/schema.prisma
2. backend/src/modules/course/course.controller.ts
3. backend/src/modules/course/course.routes.ts
4. frontend/src/services/course.ts
5. frontend/src/pages/admin/CourseManagement.tsx (create)
6. frontend/src/routes/index.tsx
7. frontend/src/layouts/AdminLayout.tsx
