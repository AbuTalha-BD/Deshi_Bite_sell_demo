import type { Request, Response } from 'express';
import { createExpressApp } from '../server';

let cachedApp: any = null;

export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    cachedApp = await createExpressApp();
  }
  return cachedApp(req, res);
}
