import { TranslationKeys } from './vi';

export const zh: Record<TranslationKeys, string> = {
  USERCODE_REQUIRED: "用户代码是必填的。",
  PASSWORD_REQUIRED: "密码是必填的。",
  USERCODE_EXISTS: "该用户代码已存在于系统中。",
  EMAIL_EXISTS: "该电子邮件已被使用。",
  INVALID_CREDENTIALS: "用户代码或密码不正确。",
  UNAUTHORIZED: "请登录以执行此功能。",
  SESSION_EXPIRED_DUPLICATE_LOGIN: "您的账号已在其他地方登录。当前会话已被终止。",
  FORBIDDEN: "您没有权限访问此资源。",
  REGISTER_SUCCESS: "账户注册成功。",
  LOGIN_SUCCESS: "登录成功。",
  LOGOUT_SUCCESS: "登出成功。",
  INTERNAL_SERVER_ERROR: "内部服务器错误。请稍后再试。",
  REFRESH_TOKEN_INVALID: "会话已过期或无效。请重新登录。",
  // User management
  INVALID_ID: "无效的用户ID。",
  USER_NOT_FOUND: "未找到用户。",
  CANNOT_DELETE_SELF: "您无法删除自己的账户。",
  USER_CREATED_SUCCESS: "用户创建成功。",
  USER_UPDATED_SUCCESS: "用户更新成功。",
  USER_DELETED_SUCCESS: "用户删除成功。",
};
