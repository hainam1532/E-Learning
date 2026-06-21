import { TranslationKeys } from './vi';

export const en: Record<TranslationKeys, string> = {
  USERCODE_REQUIRED: "Usercode is required.",
  PASSWORD_REQUIRED: "Password is required.",
  USERCODE_EXISTS: "This usercode already exists in the system.",
  EMAIL_EXISTS: "This email is already in use.",
  INVALID_CREDENTIALS: "Incorrect usercode or password.",
  UNAUTHORIZED: "Please log in to perform this function.",
  SESSION_EXPIRED_DUPLICATE_LOGIN: "Your account has been logged in from another location. Current session has been terminated.",
  FORBIDDEN: "You do not have permission to access this resource.",
  REGISTER_SUCCESS: "Account registered successfully.",
  LOGIN_SUCCESS: "Login successful.",
  LOGOUT_SUCCESS: "Logout successful.",
  INTERNAL_SERVER_ERROR: "Internal server error. Please try again later.",
  REFRESH_TOKEN_INVALID: "Session expired or invalid. Please log in again.",
  // User management
  INVALID_ID: "Invalid user ID.",
  USER_NOT_FOUND: "User not found.",
  CANNOT_DELETE_SELF: "You cannot delete your own account.",
  USER_CREATED_SUCCESS: "User created successfully.",
  USER_UPDATED_SUCCESS: "User updated successfully.",
  USER_DELETED_SUCCESS: "User deleted successfully.",
};
