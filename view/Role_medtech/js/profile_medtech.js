/* ============================================
   👤 PROFILE PAGE - Medtech
   ============================================ */

// DOM Elements
const profileForm = document.getElementById('profileForm');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const profileMessage = document.getElementById('profileMessage');
const userDisplayName = document.getElementById('userDisplayName');

// Signature elements
const signatureInput = document.getElementById('signatureInput');
const btnUploadSignature = document.getElementById('btnUploadSignature');
const btnDeleteSignature = document.getElementById('btnDeleteSignature');
const signaturePreview = document.getElementById('signaturePreview');
const signaturePlaceholder = document.getElementById('signaturePlaceholder');
const signatureImage = document.getElementById('signatureImage');

// Info elements
const infoUsername = document.getElementById('infoUsername');
const infoRole = document.getElementById('infoRole');
const infoHospitalId = document.getElementById('infoHospitalId');
const infoCreatedAt = document.getElementById('infoCreatedAt');

// Back button
const btnBack = document.getElementById('btnBack');

// Current user data
let currentUser = null;
let currentProfile = null;

/* ============================================
   🔹 Load User Profile
   ============================================ */
async function loadUserProfile() {
  try {
    // Get current user from session
    const sessionData = sessionStorage.getItem('currentUser');
    if (!sessionData) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่', 'error');
      window.electronAPI?.navigate('login');
      return;
    }

    currentUser = JSON.parse(sessionData);

    // Fetch full profile from database
    const result = await window.electronAPI.getUserProfile(currentUser.user_id);

    if (result.success && result.data) {
      currentProfile = result.data;
      displayProfile(currentProfile);
    } else {
      showMessage('error', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
    }
  } catch (error) {
    console.error('❌ Load profile error:', error);
    showMessage('error', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
}

/* ============================================
   🔹 Display Profile Data
   ============================================ */
function displayProfile(profile) {
  // Fill form inputs
  firstNameInput.value = profile.first_name || '';
  lastNameInput.value = profile.last_name || '';

  // Update session with full profile data
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  if (fullName) {
    // Store doctor_name in current user session for display
    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.doctor_name = fullName;
      currentUser.first_name = profile.first_name;
      currentUser.last_name = profile.last_name;
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }

  // Trigger update of user display in header (handled by userProfile.js)
  if (typeof updateUserDisplay === 'function') {
    updateUserDisplay();
  }

  // Display account info
  infoUsername.textContent = profile.username;
  infoRole.textContent = getRoleLabel(profile.role);
  infoHospitalId.textContent = profile.hospital_id || '-';
  infoCreatedAt.textContent = formatDate(profile.created_at);

  // Display signature if exists
  if (profile.signature_url) {
    displaySignature(profile.signature_url);
  }
}

/* ============================================
   🔹 Update Profile
   ============================================ */
profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const profileData = {
    first_name: firstNameInput.value.trim(),
    last_name: lastNameInput.value.trim()
  };

  // Validation
  if (!profileData.first_name || !profileData.last_name) {
    showMessage('error', 'กรุณากรอกชื่อและนามสกุล');
    return;
  }

  try {
    const result = await window.electronAPI.updateUserProfile(currentUser.user_id, profileData);

    if (result.success) {
      showMessage('success', result.message);
      
      // Update current profile
      currentProfile.first_name = profileData.first_name;
      currentProfile.last_name = profileData.last_name;
      
      // Update display
      const fullName = `${profileData.first_name} ${profileData.last_name}`;
      userDisplayName.textContent = `${fullName} (${currentProfile.role})`;

      // Update session storage with full name
      currentUser.first_name = profileData.first_name;
      currentUser.last_name = profileData.last_name;
      currentUser.doctor_name = fullName; // Update doctor_name for header display
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Also update localStorage for persistence
      localStorage.setItem('userSession', JSON.stringify(currentUser));
      
      // Trigger a custom event to update all user displays across the page
      window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
        detail: { fullName, user: currentUser } 
      }));
    } else {
      showMessage('error', result.message);
    }
  } catch (error) {
    console.error('❌ Update profile error:', error);
    showMessage('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
});

