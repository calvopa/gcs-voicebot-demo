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
  // interno dentro del shadow DOM. Buscarlo por aria-label/texto es frágil:
  // algunos agentes no toman el start-call-text seteado (quedan en inglés,
  // "Start a call"), así que usamos el primer <button> del panel — en todos
  // los agentes probados es siempre el de iniciar la llamada, antes del de
  // mensaje de texto. El shadow DOM tarda un toque en poblarse tras montar
  // el widget, así que reintenta unas cuantas veces antes de rendirse (si
  // falla, el usuario igual puede arrancar la llamada a mano).
  function autoStartConversation(widget, attemptsLeft) {
    const root = widget.shadowRoot;
    const btn = root && root.querySelector("button");
    if (btn) {
      btn.click();
      return;
    }
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
        window.setTimeout(() => autoStartConversation(widget, 5), 200);
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
