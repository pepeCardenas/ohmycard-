# OhMyCard!!

Web app para el celular (PWA, se instala como una app nativa) para coleccionar cartas de Pokémon TCG.
Cada persona tiene su cuenta (mail y contraseña) y sus binders se guardan en la nube.

## Funciones

- **Binder 3x3**: páginas de 9 casilleros que se pasan deslizando. Toca un casillero vacío para buscar una carta oficial o subir una foto.
- **Cartas oficiales**: búsqueda por nombre en 11 idiomas o en "Cualquier idioma" a la vez con la API gratuita de [TCGdex](https://tcgdex.dev). El nombre del Pokémon se traduce solo: "Sylveon" encuentra ニンフィア en japonés (nombres del paquete [pokemon](https://github.com/sindresorhus/pokemon), MIT).
- **Detalle y precio**: al tocar una carta oficial ves su información y el precio estimado en Cardmarket (EUR) y TCGplayer (USD).
- **Compartir**: el botón ⤴ arriba arma una imagen de la página actual y abre el menú de compartir del teléfono (WhatsApp, Instagram, etc.) o la guarda.
- **Varios binders**: toca el nombre del binder para crear, renombrar, borrar o cambiar de colección.
- **Cuentas**: registro e inicio de sesión con mail y contraseña.
- **Importar**: si usaste la versión anterior (que guardaba todo en el teléfono), la app ofrece pasar esas cartas a tu cuenta.

## Tecnología

- [Next.js](https://nextjs.org) desplegado en [Vercel](https://vercel.com).
- Base de datos [Turso](https://turso.tech) (SQLite) con [Drizzle ORM](https://orm.drizzle.team). Las tablas se crean solas la primera vez que arranca la app (`drizzle/`).
- Cuentas con [Better Auth](https://www.better-auth.com). Las contraseñas se guardan cifradas en la base.
- Fotos en [Vercel Blob](https://vercel.com/docs/vercel-blob). Si no está configurado, se guardan en la base.

## Variables de entorno

| Variable | Para qué | Dónde se consigue |
| --- | --- | --- |
| `DATABASE_URL` | Dirección de una base **fija** de Turso (`libsql://...`) | Panel de Turso → tu base → Connect |
| `DATABASE_AUTH_TOKEN` | Token de acceso a esa base | Panel de Turso → tu base → Create token |
| `BETTER_AUTH_SECRET` | Clave para firmar las sesiones (32+ caracteres al azar) | Generarla con `openssl rand -base64 32` o en https://www.better-auth.com/docs/installation |
| `BETTER_AUTH_URL` | Dirección pública de la app (opcional en Vercel: si falta, se usa la de producción) | Vercel → tu proyecto → Domains |
| `TRUSTED_ORIGINS` | Otras direcciones desde las que se puede iniciar sesión, separadas por coma (opcional) | Por ejemplo, un dominio propio |
| `BLOB_READ_WRITE_TOKEN` | Guardar fotos en Vercel Blob (opcional) | Se agrega sola al crear un Blob Store en Vercel → Storage |

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar BETTER_AUTH_SECRET; sin Turso usa un archivo local.db
npm run dev
```

> La integración de Turso en Vercel carga `TURSO_DATABASE_URL` con una base nueva por cada deploy (host `dpl-...`), así que las cuentas se pierden en cada deploy. Usá `DATABASE_URL` y `DATABASE_AUTH_TOKEN` con una base fija; tienen prioridad sobre `TURSO_*`. `/api/health` muestra qué base usa cada deploy.
