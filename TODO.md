# TODO List - Add Download Template Buttons

## Task: Add "Tải mẫu" (Download Template) buttons to Import Excel features

### Files to Edit:

1. **frontend/src/pages/admin/UserManagement.tsx**
   - Current: Has broken download button that only shows info message
   - Fix: Implement actual template download using `authGet.getUserTemplate()`

2. **frontend/src/pages/admin/TrainingClassManagement.tsx**
   - Current: Has "Import Excel" button but no download template button
   - Fix: Add "Tải mẫu" button next to Import button in Students tab

3. **frontend/src/pages/admin/TrainingPathManagement.tsx**
   - Current: Has student import via Excel but no download template button
   - Fix: Add "Tải mẫu" link in student import section

### Backend Dependencies (already exist):
- `/auth/users/template` endpoint ✓
- `/training/classes/:id/students/template` endpoint ✓

### Frontend Services (already exist):
- `authGet.getUserTemplate()` ✓
- `downloadStudentTemplate(classId)` ✓

## Progress:
- [x] 1. UserManagement.tsx - Fix broken download template button (ALREADY DONE)
- [x] 2. TrainingClassManagement.tsx - Add download template button (ALREADY DONE)
- [x] 3. TrainingPathManagement.tsx - Add download template button (DONE)