/* ============================================
   🔹 Signature Upload
   ============================================ */
btnUploadSignature?.addEventListener('click', () => {
  signatureInput.click();
});

signatureInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
    return;
  }

  // Validate file size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    Swal.fire('ข้อผิดพลาด', 'ขนาดไฟล์ต้องไม่เกิน 2MB', 'error');
    return;
  }

  try {
    // Show loading
    Swal.fire({
      title: 'กำลังอัปโหลด...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Read file as ArrayBuffer (will be converted to Buffer in main process)
    const fileBuffer = await file.arrayBuffer();

    // Upload to Supabase
    const uploadResult = await window.electronAPI.uploadSignature(
      currentUser.user_id,
      fileBuffer,
      file.name
    );

    if (!uploadResult.success) {
      Swal.fire('ข้อผิดพลาด', uploadResult.message, 'error');
      return;
    }

    // Update profile with new signature URL
    const updateResult = await window.electronAPI.updateUserProfile(
      currentUser.user_id,
      { signature_url: uploadResult.url }
    );

    if (updateResult.success) {
      currentProfile.signature_url = uploadResult.url;
      displaySignature(uploadResult.url);
      
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'อัปโหลดลายเซ็นเรียบร้อยแล้ว',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึก URL ลายเซ็นได้', 'error');
    }
  } catch (error) {
    console.error('❌ Upload signature error:', error);
    Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการอัปโหลดลายเซ็น', 'error');
  }

  // Clear input
  signatureInput.value = '';
});

/* ============================================
   🔹 Delete Signature
   ============================================ */
btnDeleteSignature?.addEventListener('click', async () => {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ',
    text: 'คุณต้องการลบลายเซ็นนี้ใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  try {
    // Delete from storage
    const deleteResult = await window.electronAPI.deleteSignatureFile(currentProfile.signature_url);

    // Update profile to remove signature URL
    const updateResult = await window.electronAPI.updateUserProfile(
      currentUser.user_id,
      { signature_url: null }
    );

    if (updateResult.success) {
      currentProfile.signature_url = null;
      hideSignature();
      
      Swal.fire({
        icon: 'success',
        title: 'ลบแล้ว!',
        text: 'ลบลายเซ็นเรียบร้อยแล้ว',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบลายเซ็นได้', 'error');
    }
  } catch (error) {
    console.error('❌ Delete signature error:', error);
    Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบลายเซ็น', 'error');
  }
});

/* ============================================
   🔹 Display/Hide Signature
   ============================================ */
function displaySignature(url) {
  signaturePlaceholder.style.display = 'none';
  signatureImage.src = url;
  signatureImage.style.display = 'block';
  btnDeleteSignature.style.display = 'inline-flex';
}

function hideSignature() {
  signaturePlaceholder.style.display = 'flex';
  signatureImage.style.display = 'none';
  signatureImage.src = '';
  btnDeleteSignature.style.display = 'none';
}

/* ============================================
   🔹 Helper Functions
   ============================================ */
function showMessage(type, message) {
  if (!profileMessage) return;

  profileMessage.textContent = message;
  profileMessage.className = `message ${type}`;
  profileMessage.style.display = 'block';

  setTimeout(() => {
    profileMessage.style.display = 'none';
  }, 5000);
}

function getRoleLabel(role) {
  const roleMap = {
    'medtech': 'เจ้าหน้าที่ห้องปฏิบัติการ',
    'pharmacist': 'เภสัชกร',
    'admin': 'ผู้ดูแลระบบ'
  };
  return roleMap[role] || role;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* ============================================
   🔹 Back Button
   ============================================ */
btnBack?.addEventListener('click', () => {
  // Navigate to role-specific dashboard
  const currentUser = getCurrentUser();
  if (currentUser) {
    if (currentUser.role === 'pharmacist') {
      window.electronAPI.navigate('Role_pharmacy/dashboard_pharmacy');
    } else if (currentUser.role === 'medtech') {
      window.electronAPI.navigate('Role_medtech/dashboard_medtech');
    } else {
      window.electronAPI.navigate('Role_admin/adminpage');
    }
  }
});

/* ============================================
   🔹 Initialize
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
});
