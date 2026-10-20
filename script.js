import { Conversation } from "https://cdn.jsdelivr.net/npm/@elevenlabs/client/+esm";

// UI de llamada propia, sin el widget pre-armado de ElevenLabs. Antes
// usábamos <elevenlabs-convai> (vive en shadow DOM) y había que "cazar" sus
// botones internos por aria-label para auto-iniciar la llamada, ocultarlo
// visualmente y detectar cuándo terminaba — frágil, cada agente usa textos
// distintos para los mismos botones ("Cortar"/"Finalizar"/"End"), y en
// mobile el touch no siempre llegaba bien al botón real por culpa del
// truco de CSS usado para esconderlo.
//
// Acá se usa el SDK de JS de ElevenLabs (@elevenlabs/client) directamente:
// Conversation.startSession()/.endSession() con callbacks propios. Control
// total sobre la llamada, cero necesidad de adivinar nada del DOM de un
// tercero — y de paso resuelve solo el pedido original de "nada de branding
// de ElevenLabs visible": no hay ninguna UI de ElevenLabs en la página.
(function () {
  const tabs = document.querySelectorAll(".agent-tab");
  const orb = document.getElementById("call-orb");
  const statusLine = document.getElementById("call-status-line");
  const toggleBtn = document.getElementById("call-toggle");
  const toggleLabel = document.getElementById("call-toggle-label");
  const micHint = document.getElementById("mic-hint");
  if (!tabs.length || !toggleBtn) return;

  let conversation = null;
  let currentAgentId = null;
  let currentAgentName = null;
  let timerId = null;
  let callStartedAt = null;

  // Cuánto esperamos a que Conversation.startSession() conecte antes de darla
  // por perdida. Sin esto, si la conexión se cuelga (red móvil lenta, WS
  // bloqueado, etc.) el botón queda grisado para siempre: startSession() no
  // resuelve ni rechaza, y el único lugar que reactiva el botón es
  // onConnect/el catch — ninguno de los dos llega.
  const CONNECT_TIMEOUT_MS = 20000;

  // Se incrementa cada vez que arrancamos o cortamos un intento de llamada.
  // Permite detectar y descartar una respuesta "tardía" de un intento viejo
  // (ej. el usuario cambió de tab mientras todavía estábamos conectando, o
  // justo salté por el timeout y attempt de startSession resuelve después).
  let callAttemptId = 0;

  function formatElapsed() {
    const totalSeconds = Math.floor((Date.now() - callStartedAt) / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function startTimer() {
    callStartedAt = Date.now();
    timerId = window.setInterval(() => {
      statusLine.textContent = `Conectado · ${formatElapsed()}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function setIdleUI() {
    stopTimer();
    orb.classList.remove("is-live");
    toggleBtn.classList.remove("is-active-call");
    toggleBtn.disabled = !currentAgentId;
    toggleLabel.textContent = currentAgentName ? `Hablar con ${currentAgentName}` : "Elegí un agente";
    statusLine.textContent = currentAgentId ? "Disponible para conversar" : "Elegí un agente arriba para empezar";
  }

  function selectTab(tab) {
    callAttemptId++; // invalida cualquier intento de conexión en curso
    if (conversation) endCall();
    tabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    currentAgentId = tab.dataset.agentId;
    currentAgentName = tab.dataset.agentName;
    setIdleUI();
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });

  async function startCall() {
    if (!currentAgentId || conversation) return;
    const attemptId = ++callAttemptId;
    toggleBtn.disabled = true;
    statusLine.textContent = "Conectando…";
    if (micHint) micHint.textContent = "Pidiendo permiso de micrófono…";

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attemptId !== callAttemptId) return; // se canceló mientras pedíamos el mic
      if (micHint) micHint.textContent = "Micrófono activado.";
    } catch (err) {
      if (attemptId !== callAttemptId) return;
      console.error("No pudimos acceder al micrófono:", err);
      statusLine.textContent = "No pudimos acceder al micrófono — revisá los permisos";
      if (micHint) micHint.textContent = "Bloqueaste el micrófono. Habilitalo desde la configuración del navegador.";
      toggleBtn.disabled = false;
      return;
    }

    const sessionPromise = Conversation.startSession({
      agentId: currentAgentId,
      onConnect: () => {
        if (attemptId !== callAttemptId) return;
        toggleBtn.disabled = false;
        toggleBtn.classList.add("is-active-call");
        toggleLabel.textContent = "Finalizar llamada";
        orb.classList.add("is-live");
        startTimer();
      },
      onDisconnect: () => {
        if (attemptId !== callAttemptId) return;
        conversation = null;
        setIdleUI();
      },
      onModeChange: (m) => {
        // No pisamos el texto si ya estamos mostrando el timer "Conectado · mm:ss"
        // — este callback solo importa mientras no hay timer corriendo (ej. justo
        // al conectar, antes de que el agente empiece a hablar/escuchar).
        if (attemptId === callAttemptId && !timerId) {
          statusLine.textContent = m.mode === "speaking" ? "Hablando…" : "Escuchando…";
        }
      },
      onError: (err) => {
        console.error("ElevenLabs conversation error:", err);
        if (attemptId !== callAttemptId) return;
        statusLine.textContent = "Se cortó la conexión — probá de nuevo";
        conversation = null;
        setIdleUI();
      },
    });

    // Si startSession() nunca resuelve (red lenta, WebSocket bloqueado, etc.)
    // no queremos que el botón quede grisado para siempre sin explicación.
    const timeoutPromise = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("connect-timeout")), CONNECT_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      if (attemptId !== callAttemptId) {
        // Llegó tarde: ya cambiamos de agente o cortamos desde otro lado.
        // No dejar la sesión colgada sin nadie que la corte.
        result.endSession().catch(() => {});
        return;
      }
      conversation = result;
    } catch (err) {
      if (attemptId !== callAttemptId) return;
      console.error("No se pudo iniciar la llamada:", err);
      statusLine.textContent =
        err.message === "connect-timeout"
          ? "La conexión está tardando demasiado — revisá tu internet y probá de nuevo"
          : "No se pudo conectar con el agente — probá de nuevo";
      toggleBtn.disabled = false;

      // El intento sigue en pie del lado del SDK aunque ya nos rendimos acá —
      // si termina resolviendo tarde, cortarlo para no dejar un micrófono
      // abierto de fondo que el usuario no puede ver ni cerrar.
      sessionPromise
        .then((lateConversation) => {
          if (attemptId !== callAttemptId || conversation !== lateConversation) {
            lateConversation.endSession().catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  async function endCall() {
    callAttemptId++; // invalida cualquier conexión en curso (ver startCall)
    const toEnd = conversation;
    conversation = null;
    setIdleUI();
    if (toEnd) {
      try {
        await toEnd.endSession();
      } catch (err) {
        console.error("Error al cortar la llamada:", err);
      }
    }
  }

  toggleBtn.addEventListener("click", () => {
    if (conversation) endCall();
    else startCall();
  });

  // Si el usuario scrollea lejos de la sección con una llamada en curso, la
  // cortamos — no tiene sentido mantenerla viva sin que se la pueda ver ni
  // cortar desde la pantalla.
  const widgetSection = document.getElementById("widget");
  if (widgetSection && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && conversation) endCall();
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(widgetSection);
  }
})();
