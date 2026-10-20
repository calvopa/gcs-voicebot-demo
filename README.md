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

## Skin del widget (colores, textos, branding)

El widget vive en shadow DOM — no es estilable con CSS normal ni con `::part()`
(ElevenLabs no expone partes internas en la versión `0.20.0`). La
personalización pasa por los **atributos documentados del elemento**, seteados
en `script.js` → objeto `WIDGET_SKIN`, aplicados a cada `<elevenlabs-convai>`
al montarlo:

| Atributo | Qué hace | Valor usado acá |
|---|---|---|
| `avatar-orb-color-1` / `-2` | Gradiente del orbe del agente | `#7c5cff` / `#2f3bff` (el mismo violeta del sitio) |
| `disable-banner` | Saca el "Powered by ElevenLabs" | presente (sin valor) |
| `dismissible` | Deja minimizar el widget | presente (sin valor) |
| `action-text`, `start-call-text`, `end-call-text`, `expand-text`, `collapse-text`, `listening-text`, `speaking-text` | Textos del widget | traducidos a español rioplatense |

**Ojo:** varios agentes NO toman estos textos — usan sus propios defaults de
i18n según el idioma configurado del agente, no nuestros atributos. Vimos el
botón de cortar como "Cortar" (el nuestro), "Finalizar" y "End" en distintos
agentes; el de colapsar como "Contraer" en vez del "Cerrar" que configuramos.
Por eso `script.js` nunca depende de un texto exacto para encontrar botones
(ver "Auto-start" y "Viewport del widget" más abajo) — solo lo usa como atajo
rápido antes de caer a detección por descarte.

Para cambiar colores o textos, editá `WIDGET_SKIN` en `script.js` — se aplica
a todos los agentes por igual (aunque no todos lo respeten).

## El widget queda completamente oculto — indicador propio

La ventana nativa de ElevenLabs (burbuja flotante, panel de conversación) **no
se muestra nunca**, ni siquiera durante la llamada. En su lugar hay un
indicador armado a mano en `index.html` (`#call-status`) con texto de estado y
botón "Cortar" real, manejado por `startStatusPolling()` en `script.js`.

**Por qué está oculto así:** el panel visible del widget vive *dentro* del
shadow DOM con su propio `position: fixed` anclado al viewport — no sigue la
posición del host (`<elevenlabs-convai>`), así que mover el host con left/top
no lo mueve. Probamos `position: relative` en el host para que fluya inline:
rompe el panel expandido (queda clippeado a unos pocos píxeles). La solución
que quedó en `styles.css`:

```css
.widget-mount elevenlabs-convai {
  position: fixed; left: 0; top: 0; width: 0; height: 0; overflow: hidden;
  transform: scale(0.0001); opacity: 0; pointer-events: none;
}
```

`transform` crea un *containing block* para los descendientes `position:fixed`
de todo el árbol — shadow DOM incluido, es una regla normal de CSS, no la
esquiva el shadow boundary — así el panel interno queda atrapado en una caja
de 0px en vez de anclado al viewport. Sin esto, `opacity:0` solo no alcanza:
el panel seguía clickeable en su posición original (esquina inferior derecha),
pudiendo tapar toques reales en mobile si coincidían en pantalla — fue la
causa de un reporte real de "el botón Cortar no responde" en Android.
Verificado con `document.elementFromPoint()` que ahora el click llega limpio
a nuestro botón.

## Auto-start y botón de cortar (sin depender de texto exacto)

Al elegir una tab, la llamada arranca sola — no hace falta un segundo click.
Esta versión del widget (`0.20.0`) **no expone un método JS** tipo
`widget.startConversation()` / `endConversation()` en el elemento (se probó,
el prototipo solo tiene los callbacks del custom element). El único gancho
real son los botones internos dentro del shadow DOM.

**Botón de iniciar** (`autoStartConversation()`): se busca por una lista corta
de aria-labels conocidos (`CALL_BUTTON_LABELS`) — en todos los agentes
probados coincide bien (`"Iniciar llamada"` o el default `"Start a call"`).
Si no aparece todavía (shadow DOM sin poblar), reintenta cada 200ms hasta 8
veces, revelando el panel con el botón de expandir si hace falta.

**Botón de cortar** (`findEndCallButton()`): su etiqueta varía demasiado para
confiar en una lista fija (vimos `"Cortar"`, `"Finalizar"`, `"End call"`,
`"End"` a secas — cada agente puede usar un default de i18n distinto). La
detección real es por **descarte**: de los 4 botones que tiene el panel en
llamada (adjuntar, cortar, enviar, colapsar), se excluyen los 3 que sí se
identifican bien por label (`OTHER_PANEL_BUTTON_LABELS`) y lo que sobra es el
de cortar. Mismo criterio para saber si la llamada **sigue viva**: en vez de
confiar en la etiqueta de cortar, se poll-ea la *reaparición* del botón de
iniciar (señal confiable) — cuando vuelve a aparecer, la llamada terminó (sola
o porque el usuario cortó) y se resetea todo.

**Si tras actualizar `@elevenlabs/convai-widget-embed` algo de esto deja de
funcionar:** inspeccionar `widget.shadowRoot.querySelectorAll('button')` en
DevTools durante una llamada activa para ver qué `aria-label`s aparecen ahora,
y ajustar `CALL_BUTTON_LABELS` / `OTHER_PANEL_BUTTON_LABELS` en `script.js`.
Si ElevenLabs termina exponiendo `startConversation()`/`endConversation()`
como métodos públicos en una versión futura, usar eso en vez de buscar
botones — es la vía documentada y no depende de la estructura interna.

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

- El widget pide permiso de micrófono al usuario; `script.js` solo mejora el
  texto de ayuda mientras ese permiso no fue otorgado — el manejo real del
  permiso lo hace el widget de ElevenLabs internamente.
- Sin librerías externas más allá del script oficial del widget
  (`@elevenlabs/convai-widget-embed`).
