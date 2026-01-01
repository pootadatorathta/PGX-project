/* ============================================
   👤 USER PROFILE & SESSION MANAGEMENT
   ============================================
   Shared utility functions for user authentication,
   session management, and profile display across all pages
   ============================================ */

/* --------------------------------------------
   🔐 SESSION MANAGEMENT
-------------------------------------------- */

// Get current user session
function getCurrentUser() {
  try {
    // Try sessionStorage first (current tab)
    let sessionData = sessionStorage.getItem('currentUser');
    if (sessionData) return JSON.parse(sessionData);
    
    // Fallback to localStorage (persistent)
    sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      const userData = JSON.parse(sessionData);
      // Also store in sessionStorage for this tab
      sessionStorage.setItem('currentUser', sessionData);
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error reading current user:', error);
    return null;
  }
}

// Check if user is authenticated
function checkAuthentication() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    console.warn('⚠️ No user session found, redirecting to login');
    window.electronAPI.navigate('login');
    return false;
  }
  
  console.log('✅ User authenticated:', currentUser.username, currentUser.role);
  return true;
}

// Update user display in header
function updateUserDisplay() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    // Update dropdown button with user info
    const dropdownBtn = document.getElementById('dropdownBtn');
    if (dropdownBtn) {
      // Use doctor_name (full name) if available, otherwise fallback to username
      const displayName = currentUser.doctor_name || currentUser.username;
      dropdownBtn.innerHTML = `
        <i class="fa fa-user-circle"></i> ${displayName} (${currentUser.role}) <i class="fa fa-caret-down"></i>
      `;
    }
    
    // You can also add hospital info if needed
    if (currentUser.hospital_id) {
      console.log('🏥 Hospital:', currentUser.hospital_id);
    }
  }
}

// Clear user session
function clearUserSession() {
  localStorage.removeItem('userSession');
  localStorage.removeItem('userRole');
  sessionStorage.clear();
  console.log('🗑️ User session cleared');
}

function showPage(pageName, patientId) {
  // Store patientId in sessionStorage for use in verify_step1.html
  sessionStorage.setItem('selectedPatientId', patientId);
  window.electronAPI.navigate(pageName); // Navigate to the specified page
}

/* --------------------------------------------
   🚪 LOGOUT HANDLER (ฉบับแก้ไขที่ถูกต้อง)
-------------------------------------------- */

