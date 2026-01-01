// ===============================
// 🌐 Language Data
// ===============================
const langData = {
  en: {
    username: "Username",
    password: "Password",
    placeholderUser: "Enter your username",
    placeholderPass: "Enter your password",
    loginBtn: "Login",
    loginLoading: "Logging in...",
  },
  th: {
    username: "ชื่อผู้ใช้",
    password: "รหัสผ่าน",
    placeholderUser: "กรอกชื่อผู้ใช้",
    placeholderPass: "กรอกรหัสผ่าน",
    loginBtn: "เข้าสู่ระบบ",
    loginLoading: "กำลังเข้าสู่ระบบ...",
  },
};

// ===============================
// 🔧 Element References
// ===============================
const elements = {
  labelUsername: document.getElementById("label-username"),
  labelPassword: document.getElementById("label-password"),
  usernameInput: document.getElementById("username"),
  passwordInput: document.getElementById("password"),
  btnLogin: document.getElementById("btn-login"),
  btnEn: document.getElementById("lang-en"),
  btnTh: document.getElementById("lang-th"),
};

// ===============================
// ✨ Notyf Initialization (สำคัญ: ส่วนนี้คือที่กำหนดไอคอน)
// ===============================
const notyf = new Notyf({
  duration: 3000,
  position: { x: 'right', y: 'top' },
  types: [
    // 👇 ไอคอนเหล่านี้ดึงมาจาก Font Awesome ที่คุณติดตั้งไว้ใน HTML ครับ
    { type: 'success', background: '#34A853', icon: { className: 'fas fa-check-circle', tagName: 'i' } },
    { type: 'error', background: '#EA4335', icon: { className: 'fas fa-exclamation-circle', tagName: 'i' } },
    { type: 'warning', background: '#FBBC05', color: '#000', icon: { className: 'fas fa-exclamation-triangle', tagName: 'i' } }
  ]
});

// ===============================
// 🌐 Language Switcher
// ===============================
function setLanguage(lang) {
  const text = langData[lang];
  elements.labelUsername.textContent = text.username;
  elements.labelPassword.textContent = text.password;
  elements.usernameInput.placeholder = text.placeholderUser;
  elements.passwordInput.placeholder = text.placeholderPass;
  if (!elements.btnLogin.disabled) {
    elements.btnLogin.textContent = text.loginBtn;
  }
}

setLanguage("en");
elements.btnEn.addEventListener("click", () => setLanguage("en"));
elements.btnTh.addEventListener("click", () => setLanguage("th"));


/* ============================================
   🔔 POPUP NOTIFICATION FUNCTIONS (Using Notyf)
   ============================================ */

function showPopup(message, type = 'error') {
  if (type === 'warning') {
    notyf.open({ type: 'warning', message: message });
  } else if (type === 'success') {
    notyf.success(message);
  } else {
    notyf.error(message);
  }
}

function hidePopup() {
  notyf.dismissAll();
}

/* ============================================
   🔐 SESSION MANAGEMENT FUNCTIONS
   ============================================ */
// (ส่วนนี้เหมือนเดิม ไม่มีการเปลี่ยนแปลง)
function storeUserSession(userData) {
  const sessionData = {
    user_id: userData.user_id,
    username: userData.username,
    role: userData.role,
    hospital_id: userData.hospital_id,
    first_name: userData.first_name,
    last_name: userData.last_name,
    doctor_name: userData.doctor_name,
    loginTime: new Date().toISOString(),
    sessionId: generateSessionId()
  };
  localStorage.setItem('userSession', JSON.stringify(sessionData));
  sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
  console.log('✅ User session stored:', sessionData.doctor_name || sessionData.username, sessionData.role);
  return sessionData;
}
function generateSessionId() { return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }
function getUserSession() {
  try { const sessionData = localStorage.getItem('userSession'); return sessionData ? JSON.parse(sessionData) : null; }
  catch (error) { console.error('❌ Error reading user session:', error); return null; }
}
function clearUserSession() {
  localStorage.removeItem('userSession');
  localStorage.removeItem('userRole');
  sessionStorage.removeItem('currentUser');
  console.log('🗑️ User session cleared');
}
function isSessionValid(sessionData) {
  if (!sessionData || !sessionData.loginTime) return false;
  const loginTime = new Date(sessionData.loginTime);
  const now = new Date();
  const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
  return hoursSinceLogin < 24;
}
function checkExistingSession() {
  const sessionData = getUserSession();
  if (sessionData && isSessionValid(sessionData)) {
    console.log('🔄 Valid session found, auto-login for:', sessionData.username);
    sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
    navigateBasedOnRole(sessionData.role);
    return true;
  } else if (sessionData) { console.log('⏰ Session expired, clearing...'); clearUserSession(); }
  return false;
}
function navigateBasedOnRole(role) {
  if (role === 'medtech') { window.electronAPI.navigate('dashboard_medtech'); }
  else if (role === 'pharmacist') { window.electronAPI.navigate('dashboard_pharmacy'); }
  else if (role === 'admin') { window.electronAPI.navigate('adminpage'); }
  else { console.warn('❌ Unknown role:', role); showPopup(`Role "${role}" ไม่มีหน้าที่กำหนด`); }
}

