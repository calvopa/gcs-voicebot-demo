# GCS Voicebot Demo

Landing page estática para que un visitante hable en vivo con un agente de voz de
ElevenLabs embebido en la página, sin llamada telefónica real. Inspirada en el
patrón de demo.kleva.co.

Stack: HTML + CSS + JS puro. Sin build, sin frameworks.

## Archivos

- `index.html` — estructura de la página, incluye las tabs de agentes con sus `agent-id`.
- `styles.css` — estilos (dark mode).
- `script.js` — selector de agentes (monta/desmonta `<elevenlabs-convai>` dinámicamente,
  arranca la llamada sola al elegir tab) + mensaje de estado del permiso de micrófono.

## Selector de agentes (demos en vivo)

La página tiene tabs, cada una con su propio agente de ElevenLabs. Solo hay un
`<elevenlabs-convai>` montado en el DOM a la vez — `script.js` lo destruye y crea uno
nuevo al cambiar de tab, así no quedan varios widgets conectados en paralelo (consumiría
recursos y pediría/mantendría el micrófono de más). Al elegir una tab, la llamada arranca
sola (ver sección "Auto-start de la llamada" más abajo) — no hace falta un segundo click
en el botón propio del widget.

Agentes configurados en `index.html` (atributo `data-agent-id` de cada `.agent-tab`):

| Tab | agent-id | Descripción | Estado |
|---|---|---|---|
| RRHH | `agent_0901kbgae1pse21tqa2b10w5mxs9` | Asistente de voz para procesos de Recursos Humanos | ✅ funciona |
| Alteor | `agent_4401krgvqay1ef38gw40payzz1rr` | Agente de voz para la empresa Alteor | ⚠️ ver pendiente abajo |

**Sacado de la demo:** `agent_3001m236q168e24994skx7wskf5w` ("Clara") — es el agente de
**producción de JaiCARE** (otro proyecto, no esta demo), requiere una variable dinámica
`nombre_paciente` en el primer mensaje que esta página no puede proveer y tira error al
arrancar. Si se quiere un agente "Acompañante" para esta demo, armar uno nuevo pensado
para uso público standalone, no reusar el de JaiCARE.

**Pendiente:** Alteor tira `"Override for field 'language' is not allowed by config"` al
iniciar la llamada — la configuración de seguridad de ese agente en ElevenLabs no permite
que el widget le mande un override de idioma (a diferencia de RRHH, que sí lo permite).
Se arregla desde el panel de ElevenLabs → agente Alteor → **Security** → habilitar
overrides de idioma (o el campo que corresponda según la versión del panel).

Para agregar, sacar o reordenar agentes, editá los botones `.agent-tab` dentro de
`#widget` en `index.html` (cada uno lleva `data-agent-id` y `data-agent-name`) — no
hace falta tocar `script.js`, lee esos atributos directamente.

**Cada agente necesita autenticación deshabilitada en ElevenLabs** (panel del agente
→ pestaña **Advanced** → "Enable authentication: off" / "Allow unauthenticated access"
según la versión del panel). Si no está deshabilitada, el widget público no va a poder
conectarse desde esta página sin backend.

## Skin del widget (colores, textos, branding)

El widget vive en shadow DOM — no es estilable con CSS normal ni con `::part()`
(ElevenLabs no expone partes internas en la versión `0.20.0`). Probamos forzar
`position: relative` por CSS para que el panel de conversación fluya dentro de
la tarjeta en vez de flotar como burbuja fija: **rompe el panel expandido**
(queda clippeado a una barra de unos pocos píxeles) — no lo usamos en producción
por eso. La personalización real pasa por los **atributos documentados del
elemento**, seteados en `script.js` → objeto `WIDGET_SKIN`, aplicados a cada
`<elevenlabs-convai>` al montarlo:

| Atributo | Qué hace | Valor usado acá |
|---|---|---|
| `avatar-orb-color-1` / `-2` | Gradiente del orbe del agente | `#7c5cff` / `#2f3bff` (el mismo violeta del sitio) |
| `disable-banner` | Saca el "Powered by ElevenLabs" | presente (sin valor) |
| `dismissible` | Deja minimizar el widget | presente (sin valor) |
| `action-text`, `start-call-text`, `end-call-text`, `expand-text`, `collapse-text`, `listening-text`, `speaking-text` | Textos del widget | traducidos a español rioplatense |

Esto **reemplaza** el intento anterior con `::part()` en `styles.css` (no
funcionaba — quedaba documentado acá por si en una versión futura del widget
ElevenLabs expone partes reales). Para cambiar colores o textos, editá
`WIDGET_SKIN` en `script.js` — se aplica a todos los agentes por igual.

## Auto-start de la llamada

Al elegir una tab, la llamada arranca sola — no hace falta el segundo click en
el botón propio del widget. Esta versión (`0.20.0`) **no expone un método JS**
tipo `widget.startConversation()` en el elemento (se probó, el prototipo solo
tiene los callbacks del custom element). El único gancho real es su botón
interno dentro del shadow DOM: `script.js` → `autoStartConversation()` lo
busca con `widget.shadowRoot.querySelector("button")` (el primer botón del
panel, que en todos los agentes probados es el de iniciar llamada) y le hace
`.click()`. Reintenta cada 200ms hasta 5 veces por si el shadow DOM todavía no
se pobló cuando se intenta.

**Frágil, ojo:** esto depende de la estructura interna del widget, que
ElevenLabs no documenta ni garantiza entre versiones. Si tras actualizar
`@elevenlabs/convai-widget-embed` la llamada deja de arrancar sola, probar:
1. Abrir el widget manualmente y confirmar si el primer botón del panel
   sigue siendo el de "iniciar llamada" (inspeccionar `shadowRoot` en DevTools).
2. Si cambió el orden o la estructura, ajustar el selector en
   `autoStartConversation()`.
3. Si ElevenLabs termina exponiendo `startConversation()` como método público
   del elemento en una versión futura, usar eso en vez del click al botón —
   es la vía documentada y no depende de la estructura interna.

**Lo que no se puede customizar:** el fondo, tipografía y layout del panel
interno del widget (chrome propio de ElevenLabs, no configurable desde afuera
del shadow DOM). El widget siempre aparece como burbuja flotante fija en una
esquina — no hay forma soportada de embeberlo inline en el flujo de la página
sin romper su funcionamiento.

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