async function handleLogout(e) {
  if (e) e.preventDefault();
  
  const currentUser = getCurrentUser();
  const username = currentUser ? currentUser.username : 'Unknown';
  
  const result = await Swal.fire({
    title: 'ยืนยันการออกจากระบบ',
    text: `คุณ (${username}) ต้องการออกจากระบบใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ออกจากระบบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6e7881',
    customClass: {
      popup: 'swal-dark'
    }
  });

  // ⭐️ ใช้ 'result.isConfirmed' จาก Swal.fire() ตรงนี้
  if (result.isConfirmed) {
    try {
      // Call logout handler if available
      if (window.electronAPI.handleLogout) {
        await window.electronAPI.handleLogout({ username });
      }
      
      // Clear all session data
      clearUserSession();
      
      console.log('👋 User logged out:', username);
      
      // Navigate to login page
      window.electronAPI.navigate('login');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Still logout even if API call fails
      clearUserSession();
      window.electronAPI.navigate('login');
    }
  }
  // ถ้าผู้ใช้กด "ยกเลิก" (result.isDismissed) โค้ดใน if ก็จะไม่ทำงาน
}
/* --------------------------------------------
   📱 DROPDOWN MENU HANDLER
-------------------------------------------- */

// Initialize dropdown menu
function initializeDropdown() {
  const dropdownBtn = document.getElementById("dropdownBtn");
  const dropdownMenu = document.getElementById("dropdownMenu");

  dropdownBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu?.classList.toggle("show");
  });

  window.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) {
      dropdownMenu?.classList.remove("show");
    }
  });
}

/* --------------------------------------------
   ⚙️ SETTINGS POPUP HANDLER
-------------------------------------------- */

// Initialize settings popup
function initializeSettingsPopup() {
  const settingsPopup = document.getElementById('settingsPopup');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const cancelSettings = document.getElementById('cancelSettings');
  const settingsBtn = document.getElementById('settingsBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');

  // Open settings popup
  settingsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    settingsPopup.style.display = 'flex';
    dropdownMenu?.classList.remove('show');
  });

  // Close settings popup
  closeSettings?.addEventListener('click', () => {
    settingsPopup.style.display = 'none';
  });

  cancelSettings?.addEventListener('click', () => {
    settingsPopup.style.display = 'none';
  });

  // Save settings
  saveSettings?.addEventListener('click', () => {
    const language = document.getElementById('languageSetting')?.value;
    const theme = document.getElementById('themeSetting')?.value;
    const notifications = document.getElementById('notificationsSetting')?.checked;
    
    if (language) localStorage.setItem('appLanguage', language);
    if (theme) localStorage.setItem('theme-mode', theme);
    if (notifications !== undefined) localStorage.setItem('appNotifications', notifications);
    
    // Apply theme immediately if changed
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else if (theme === 'light') {
      document.body.classList.remove('dark');
    }
    
    // [เพิ่มส่วนนี้] เพื่ออัปเดตไอคอนปุ่มสลับธีม (darkmode.js) ให้ตรงกันทันที
    const themeBtn = document.getElementById('themeToggle');
    const icon = themeBtn?.querySelector('i');
    if (icon) {
      const isDark = (theme === 'dark');
      icon.classList.toggle('fa-sun', isDark);
      icon.classList.toggle('fa-moon', !isDark);
    }

    alert('Settings saved successfully!');
    settingsPopup.style.display = 'none';
  });

  // Close popup when clicking outside
  settingsPopup?.addEventListener('click', (e) => {
    if (e.target === settingsPopup) {
      settingsPopup.style.display = 'none';
    }
  });

  // Load saved settings
  loadSavedSettings();
}

// Load saved settings
function loadSavedSettings() {
  const savedTheme = localStorage.getItem('theme-mode');
  const savedLanguage = localStorage.getItem('appLanguage');
  const savedNotifications = localStorage.getItem('appNotifications');
  
  if (savedTheme && document.getElementById('themeSetting')) {
    document.getElementById('themeSetting').value = savedTheme;
  }
  
  if (savedLanguage && document.getElementById('languageSetting')) {
    document.getElementById('languageSetting').value = savedLanguage;
  }
  
  if (savedNotifications !== null && document.getElementById('notificationsSetting')) {
    document.getElementById('notificationsSetting').checked = savedNotifications === 'true';
  }
}

/* --------------------------------------------
   🚀 INITIALIZATION
-------------------------------------------- */

// Initialize all user profile features
function initializeUserProfile() {
  // Check authentication first
  if (!checkAuthentication()) {
    return false;
  }
  
  // Update user display
  updateUserDisplay();
  
  // Initialize dropdown menu
  initializeDropdown();
  
  // Initialize settings popup
  initializeSettingsPopup();
  
  // Attach logout handler
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Attach profile navigation handler
  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      if (currentUser) {
        // Navigate to role-specific profile page
        if (currentUser.role === 'medtech') {
          window.electronAPI.navigate('Role_medtech/profile_medtech');
        } else if (currentUser.role === 'pharmacist') {
          window.electronAPI.navigate('Role_pharmacy/profile_pharmacy');
        } else if (currentUser.role === 'admin') {
          // TODO: Create profile_admin.html
          console.warn('Profile page not yet available for admin role');
        }
      }
    });
  }
  

  /* --------------------------------------------
   📷 Popup Scan Barcode (ใช้โค้ดใหม่ส่วนนี้)
-------------------------------------------- */
const scannerOverlay = document.getElementById('scannerOverlay');
const scanBtn = document.getElementById('scanBarcodeBtn');
const closeScannerBtn = document.getElementById('closeScannerBtn');

// เมื่อกดปุ่ม "สแกนบาร์โค้ด"
scanBtn?.addEventListener('click', () => {
  scannerOverlay.style.display = 'flex'; // ให้แสดง scanner popup
});

// เมื่อกดปุ่ม "ปิด" ใน scanner popup
closeScannerBtn?.addEventListener('click', () => {
  scannerOverlay.style.display = 'none'; // ให้ซ่อน scanner popup
});

  const langBtn = document.getElementById('langToggle');
  langBtn?.addEventListener('click', () => {
    langBtn.textContent = langBtn.textContent === 'TH' ? 'EN' : 'TH';
  });

  // Listen for profile updates from profile page
  window.addEventListener('userProfileUpdated', (event) => {
    console.log('🔄 Profile updated, refreshing user display');
    // Update the current user in session
    const currentUser = getCurrentUser();
    if (currentUser && event.detail.user) {
      // Merge updated data
      Object.assign(currentUser, event.detail.user);
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      localStorage.setItem('userSession', JSON.stringify(currentUser));
    }
    // Refresh the display
    updateUserDisplay();
  });

  return true;
}// Auto-initialize on DOM load if not called manually
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Don't auto-initialize here, let each page call it explicitly
  });
}