/* ============================================
   🚪 LOGIN FORM HANDLER (Upgraded with Notyf)
   ============================================ */

elements.btnLogin.addEventListener('click', async (e) => {
  e.preventDefault();

  const username = elements.usernameInput.value.trim();
  const password = elements.passwordInput.value.trim();

  if (!username || !password) {
    showPopup("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน", 'warning');
    return;
  }

  const currentLang = elements.btnEn.classList.contains('active') ? 'en' : 'th';
  elements.btnLogin.disabled = true;
  elements.btnLogin.textContent = langData[currentLang].loginLoading;

  try {
    const result = await window.electronAPI.checkLogin({ username, password });

    if (!result.success) {
      showPopup(result.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      elements.btnLogin.disabled = false;
      elements.btnLogin.textContent = langData[currentLang].loginBtn;
      return;
    }

    const userData = result.data || {
      user_id: result.user_id,
      username: username,
      role: result.role,
      hospital_id: result.hospital_id
    };
    
    storeUserSession(userData);
    showPopup('เข้าสู่ระบบสำเร็จ!', 'success');
    
    setTimeout(() => {
      navigateBasedOnRole(userData.role || result.role);
    }, 800);
    
  } catch (error) {
    console.error('❌ Login error:', error);
    showPopup('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    const currentLang = elements.btnEn.classList.contains('active') ? 'en' : 'th';
    elements.btnLogin.disabled = false;
    elements.btnLogin.textContent = langData[currentLang].loginBtn;
  }
});

/* ============================================
   🔄 AUTO-LOGIN ON PAGE LOAD
   ============================================ */

function resetLoginForm() {
  elements.btnLogin.disabled = false;
  const currentLang = elements.btnEn.classList.contains('active') ? 'en' : 'th';
  elements.btnLogin.textContent = langData[currentLang].loginBtn;
  elements.usernameInput.value = '';
  elements.passwordInput.value = '';
  elements.usernameInput.disabled = false;
  elements.passwordInput.disabled = false;
  hidePopup();
  console.log('🔄 Login form reset to initial state');
}

// (ส่วนที่เหลือเหมือนเดิม ไม่มีการเปลี่ยนแปลง)
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 Checking for existing user session...');
  elements.btnLogin.disabled = false;
  elements.usernameInput.disabled = false;
  elements.passwordInput.disabled = false;
  elements.usernameInput.value = '';
  elements.passwordInput.value = '';
  resetLoginForm();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('clear') === 'true') {
    console.log('🗑️ Clearing session as requested...');
    clearUserSession();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (!checkExistingSession()) {
    console.log('👋 No valid session found, showing login form');
    setTimeout(() => { document.getElementById('username')?.focus(); }, 100);
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('🔄 Page became visible, ensuring form is enabled...');
    btn.disabled = false;
    elements.usernameInput.disabled = false;
    elements.passwordInput.disabled = false;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    console.log('🗑️ Keyboard shortcut detected - Clearing session...');
    clearUserSession();
    alert('Session cleared! Page will reload.');
    location.reload();
  }
});
function getCurrentUser() {
  try { const sessionData = sessionStorage.getItem('currentUser'); return sessionData ? JSON.parse(sessionData) : null; }
  catch (error) { console.error('❌ Error reading current user:', error); return null; }
}
function updateUserSession(updates) {
  const currentSession = getUserSession();
  if (currentSession) { const updatedSession = { ...currentSession, ...updates }; storeUserSession(updatedSession); return updatedSession; }
  return null;
}
window.userSession = { getCurrentUser, updateUserSession, clearUserSession, storeUserSession };