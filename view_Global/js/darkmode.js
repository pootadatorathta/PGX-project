/* ============================================
   🌙 Unified Persistent Dark Mode System
   ============================================ */

const themeBtn = document.getElementById('themeToggle');
const DARK_KEY = 'theme-mode';

// โหลดค่าจาก LocalStorage ตอนเริ่มต้น
// Note: Initial dark mode is applied by inline script in <head>
// This just ensures the class is present and updates charts
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem(DARK_KEY);
  const isDark = savedTheme === 'dark';

  // Ensure dark class is applied (in case inline script didn't run)
  if (isDark && !document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.add('dark');
  }

  // Update charts if available
  if (typeof updateChartsForTheme === 'function') {
    updateChartsForTheme();
  }
});

// เมื่อผู้ใช้กดปุ่ม toggle
themeBtn?.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(DARK_KEY, isDark ? 'dark' : 'light');

  // Update charts if available
  if (typeof updateChartsForTheme === 'function') {
    updateChartsForTheme();
  }
});

