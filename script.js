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
      return;
    }

    const expandBtn = findButtonByLabel(root, EXPAND_BUTTON_LABELS);
    if (expandBtn) expandBtn.click();

    if (attemptsLeft > 0) {
      window.setTimeout(() => autoStartConversation(widget, attemptsLeft - 1), 200);
    }
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
    currentAgentId = tab.dataset.agentId;
    hasStarted = true;
    mountAgent(currentAgentId, true);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });

  // El widget de ElevenLabs flota fijo en una esquina y, una vez montado,
  // queda visible en TODA la página (no solo cerca de la tarjeta de demo).
  // Para que no persiga al usuario por el resto del sitio, se desmonta en
  // cuanto la sección del selector sale de pantalla (no se automonta al
  // entrar — eso requiere un click explícito en una tab).
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
