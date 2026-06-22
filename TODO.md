# Completed: Add Academy Filter to Home Page

## Summary
Added a dropdown on the home page to filter courses by academy. When an academy is selected from the dropdown in the navigation bar, only courses belonging to that academy will be displayed.

## Changes Made

### 1. Backend - Add academy filter to course controller ✅
- Modified `getCourses` function in `backend/src/modules/course/course.controller.ts` to accept `academyId` query parameter
- Filters courses by academyId when provided

### 2. Frontend - Add academy service/function ✅
- Added `getCoursesByAcademy` function in `frontend/src/services/course.ts` that accepts academyId parameter
- Makes API call with query parameter

### 3. Frontend - Add Academy Select to UserLayout (Navigation) ✅
- Added Select dropdown in navigation bar in `frontend/src/layouts/UserLayout.tsx`
- Fetches academies on component mount
- Filters academies based on user permissions (public + assigned private academies)
- When an academy is selected, navigates to Home with `?academy={id}` query parameter
- Includes "clear" option to show all courses

### 4. Frontend - Home page reads academy from URL ✅
- Modified `frontend/src/pages/views/Home.tsx` to read academyId from URL search params
- Fetches courses filtered by academy when parameter exists
- Shows all courses when no academy selected

## Files Edited
1. `backend/src/modules/course/course.controller.ts`
2. `frontend/src/services/course.ts`
3. `frontend/src/layouts/UserLayout.tsx`
4. `frontend/src/pages/views/Home.tsx`

## Usage
- User sees a "Chọn học viện" (Select Academy) dropdown in the navigation bar
- Dropdown shows academies the user has access to
- When selecting an academy, courses are filtered to show only that academy's courses
- When clearing the selection, all courses are shown
