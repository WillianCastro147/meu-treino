'use client';

import { useEffect, useState } from 'react';
import { INERT_REGIONS } from '@/lib/muscles';

// Desenho do corpo (frente e costas) com cada músculo pintado de azul conforme o nível 0–4.
// A geometria (~42 KB, MuscleMap MIT) só é baixada quando um mapa aparece na tela.

let cache = null;
let pending = null;

function useBodyPaths() {
  const [paths, setPaths] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    pending =
      pending ||
      fetch('/body/muscle-paths.json')
        .then((r) => r.json())
        .then((j) => (cache = j));
    pending.then((p) => alive && setPaths(p)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return paths;
}

const FILL = ['#2c2c2e', 'rgba(59,130,246,0.35)', 'rgba(59,130,246,0.55)', 'rgba(59,130,246,0.8)', '#3b82f6'];

function View({ view, levels }) {
  return (
    <svg viewBox={view.vb} className="body-view" role="img">
      {Object.entries(view.p).map(([slug, list]) =>
        list.map((d, i) => (
          <path
            key={slug + i}
            d={d}
            fill={INERT_REGIONS.includes(slug) ? '#48484a' : FILL[levels[slug] || 0]}
            stroke="#000"
            strokeWidth="2"
          />
        ))
      )}
    </svg>
  );
}

export default function BodyMap({ levels = {} }) {
  const paths = useBodyPaths();
  return (
    <div className="body-map">
      {paths ? (
        <>
          <View view={paths.front} levels={levels} />
          <View view={paths.back} levels={levels} />
        </>
      ) : null}
    </div>
  );
}
