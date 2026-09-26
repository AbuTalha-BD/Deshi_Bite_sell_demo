# DESHI BITE - Backend API Server

This folder contains the standalone backend server for **DESHI BITE**.

## Deployment Options

### Option 1: 1-Click Unified Full-Stack on Vercel (Recommended)
You do **NOT** need to host this backend separately if you deploy to Vercel!
The root project is already pre-configured for Vercel with:
- `vercel.json` rewrites (`/api/(.*)` -> `/api?endpoint=$1`)
- `/api/index.ts` Serverless Function handler
- Automatic state fallback and MongoDB Atlas connectivity

When deploying the root repository to Vercel:
1. Import repository into Vercel.
2. Build command: `vite build` (preset is automatically detected).
3. Output directory: `dist`.
4. (Optional) Set `MONGODB_URI` in Vercel Environment Variables.
5. Deploy! Both frontend and backend work together seamlessly.

---

### Option 2: Standalone Backend Deployment (Render / Railway / VPS / Heroku)
If you want to host the backend separately:
1. Navigate into this `backend` directory:
   ```bash
   cd backend
   npm install
   ```
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
3. Set your `MONGODB_URI` and `PORT`.
4. Run locally:
   ```bash
   npm start
   ```
