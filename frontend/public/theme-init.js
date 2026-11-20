(() => {
  let preference = null;
  try {
    preference = localStorage.getItem('sportify-theme');
  } catch {
    // The theme remains usable when persistent storage is unavailable.
  }

  const dark = preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
