# TODO: Fix TypeScript Build Errors (39 errors)

## Plan to fix all TypeScript errors from `npm run build:test`

### Files to Fix:

1. **src/components/VideoPlayer.tsx**
   - [ ] Remove `videoName` from destructuring (line 45) - declared but never used
   - [ ] Remove `playbackRate` state (line 55) - declared but setter never used

2. **src/layouts/UserLayout.tsx**
   - [ ] Remove `useEffect` from import (line 1) - declared but never read

3. **src/pages/admin/AcademyManagement.tsx**
   - [ ] Remove `Avatar` from import (line 2) - declared but never read

4. **src/pages/admin/CourseManagement.tsx**
   - [ ] Remove `Tooltip` from import (line 17)
   - [ ] Remove `SettingOutlined` from import (line 28)
   - [ ] Remove `InfoCircleOutlined` from import (line 29)
   - [ ] Remove `t` from useTranslation (line 57) - declared but never read
   - [ ] Fix `index` variable in fields.map (line 684) - use _ instead

5. **src/pages/admin/CourseTagManagement.tsx**
   - [ ] Remove `Tag` from import (line 11)
   - [ ] Remove `getLocalizedName` function (line 52) - declared but never used

6. **src/pages/admin/DocumentLibrary.tsx**
   - [ ] Remove `Tag` from import (line 12)
   - [ ] Remove `uploadProgress` state (line 80) - declared but setter never used

7. **src/pages/admin/LecturerManagement.tsx**
   - [ ] Remove `Modal` from import (line 2)

8. **src/pages/admin/ReportsOverview.tsx**
   - [ ] Remove `Button` from import (line 2)
   - [ ] Remove `Space` from import (line 2)
   - [ ] Remove `BarChartOutlined` from import (line 4)

9. **src/pages/admin/ReportsTime.tsx**
   - [ ] Remove `Tag` from import (line 2)

10. **src/pages/admin/SystemConfig.tsx**
    - [ ] Remove `Tag` from import (line 2)
    - [ ] Fix `id` parameter in handleDelete (line 58) - use _ instead

11. **src/pages/admin/TrainingClassManagement.tsx**
    - [ ] Remove `UserAddOutlined` from import (line 29)
    - [ ] Remove `TeamOutlined` from import (line 32)
    - [ ] Remove `BarChartOutlined` from import (line 35)
    - [ ] Remove `LineChartOutlined` from import (line 36)
    - [ ] Remove `t` from useTranslation (line 120) - declared but never read
    - [ ] Remove `filteredPlans` variable (line 379) - declared but never used
    - [ ] Fix `err` in catch (line 1041) - use _ instead

12. **src/pages/admin/UserManagement.tsx**
    - [ ] Remove `XLSX` import (line 7)
    - [ ] Remove `fileInputRef` variable (line 57) - declared but never used

13. **src/pages/admin/VideoLibrary.tsx**
    - [ ] Remove `uploadProgress` state (line 43) - declared but setter never used

14. **src/pages/views/CourseLearn.tsx**
    - [ ] Remove recharts imports (line 29) - all unused
    - [ ] Remove `user` from useAuthStore (line 54) - declared but never read

15. **src/pages/views/ExamTaking.tsx**
    - [ ] Remove `Input` from import (line 7)
    - [ ] Remove `Radio` from import (line 9)
    - [ ] Remove `Title` from Typography (line 30) - declared but never used

16. **src/services/progress.ts**
    - [ ] Remove `ApiResponse` interface (line 53) - declared but never used

17. **src/store/authStore.ts**
    - [ ] Remove `UserRole` from import (line 2)
    - [ ] Remove `get` from create (line 25) - declared but never used
    - [ ] Add missing `register` method to fulfill AuthState interface

## Execution Order:
1. Fix imports first (remove unused)
2. Fix unused variables (remove or prefix with _)
3. Fix unused state setters
4. Fix authStore to add register method
