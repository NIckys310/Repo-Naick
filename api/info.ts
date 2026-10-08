import { handleInfo } from './_youtube.js';

// Función de Vercel: GET /api/info?id=VIDEO_ID
export function GET(request: Request): Promise<Response> {
  return handleInfo(request, process.env.YOUTUBE_API_KEY);
}
