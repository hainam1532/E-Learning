import { useState, useEffect } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import i18n from '../utils/i18n';

const languages = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function LanguageSelector() {
  const [currentLang, setCurrentLang] = useState(
    languages.find((l) => l.code === i18n.language) || languages[0]
  );

  useEffect(() => {
    const handleLangChange = (lang: string) => {
      setCurrentLang(languages.find((l) => l.code === lang) || languages[0]);
    };

    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);

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
        {/* <span className="text-xs">{currentLang.code.toUpperCase()}</span> */}
      </button>
    </Dropdown>
  );
}