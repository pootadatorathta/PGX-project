/* ============================================
   📊 INFORMATION PAGE - PATIENT TRACKING
   ============================================ */

let specimenSlaMap = {};

/* ========= Bootstrap ========= */
window.addEventListener('DOMContentLoaded', async () => {
  // Initialize user profile (from userProfile.js)
  if (!initializeUserProfile()) return;
  
  try {
    // 1. ดึงข้อมูล SLA มาเก็บในตัวแปรที่สร้างไว้
    specimenSlaMap = await window.electronAPI.getSpecimenSLA();
    console.log('✅ Fetched SLA Map:', specimenSlaMap);
    console.log('🔍 SLA Map Keys:', Object.keys(specimenSlaMap));
    console.log('🔍 SLA Map Values:', Object.values(specimenSlaMap));

    // 2. ดึงข้อมูล Test Requests
    const testRequests = await window.electronAPI.getTestRequests();
    console.log('📦 Test Requests:', testRequests);
    
    renderAllTables(testRequests); 
    
    await updateStatsFromAPI();
  } catch (e) {
    console.error('fetch test requests error', e);
    
    renderAllTables([]);
  }
});

/* ========= Elements & Events ========= */

// Helper function for smooth scroll with offset
function smoothScrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });
  }
}

// Stat card click handlers - scroll to corresponding section
document.getElementById('cardAll')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('cardPending')?.addEventListener('click', () => {
  smoothScrollToSection('sectionPending');
});

document.getElementById('cardNeed2')?.addEventListener('click', () => {
  smoothScrollToSection('sectionAwaiting');
});

document.getElementById('cardNeed1')?.addEventListener('click', () => {
  smoothScrollToSection('sectionAwaiting');
});

document.getElementById('cardDone')?.addEventListener('click', () => {
  smoothScrollToSection('sectionDone');
});

document.getElementById('cardReject')?.addEventListener('click', () => {
  smoothScrollToSection('sectionReject');
});

document.getElementById('searchInput')?.addEventListener('input', async e => {
  const kw = e.target.value.trim();
  try {
    const data = kw ? await window.electronAPI.searchTestRequests(kw) : await window.electronAPI.getTestRequests();
    
    // 🚩 [แก้ไขจุดที่ 3]
    renderAllTables(data); 

    await updateStatsFromAPI();
  } catch (err) {
    console.error('search error', err);
    renderAllTables([]); // ⭐️ เพิ่มบรรทัดนี้ด้วยเผื่อ search error
  }
});



 
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

/* ========= Table Renderer (แสดงข้อมูล Test Requests) ========= */

// Helper function to determine TAT badge status and color
function getTATBadgeClass(status) {
  // Normalize status to lowercase for comparison
  const statusLower = (status || '').toLowerCase().trim();
  
  // 🟢 Green - Done (Completed)
  if (statusLower === 'done') {
    return 'status-done';
  }
  
  // 🔵 Blue - Pending
  if (statusLower === 'pending') {
    return 'status-pending';
  }
  
  // 🟡 Yellow - Needs 1 confirmation
  if (statusLower === 'need 1 confirmation') {
    return 'status-pending-1';
  }
  
  // 🟠 Orange - Needs 2 confirmations
  if (statusLower === 'need 2 confirmation') {
    return 'status-pending-2';
  }
  
  // 🔴 Red - Rejected
  if (statusLower === 'reject') {
    return 'status-reject';
  }
  
  // Default for other statuses
  return 'status-default';
}

