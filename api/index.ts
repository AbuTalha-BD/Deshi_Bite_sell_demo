import type { Request, Response } from 'express';
import { createExpressApp } from '../server.ts';

// Mark Vercel runtime environment
process.env.VERCEL = '1';

let cachedApp: any = null;

export default async function handler(req: Request, res: Response) {
  // Always attach CORS headers for cross-origin or client fetch compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!cachedApp) {
      cachedApp = await createExpressApp();
    }

    // 1. Extract endpoint from rewrite query if present (destination: /api?endpoint=$1)
    let endpoint = '';
    if (req.query && req.query.endpoint !== undefined) {
      const raw = req.query.endpoint;
      endpoint = Array.isArray(raw) ? raw.join('/') : String(raw);
      endpoint = endpoint.split('?')[0];
    }

    // 2. Check various headers that Vercel or proxies might set
    const originalUri =
      (req.headers['x-matched-path'] as string) ||
      (req.headers['x-vercel-original-uri'] as string) ||
      (req.headers['x-original-url'] as string) ||
      (req.headers['x-rewrite-url'] as string) ||
      '';

    let pathPart = '';
    if (endpoint) {
      pathPart = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    } else if (originalUri && originalUri.includes('/api/')) {
      pathPart = originalUri.substring(originalUri.indexOf('/api/') + 4);
      pathPart = pathPart.split('?')[0];
    } else if (req.url && req.url.includes('/api/')) {
      pathPart = req.url.substring(req.url.indexOf('/api/') + 4);
      pathPart = pathPart.split('?')[0];
    } else if (req.url && req.url !== '/' && req.url !== '/api' && !req.url.startsWith('/api?')) {
      pathPart = req.url.split('?')[0];
    }

    if (pathPart && !pathPart.startsWith('/')) {
      pathPart = `/${pathPart}`;
    }

    // Preserve query parameters except the internal 'endpoint'
    let queryString = '';
    const qIndex = req.url.indexOf('?');
    if (qIndex !== -1) {
      const searchParams = new URLSearchParams(req.url.slice(qIndex + 1));
      searchParams.delete('endpoint');
      const qs = searchParams.toString();
      if (qs) queryString = `?${qs}`;
    }

    // Normalize req.url and req.originalUrl so Express routing works whether matched on '/api' or '/'
    const finalPath = pathPart ? `/api${pathPart}${queryString}` : `/api${queryString}`;
    req.url = finalPath;
    (req as any).originalUrl = finalPath;

    return cachedApp(req, res);
  } catch (err: any) {
    console.error('Serverless invocation error:', err);
    return res.status(500).json({ error: 'Server initialization error', details: err?.message || String(err) });
  }
}

