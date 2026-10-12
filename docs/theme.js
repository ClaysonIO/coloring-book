// Light/dark toggle in the header. The site follows the device's setting until someone picks the
// other theme; picking the theme that matches the device goes back to following it.
// The inline script in each page's <head> applies a saved choice before the page paints.
(function () {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const system = () => (media.matches ? 'dark' : 'light');
  const current = () => root.dataset.theme || system();

  function save(theme) {
    try {
      if (theme) localStorage.setItem('theme', theme);
      else localStorage.removeItem('theme');
    } catch (e) {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }

  function label(button) {
    const next = current() === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
    button.title = `Switch to ${next} mode`;
  }

  for (const button of document.querySelectorAll('.theme-toggle')) {
    label(button);
    button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      if (next === system()) {
        delete root.dataset.theme;
        save(null);
      } else {
        root.dataset.theme = next;
        save(next);
      }
      label(button);
    });
    media.addEventListener('change', () => label(button));
  }
})();
