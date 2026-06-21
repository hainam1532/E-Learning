import { Dropdown, type MenuProps } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import i18n from '../utils/i18n';

const languages = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function LanguageSelector() {
  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleChangeLanguage: MenuProps['onClick'] = ({ key }) => {
    i18n.changeLanguage(key as string);
  };

  const menuItems: MenuProps['items'] = languages.map((lang) => ({
    key: lang.code,
    label: (
      <div className="flex items-center gap-2">
        <span className="text-lg">{lang.flag}</span>
        <span>{lang.name}</span>
      </div>
    ),
  }));

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleChangeLanguage }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        aria-label="Change language"
      >
        <GlobalOutlined />
        <span>{currentLang.flag}</span>
      </button>
    </Dropdown>
  );
}
