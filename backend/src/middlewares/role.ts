import { Request, Response, NextFunction } from 'express';

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: req.t('UNAUTHORIZED') });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    next();
  };
};

export default roleMiddleware;
