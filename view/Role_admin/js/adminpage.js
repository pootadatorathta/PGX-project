/* ============================================
   👥 ADMIN PAGE - USER MANAGEMENT
   ============================================
   Uses userProfile.js for session management
   ============================================ */

const userForm = document.getElementById("user-form");
const userTableBody = document.querySelector("#user-table tbody");
const formMessage = document.getElementById("form-message");
const togglePasswordButtons = document.querySelectorAll(".toggle-password");

// Modal elements
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("edit-user-form");
const editFormMessage = document.getElementById("edit-form-message");
const closeModalBtn = document.getElementById("closeModal");
const cancelEditBtn = document.getElementById("cancelEdit");

let users = [];
let isEditing = false;
let editingUserId = null;

// Hash password using bcrypt through IPC
async function hashPassword(password) {
  return await window.electronAPI.invoke('hash-password', password);
}

const roleLabels = {
  pharmacist: "Pharmacist",
  medtech: "MedTech",
};

function renderUsers() {
  console.log('🎨 Rendering users:', users.length, 'users');
  
  // Get fresh reference to tbody element
  const tbody = document.querySelector("#user-table tbody");
  
  if (!tbody) {
    console.error('❌ Table tbody not found!');
    return;
  }
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#666;">ไม่มีข้อมูลผู้ใช้งาน</td></tr>';
    return;
  }
  
  tbody.innerHTML = users
    .map(
      (user) => `
      <tr data-id="${user.user_id}">
        <td>${user.username}</td>
        <td>${user.hospital_id}</td>
        <td>${roleLabels[user.role] ?? user.role}</td>
        <td>
          <div class="button-group">
            <button type="button" class="table-action edit" data-action="edit" data-id="${user.user_id}">
              แก้ไข
            </button>
            <button type="button" class="table-action delete" data-action="delete" data-id="${user.user_id}">
              ลบ
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
  
  console.log('✅ Users rendered successfully');
}

function showMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

function resetMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

async function loadUsers() {
  try {
    const result = await window.electronAPI.fetchAllAccounts();
    console.log('📦 Loaded users:', result);
    users = result || [];
    renderUsers();
  } catch (error) {
    console.error('❌ Error loading users:', error);
    showMessage('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', 'error');
  }
}

function userExists(username, excludeUserId = null) {
  return users.some((user) => user.username === username && user.user_id !== excludeUserId);
}

// Show message in main form
function showMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

function resetMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

// Show message in edit modal
function showEditMessage(message, type = "success") {
  editFormMessage.textContent = message;
  editFormMessage.className = `form-message ${type}`;
}

function resetEditMessage() {
  editFormMessage.textContent = "";
  editFormMessage.className = "form-message";
}

// Modal functions
function openEditModal(user) {
  if (!editModal) {
    console.error('❌ Edit modal container not found');
    return;
  }

  const idField = document.getElementById('edit-user-id');
  const usernameField = document.getElementById('edit-username');
  const passwordField = document.getElementById('edit-password');
  const hospitalField = document.getElementById('edit-hospital-id');
  const roleField = document.getElementById('edit-role');

  if (!idField || !usernameField || !passwordField || !hospitalField || !roleField) {
    console.error('❌ Edit modal fields missing');
    return;
  }

  idField.value = user.user_id;
  usernameField.value = user.username;
  passwordField.value = '';
  hospitalField.value = user.hospital_id;
  roleField.value = user.role;
  
  resetEditMessage();
  editModal.style.display = 'flex';
  editModal.classList.add('show');
}

function closeEditModal() {
  if (!editModal) {
    return;
  }

  editModal.classList.remove('show');
  editModal.style.display = 'none';
  editForm?.reset();
  resetEditMessage();
}

// Add new user form submission
userForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetMessage();

  const formData = new FormData(userForm);
  const userData = {
    username: formData.get("username").trim(),
    password: formData.get("password"),
    hospital_id: parseInt(formData.get("hospital_id").trim(), 10),
    role: formData.get("role"),
  };

  if (!userData.username || !userData.password || !userData.hospital_id || !userData.role) {
    showMessage("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
    return;
  }

  if (userExists(userData.username)) {
    showMessage("มี Username นี้อยู่แล้ว", "error");
    return;
  }

  try {
    // Hash password
    userData.password_hash = await hashPassword(userData.password);
    delete userData.password;

    const result = await window.electronAPI.createAccount(userData);
    
    if (result.success) {
      showMessage("เพิ่มผู้ใช้งานเรียบร้อยแล้ว");
      await loadUsers();
      userForm.reset();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Form submission error:', error);
    showMessage(error.message || "เกิดข้อผิดพลาดในการดำเนินการ", "error");
  }
});

// Edit user form submission
editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetEditMessage();

  const userId = document.getElementById('edit-user-id').value;
  const password = document.getElementById('edit-password').value;
  const hospital_id = parseInt(document.getElementById('edit-hospital-id').value, 10);
  const role = document.getElementById('edit-role').value;

  if (!hospital_id || !role) {
    showEditMessage("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
    return;
  }

  try {
    const userData = {
      user_id: userId,
      hospital_id: hospital_id,
      role: role
    };

    // If password is provided, hash it
    if (password && password.trim()) {
      userData.password_hash = await hashPassword(password);
    }

    const result = await window.electronAPI.updateAccount(userData);
    
    if (result.success) {
      showEditMessage("อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว", "success");
      await loadUsers();
      
      // Close modal after 1 second
      setTimeout(() => {
        closeEditModal();
      }, 1000);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Edit form submission error:', error);
    showEditMessage(error.message || "เกิดข้อผิดพลาดในการอัปเดต", "error");
  }
});

// Modal event listeners
closeModalBtn?.addEventListener('click', closeEditModal);
cancelEditBtn?.addEventListener('click', closeEditModal);

// Close modal when clicking outside
editModal?.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// Table row click handler - Use event delegation
document.addEventListener("click", async (event) => {
  const tableTarget = event.target;
  if (!tableTarget.closest('#user-table')) return;
  
  const action = tableTarget.dataset.action;
  const userId = tableTarget.dataset.id;

  if (!action || !userId) return;

  if (action === 'edit') {
    const user = users.find(u => u.user_id === parseInt(userId));
    if (user) {
      openEditModal(user);
    }
  } else if (action === 'delete') {
    if (confirm('คุณต้องการลบผู้ใช้งานนี้ใช่หรือไม่?')) {
      try {
        const result = await window.electronAPI.deleteAccount(userId);
        if (result.success) {
          await loadUsers();
          showMessage(result.message);
        } else {
          showMessage(result.message, 'error');
        }
      } catch (error) {
        console.error('❌ Delete error:', error);
        showMessage('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
      }
    }
  }
});

// Password toggle - use event delegation to work with dynamically added elements
document.addEventListener("click", (event) => {
  const button = event.target.closest('.toggle-password');
  if (!button) return;
  
  const input = document.getElementById(button.dataset.target);
  if (!input) return;
  
  const willShow = input.type === "password";
  input.type = willShow ? "text" : "password";
  button.classList.toggle("is-visible", willShow);
  button.setAttribute(
    "aria-label",
    willShow ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
  );
});

/* ============================================
   🚀 PAGE INITIALIZATION
   ============================================ */

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Initialize user profile (includes auth check and UI setup)
  if (!initializeUserProfile()) {
    return; // User not authenticated, redirected to login
  }
  
  // Load users after authentication
  loadUsers();
});

