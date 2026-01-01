const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const bcrypt = require('bcryptjs');
const supabase = require('./supabase');
const { handleLogin } = require('./controllers/loginController');
const { generatePDF } = require('./controllers/pdfController');
const { fetchPatients, addPatient, searchPatientById, getPatientById, updatePatient, deletePatient } = require('./controllers/add_patient_Controller');
const { 
  fetchAccountDetails, 
  fetchAllAccounts, 
  createAccount, 
  updateAccount 
} = require('./controllers/accountController');
const {
  fetchAllTestRequests,
  searchTestRequests,
  getTestRequestById,
  addTestRequest,
  updateTestRequest,
  deleteTestRequest,
  getTestRequestStats
} = require('./controllers/testRequestController');
const {
  predictPhenotype,
  getAvailableAlleles,
  getAllelePossibleValues,
  getSupportedDnaTypes,
  getRulebase,
  refreshRulebase
} = require('./controllers/rulebaseController');
const {
  importExcelToSupabase,
  getRulebaseFromSupabase
} = require('./controllers/rulebaseImportController');
const {
  fetchAuditLogs,
  getUniqueUsers,
  getAuditLogDetail,
  getAuditStats
} = require('./controllers/auditLogController');

const {
  getDashboardSummary,
  getTestRequestStats: getReportStats,
  getTopDNATypes,
  getTopSpecimens,
  getRejectedSpecimens,
  getErrorRateTimeSeries,
  getTestRequestsTimeSeries,
  getTATStats
} = require('./controllers/reportController');

const {
  getSpecimens,
  addSpecimen,
  updateSpecimen,
  deleteSpecimen
} = require('./controllers/specimenController');

const {
  getUserProfile,
  updateUserProfile,
  uploadSignature,
  deleteSignature
} = require('./controllers/userProfileController');

const {
  findDiplotype,
  createReport,
  generatePGxPDF,
  uploadPDFToStorage,
  processCompleteReport
} = require('./controllers/pgxReportController');

// Password hashing configuration
const SALT_ROUNDS = 10;


let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow loading external resources (Supabase PDFs)
    },
    autoHideMenuBar: true,
    fullscreen: true,
  });

  // เริ่มต้นที่หน้า login
  mainWindow.loadFile(path.join(__dirname, 'view', 'login.html'));
}

// 📩 ฟัง event จาก renderer เพื่อเปลี่ยนหน้า
ipcMain.on('navigate', (event, page) => {
  console.log(` Navigate to: ${page}`);
  
  // Handle role-specific navigation
  const rolePages = {
    // Medtech pages
    'dashboard_medtech': 'view/Role_medtech/dashboard_medtech.html',
    'patient_medtech': 'view/Role_medtech/patient_medtech.html',
    'information_medtech': 'view/Role_medtech/information_medtech.html',
    'input_step1_medtech': 'view/Role_medtech/input_step1_medtech.html',
    'input_step2_medtech': 'view/Role_medtech/input_step2_medtech.html',
    'input_step3_medtech': 'view/Role_medtech/input_step3_medtech.html',
    'profile_medtech': 'view/Role_medtech/profile_medtech.html',
    'state_medtech': 'view/Role_medtech/state_informaiton_medtech.html',
    'showpdf_medtech': 'view/Role_medtech/show_pdf.html',
    
    // Pharmacy pages
    'dashboard_pharmacy': 'view/Role_pharmacy/dashboard_pharmacy.html',
    'test_request_manager': 'view/Role_pharmacy/test_request_manager.html',
    'information_pharmacy': 'view/Role_pharmacy/information_pharmacy.html',
    'verify_pharmacy': 'view/Role_pharmacy/verify_pharmacy.html',
    'fill_alleles_pharmacy': 'view/Role_pharmacy/fill_alleles_pharmacy.html',
    'confirm_alleles_pharmacy': 'view/Role_pharmacy/confirm_alleles_pharmacy.html',
    'profile_pharmacy': 'view/Role_pharmacy/profile_pharmacy.html',
    'showpdf_pharmacy': 'view/Role_pharmacy/show_pdf.html',
    
    // Admin pages (backward compatibility)
    'adminpage': 'view/Role_admin/adminpage.html',
    'auditlog': 'view/Role_admin/auditlog.html',
    'admin-settings': 'view/Role_admin/admin-settings.html',
    
    // Login page
    'login': 'view/login.html'
  };
  
  const filePath = rolePages[page] || `view/${page}.html`;
  mainWindow.loadFile(path.resolve(__dirname, filePath));
});

// 🔑 ฟังก์ชันตรวจสอบ Login (เรียกจาก controller)
ipcMain.handle('check-login', handleLogin);
// 📄 ฟังก์ชันสร้าง PDF (เรียกจาก controller)
ipcMain.handle('generate-pdf', async (event, reportData) => {
  return await generatePDF(reportData);
});

