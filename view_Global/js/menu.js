/* ============================================================
   🧭 NAVIGATION BUTTONS
   ------------------------------------------------------------
   ▶️ Page navigation handlers
============================================================ */

// Medtech navigation
const patient_btn_medtech = document.getElementById('patient-btn-medtech');
patient_btn_medtech?.addEventListener('click', () => {
  window.electronAPI.navigate('patient_medtech');
});

const information_btn_medtech = document.getElementById('information-btn-medtech');
information_btn_medtech?.addEventListener('click', () => {
  window.electronAPI.navigate('information_medtech');
});

const dashboard_btn_medtech = document.getElementById('dashboard-btn-medtech');
dashboard_btn_medtech?.addEventListener('click', () => {
  window.electronAPI.navigate('dashboard_medtech');
});

const viewpdf_btn_medtech = document.getElementById('viewpdf-btn-medtech');
viewpdf_btn_medtech?.addEventListener('click', () => {
  window.electronAPI.navigate('showpdf_medtech');
}); 

// Pharmacy navigation
const information_btn_pharmacy = document.getElementById('information-btn-pharmacy');
information_btn_pharmacy?.addEventListener('click', () => {
  window.electronAPI.navigate('information_pharmacy');
});

const dashboard_btn_pharmacy = document.getElementById('dashboard-btn-pharmacy');
dashboard_btn_pharmacy?.addEventListener('click', () => {
  window.electronAPI.navigate('dashboard_pharmacy');
});

const test_request_manager_btn_pharmacy = document.getElementById('test-request-manager-btn-pharmacy');
test_request_manager_btn_pharmacy?.addEventListener('click', () => {
  window.electronAPI.navigate('test_request_manager');
});

const verify_btn_pharmacy = document.getElementById('verify-btn-pharmacy');
verify_btn_pharmacy?.addEventListener('click', () => {
  window.electronAPI.navigate('verify_pharmacy');
});

// Admin navigation
const admin_btn = document.getElementById('admin-btn');
admin_btn?.addEventListener('click', () => {
  window.electronAPI.navigate('adminpage');
});

const auditlog_btn = document.getElementById('auditlog-btn');
auditlog_btn?.addEventListener('click', () => {
  window.electronAPI.navigate('auditlog');
});

const admin_settings_btn = document.getElementById('admin_settings-btn');
admin_settings_btn?.addEventListener('click', () => {
  window.electronAPI.navigate('admin-settings');
});

const state_btn = document.getElementById('state-btn-medtech');
state_btn?.addEventListener('click', () => {
  window.electronAPI.navigate('state_medtech');
});


