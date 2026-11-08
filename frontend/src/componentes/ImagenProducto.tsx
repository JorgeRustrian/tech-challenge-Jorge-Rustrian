import { useState } from 'react';
import { IconoBolsa } from './Iconos';
import css from './ImagenProducto.module.css';

interface Props {
  url: string | null;
  alt: string;
  className?: string;
  prioridad?: boolean;
}

export function ImagenProducto({ url, alt, className, prioridad }: Props) {
  const [fallo, setFallo] = useState<string | null>(null);

  if (!url || fallo === url) {
    return (
      <div
        className={`${css.marco} ${css.sinImagen} ${className ?? ''}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <IconoBolsa width={28} height={28} />
      </div>
    );
  }

  return (
    <div className={`${css.marco} ${className ?? ''}`}>
      <img
        src={url}
        alt={alt}
        loading={prioridad ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFallo(url)}
      />
    </div>
  );
}
