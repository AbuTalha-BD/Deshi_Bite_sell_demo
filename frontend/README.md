# DESHI BITE - Frontend (Next.js)

Standalone Next.js frontend matching your exact `package.json` specifications with Next 16, React 19, HeroUI, Better Auth, Stripe, Swiper, and TailwindCSS.

## Getting Started

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Set `NEXT_PUBLIC_API_URL` to your backend URL (e.g. `http://localhost:5000` or your deployed backend on Render/Railway/VPS).

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build for Production / Vercel:
   ```bash
   npm run build
   npm start
   ```
