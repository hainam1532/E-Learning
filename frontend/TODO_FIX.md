# Fix Unused Variables/Imports List

## Errors to fix:
1. VideoPlayer.tsx - line 45: videoName declared but never read
2. VideoPlayer.tsx - line 55: playbackRate declared but never read
3. UserLayout.tsx - line 1: useEffect imported but never used
4. AcademyManagement.tsx - line 2: Avatar imported but never used
5. CourseManagement.tsx - line 17: Tooltip imported but never used
6. CourseManagement.tsx - line 28: SettingOutlined imported but never used
7. CourseManagement.tsx - line 29: InfoCircleOutlined imported but never used
8. CourseManagement.tsx - line 57: t declared but never read
9. CourseManagement.tsx - line 684: index declared but never used (in map callback)
10. CourseTagManagement.tsx - line 11: Tag imported but never used
11. CourseTagManagement.tsx - line 52: getLocalizedName declared but never used
12. DocumentLibrary.tsx - line 12: Tag imported but never used
13. DocumentLibrary.tsx - line 80: uploadProgress declared but never read
14. LecturerManagement.tsx - line 2: Modal imported but never used
15. ReportsOverview.tsx - line 2: Button, Space, BarChartOutlined imported but never used
16. ReportsTime.tsx - line 2: Tag imported but never used
17. SystemConfig.tsx - line 2: Tag imported but never used
18. SystemConfig.tsx - line 58: id declared but never read
19. TrainingClassManagement.tsx - line 29: UserAddOutlined imported but never used
20. TrainingClassManagement.tsx - line 32: TeamOutlined imported but never used
21. TrainingClassManagement.tsx - line 35: BarChartOutlined imported but never used
22. TrainingClassManagement.tsx - line 36: LineChartOutlined imported but never used
23. TrainingClassManagement.tsx - line 120: t declared but never used
24. TrainingClassManagement.tsx - line 379: filteredPlans declared but never used
25. TrainingClassManagement.tsx - line 1041: err declared but never used
26. UserManagement.tsx - line 7: XLSX imported but never used
27. UserManagement.tsx - line 57: fileInputRef declared but never read
28. VideoLibrary.tsx - line 43: uploadProgress declared but never read
29. CourseLearn.tsx - line 29: imports unused (LineChart etc)
30. CourseLearn.tsx - line 54: user declared but never used
31. ExamTaking.tsx - line 7: Input imported but never used
32. ExamTaking.tsx - line 9: Radio imported but never used
33. ExamTaking.tsx - line 30: Title imported but never used
34. progress.ts - line 53: ApiResponse declared but never used
35. authStore.ts - line 2: UserRole imported but never used
36. authStore.ts - line 25: get declared but never read (in create function)
37. authStore.ts - line 25: Missing 'register' in store

## Plan:
- Fix each file one by one
- Remove unused imports
- Prefix unused variables with underscore or remove them
- Fix the authStore register issue