/* ========= TAT Warning Calculation ========= */
function calculateTATWarning(requestDate, slaTime, status) {
  // Only calculate for non-done and non-reject cases
  const statusLower = status?.toLowerCase() || '';
  if (!requestDate || statusLower === 'done' || statusLower === 'reject') {
    return { warning: false, percentage: 0, overdue: false };
  }

  const startDate = new Date(requestDate);
  const now = new Date();
  
  // Check if date is valid
  if (isNaN(startDate.getTime())) {
    console.error('❌ Invalid date:', requestDate);
    return { warning: false, percentage: 0, overdue: false };
  }
  
  // Use provided SLA time in DAYS (not hours)
  let slaDays = parseFloat(slaTime);
  
  // If no valid SLA time provided, don't show warnings
  if (!slaDays || slaDays <= 0) {
    console.warn('⚠️ No valid SLA time:', slaTime);
    return { warning: false, percentage: 0, overdue: false };
  }
  
  // Calculate elapsed time in days
  const elapsedMs = now - startDate;
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  
  // Calculate percentage
  const percentage = (elapsedDays / slaDays) * 100;
  
  console.log('📊 TAT Calculation:', {
    requestDate,
    startDate: startDate.toISOString(),
    now: now.toISOString(),
    elapsedMs,
    elapsedDays: elapsedDays.toFixed(2),
    slaDays,
    percentage: percentage.toFixed(2),
    warning: percentage > 80 && percentage <= 100,
    overdue: percentage > 100
  });
  
  return {
    warning: percentage > 80 && percentage <= 100,
    overdue: percentage > 100,
    percentage: Math.round(percentage)
  };
}

/* ==================================================
   ✅ RENDERER ใหม่สำหรับ 4 ตาราง
   ================================================== */

/**
 * ฟังก์ชันหลัก: รับข้อมูลทั้งหมด แล้วกรองเพื่อส่งไป render ลง 4 ตาราง
 */
function renderAllTables(allRequests) {
  // 1. กรองข้อมูลตามสถานะ (ใช้ .toLowerCase() เพื่อความแน่นอน)
  const pendingList = allRequests.filter(r => (r.status || '').toLowerCase() === 'pending');
  const need2List = allRequests.filter(r => (r.status || '').toLowerCase() === 'need 2 confirmation');
  const need1List = allRequests.filter(r => (r.status || '').toLowerCase() === 'need 1 confirmation');
  const doneList = allRequests.filter(r => (r.status || '').toLowerCase() === 'done');
  const rejectList = allRequests.filter(r => (r.status || '').toLowerCase() === 'reject');

  // 2. ดึง Element ของ tbody ทั้งหมด (จาก HTML)
  const tbodyPending = document.querySelector('#tablePending tbody');
  const tbodyNeed2 = document.querySelector('#tableNeed2 tbody');
  const tbodyNeed1 = document.querySelector('#tableNeed1 tbody');
  const tbodyDone = document.querySelector('#tableDone tbody');
  const tbodyReject = document.querySelector('#tableReject tbody');

  // 3. ส่งข้อมูลไป render แต่ละตาราง
  renderTableRows(tbodyPending, pendingList);
  renderTableRows(tbodyNeed2, need2List);
  renderTableRows(tbodyNeed1, need1List);
  renderTableRows(tbodyDone, doneList);
  renderTableRows(tbodyReject, rejectList);
}

/**
 * ฟังก์ชันช่วย: รับ tbody และ list ข้อมูล เพื่อสร้างแถว (tr)
 * (โค้ดส่วนนี้เกือบทั้งหมดมาจากฟังก์ชัน renderTestRequests เดิมของคุณ)
 */
