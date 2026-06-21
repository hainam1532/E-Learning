export const vi = {
  USERCODE_REQUIRED: "Mã người dùng là bắt buộc.",
  PASSWORD_REQUIRED: "Mật khẩu là bắt buộc.",
  USERCODE_EXISTS: "Mã người dùng này đã tồn tại trong hệ thống.",
  EMAIL_EXISTS: "Email này đã được sử dụng.",
  INVALID_CREDENTIALS: "Mã người dùng hoặc mật khẩu không chính xác.",
  UNAUTHORIZED: "Vui lòng đăng nhập để thực hiện chức năng này.",
  SESSION_EXPIRED_DUPLICATE_LOGIN: "Tài khoản của bạn đã được đăng nhập từ một nơi khác. Phiên đăng nhập hiện tại đã bị hủy.",
  FORBIDDEN: "Bạn không có quyền truy cập vào tài nguyên này.",
  REGISTER_SUCCESS: "Đăng ký tài khoản thành công.",
  LOGIN_SUCCESS: "Đăng nhập thành công.",
  LOGOUT_SUCCESS: "Đăng xuất thành công.",
  INTERNAL_SERVER_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
  REFRESH_TOKEN_INVALID: "Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
// User management
  INVALID_ID: "ID người dùng không hợp lệ.",
  USER_NOT_FOUND: "Không tìm thấy người dùng.",
  CANNOT_DELETE_SELF: "Bạn không thể xóa tài khoản của chính mình.",
  USER_CREATED_SUCCESS: "Tạo người dùng thành công.",
  USER_UPDATED_SUCCESS: "Cập nhật người dùng thành công.",
  USER_DELETED_SUCCESS: "Xóa người dùng thành công.",
};

export type TranslationKeys = keyof typeof vi;
