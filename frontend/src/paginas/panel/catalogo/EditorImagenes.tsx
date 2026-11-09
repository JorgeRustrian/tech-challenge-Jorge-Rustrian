import { useState, type FormEvent } from 'react';
import { Boton } from '../../../componentes/Boton';
import { ImagenProducto } from '../../../componentes/ImagenProducto';
import css from './Catalogo.module.css';

export const MAXIMO_IMAGENES = 10;

function urlValida(texto: string): boolean {
  try {
    const url = new URL(texto);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

interface Props {
  urls: string[];
  alCambiar: (urls: string[]) => void;
  soloLectura?: boolean;
}

// Las imágenes son direcciones web; la primera es la que se muestra en el catálogo.
export function EditorImagenes({ urls, alCambiar, soloLectura }: Props) {
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);

  function agregar(e: FormEvent) {
    e.preventDefault();
    const url = nueva.trim();
    if (!urlValida(url)) setError('Pegue una dirección completa que empiece con https://');
    else if (url.length > 500) setError('La dirección no puede pasar de 500 caracteres.');
    else if (urls.includes(url)) setError('Esa imagen ya está en la lista.');
    else {
      alCambiar([...urls, url]);
      setNueva('');
      setError(null);
    }
  }

  function mover(desde: number, hacia: number) {
    const copia = [...urls];
    const [url] = copia.splice(desde, 1);
    copia.splice(hacia, 0, url);
    alCambiar(copia);
  }

  return (
    <div className={css.imagenes}>
      {urls.length === 0 ? (
        <p className={css.secundario}>Sin imágenes. En la tienda se mostrará un recuadro gris.</p>
      ) : (
        <ol className={css.galeria}>
          {urls.map((url, i) => (
            <li key={url}>
              <ImagenProducto url={url} alt={`Imagen ${i + 1}`} className={css.imagenGaleria} />
              <p className={css.pieImagen}>
                {i === 0 ? <strong>Principal</strong> : `Imagen ${i + 1}`}
                <a href={url} target="_blank" rel="noreferrer" title={url}>
                  Abrir
                </a>
              </p>
              {!soloLectura && (
                <div className={css.accionesFila}>
                  <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Mover la imagen ${i + 1} antes`}>
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, i + 1)}
                    disabled={i === urls.length - 1}
                    aria-label={`Mover la imagen ${i + 1} después`}
                  >
                    →
                  </button>
                  <button type="button" className={css.peligro} onClick={() => alCambiar(urls.filter((u) => u !== url))}>
                    Quitar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!soloLectura &&
        (urls.length < MAXIMO_IMAGENES ? (
          // Es un formulario aparte para que Enter agregue la imagen en lugar de guardar el producto.
          <form className={css.agregarImagen} onSubmit={agregar} noValidate>
            <label>
              <span>Agregar imagen por dirección web</span>
              <input
                type="url"
                value={nueva}
                placeholder="https://…"
                aria-invalid={error ? true : undefined}
                onChange={(e) => setNueva(e.target.value)}
              />
            </label>
            <Boton type="submit" variante="secundario" chico>
              Agregar
            </Boton>
            {error && <p className={css.error}>{error}</p>}
          </form>
        ) : (
          <p className={css.secundario}>Llegó al máximo de {MAXIMO_IMAGENES} imágenes.</p>
        ))}
    </div>
  );
}
