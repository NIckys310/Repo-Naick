import { handleHealth } from './_youtube.js';

// Función de Vercel: GET /api/health
export function GET(): Response {
  return handleHealth(process.env.YOUTUBE_API_KEY);
}