function renderTableRows(tbody, data) {
  // 0. ตรวจสอบว่า tbody มีจริงหรือไม่
  if (!tbody) {
    console.error('ไม่พบ tbody element');
    return;
  }
  
  tbody.innerHTML = ''; // ล้างข้อมูลเก่า

  // 1. แสดงผลว่า "ไม่พบข้อมูล" ถ้า data ว่าง
  if (!data || data.length === 0) {
    // ต้องใช้ colspan="8" เพราะตารางใหม่มี 8 คอลัมน์
    tbody.innerHTML = `<tr class="no-data-row"><td colspan="8">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  // 2. วนลูปสร้างแถว
  data.forEach(req => {
    const patient = req.patient || {};
    const patientName = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim() || '-';
    const encodedPatientName = encodeURIComponent(patientName);
    const patientId = patient.patient_id || req.patient_id || '-';
    const hospitalId = patient.hospital_id || '-';
    const requestDate = req.request_date || req.created_at;
    const received = requestDate ? new Date(requestDate).toLocaleDateString('th-TH') : '-';
    const testTarget = req.test_target || '-';
    const status = req.status || '-';
    const specimen = req.Specimen || '-';

    // Get SLA time from map (case-insensitive lookup)
    const specimenKey = (specimen || '').toLowerCase();
    const slaTime = specimenSlaMap[specimenKey];
    
    // Format status display text (replace underscores with spaces)
    const statusDisplay = status ? status.replace(/_/g, ' ') : '-';

    const dotClass = getTATBadgeClass(status);
    
    // Calculate TAT warning with actual SLA time from database
    const tatWarning = calculateTATWarning(requestDate, slaTime, status);
    
    // Debug logging for request 43
    if (req.request_id === 43) {
      console.log(`🔍 DEBUG Request ${req.request_id}:`, {
        specimen,
        specimenKey,
        slaTime,
        requestDate,
        requestDateType: typeof requestDate,
        status,
        tatWarning,
        fullRequest: req,
        specimenSlaMap
      });
    }
    
    const tr = document.createElement('tr');
    tr.setAttribute('data-request-id', req.request_id);

    if (tatWarning.overdue) {
      tr.classList.add('tat-overdue');
    } else if (tatWarning.warning) {
      tr.classList.add('tat-warning');
    }
    
    // 3. สร้าง HTML ของแถว (เช็คให้แน่ใจว่าครบ 8 <td>)
    tr.innerHTML = `
      <td>${req.request_id || '-'}</td>
      <td>${hospitalId}</td>
      <td>${patientName}</td>
      <td>${testTarget}</td>
      <td>${received}</td>
      <td>${specimen}</td>
      <td>
        <div class="tat-status">
          <span class="tat-dot ${dotClass}"></span>
          <span>${statusDisplay}</span>
          ${tatWarning.warning ? `<i class="fas fa-exclamation-triangle tat-warning-icon" title="TAT > 80% (${tatWarning.percentage}%)"></i>` : ''}
          ${tatWarning.overdue ? `<i class="fas fa-exclamation-circle tat-overdue-icon" title="TAT > 100% - Overdue! (${tatWarning.percentage}%)"></i>` : ''}
        </div>
      </td>
      <td>
        ${status?.toLowerCase() === 'done' ? `
          <button
            class="pdf-btn viewpdf-btn-medtech"
            data-request-id="${req.request_id || ''}"
            data-patient-name="${encodedPatientName}"
          >
            <i class="fas fa-file-pdf"></i> ดู PDF
          </button>
        ` : status?.toLowerCase() === 'reject' ? `
          <button class="reject-reason-btn" onclick="showRejectReason(${req.request_id})">
            <i class="fas fa-info-circle"></i> ดูเหตุผล
          </button>
        ` : ''}
      </td>
    `;
    tr.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        //showPage('input_step1_medtech', patientId);
      }
    });
    tbody.appendChild(tr);
  });
}

/* ========= Stats (ดึงจาก API) ========= */
async function updateStatsFromAPI() {
  try {
    const stats = await window.electronAPI.getTestRequestStats('all');
    
    document.getElementById('statAll').textContent = stats.all || 0;
    document.getElementById('statPending').textContent = stats.pending || 0;
    document.getElementById('statPost').textContent = stats.done || 0;
    document.getElementById('statReject').textContent = stats.reject || 0;
    document.getElementById('statPre').textContent = stats.need2 || stats.need2Confirmation || 0;
    document.getElementById('statAnalytic').textContent = stats.need1 || stats.need1Confirmation || 0;

  } catch (e) {
    console.error('Error fetching stats:', e);
    // Set to 0 if error
    document.getElementById('statAll').textContent = 0;
    document.getElementById('statPending').textContent = 0;
    document.getElementById('statPost').textContent = 0;
    document.getElementById('statReject').textContent = 0;
    document.getElementById('statPre').textContent = 0;
    document.getElementById('statAnalytic').textContent = 0;
  }
}

/* ========= Edit / View PDF / Navigate ========= */
async function showRejectReason(requestId) {
  try {
    const req = await window.electronAPI.getTestRequestById(requestId);
    if (!req) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบข้อมูล',
        text: 'ไม่สามารถดึงข้อมูล Test Request ได้'
      });
      return;
    }
    
    const rejectionReason = req.rejection_reason || 'ไม่มีเหตุผลที่ระบุ';
    const rejectedBy = req.rejected_by || '-';
    const rejectedAt = req.rejected_at ? new Date(req.rejected_at).toLocaleString('th-TH') : '-';
    
    Swal.fire({
      icon: 'info',
      title: 'เหตุผลการปฏิเสธ',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>เคสเลขที่:</strong> ${requestId}</p>
          <p><strong>เหตุผล:</strong></p>
          <p style="background: #f3f4f6; padding: 10px; border-radius: 5px; margin: 10px 0;">${rejectionReason}</p>
          <p><strong>ปฏิเสธโดย:</strong> ${rejectedBy}</p>
          <p><strong>วันที่ปฏิเสธ:</strong> ${rejectedAt}</p>
        </div>
      `,
      confirmButtonText: 'ปิด',
      width: '600px'
    });
  } catch (error) {
    console.error('❌ Error fetching reject reason:', error);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'ไม่สามารถดึงข้อมูลเหตุผลการปฏิเสธได้'
    });
  }
}

