import { Request, Response, NextFunction } from 'express';
import { translate, TranslationKeys } from '../locales';

declare global {
  namespace Express {
    interface Request {
      language: string;
      t: (key: TranslationKeys) => string;
    }
  }
}

export const i18nMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const langHeader = req.headers['accept-language'] || 'vi';
  const queryLang = req.query.lang as string;
  
  // Lấy ngôn ngữ từ query param hoặc header
  const lang = queryLang || (typeof langHeader === 'string' ? langHeader : 'vi');

  req.language = lang;
  req.t = (key: TranslationKeys) => translate(key, lang);

  next();
};
export default i18nMiddleware;
