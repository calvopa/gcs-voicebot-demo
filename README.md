# GCS Voicebot Demo

Landing page estática para que un visitante hable en vivo con un agente de voz de
ElevenLabs embebido en la página, sin llamada telefónica real. Inspirada en el
patrón de demo.kleva.co.

Stack: HTML + CSS + JS puro. Sin build, sin frameworks.

## Archivos

- `index.html` — estructura de la página: tabs de agentes + tarjeta de llamada
  (`.call-card`: orbe, estado, botón único hablar/cortar).
- `styles.css` — estilos (dark mode).
- `script.js` — selector de agentes + control de la llamada vía el SDK de
  ElevenLabs (`@elevenlabs/client`, cargado desde CDN como ES module — por
  eso `index.html` carga el script con `type="module"`).

## Cómo arranca/corta la llamada

**No usa el widget pre-armado `<elevenlabs-convai>`.** Esa versión anterior
vivía en shadow DOM y había que "cazar" sus botones internos por aria-label
para auto-iniciar la llamada, ocultar la ventana visualmente y detectar
cuándo terminaba — frágil: cada agente usaba etiquetas distintas para los
mismos botones ("Cortar"/"Finalizar"/"End"), y en mobile el touch no siempre
llegaba al botón real por el truco de CSS usado para esconder el widget (ver
historial de commits si hace falta ese contexto completo).

El patrón actual — inspirado directo en **demo.kleva.co** — usa el **SDK de
JS de ElevenLabs** (`Conversation.startSession()` / `.endSession()`)
directamente, con un único botón que cambia de estado:

```js
import { Conversation } from "https://cdn.jsdelivr.net/npm/@elevenlabs/client/+esm";

conversation = await Conversation.startSession({
  agentId: currentAgentId,
  onConnect: () => { /* arrancó: cambiar a "Finalizar llamada", iniciar timer */ },
  onDisconnect: () => { /* terminó (sola o por nosotros): volver al estado idle */ },
  onModeChange: (m) => { /* m.mode === "speaking" | "listening" */ },
  onError: (err) => { /* mostrar error, volver a idle */ },
});
// ...
await conversation.endSession();
```

Ventajas sobre el enfoque anterior: cero necesidad de adivinar nada del DOM
interno de un tercero, `endSession()` es un método real (no un click
simulado), y el callback `onModeChange` da el estado real de la conversación
sin tener que leer texto de la pantalla. También resuelve solo el pedido
original de "nada de branding de ElevenLabs visible" — no hay ninguna UI de
ElevenLabs en la página, la armamos nosotros entera.

**Permiso de micrófono:** se pide explícito antes de `startSession()` con
`navigator.mediaDevices.getUserMedia({ audio: true })` (el SDK no lo hace
solo). Si el usuario lo rechaza, el `catch` deja el botón disponible para
reintentar y actualiza el hint.

**Requiere que `index.html` cargue `script.js` con `type="module"`** (el
import del SDK es ESM) — si se edita el script tag, no sacar ese atributo.

## Selector de agentes (demos en vivo)

La página tiene tabs, cada una con su propio agente de ElevenLabs. Elegir una
tab solo selecciona el agente y habilita el botón ("Hablar con RRHH" /
"Hablar con Alteor") — la llamada arranca recién al tocar ese botón, no sola.
Si había una llamada activa con otro agente y cambiás de tab, se corta antes
de seleccionar el nuevo.

Agentes configurados en `index.html` (atributo `data-agent-id` de cada `.agent-tab`):

| Tab | agent-id | Descripción | Estado |
|---|---|---|---|
| RRHH | `agent_0901kbgae1pse21tqa2b10w5mxs9` | Asistente de voz para procesos de Recursos Humanos | ✅ funciona |
| Alteor | `agent_4401krgvqay1ef38gw40payzz1rr` | Agente de voz para la empresa Alteor | ✅ funciona |

**Sacado de la demo:** `agent_3001m236q168e24994skx7wskf5w` ("Clara") — es el agente de
**producción de JaiCARE** (otro proyecto, no esta demo), requiere una variable dinámica
`nombre_paciente` en el primer mensaje que esta página no puede proveer y tira error al
arrancar. Si se quiere un agente "Acompañante" para esta demo, armar uno nuevo pensado
para uso público standalone, no reusar el de JaiCARE.