async function editTestRequest(requestId) {
  try {
    const req = await window.electronAPI.getTestRequestById(requestId);
    if (!req) return alert('ไม่พบข้อมูล Test Request');
    
    // TODO: เปิด modal หรือฟอร์มแก้ไข (ต้องสร้างเพิ่ม)
    alert(`แก้ไข Request ID: ${requestId}\nPatient: ${req.patient?.first_name || ''}\nStatus: ${req.status}`);
  } catch (e) { 
    console.error(e); 
    alert('เกิดข้อผิดพลาดในการดึงข้อมูล'); 
  }
}

// ⭐️ (ส่วนนี้ขาดหายไปจากไฟล์ที่คุณส่งมา ผมเติมให้)
async function viewPDF(requestId, patientName) {
  try {
    // Store data in sessionStorage
    sessionStorage.setItem('selectedRequestId', requestId);
    sessionStorage.setItem('selectedPatientName', patientName);
    
    // Navigate to PDF viewer page
    window.electronAPI.navigate('showpdf_medtech');
  } catch (error) {
    console.error('❌ Error preparing PDF view:', error);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'ไม่สามารถเปิด PDF ได้'
    });
  }
}

function showPage(pageName, patientId) {
  sessionStorage.setItem('selectedPatientId', patientId);
  window.electronAPI?.navigate(pageName);
}

// Make functions globally accessible for onclick handlers
window.showRejectReason = showRejectReason;
window.viewPDF = viewPDF;
window.editTestRequest = editTestRequest;

/* ========= Light/Dark toggle (ตัวอย่าง) ========= */

document.getElementById('langToggle')?.addEventListener('click', (e) => {
  e.target.textContent = e.target.textContent === 'TH' ? 'EN' : 'TH';
});

document.addEventListener('click', (event) => {
  const pdfButton = event.target.closest('.viewpdf-btn-medtech');
  if (!pdfButton) return;

  const requestId = Number(pdfButton.dataset.requestId);
  const patientName = decodeURIComponent(pdfButton.dataset.patientName || '');
  sessionStorage.setItem('selectedRequestId', requestId);
  sessionStorage.setItem('selectedPatientName', patientName);
  window.electronAPI.navigate('showpdf_medtech');
});