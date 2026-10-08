/**
 * BACKEND: lógica compartida de las funciones de Vercel.
 *
 * El navegador nunca ve la clave de YouTube: llama a /api/search o /api/info, y estas
 * funciones hablan con la YouTube Data API v3 usando la variable de entorno YOUTUBE_API_KEY.
 * El archivo empieza con "_" para que Vercel no lo publique como una ruta.
 */

export interface VideoResult {
  videoId: string;
  /** Título tal como aparece en YouTube (el navegador lo limpia y separa el artista). */
  title: string;
  channel: string;
  /** Segundos. 0 si no se pudo saber (sin clave): el reproductor lo completa al cargar. */
  durationSeconds: number;
  thumbnail: string;
}

const API = 'https://www.googleapis.com/youtube/v3';
const VIDEO_ID = /^[\w-]{11}$/;

/** Respuesta JSON. `cacheSeconds` deja que la red de Vercel guarde respuestas repetidas. */
export function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds > 0 ? `public, s-maxage=${cacheSeconds}, max-age=300` : 'no-store',
    },
  });
}

/** "PT4M13S" a segundos. */
function isoToSeconds(iso: string): number {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}

/** Solo se aceptan llamadas hechas desde la propia página (evita que otros sitios gasten la cuota). */
function isSameSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}

interface ApiVideo {
  id: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
}

function toResult(video: ApiVideo): VideoResult {
  const thumbnails = video.snippet?.thumbnails ?? {};
  return {
    videoId: video.id,
    title: video.snippet?.title ?? 'Sin título',
    channel: video.snippet?.channelTitle ?? '',
    durationSeconds: isoToSeconds(video.contentDetails?.duration ?? ''),
    thumbnail: thumbnails.medium?.url ?? thumbnails.default?.url ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
  };
}

/** Pide a YouTube los datos completos de varios videos (título, canal y duración). */
async function fetchVideos(ids: string, apiKey: string): Promise<ApiVideo[] | { error: Response }> {
  const params = new URLSearchParams({ part: 'snippet,contentDetails,status', id: ids, key: apiKey });
  const response = await fetch(`${API}/videos?${params}`);
  if (!response.ok) return { error: await upstreamError(response) };
  const data = (await response.json()) as { items?: ApiVideo[] };
  return data.items ?? [];
}

/** Traduce los errores de YouTube a mensajes claros, sin filtrar detalles internos. */
async function upstreamError(response: Response): Promise<Response> {
  let reason = '';
  try {
    const data = (await response.json()) as { error?: { errors?: { reason?: string }[] } };
    reason = data.error?.errors?.[0]?.reason ?? '';
  } catch {
    // La respuesta no era JSON: se usa el mensaje genérico.
  }
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return json({ error: 'quota', message: 'Se agotó la cuota diaria de búsquedas de YouTube. Pega el enlace del video.' }, 429);
  }
  if (response.status === 400 || response.status === 403) {
    return json({ error: 'bad_key', message: 'La clave de YouTube no es válida o no tiene habilitada la YouTube Data API v3.' }, 502);
  }
  return json({ error: 'upstream', message: 'YouTube no respondió. Intenta de nuevo.' }, 502);
}

/** GET /api/search?q=texto : busca videos de música que se puedan insertar. */
export async function handleSearch(request: Request, apiKey: string | undefined): Promise<Response> {
  if (!isSameSite(request)) return json({ error: 'forbidden', message: 'Origen no permitido.' }, 403);
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (query.length < 2 || query.length > 100) {
    return json({ error: 'bad_query', message: 'Escribe entre 2 y 100 caracteres.' }, 400);
  }
  if (!apiKey) {
    return json({ error: 'missing_key', message: 'La búsqueda por nombre necesita la clave YOUTUBE_API_KEY. Mientras tanto, pega el enlace del video.' }, 503);
  }
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoCategoryId: '10',
      maxResults: '8',
      q: query,
      key: apiKey,
    });
    const response = await fetch(`${API}/search?${params}`);
    if (!response.ok) return await upstreamError(response);
    const data = (await response.json()) as { items?: { id?: { videoId?: string } }[] };
    const ids = (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return json({ results: [] }, 200, 3600);

    const videos = await fetchVideos(ids.join(','), apiKey);
    if ('error' in videos) return videos.error;
    const results = videos.filter((video) => video.status?.embeddable !== false).map(toResult);
    return json({ results }, 200, 86400);
  } catch {
    return json({ error: 'network', message: 'No se pudo conectar con YouTube.' }, 502);
  }
}

/** GET /api/info?id=VIDEO_ID : datos de un video. Sin clave usa oEmbed (no trae la duración). */
export async function handleInfo(request: Request, apiKey: string | undefined): Promise<Response> {
  if (!isSameSite(request)) return json({ error: 'forbidden', message: 'Origen no permitido.' }, 403);
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!VIDEO_ID.test(id)) return json({ error: 'bad_id', message: 'El enlace no es de un video de YouTube.' }, 400);
  try {
    if (apiKey) {
      const videos = await fetchVideos(id, apiKey);
      if (!('error' in videos)) {
        const video = videos[0];
        if (!video) return json({ error: 'not_found', message: 'Ese video no existe o es privado.' }, 404);
        if (video.status?.embeddable === false) {
          return json({ error: 'not_embeddable', message: 'El dueño del video no permite reproducirlo fuera de YouTube.' }, 422);
        }
        return json({ result: toResult(video) }, 200, 86400);
      }
      // Si la clave falla, se intenta igual con oEmbed para no bloquear al usuario.
    }
    const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);
    const response = await fetch(`https://www.youtube.com/oembed?url=${watchUrl}&format=json`);
    if (response.status === 401 || response.status === 403) {
      return json({ error: 'not_embeddable', message: 'El dueño del video no permite reproducirlo fuera de YouTube.' }, 422);
    }
    if (!response.ok) return json({ error: 'not_found', message: 'Ese video no existe o es privado.' }, 404);
    const data = (await response.json()) as { title?: string; author_name?: string };
    const result: VideoResult = {
      videoId: id,
      title: data.title ?? 'Sin título',
      channel: data.author_name ?? '',
      durationSeconds: 0,
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    };
    return json({ result }, 200, 86400);
  } catch {
    return json({ error: 'network', message: 'No se pudo conectar con YouTube.' }, 502);
  }
}

/** GET /api/health : dice si el backend está vivo y si tiene la clave configurada. */
export function handleHealth(apiKey: string | undefined): Response {
  return json({ ok: true, youtubeKey: Boolean(apiKey) });
}
