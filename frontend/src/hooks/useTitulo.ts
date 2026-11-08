import { useEffect } from 'react';

export function useTitulo(titulo: string | undefined): void {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ShopCart` : 'ShopCart';
  }, [titulo]);
}
