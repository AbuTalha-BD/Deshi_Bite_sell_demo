import type { Request, Response } from 'express';
import { createExpressApp } from '../server';

let cachedApp: any = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!cachedApp) {
      cachedApp = await createExpressApp();
    }

    // Restore request URL if rewritten by Vercel
    const xMatchedPath = (req.headers['x-matched-path'] as string) || '';
    const originalUrl = (req.headers['x-original-url'] as string) || (req.headers['x-forwarded-uri'] as string) || '';
    let query0 = (req as any).query?.['0'] || (req as any).query?.path;

    if (!query0 && req.url) {
      try {
        const u = new URL(req.url, 'http://localhost');
        query0 = u.searchParams.get('0');
      } catch {
        // ignore
      }
    }

    if (xMatchedPath && xMatchedPath.startsWith('/api')) {
      req.url = xMatchedPath;
    } else if (originalUrl && originalUrl.startsWith('/api')) {
      req.url = originalUrl;
    } else if (query0) {
      const clean = Array.isArray(query0) ? query0.join('/') : String(query0);
      req.url = `/api/${clean.replace(/^\//, '')}`;
    }

    return new Promise<void>((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', (err) => {
        console.error('[Vercel Serverless Stream Error]:', err);
        resolve();
      });

      cachedApp(req, res, (err: any) => {
        if (err) {
          console.error('[Unhandled Express Error in Serverless Handler]:', err);
          if (!res.headersSent) {
            res.statusCode = typeof err.status === 'number' ? err.status : 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal server error occurred', success: false }));
          }
        }
        resolve();
      });
    });
  } catch (fatalErr: any) {
    console.error('[Fatal Serverless Exception]:', fatalErr);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: fatalErr?.message || 'Server initialization error', success: false }));
    }
  }
}

