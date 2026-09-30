import { Request, Response, NextFunction } from 'express';

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.get('X-User-Id');
  const userId = Number(header);

  if (
    !header ||
    header.trim() === '' ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    res.status(401).json({ error: 'A valid X-User-Id header is required' });
    return;
  }

  res.locals.userId = userId;
  next();
}

export default authMiddleware;
