import { Form, Input, Button, Card, message, Divider } from 'antd';
import { LockOutlined, UserOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types/auth';

export default function Login() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  // Read redirect path before being blocked
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (values: { usercode: string; password: string }) => {
    try {
      await login(values.usercode, values.password);
      message.success(t('login.loginSuccess'));
      
      // Redirect based on role
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Login failed. Please try again!';
      message.error(errorMessage);
    }
  };

  // Quick login for testing purposes
  const handleQuickLogin = async (role: UserRole) => {
    const usercode = role === 'admin' ? 'admin' : 'hv001';
    const password = 'password123';
    form.setFieldsValue({ usercode, password });
    await handleLogin({ usercode, password });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-6 px-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-100 rounded-3xl overflow-hidden p-2">
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl mx-auto shadow-lg shadow-blue-500/20">
              E+
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              {t('login.welcomeBack')}
            </h2>
            <p className="text-slate-400 text-sm">
              {t('login.welcomeSub')}
            </p>
          </div>

          <Form
            form={form}
            name="login_form"
            layout="vertical"
            initialValues={{ usercode: '', password: '' }}
            onFinish={handleLogin}
            requiredMark={false}
            className="space-y-4"
          >
            <Form.Item
              name="usercode"
              label={<span className="text-slate-600 font-semibold text-xs uppercase tracking-wider">{t('common.usercode')}</span>}
              rules={[{ required: true, message: t('common.requiredField') }]}
            >
              <Input
                prefix={<UserOutlined className="text-slate-400" />}
                placeholder="HV001, admin..."
                className="h-11 rounded-lg border-slate-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-slate-600 font-semibold text-xs uppercase tracking-wider">{t('common.password')}</span>}
              rules={[{ required: true, message: t('common.requiredField') }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400" />}
                placeholder="••••••••"
                className="h-11 rounded-lg border-slate-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 border-none font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all duration-200"
              >
                {t('common.login')}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain className="text-slate-400 text-xs my-6">
            {t('home.learnNow')} (Test)
          </Divider>

          <div className="grid grid-cols-2 gap-4">
            <Button
              icon={<UserOutlined />}
              onClick={() => handleQuickLogin('student')}
              className="h-12 border-slate-200 hover:border-blue-500 hover:text-blue-600 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              disabled={isLoading}
            >
              {t('dashboard.roleStudent')}
            </Button>
            <Button
              icon={<SafetyOutlined />}
              onClick={() => handleQuickLogin('admin')}
              className="h-12 border-slate-200 hover:border-amber-500 hover:text-amber-600 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              disabled={isLoading}
            >
              {t('dashboard.roleAdmin')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
