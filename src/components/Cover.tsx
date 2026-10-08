import { useState } from 'react';
import { initials } from '../lib/format';
import { thumbnailOf } from '../player/youtubeApi';

/** Tonos de las carátulas de relleno, tomados de la referencia. */
const FALLBACK_TONES = ['#7a0a06', '#0a0a0a', '#3a3a3a', '#ff5a52'];

function toneOf(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return FALLBACK_TONES[sum % FALLBACK_TONES.length] ?? '#3a3a3a';
}

interface CoverProps {
  song: { id: string; title: string; videoId: string };
  className?: string;
}

/** Carátula: la miniatura del video o, si no hay, un bloque de color con las iniciales. */
export function Cover({ song, className = '' }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const src = thumbnailOf(song.videoId);
  if (src === '' || failed) {
    return (
      <span className={`cover cover-fallback ${className}`} style={{ background: toneOf(song.id) }} aria-hidden="true">
        {initials(song.title)}
      </span>
    );
  }
  return (
    <img
      className={`cover ${className}`}
      src={src}
      alt=""
      width={320}
      height={180}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
