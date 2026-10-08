/** Utilidades puras de texto, tiempo y enlaces. No dependen del navegador. */

/** Segundos a "m:ss" (o "h:mm:ss" si pasa de una hora). */
export function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Duración total en lenguaje claro: "43 min" o "1 h 12 min". */
export function formatTotal(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "3:38" o "218" a segundos. Devuelve null si el texto no es una duración válida. */
export function parseDuration(text: string): number | null {
  const clean = text.trim();
  if (/^\d+$/.test(clean)) {
    const seconds = Number(clean);
    return seconds > 0 ? seconds : null;
  }
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(clean);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds > 59 || (match[1] !== undefined && minutes > 59)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** Duración ISO 8601 de la API de YouTube ("PT4M13S") a segundos. */
export function parseIsoDuration(iso: string): number {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}

/** Minúsculas y sin tildes, para comparar textos al buscar. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Iniciales para la carátula de relleno: "Hips Don't Lie" da "HD". */
export function initials(title: string): string {
  const words = title
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  const first = words[0]?.match(/[\p{L}\p{N}]/u)?.[0] ?? '?';
  const second = words[1]?.match(/[\p{L}\p{N}]/u)?.[0] ?? '';
  return (first + second).toUpperCase();
}

/**
 * Dirección de memoria decorativa a partir de un id: "0x" + 4 dígitos hexadecimales.
 * Usa el hash FNV-1a, así que el mismo id siempre da la misma dirección.
 * Es solo visual: en JavaScript no se puede ver la dirección real de un objeto.
 */
export function memoryAddress(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const folded = (hash ^ (hash >>> 16)) & 0xffff;
  return `0x${folded.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Extrae el id de un video a partir de un enlace de YouTube (o de un id suelto). */
export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') candidate = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    else {
      const match = /^\/(?:shorts|embed|live|v)\/([^/?]+)/.exec(url.pathname);
      candidate = match?.[1] ?? null;
    }
  }
  return candidate !== null && /^[\w-]{11}$/.test(candidate) ? candidate : null;
}

/**
 * Limpia el título de un video: quita adornos como "(Official Video)" y separa
 * "Artista - Título". Si no hay guion, el artista es el nombre del canal.
 */
export function splitVideoTitle(rawTitle: string, channel: string): { title: string; artist: string } {
  const cleaned = rawTitle
    .replace(/[([][^)\]]*(official|oficial|video|audio|lyric|letra|4k|hd|remaster|visualizer)[^)\]]*[)\]]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const fallbackArtist = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length >= 2 && parts[0]) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() || cleaned };
  }
  return { title: cleaned || rawTitle, artist: fallbackArtist || 'Artista desconocido' };
}

/** Separa los créditos de una canción: "Shakira ft. Wyclef Jean" da dos artistas. */
export function splitArtists(artist: string): string[] {
  const names = artist
    .split(/\s*(?:,|&|\bft\.?|\bfeat\.?|\bx\b|\by\b)\s*/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return names.filter((name, index) => names.indexOf(name) === index);
}
