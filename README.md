# Ceuta nos une

Web de la convocatoria del **2 de septiembre**: mapa y listado de lugares, formulario para
proponer lugares nuevos y muro donde dejar mensajes de apoyo con foto.

Todo corre sobre Cloudflare, en un único Worker.

- **En producción:** https://ceuta-nos-une.andresleontest.workers.dev
- **Panel de revisión:** https://ceuta-nos-une.andresleontest.workers.dev/admin

## Cómo se publica cada cosa

| | Quién lo envía | Cuándo aparece |
|---|---|---|
| **Lugares** | Cualquiera, desde el formulario | Solo tras aprobarlos en `/admin`. Además llega un aviso por correo |
| **Mensajes del muro** | Cualquiera | Al momento, sin revisión previa. Se pueden ocultar o borrar desde `/admin` |
| **Fotos** | Adjuntas al mensaje | Al momento. Van a R2 y quedan enlazadas a su mensaje |

## Piezas

| Pieza | Para qué |
|---|---|
| Worker (`src/`) | Sirve la web y la API en el mismo origen |
| D1 `ceuta-nos-une` | Lugares, mensajes, ajustes y registro de avisos por correo |
| R2 `ceuta-nos-une-fotos` | Fotos del muro |
| Rate limiting | Frena el spam: 4 mensajes, 3 lugares y 5 intentos de acceso por minuto e IP |
| Assets estáticos (`public/`) | Portada, panel, CSS, JS y Leaflet |

El mapa usa OpenStreetMap. Las teselas **no** van directas al servidor de OSM: pasan por
`/tiles/*` en el Worker, que las cachea en el borde de Cloudflare. Así se aguanta un pico de
visitas sin castigar a OSM ni depender de ninguna clave de terceros.

## Trabajar en local

```bash
npm install
cp .dev.vars.example .dev.vars          # y rellena ADMIN_PASSWORD, SESSION_SECRET, IP_SALT
npm run db:local                        # crea las tablas y mete datos de ejemplo
npm run dev                             # http://127.0.0.1:8787
```

## Desplegar

```bash
npm run deploy
npm run db:remote                       # solo si hay migraciones nuevas
```

## Ajustes que se cambian sin tocar código

Están en la tabla `settings` y se editan desde **`/admin` → Ajustes**:

| Clave | Qué controla |
|---|---|
| `notify_email` | **Correo que recibe el aviso de cada lugar propuesto** |
| `contact_email` | Correo de contacto que sale en el pie de la web |
| `event_date` | Fecha del acto (`AAAA-MM-DD`). Manda en la cuenta atrás |
| `event_label` | La fecha en texto para la portada |
| `site_title`, `site_claim` | Título y lema |
| `places_open`, `messages_open` | `1` o `0` para abrir o cerrar cada formulario |

## Secretos

Se cargan con `npx wrangler secret put NOMBRE`:

| Secreto | Obligatorio | Para qué |
|---|---|---|
| `ADMIN_PASSWORD` | Sí | Entrar en `/admin` |
| `SESSION_SECRET` | Sí | Firma la cookie de sesión del panel |
| `IP_SALT` | Sí | Anonimiza las IP antes de guardarlas |
| `RESEND_API_KEY` | No | Envía de verdad el aviso por correo. Sin esta clave el aviso queda registrado en D1 y visible en `/admin`, pero no sale ningún correo |
| `RESEND_FROM` | No | Remitente, p. ej. `Ceuta nos une <avisos@tudominio.es>` |
| `TURNSTILE_SECRET_KEY` + `TURNSTILE_SITE_KEY` | No | Activan el anti-bot de Cloudflare en los dos formularios. Si no están, el widget ni aparece |

### Activar el correo de aviso

1. Crea una cuenta en [resend.com](https://resend.com) (3.000 correos/mes gratis).
2. `npx wrangler secret put RESEND_API_KEY` y pega la clave.
3. Sin dominio propio verificado, Resend solo deja enviar desde `onboarding@resend.dev` y
   **únicamente a la dirección con la que te registraste**: pon esa dirección en `notify_email`.
   Con un dominio verificado en Resend puedes enviar a cualquier destinatario y cambiar
   `RESEND_FROM`.

## Cambiar los datos de ejemplo por los reales

Los lugares de muestra están marcados en `notes`. Se pueden borrar de golpe:

```bash
npx wrangler d1 execute ceuta-nos-une --remote \
  --command "DELETE FROM places WHERE notes LIKE 'EJEMPLO%'; DELETE FROM messages WHERE body LIKE 'EJEMPLO%';"
```

Los reales se pueden meter por el formulario público (y aprobarlos), o directamente por SQL.

## Decisiones que conviene conocer

- **Nada de `innerHTML`.** Todo lo que escribe la gente se pinta con `textContent`, porque los
  mensajes se publican sin revisar. Está comprobado con etiquetas `<script>` reales.
- **Las imágenes se comprueban por sus bytes**, no por el `content-type` que declara el
  navegador, y se sirven con `Content-Security-Policy: sandbox` para que nada se ejecute.
- **No se guarda ninguna IP en claro**, solo un hash con sal, para poder frenar abusos.
- **Las fotos se reducen en el propio móvil** antes de subirlas (máx. 1600 px), lo que ahorra
  datos a quien publica.
- **El aviso por correo se registra siempre en D1**, se consiga enviar o no: ninguna propuesta
  se pierde por un fallo del proveedor de correo.
