/* ============================================================
   🧭 NAVBAR HOVER + CLOSE APP (Electron)
   ------------------------------------------------------------
   ▶️ แสดง Navbar เมื่อเม้าท์ใกล้ขอบบนของจอ
   ▶️ ปุ่ม ❌ จะสั่งปิดแอปผ่าน IPC ไปยัง main.js
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const hoverNav = document.querySelector(".hover-navbar");
  const closeBtn = document.querySelector(".nav-btn.close");
  let timer = null;

  if (!hoverNav) {
    return;
  }

  // 🟦 แสดง/ซ่อน Navbar เมื่อเลื่อนเม้าท์
  document.addEventListener("mousemove", (e) => {
    if (e.clientY <= 20) {
      hoverNav.classList.add("visible");
      clearTimeout(timer);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => hoverNav.classList.remove("visible"), 500);
    }
  });

  // 🟥 ปุ่มปิดแอป
  closeBtn?.addEventListener("click", () => {
    console.log("🔴 Close button clicked");
    if (window.electronAPI && typeof window.electronAPI.closeApp === "function") {
      window.electronAPI.closeApp(); // ส่ง event ไป main.js
    } else {
      console.error("⚠️ electronAPI.closeApp() ไม่พร้อมใช้งาน");
    }
  });
});