**Resuelto (2026-10-20):** Alteor tiraba `"Override for field 'language' is not allowed
by config"` al iniciar la llamada — su configuración de seguridad en ElevenLabs no
permitía que el widget le mande un override de idioma. Se arregló desde el panel de
ElevenLabs → agente Alteor → **Settings → Security → Overrides → Agent language** (branch
`Alteor1.0`, la que está en Live).

Para agregar, sacar o reordenar agentes, editá los botones `.agent-tab` dentro de
`#widget` en `index.html` (cada uno lleva `data-agent-id` y `data-agent-name`) — no
hace falta tocar `script.js`, lee esos atributos directamente.

**Cada agente necesita autenticación deshabilitada en ElevenLabs** (panel del agente
→ pestaña **Advanced** → "Enable authentication: off" / "Allow unauthenticated access"
según la versión del panel). Si no está deshabilitada, el widget público no va a poder
conectarse desde esta página sin backend.

## Personalización visual (orbe, botón, branding)

Como ya no se usa el widget de ElevenLabs, la skin es 100% nuestra —
`.call-card__orb`, `.call-card__btn`, etc. en `styles.css`, sin ningún límite
de shadow DOM ni atributos ajenos que adivinar. El orbe es un gradiente
cónico animado (violeta, igual al acento del sitio) que gira más rápido y
brilla cuando hay una llamada activa (`.is-live`). El botón cambia de color
(violeta → rojo) y texto (`Hablar con X` → `Finalizar llamada`) según el
estado — ver `setIdleUI()` en `script.js`.

No hay branding de ElevenLabs en ningún lado — no porque lo hayamos ocultado,
sino porque no hay ninguna UI de ElevenLabs en la página. El pedido original
de "nada de Powered by ElevenLabs" queda resuelto de raíz.

## Caché en producción (desa-lab.online)

El deploy real (ver `voicebot_demo.md` en Obsidian) usa nginx + Cloudflare. Por
default, cuando el origen (nginx) no manda su propio `Cache-Control`,
Cloudflare le aplica el "Browser Cache TTL" de la zona (4 horas en
`desa-lab.online`) — un visitante que ya cargó el sitio puede seguir viendo JS
viejo en su navegador por horas después de un deploy, **aunque se purgue la
caché de Cloudflare** (el purge solo limpia el edge de Cloudflare, no el
navegador del visitante). Esto pasó de verdad: alguien probó el sitio en el
celu y vio comportamiento viejo pese a un purge reciente.

Dos capas de fix, las dos ya aplicadas:
1. **nginx** (`/home/alteor/stacks/voicebot-demo/nginx.conf` en el servidor,
   no versionado en este repo) manda `Cache-Control: no-cache, must-revalidate`
   en todas las respuestas — el navegador revalida con ETag en cada visita
   (rápido, sigue sirviendo del caché si no cambió, pero nunca sirve algo
   stale por horas).
2. **Cache Rule de Cloudflare** (`voicebot-demo no-cache`, scope
   `http.host eq "voicebot-demo.desa-lab.online"`) fuerza
   `max-age=0, no-cache` en la respuesta — sin esto, Cloudflare pisa el header
   de nginx con su propio Browser Cache TTL de zona igual. Está scopeado solo
   a este subdominio para no afectar el caching de `crm.`/`vault.` en la
   misma zona.

**Al deployar un cambio:** alcanza con `git pull` en el servidor — no hace
falta purgar Cloudflare a mano para que los visitantes vean el cambio (el
`no-cache` ya fuerza revalidación), pero no está de más purgar igual para que
el próximo `curl`/chequeo manual no muestre una respuesta vieja del edge.

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

- `script.js` pide el permiso de micrófono explícitamente
  (`getUserMedia({ audio: true })`) antes de `Conversation.startSession()` —
  el SDK no lo hace solo. Si el usuario lo bloquea, el botón vuelve a estar
  disponible para reintentar y el hint se actualiza.
- Sin librerías externas más allá del SDK de ElevenLabs
  (`@elevenlabs/client`, cargado como ES module desde jsdelivr — sin npm,
  sin build step).
- Si falla el `import` del CDN (jsdelivr caído, bloqueado por una red
  corporativa, etc.), la página entera de llamada queda sin funcionar — no
  hay fallback. Para un sitio de mayor tráfico que este convendría vendorizar
  el paquete o tener un segundo CDN de respaldo.
