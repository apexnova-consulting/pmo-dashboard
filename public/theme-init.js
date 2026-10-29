(function () {
  try {
    var stored = localStorage.getItem('pmo-theme');
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
