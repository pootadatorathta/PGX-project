/* ============================================
   🌙 Dark Mode Instant Initialization
   Prevents white flash on page load
   Place this in <head> before any CSS
   ============================================ */

(function() {
  const savedTheme = localStorage.getItem('theme-mode');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  }
})();
