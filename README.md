# GCS Voicebot Demo

Landing page estática para que un visitante hable en vivo con un agente de voz de
ElevenLabs embebido en la página, sin llamada telefónica real. Inspirada en el
patrón de demo.kleva.co.

Stack: HTML + CSS + JS puro. Sin build, sin frameworks.

## Archivos

- `index.html` — estructura de la página.
- `styles.css` — estilos (dark mode).
- `script.js` — mensaje de estado del permiso de micrófono.

## Configurar el agente real

1. Abrí `index.html` y buscá esta línea:

   ```html
   <elevenlabs-convai agent-id="AGENT_ID_PLACEHOLDER"></elevenlabs-convai>
   ```

   Reemplazá `AGENT_ID_PLACEHOLDER` por el `agent-id` real de tu agente en
   ElevenLabs Conversational AI.

2. En el panel de ElevenLabs, abrí el agente → pestaña **Advanced** → deshabilitá
   la autenticación (**Enable authentication: off** / "Allow unauthenticated
   access" según la versión del panel). Si no hacés esto, el widget público no
   va a poder conectarse desde una página sin backend.

## Ocultar el branding "Powered by ElevenLabs"

El código de `styles.css` intenta esconder el badge vía `::part()`:

```css
elevenlabs-convai::part(badge),
elevenlabs-convai::part(watermark),
elevenlabs-convai::part(powered-by) {
  display: none !important;
}
```

**Esto es best-effort.** El widget vive en shadow DOM y ElevenLabs no garantiza
que esas partes estén expuestas ni que los nombres (`badge`, `watermark`,
`powered-by`) coincidan con los reales — hay que inspeccionar el DOM renderizado
del widget en el navegador (DevTools → buscar `::part` o atributos `part=` dentro
del shadow root) y ajustar los selectores si hace falta.

**La vía confiable** es la que ofrece ElevenLabs desde su plataforma: en planes
pagos (a partir de Business/Scale según el momento en que lo estés leyendo) hay
una opción para quitar el badge "Powered by ElevenLabs" desde la configuración
del workspace o del agente. Si tu plan no la tiene habilitada, **esto queda
pendiente de resolver por ese lado** — no es un bug de esta página, es una
limitación del plan.

## Deploy

Es un sitio 100% estático. Cualquiera de estas opciones sirve:

### Opción A — GitHub Pages
```bash
git init
git add .
git commit -m "Demo landing de voicebots GCS"
git branch -M main
git remote add origin <tu-repo>
git push -u origin main
# Activar GitHub Pages en Settings → Pages → Branch: main → / (root)
```

### Opción B — Netlify / Vercel (drag & drop o CLI)
Subí la carpeta tal cual (no necesita build step). En Vercel/Netlify, el
"Build command" queda vacío y el "Output directory" es la raíz del proyecto.

### Opción C — Servidor propio (nginx, el stack de infra de GCS)
Servir la carpeta como estático, igual que cualquier sitio HTML plano. No
requiere Node ni proceso corriendo.

## Notas

- El widget pide permiso de micrófono al usuario; `script.js` solo mejora el
  texto de ayuda mientras ese permiso no fue otorgado — el manejo real del
  permiso lo hace el widget de ElevenLabs internamente.
- Sin librerías externas más allá del script oficial del widget
  (`@elevenlabs/convai-widget-embed`).
