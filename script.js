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

  function mountAgent(agentId) {
    mount.classList.add("is-switching");
    window.setTimeout(() => {
      mount.innerHTML = "";
      const widget = document.createElement("elevenlabs-convai");
      widget.setAttribute("agent-id", agentId);
      mount.appendChild(widget);
      mount.classList.remove("is-switching");
    }, 150);
  }

  function selectTab(tab) {
    tabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    mountAgent(tab.dataset.agentId);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("is-active")) return;
      selectTab(tab);
    });
  });

  // Montar el primer agente (tab activo por defecto) al cargar la página.
  const initialTab = document.querySelector(".agent-tab.is-active") || tabs[0];
  mountAgent(initialTab.dataset.agentId);
})();
