/** Cliente del backend propio (/api). La clave de YouTube vive en el servidor, nunca aquí. */

export interface VideoResult {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number;
  thumbnail: string;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

async function request<T>(path: string, pick: (body: Record<string, unknown>) => T, signal?: AbortSignal): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, { signal });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        code: typeof body.error === 'string' ? body.error : 'unknown',
        message: typeof body.message === 'string' ? body.message : 'El servidor no respondió bien. Intenta de nuevo.',
      };
    }
    return { ok: true, data: pick(body) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, code: 'aborted', message: '' };
    }
    return { ok: false, code: 'network', message: 'No hay conexión con el servidor. Revisa tu internet.' };
  }
}

/** Busca canciones por nombre. Necesita YOUTUBE_API_KEY en el servidor. */
export function searchYouTube(query: string, signal?: AbortSignal): Promise<ApiResponse<VideoResult[]>> {
  return request(`/api/search?q=${encodeURIComponent(query)}`, (body) => (body.results as VideoResult[]) ?? [], signal);
}

/** Datos de un video a partir de su id (sirve aunque no haya clave). */
export function fetchVideoInfo(videoId: string, signal?: AbortSignal): Promise<ApiResponse<VideoResult>> {
  return request(`/api/info?id=${encodeURIComponent(videoId)}`, (body) => body.result as VideoResult, signal);
}

/** Dice si el backend está vivo y si tiene la clave configurada. */
export function fetchHealth(): Promise<ApiResponse<{ youtubeKey: boolean }>> {
  return request('/api/health', (body) => ({ youtubeKey: body.youtubeKey === true }));
}

/** Miniatura de un video (o cadena vacía si la canción no tiene video). */
export function thumbnailOf(videoId: string): string {
  return videoId === '' ? '' : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
