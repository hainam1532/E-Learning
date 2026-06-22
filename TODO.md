# TODO: Add Profile Page to UserLayout

## Tasks

### 1. Update UserLayout.tsx
- [x] Add "Cá nhân" button in navigation menu next to "Trang chủ"
- [x] Add mobile menu with Drawer component
- [x] Include "Cá nhân" link in mobile menu

### 2. Create Profile Page
- [x] Create `frontend/src/pages/views/Profile.tsx`
- [x] Add header with avatar, name, department, position, usercode
- [x] Add stats section: thời lượng học tháng này, thời lượng tích lũy
- [x] Add 4 tabs: đào tạo của tôi, yêu thích của tôi, lịch sử xem, thống kê

### 3. Add Route
- [x] Update `frontend/src/routes/index.tsx` with `/profile` route

### 4. Locale Updates
- [x] Add Vietnamese translations in `frontend/src/locales/vi.json`

### 5. Backend API (Optional)
- [ ] Add user profile endpoint with department/position
- [ ] Add learning stats endpoint
