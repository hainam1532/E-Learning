# TODO - Learning Path Wizard Implementation

## Task: Create a 3-step Learning Path Wizard Page (Lộ trình học tập)

### Steps Overview:

#### Step 1: Create Class (Tạo lớp học)
- [x] Select training plan from Training Plan page
- [x] Set class name (multi-language)
- [x] Select lecturer
- [x] Set start/end dates
- [x] Add students via 2 methods:
  - [x] Manual add (select from user list)
  - [x] Import from Excel

#### Step 2: Build Content (Xây dựng nội dung)
- [x] Display list of all classes created in Step 1
- [x] Select a class to add content:
  - [x] Add courses
  - [x] Add exams
  - [x] Add documents

#### Step 3: Review & Confirm (Xem lại & Xác nhận)
- [x] Review all class information
- [x] Review all students added
- [x] Review all content planned
- [x] Confirm and save (create all data)

### Implementation Files:
1. `frontend/src/pages/admin/LearningPath.tsx` - Main wizard component
2. `frontend/src/routes/index.tsx` - Update route to use new component
