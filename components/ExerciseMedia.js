'use client';

import { findExercise } from '@/lib/catalog';

// Animação do exercício: vídeo em loop (catálogo novo) ou GIF/WebP (exercícios antigos).
// `ex` pode ser o exercício do catálogo ou o salvo numa rotina/treino.
export default function ExerciseMedia({ ex, alt = '', className }) {
  const cat = findExercise(ex) || ex;
  if (cat?.clip) {
    return (
      <video
        className={className}
        src={cat.clip}
        poster={cat.gif}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  }
  return cat?.gif ? <img className={className} src={cat.gif} alt={alt} /> : null;
}
