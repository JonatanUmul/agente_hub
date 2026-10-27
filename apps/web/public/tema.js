// Aplica el modo (claro/oscuro) ANTES de que se dibuje la página, para que no parpadee.
// Es un archivo aparte (no un <script> en línea) porque la política de seguridad prohíbe scripts en línea.
(function () {
  var tema;
  try {
    tema = localStorage.getItem('tema');
  } catch {
    tema = null;
  }
  if (tema !== 'claro' && tema !== 'oscuro') {
    tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }
  document.documentElement.dataset.tema = tema;
})();