ipcMain.handle('get-patients', async () => {
  try {
    return await fetchPatients();
  } catch (err) {
    console.error('❌ Fetch Error:', err.message);
    return [];
  }
});

ipcMain.handle('add-patient', async (event, patientData, currentUser) => {
  try {
    await addPatient(patientData, currentUser);
    return { success: true, message: 'บันทึกข้อมูลสำเร็จ!' };
  } catch (err) {
    console.error('❌ Insert Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
});

ipcMain.handle('search-patient', async (event, patientId) => {
  try {
    return await searchPatientById(patientId);
  } catch (err) {
    console.error('❌ Search Error:', err.message);
    return [];
  }
});

// 👤 Patient CRUD - get by id
ipcMain.handle('get-patient-by-id', async (event, patientId) => {
  try {
    return await getPatientById(patientId);
  } catch (err) {
    console.error('❌ Get Patient Error:', err.message);
    return null;
  }
});

// 👤 Patient CRUD - update
ipcMain.handle('update-patient', async (event, payload) => {
  try {
    const { patientId, data, currentUser } = payload || {};
    const result = await updatePatient(patientId, data, currentUser);
    return { success: true, data: result, message: 'อัปเดตข้อมูลสำเร็จ!' };
  } catch (err) {
    console.error('❌ Update Patient Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ป่วย' };
  }
});

// 👤 Patient CRUD - delete
ipcMain.handle('delete-patient', async (event, patientId, currentUser) => {
  try {
    const result = await deletePatient(patientId, currentUser);
    return result; // result already contains { success, message }
  } catch (err) {
    console.error('❌ Delete Patient Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ป่วย' };
  }
});

// 👥 Account Management Handlers
ipcMain.handle('fetch-account-details', async (event, userId) => {
  try {
    return await fetchAccountDetails(userId);
  } catch (err) {
    console.error('❌ Account Fetch Error:', err.message);
    return null;
  }
});

ipcMain.handle('fetch-all-accounts', async () => {
  try {
    return await fetchAllAccounts();
  } catch (err) {
    console.error('❌ Accounts Fetch Error:', err.message);
    return [];
  }
});

// Password hashing handler
ipcMain.handle('hash-password', async (event, password) => {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (err) {
    console.error('❌ Password Hash Error:', err.message);
    throw err;
  }
});

ipcMain.handle('create-account', async (event, userData, currentUser) => {
  try {
    const result = await createAccount(userData, currentUser);
    return { success: true, data: result, message: 'บันทึกข้อมูลผู้ใช้สำเร็จ!' };
  } catch (err) {
    console.error('❌ Account Creation Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้' };
  }
});

ipcMain.handle('update-account', async (event, userData, currentUser) => {
  try {
    const result = await updateAccount(userData, currentUser);
    return { success: true, data: result, message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ!' };
  } catch (err) {
    console.error('❌ Account Update Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตบัญชีผู้ใช้' };
  }
});

ipcMain.handle('delete-account', async (event, userId) => {
  try {
    await supabase
      .from('system_users')
      .delete()
      .eq('user_id', userId);
    return { success: true, message: 'ลบบัญชีผู้ใช้สำเร็จ!' };
  } catch (err) {
    console.error('❌ Account Deletion Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้' };
  }
});

// 📋 Specimen Management Handlers
ipcMain.handle('get-specimens', async () => {
  try {
    return await getSpecimens();
  } catch (err) {
    console.error('❌ Get Specimens Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิ่งส่งตรวจ' };
  }
});

ipcMain.handle('add-specimen', async (event, specimenData) => {
  try {
    return await addSpecimen(specimenData);
  } catch (err) {
    console.error('❌ Add Specimen Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสิ่งส่งตรวจ' };
  }
});

ipcMain.handle('update-specimen', async (event, specimenId, specimenData) => {
  try {
    return await updateSpecimen(specimenId, specimenData);
  } catch (err) {
    console.error('❌ Update Specimen Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขสิ่งส่งตรวจ' };
  }
});

ipcMain.handle('delete-specimen', async (event, specimenId) => {
  try {
    return await deleteSpecimen(specimenId);
  } catch (err) {
    console.error('❌ Delete Specimen Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบสิ่งส่งตรวจ' };
  }
});

// 👤 User Profile Handlers
ipcMain.handle('get-user-profile', async (event, userId) => {
  try {
    return await getUserProfile(userId);
  } catch (err) {
    console.error('❌ Get User Profile Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' };
  }
});

ipcMain.handle('update-user-profile', async (event, userId, profileData) => {
  try {
    return await updateUserProfile(userId, profileData);
  } catch (err) {
    console.error('❌ Update User Profile Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' };
  }
});

ipcMain.handle('upload-signature', async (event, userId, fileBuffer, fileName) => {
  try {
    // Convert ArrayBuffer to Buffer in main process (Node.js has Buffer)
    const buffer = Buffer.from(fileBuffer);
    return await uploadSignature(userId, buffer, fileName);
  } catch (err) {
    console.error('❌ Upload Signature Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดลายเซ็น' };
  }
});

ipcMain.handle('delete-signature', async (event, signatureUrl) => {
  try {
    return await deleteSignature(signatureUrl);
  } catch (err) {
    console.error('❌ Delete Signature Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบลายเซ็น' };
  }
});

// 🧪 Test Request Handlers
ipcMain.handle('get-test-requests', async () => {
  try {
    return await fetchAllTestRequests();
  } catch (err) {
    console.error('❌ Fetch Test Requests Error:', err.message);
    return [];
  }
});

ipcMain.handle('search-test-requests', async (event, searchTerm) => {
  try {
    return await searchTestRequests(searchTerm);
  } catch (err) {
    console.error('❌ Search Test Requests Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-test-request-by-id', async (event, requestId) => {
  try {
    return await getTestRequestById(requestId);
  } catch (err) {
    console.error('❌ Get Test Request Error:', err.message);
    return null;
  }
});

ipcMain.handle('add-test-request', async (event, requestData) => {
  try {
    const result = await addTestRequest(requestData);
    return { success: true, data: result, message: 'บันทึกข้อมูลสำเร็จ!' };
  } catch (err) {
    console.error('❌ Add Test Request Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
});

// Confirm test request
ipcMain.handle('confirm-test-request', async (event, requestId, userId) => {
  try {
    const { confirmTestRequest } = require('./controllers/testRequestController');
    return await confirmTestRequest(requestId, userId);
  } catch (err) {
    console.error('❌ Confirm Test Request Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาด' };
  }
});

// Reject test request
ipcMain.handle('reject-test-request', async (event, requestId, userId, reason) => {
  try {
    const { rejectTestRequest } = require('./controllers/testRequestController');
    return await rejectTestRequest(requestId, userId, reason);
  } catch (err) {
    console.error('❌ Reject Test Request Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาด' };
  }
});

ipcMain.handle('update-test-request', async (event, payload) => {
  try {
    const { requestId, data } = payload || {};
    const result = await updateTestRequest(requestId, data);
    return { success: true, data: result, message: 'อัปเดตข้อมูลสำเร็จ!' };
  } catch (err) {
    console.error('❌ Update Test Request Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' };
  }
});

ipcMain.handle('delete-test-request', async (event, requestId) => {
  try {
    const ok = await deleteTestRequest(requestId);
    return { success: ok, message: ok ? 'ลบข้อมูลสำเร็จ!' : 'ไม่สามารถลบข้อมูลได้' };
  } catch (err) {
    console.error('❌ Delete Test Request Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' };
  }
});

ipcMain.handle('get-test-request-stats', async (event, timeFilter = 'today') => {
  try {
    return await getTestRequestStats(timeFilter);
  } catch (err) {
    console.error('❌ Get Stats Error:', err.message);
    return { all: 0, need2Confirmation: 0, need1Confirmation: 0, done: 0, reject: 0 };
  }
});

// 📊 PGx Report Handlers
ipcMain.handle('find-diplotype', async (event, geneSymbol, genotype) => {
  try {
    return await findDiplotype(geneSymbol, genotype);
  } catch (err) {
    console.error('❌ Find Diplotype Error:', err.message);
    return null;
  }
});

ipcMain.handle('create-pgx-report', async (event, testData) => {
  console.log('========================================');
  console.log('IPC HANDLER: create-pgx-report called');
  console.log('testData received:', testData);
  console.log('========================================');
  try {
    return await processCompleteReport(testData);
  } catch (err) {
    console.error('❌ Create PGx Report Error:', err.message);
    console.error('Stack:', err.stack);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างรายงาน' };
  }
});


ipcMain.handle('get-specimen-sla', async () => {
  try {
    const { getSpecimenSLA } = require('./controllers/testRequestController');
    return await getSpecimenSLA();
  } catch (err) {
    console.error('❌ Get Specimen SLA Error:', err.message);
    return {};
  }
});

// 🧬 Rulebase handlers
ipcMain.handle('predict-phenotype', async (event, dnaType, alleles) => {
  try {
    return predictPhenotype(dnaType, alleles);
  } catch (err) {
    console.error('❌ Predict Phenotype Error:', err.message);
    return { genotype: '-', phenotype: '-', activity_score: 0, matched: false, error: err.message };
  }
});

ipcMain.handle('get-available-alleles', async (event, dnaType) => {
  try {
    return getAvailableAlleles(dnaType);
  } catch (err) {
    console.error('❌ Get Available Alleles Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-allele-possible-values', async (event, dnaType, alleleName) => {
  try {
    return getAllelePossibleValues(dnaType, alleleName);
  } catch (err) {
    console.error('❌ Get Allele Possible Values Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-supported-dna-types', async () => {
  try {
    return getSupportedDnaTypes();
  } catch (err) {
    console.error('❌ Get Supported DNA Types Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-rulebase', async () => {
  try {
    return await getRulebase();
  } catch (err) {
    console.error('❌ Get Rulebase Error:', err.message);
    return {};
  }
});

// 🔄 Import Excel to Supabase
ipcMain.handle('import-excel-to-supabase', async (event, excelFileName) => {
  try {
    const result = await importExcelToSupabase(excelFileName);
    return result;
  } catch (err) {
    console.error('❌ Import Excel Error:', err.message);
    return { success: false, error: err.message };
  }
});

// 🔄 Refresh Rulebase Cache
ipcMain.handle('refresh-rulebase', async () => {
  try {
    const result = await refreshRulebase();
    return { success: true, data: result };
  } catch (err) {
    console.error('❌ Refresh Rulebase Error:', err.message);
    return { success: false, error: err.message };
  }
});

// � Audit Log Handlers
ipcMain.handle('fetch-audit-logs', async (event, filters) => {
  try {
    return await fetchAuditLogs(filters);
  } catch (err) {
    console.error('❌ Fetch Audit Logs Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-audit-users', async () => {
  try {
    return await getUniqueUsers();
  } catch (err) {
    console.error('❌ Get Audit Users Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-audit-detail', async (event, logId) => {
  try {
    return await getAuditLogDetail(logId);
  } catch (err) {
    console.error('❌ Get Audit Detail Error:', err.message);
    return null;
  }
});

ipcMain.handle('get-audit-stats', async () => {
  try {
    return await getAuditStats();
  } catch (err) {
    console.error('❌ Get Audit Stats Error:', err.message);
    return { total: 0, byAction: {}, last24Hours: 0 };
  }
});

// �🚀 เริ่มต้น
// 📊 Dashboard Report Handlers
ipcMain.handle('get-dashboard-summary', async (event, timeFilter = 'today') => {
  try {
    const summary = await getDashboardSummary(timeFilter);
    return { success: true, data: summary };
  } catch (err) {
    console.error('❌ Get Dashboard Summary Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-top-dna-types', async (event, limit = 5, timeFilter = 'month') => {
  try {
    return await getTopDNATypes(limit, timeFilter);
  } catch (err) {
    console.error('❌ Get Top DNA Types Error:', err.message);
    return { labels: [], values: [] };
  }
});

ipcMain.handle('get-top-specimens', async (event, limit = 5, timeFilter = 'month') => {
  try {
    return await getTopSpecimens(limit, timeFilter);
  } catch (err) {
    console.error('❌ Get Top Specimens Error:', err.message);
    return { labels: [], values: [] };
  }
});

ipcMain.handle('get-rejected-specimens', async (event, timeFilter = 'month') => {
  try {
    return await getRejectedSpecimens(timeFilter);
  } catch (err) {
    console.error('❌ Get Rejected Specimens Error:', err.message);
    return { labels: [], values: [] };
  }
});

ipcMain.handle('get-error-rate-series', async (event, range = 'week') => {
  try {
    return await getErrorRateTimeSeries(range);
  } catch (err) {
    console.error('❌ Get Error Rate Series Error:', err.message);
    return { labels: [], values: [] };
  }
});

ipcMain.handle('get-usage-time-series', async (event, range = 'daily', timeFilter = 'week') => {
  try {
    return await getTestRequestsTimeSeries(range, timeFilter);
  } catch (err) {
    console.error('❌ Get Usage Time Series Error:', err.message);
    return { labels: [], values: [] };
  }
});

ipcMain.handle('get-tat-stats', async (event, timeFilter = 'today') => {
  try {
    return await getTATStats(timeFilter);
  } catch (err) {
    console.error('❌ Get TAT Stats Error:', err.message);
    return { inSLA: 0, inProgress: 0, overSLA: 0 };
  }
});

// �🚀 เริ่มต้น
app.whenReady().then(createWindow);

// ❌ ปิดโปรแกรมเมื่อปิดหน้าต่าง (Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// 🟥 ปิดแอปเมื่อได้รับ event จาก renderer
// 🟥 ปิดแอปเมื่อได้รับ event จาก renderer
ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  } else {
    console.error("❌ mainWindow not found");
  }
});


