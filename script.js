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
