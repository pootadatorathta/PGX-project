/* ============================================
   📋 ADMIN SETTINGS PAGE - Specimen Management
   ============================================ */

// DOM Elements
const specimenForm = document.getElementById('specimenForm');
const specimenNameInput = document.getElementById('specimenName');
const specimenTatInput = document.getElementById('specimenTat');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const formMessage = document.getElementById('form-message');
const specimenTableBody = document.querySelector('#specimen-table tbody');

// State
let editingSpecimenId = null;
let specimens = [];
let currentPage = 1;
const itemsPerPage = 10;

/* ============================================
   🔹 Load Specimens from Database
   ============================================ */
async function loadSpecimens() {
  try {
    const result = await window.electronAPI.getSpecimens();
    
    if (result.success) {
      specimens = result.data || [];
      renderSpecimenTable();
      console.log('✅ Loaded specimens:', specimens.length);
    } else {
      showMessage('error', 'ไม่สามารถโหลดข้อมูลได้: ' + result.message);
    }
  } catch (error) {
    console.error('❌ Load specimens error:', error);
    showMessage('error', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
}

/* ============================================
   🔹 Render Specimen Table with Pagination
   ============================================ */
function renderSpecimenTable() {
  if (!specimenTableBody) return;
  
  if (specimens.length === 0) {
    specimenTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 40px; color: var(--color-muted);">
          <i class="fa fa-inbox" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>
          ยังไม่มีข้อมูลสิ่งส่งตรวจในระบบ
        </td>
      </tr>
    `;
    hidePagination();
    return;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(specimens.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSpecimens = specimens.slice(startIndex, endIndex);
  
  specimenTableBody.innerHTML = paginatedSpecimens.map(specimen => `
    <tr data-id="${specimen.specimen_id}">
      <td>${specimen.specimen_name}</td>
      <td style="text-align: center;">${specimen.sla_time}</td>
      <td style="text-align: center;">
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editSpecimen(${specimen.specimen_id})" title="แก้ไข">
            <i class="fa fa-pen"></i>
          </button>
          <button class="btn-icon delete" onclick="confirmDeleteSpecimen(${specimen.specimen_id})" title="ลบ">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  renderPagination(totalPages);
}

/* ============================================
   🔹 Render Pagination Controls
   ============================================ */
function renderPagination(totalPages) {
  let paginationContainer = document.getElementById('pagination-container');
  
  if (!paginationContainer) {
    // Create pagination container if it doesn't exist
    const tableWrapper = document.querySelector('.specimen-table-wrapper') || specimenTableBody.closest('section');
    if (tableWrapper) {
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'pagination-container';
      paginationContainer.className = 'pagination-container';
      tableWrapper.appendChild(paginationContainer);
    } else {
      return;
    }
  }
  
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  paginationContainer.style.display = 'flex';
  paginationContainer.innerHTML = `
    <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>
      <i class="fa fa-angles-left"></i>
    </button>
    <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      <i class="fa fa-angle-left"></i>
    </button>
    <span class="page-info">หน้า ${currentPage} / ${totalPages}</span>
    <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      <i class="fa fa-angle-right"></i>
    </button>
    <button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>
      <i class="fa fa-angles-right"></i>
    </button>
    <span class="items-info">${specimens.length} รายการทั้งหมด</span>
  `;
}

/* ============================================
   🔹 Hide Pagination
   ============================================ */
function hidePagination() {
  const paginationContainer = document.getElementById('pagination-container');
  if (paginationContainer) {
    paginationContainer.style.display = 'none';
  }
}

/* ============================================
   🔹 Go to Page
   ============================================ */
window.goToPage = function(page) {
  const totalPages = Math.ceil(specimens.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderSpecimenTable();
  
  // Scroll to top of table
  specimenTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ============================================
   🔹 Form Submit Handler
   ============================================ */
specimenForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const specimenData = {
    specimen_name: specimenNameInput.value.trim(),
    sla_time: parseInt(specimenTatInput.value)
  };
  
  // Validation
  if (!specimenData.specimen_name) {
    showMessage('error', 'กรุณากรอกชื่อสิ่งส่งตรวจ');
    return;
  }
  
  if (isNaN(specimenData.sla_time) || specimenData.sla_time < 0) {
    showMessage('error', 'กรุณากรอก TAT ที่ถูกต้อง');
    return;
  }
  
  try {
    let result;
    
    if (editingSpecimenId) {
      // Update existing specimen
      result = await window.electronAPI.updateSpecimen(editingSpecimenId, specimenData);
    } else {
      // Add new specimen
      result = await window.electronAPI.addSpecimen(specimenData);
    }
    
    if (result.success) {
      showMessage('success', result.message);
      resetForm();
      currentPage = 1; // Reset to first page
      await loadSpecimens(); // Reload table
    } else {
      showMessage('error', result.message);
    }
  } catch (error) {
    console.error('❌ Submit error:', error);
    showMessage('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
});

/* ============================================
   🔹 Edit Specimen
   ============================================ */
window.editSpecimen = function(specimenId) {
  const specimen = specimens.find(s => s.specimen_id === specimenId);
  
  if (!specimen) {
    showMessage('error', 'ไม่พบข้อมูลที่ต้องการแก้ไข');
    return;
  }
  
  // Fill form with existing data
  specimenNameInput.value = specimen.specimen_name;
  specimenTatInput.value = specimen.sla_time;
  
  // Update UI to edit mode
  editingSpecimenId = specimenId;
  submitBtn.innerHTML = '<i class="fa fa-save"></i> บันทึก';
  cancelBtn.style.display = 'inline-flex';
  
  // Scroll to form
  specimenForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ============================================
   🔹 Delete Specimen (with confirmation)
   ============================================ */
window.confirmDeleteSpecimen = async function(specimenId) {
  const specimen = specimens.find(s => s.specimen_id === specimenId);
  
  if (!specimen) return;
  
  // Use SweetAlert2 if available, otherwise native confirm
  const confirmed = typeof Swal !== 'undefined' 
    ? await Swal.fire({
        title: 'ยืนยันการลบ',
        html: `คุณต้องการลบ <strong>${specimen.specimen_name}</strong> ใช่หรือไม่?<br><small>การลบนี้ไม่สามารถย้อนกลับได้</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก'
      }).then(result => result.isConfirmed)
    : confirm(`คุณต้องการลบ ${specimen.specimen_name} ใช่หรือไม่?`);
  
  if (!confirmed) return;
  
  try {
    const result = await window.electronAPI.deleteSpecimen(specimenId);
    
    if (result.success) {
      showMessage('success', result.message);
      await loadSpecimens();
    } else {
      showMessage('error', result.message);
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    showMessage('error', 'เกิดข้อผิดพลาดในการลบข้อมูล');
  }
};

/* ============================================
   🔹 Cancel Edit
   ============================================ */
cancelBtn?.addEventListener('click', () => {
  resetForm();
});

/* ============================================
   🔹 Reset Form
   ============================================ */
function resetForm() {
  specimenForm.reset();
  editingSpecimenId = null;
  submitBtn.innerHTML = '<i class="fa fa-plus"></i> เพิ่ม';
  cancelBtn.style.display = 'none';
  formMessage.textContent = '';
  formMessage.className = 'form-message';
}

/* ============================================
   🔹 Show Message
   ============================================ */
function showMessage(type, message) {
  if (!formMessage) return;
  
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    formMessage.textContent = '';
    formMessage.className = 'form-message';
  }, 5000);
}

/* ============================================
   🔹 Initialize Page
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user profile (auth check)
  if (typeof initializeUserProfile === 'function') {
    if (!initializeUserProfile()) {
      return; // User not authenticated
    }
  }
  
  // Load specimens from database
  await loadSpecimens();
});

// Navigation handlers (sidebar menu)
document.getElementById('admin-btn')?.addEventListener('click', () => {
  window.electronAPI?.navigate('adminpage');
});

document.getElementById('auditlog-btn')?.addEventListener('click', () => {
  window.electronAPI?.navigate('auditlog');
});

document.getElementById('admin_settings-btn')?.addEventListener('click', () => {
  window.electronAPI?.navigate('admin-settings');
});
