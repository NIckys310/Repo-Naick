import { handleSearch } from './_youtube.js';

// Función de Vercel: GET /api/search?q=texto
export function GET(request: Request): Promise<Response> {
  return handleSearch(request, process.env.YOUTUBE_API_KEY);
}
