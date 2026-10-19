# GCS Voicebot Demo

Landing page estática para que un visitante hable en vivo con un agente de voz de
ElevenLabs embebido en la página, sin llamada telefónica real. Inspirada en el
patrón de demo.kleva.co.

Stack: HTML + CSS + JS puro. Sin build, sin frameworks.

## Archivos

- `index.html` — estructura de la página, incluye las 3 tabs de agentes con sus `agent-id`.
- `styles.css` — estilos (dark mode).
- `script.js` — selector de agentes (monta/desmonta `<elevenlabs-convai>` dinámicamente) +
  mensaje de estado del permiso de micrófono.

## Selector de agentes (3 demos en vivo)

La página tiene 3 tabs, cada una con su propio agente de ElevenLabs. Solo hay un
`<elevenlabs-convai>` montado en el DOM a la vez — `script.js` lo destruye y crea uno
nuevo al cambiar de tab, así no quedan 3 widgets conectados en paralelo (consumiría
recursos y pediría/mantendría el micrófono de más).

Agentes configurados en `index.html` (atributo `data-agent-id` de cada `.agent-tab`):

| Tab | agent-id | Descripción |
|---|---|---|
| Clara | `agent_3001m236q168e24994skx7wskf5w` | Acompañante — agente conversacional de compañía |
| RRHH | `agent_0901kbgae1pse21tqa2b10w5mxs9` | Asistente de voz para procesos de Recursos Humanos |
| Alteor | `agent_4401krgvqay1ef38gw40payzz1rr` | Agente de voz para la empresa Alteor |

Para agregar, sacar o reordenar agentes, editá los botones `.agent-tab` dentro de
`#widget` en `index.html` (cada uno lleva `data-agent-id` y `data-agent-name`) — no
hace falta tocar `script.js`, lee esos atributos directamente.

**Cada agente necesita autenticación deshabilitada en ElevenLabs** (panel del agente
→ pestaña **Advanced** → "Enable authentication: off" / "Allow unauthenticated access"
según la versión del panel). Si no está deshabilitada, el widget público no va a poder
conectarse desde esta página sin backend.

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
