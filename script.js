// Feedback visual mientras el navegador pide permiso de micrófono.
// El widget de ElevenLabs maneja el permiso internamente (shadow DOM);
// esto solo mejora el mensaje que ve el usuario mientras tanto.
(function () {
  const hint = document.getElementById("mic-hint");
  if (!hint) return;

  const states = {
    idle: "Tu navegador te va a pedir permiso de micrófono. Aceptalo para que el agente te escuche.",
    granted: "Micrófono activado. Ya podés hablarle al agente.",
    denied: "Bloqueaste el micrófono. Habilitalo desde la configuración del navegador para poder hablar con el agente.",
  };

  function setHint(state) {
    hint.textContent = states[state] || states.idle;
  }

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions
      .query({ name: "microphone" })
      .then((status) => {
        setHint(status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "idle");
        status.onchange = () => {
          setHint(status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "idle");
        };
      })
      .catch(() => setHint("idle"));
  }
})();

// Selector de agentes: solo un <elevenlabs-convai> montado en el DOM a la vez.
// Al cambiar de tab, se desmonta el widget anterior (corta el micrófono/conexión)
// y se monta uno nuevo con el agent-id correspondiente.
(function () {
  const tabs = document.querySelectorAll(".agent-tab");
  const mount = document.getElementById("widget-mount");
  if (!tabs.length || !mount) return;

  // Skin de marca GCS para el widget: mismo violeta del acento del sitio
  // (ver --accent / --accent-soft en styles.css) y textos en español rioplatense.
  // Atributos documentados por ElevenLabs — no son hacks de CSS, son la vía
  // oficial de personalización del widget (ver README).
  const WIDGET_SKIN = {
    "avatar-orb-color-1": "#7c5cff",
    "avatar-orb-color-2": "#2f3bff",
    "disable-banner": "",
    dismissible: "",
    "action-text": "Hablar con el agente",
    "start-call-text": "Iniciar llamada",
    "end-call-text": "Cortar",
    "expand-text": "Abrir",
    "collapse-text": "Cerrar",
    "listening-text": "Escuchando…",
    "speaking-text": "Hablando…",
  };

  // Al elegir un agente con un click, arrancamos la llamada directo en vez de
  // obligar a un segundo click en el botón propio del widget ("Iniciar llamada").
  // Esta versión del widget (0.20.0) no expone un método JS tipo
  // startConversation() en el elemento — el único gancho real es su botón
  // interno dentro del shadow DOM.
  //
  // No alcanza con "el primer <button>": con variant="tiny" el widget arranca
  // colapsado y el primer botón es el de expandir, no el de llamar (con
  // variant="full" el primer botón SÍ es el de llamar — rompimos esto una vez
  // al cambiar de variant). Tampoco alcanza con buscar por aria-label exacto:
  // algunos agentes no toman el start-call-text/expand-text seteado y quedan
  // en inglés ("Start a call" / "Expand widget"). Por eso buscamos por una
  // lista de textos candidatos (el nuestro + el default en inglés):
  //   1. Si encuentra el botón de llamar → click y listo.
  //   2. Si no, pero encuentra el de expandir → click (revela el de llamar)
  //      y reintenta la búsqueda completa.
  //   3. Si no encuentra nada todavía (shadow DOM sin poblar), reintenta.
  const CALL_BUTTON_LABELS = [WIDGET_SKIN["start-call-text"], "Start a call"];
  const EXPAND_BUTTON_LABELS = [WIDGET_SKIN["expand-text"], "Expand widget", "Expand"];
  // La etiqueta del botón de cortar varía bastante entre agentes — vimos
  // "Cortar" (el que configuramos), "End call" (default en inglés) y
  // "Finalizar" (default en español de algunos agentes, no toma nuestro
  // end-call-text). Se agregan variantes conocidas como atajo rápido, pero
  // la detección real no depende de adivinar el texto exacto (ver
  // findEndCallButton más abajo).
  const END_CALL_LABELS = [WIDGET_SKIN["end-call-text"], "End call", "Finalizar", "Terminar llamada", "Colgar", "Hang up"];
  // Etiquetas de los OTROS botones del panel en llamada (adjuntar, enviar,
  // colapsar), en inglés y en el default en español que usa el widget
  // cuando no toma nuestros atributos (vimos "Contraer", no "Cerrar" que
  // configuramos). Sirven para encontrar el botón de cortar por descarte
  // cuando no coincide con ningún texto conocido — más robusto que intentar
  // adivinar cada variante de idioma/dispositivo una por una.
  const OTHER_PANEL_BUTTON_LABELS = [
    "Adjuntar archivo",
    "Attach file",
    "Enviar",
    "Send",
    WIDGET_SKIN["collapse-text"],
    "Contraer",
    "Collapse",
  ];

  // Encuentra el botón de cortar sin depender de adivinar su texto exacto:
  // primero prueba las etiquetas conocidas (rápido), y si ninguna matchea,
  // asume que cualquier botón visible que no sea el de adjuntar/enviar/
  // colapsar (los únicos otros botones del panel en llamada) es el de
  // cortar. Solo tiene sentido buscarlo cuando la llamada está activa (el
  // botón de iniciar ya no está), así que lo llama siempre junto a esa
  // condición.
  function findEndCallButton(root) {
    const known = findButtonByLabel(root, END_CALL_LABELS);
    if (known) return known;
    const buttons = Array.from(root.querySelectorAll("button"));
    return buttons.find((b) => !OTHER_PANEL_BUTTON_LABELS.includes(b.getAttribute("aria-label")));
  }

  // El widget en sí queda oculto (ver styles.css) — este array traduce los
  // textos de estado que muestra internamente a lo que mostramos en nuestro
  // propio indicador (#call-status). Match por PREFIJO, no exacto: vimos que
  // el default del widget es "Escuchando" sin puntos suspensivos, mientras
  // que nuestro listening-text configurado es "Escuchando…" — con match
  // exacto nunca coincidía y el indicador quedaba pegado en "Conectando…"
  // aunque la llamada ya estuviera conectada y funcionando (confundía,
  // parecía que la página estaba colgada).
  const STATUS_TEXT_PREFIXES = [
    ["Conectando", "Conectando…"],
    ["Connecting", "Conectando…"],
    ["Escuchando", "Escuchando…"],
    ["Listening", "Escuchando…"],
    ["Hablando", "Hablando…"],
    ["Speaking", "Hablando…"],
    ["Habla para interrumpir", "Escuchando — hablá cuando quieras"],
    ["Talk to interrupt", "Escuchando — hablá cuando quieras"],
  ];

  function findButtonByLabel(root, labels) {
    const buttons = Array.from(root.querySelectorAll("button"));
    return buttons.find((b) => labels.includes(b.getAttribute("aria-label")));
  }

  function autoStartConversation(widget, attemptsLeft) {
    const root = widget.shadowRoot;
    if (!root) {
      if (attemptsLeft > 0) window.setTimeout(() => autoStartConversation(widget, attemptsLeft - 1), 200);
      return;
    }

    const callBtn = findButtonByLabel(root, CALL_BUTTON_LABELS);
    if (callBtn) {
      callBtn.click();
      startStatusPolling(widget);
      return;
    }

    const expandBtn = findButtonByLabel(root, EXPAND_BUTTON_LABELS);
    if (expandBtn) expandBtn.click();

    if (attemptsLeft > 0) {
      window.setTimeout(() => autoStartConversation(widget, attemptsLeft - 1), 200);
    }
  }

  // El widget real queda invisible (styles.css lo manda fuera de pantalla),
  // así que este panel hecho a mano es lo único que la persona ve del estado
  // de la llamada. Mientras esté activa, cada 400ms se fija si el botón de
  // cortar sigue existiendo (= la llamada sigue viva) y copia el texto de
  // estado que el widget muestra internamente, traducido via STATUS_TEXT_PREFIXES.
  // Cuando el botón de cortar desaparece, la llamada terminó (sola o porque
  // el agente la cerró) — se desmonta todo y se vuelve al estado inicial.
  const statusPanel = document.getElementById("call-status");
  const statusText = document.getElementById("call-status-text");
  const statusEndBtn = document.getElementById("call-status-end");
  let statusPollId = null;

  function stopStatusPolling() {
    if (statusPollId) {
      window.clearInterval(statusPollId);
      statusPollId = null;
    }
    statusPanel.hidden = true;
  }

  function findStatusLabel(root) {
    const candidates = root.querySelectorAll("p, span, div");
    for (const el of candidates) {
      const t = el.textContent.trim();
      if (!t) continue;
      const match = STATUS_TEXT_PREFIXES.find(([prefix]) => t.startsWith(prefix));
      if (match) return match[1];
    }
    return null;
  }

  function startStatusPolling(widget) {
    statusPanel.hidden = false;
    statusText.textContent = "Conectando…";

    statusEndBtn.onclick = () => {
      const root = widget.shadowRoot;
      const endBtn = root && findEndCallButton(root);
      if (endBtn) endBtn.click();
    };

    // La etiqueta del botón de cortar varía demasiado entre agentes para
    // usarla como señal de "la llamada sigue viva" (ver END_CALL_LABELS).
    // La señal confiable es la inversa: el botón de INICIAR, que sabemos
    // que detectamos bien (es el mismo que usó autoStartConversation para
    // arrancar), reaparece cuando la llamada termina y el widget vuelve al
    // estado previo a la llamada. Mientras no reaparezca, seguimos en
    // llamada — tratamos de reflejar el texto de estado si lo encontramos,
    // pero su ausencia no corta nada.
    statusPollId = window.setInterval(() => {
      const root = widget.shadowRoot;
      if (!root) return;

      const startBtnBack = findButtonByLabel(root, CALL_BUTTON_LABELS);
      if (startBtnBack) {
        // La llamada terminó (sola, o la cortamos nosotros): volvemos al
        // estado inicial, sin tab seleccionada.
        stopStatusPolling();
        unmountAgent();
        tabs.forEach((t) => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        hasStarted = false;
        return;
      }

      const label = findStatusLabel(root);
      if (label) statusText.textContent = label;
    }, 400);
  }

  function mountAgent(agentId, autoStart) {
    mount.classList.add("is-switching");
    window.setTimeout(() => {
      mount.innerHTML = "";
      const widget = document.createElement("elevenlabs-convai");
      widget.setAttribute("agent-id", agentId);
      Object.entries(WIDGET_SKIN).forEach(([attr, value]) => {
        widget.setAttribute(attr, value);
      });
      mount.appendChild(widget);
      mount.classList.remove("is-switching");
      if (autoStart) {
        window.setTimeout(() => autoStartConversation(widget, 8), 200);
      }
    }, 150);
  }

  function unmountAgent() {
    stopStatusPolling();
    mount.innerHTML = "";
  }

  // Ninguna tab viene preseleccionada: no se monta ni se muestra ningún
  // widget hasta que el usuario elija un agente a propósito. Así no aparece
  // la burbuja de ElevenLabs sola con solo scrollear hasta la sección.
  let currentAgentId = null;
  let hasStarted = false;

  function selectTab(tab) {
    tabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    stopStatusPolling();
    currentAgentId = tab.dataset.agentId;
    hasStarted = true;
    mountAgent(currentAgentId, true);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });

  // El widget real queda oculto siempre (ver styles.css), pero si el usuario
  // scrollea lejos de la sección con una llamada en curso, igual la cortamos
  // y reseteamos todo — no tiene sentido mantenerla viva sin que se la pueda
  // ver ni cortar desde la pantalla.
  const widgetSection = document.getElementById("widget");
  if (widgetSection && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && hasStarted) {
            unmountAgent();
            hasStarted = false;
            tabs.forEach((t) => {
              t.classList.remove("is-active");
              t.setAttribute("aria-selected", "false");
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(widgetSection);
  }
})();
