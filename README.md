# OhMyCard!!

Web app para el celular (PWA, se instala como una app nativa) para coleccionar cartas de Pokémon TCG.

## Funciones

- **Binder 3x3**: páginas de 9 casilleros que se pasan deslizando. Toca un casillero vacío para subir una o varias fotos de tus cartas. Toca una carta para verla en grande, moverla a otro casillero, cambiar la foto o quitarla.
- Todo se guarda en el propio teléfono (IndexedDB). No hace falta cuenta ni servidor.
- Funciona sin conexión una vez instalada.

### Próximamente

1. Buscar cartas oficiales (API de pokemontcg.io) y tener varias colecciones.
2. Precios de TCGplayer y Cardmarket.
3. Cartas personalizadas generadas con IA.

## Instalar en el celular

Abre la página publicada y:

- **Android (Chrome)**: menú ⋮ → "Instalar app" o "Agregar a la pantalla principal".
- **iPhone (Safari)**: botón Compartir → "Agregar a inicio".

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # versión de producción en dist/
```

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`
(requiere activar Pages con origen "GitHub Actions" en Settings → Pages).
