# Implementation TODO

## Task: Profile Page - Training Tab Display

### Backend Changes:
- [x] 1. Add new endpoints in training.controller.ts
  - [x] 1.1 Get current user's training enrollments (classes enrolled)
  - [x] 1.2 Get training plans for current user with progress
- [x] 2. Add routes in training.routes.ts
- [x] 3. Test the endpoints

### Frontend Changes:
- [x] 4. Add API functions in training.ts
  - [x] 4.1 getMyTrainingEnrollments()
  - [x] 4.2 getMyTrainingPlans()
- [x] 5. Update Profile.tsx Training tab
  - [x] 5.1 Fetch and display training plans
  - [x] 5.2 Show progress for each plan
  - [x] 5.3 Click to navigate to CourseLearn

### Testing:
- [x] 6. Test the full flow
