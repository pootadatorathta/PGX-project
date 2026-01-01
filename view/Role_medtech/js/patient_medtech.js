  /* --------------------------------------------
    ✅ โหลดข้อมูลผู้ป่วยเมื่อหน้าเปิดขึ้น
  -------------------------------------------- */
  window.addEventListener('DOMContentLoaded', async () => {
    // เรียกใช้ฟังก์ชันหลักจาก userProfile.js
    // ฟังก์ชันนี้จะจัดการ checkAuthentication และ updateUserDisplay ให้เอง
    if (!initializeUserProfile()) { 
      return; // หยุดทำงานถ้าไม่ผ่านการยืนยันตัวตน
    }
    
    // Load patients data
    try {
      const patients = await window.electronAPI.getPatients();
      console.log("📦 Renderer got patients:", patients);
      renderPatients(patients);
    } catch (err) {
      console.error("❌ Error fetching patients:", err);
    }
  });
  /* --------------------------------------------
    📝 Form handler supports Add and Edit modes
  --------------------------------------------- */
  const form = document.getElementById('addForm');
  let isEditMode = false;
  let editingPatientId = null;

  async function handleFormSubmit(e) {
    e.preventDefault();

    // collect common fields
    const patientData = {
      patient_id: parseInt(document.getElementById('patient_id').value),
      hospital_id: document.getElementById('hospital').value.trim() || null,
      first_name: document.getElementById('first_name').value.trim(),
      last_name: document.getElementById('last_name').value.trim(),
      age: parseInt(document.getElementById('age').value),
      gender: document.getElementById('gender').value,
      ethnicity: document.getElementById('ethnicity').value.trim(),
      blood_type: document.getElementById('blood_type').value,
      phone: document.getElementById('phone').value.trim(),
    };

  try {
    let response;
    
    if (isEditMode && editingPatientId) {
      // Update existing patient - use editingPatientId instead of form value
      // (form field is disabled so value might be lost)
      patientData.patient_id = editingPatientId;
      response = await window.electronAPI.updatePatient(editingPatientId, patientData);
      console.log('✅ Patient updated:', response);
    } else {
      // Add new patient (duplicate check handled by real-time validation)
      response = await window.electronAPI.addPatient(patientData);
      console.log('✅ Patient added:', response);
    }

    // Show success message
    await Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: isEditMode ? 'ข้อมูลผู้ป่วยได้รับการอัปเดตแล้ว' : 'เพิ่มข้อมูลผู้ป่วยสำเร็จ',
      background: '#ffffffff',
      color: '#000000ff',
      confirmButtonColor: '#3b82f6'
    });

    // Close popup and reload data
    closePopup();
    const patients = await window.electronAPI.getPatients();
    renderPatients(patients);

  } catch (err) {
    console.error('❌ Error saving patient data:', err);
    
    // Convert error to string for checking
    const errorString = String(err);
    const errorMessage = err?.message || err?.error || errorString || '';
    
    console.log('🔍 Error details:', { errorString, errorMessage, fullError: err });
    
    // Check if it's a duplicate key error from database
    if (errorString.includes('duplicate key') || 
        errorString.includes('patient_pkey') || 
        errorString.includes('unique constraint') ||
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('patient_pkey') ||
        errorMessage.includes('unique constraint')) {
      // Show specific warning for duplicate patient ID
      await Swal.fire({
        icon: 'warning',
        title: 'เลขผู้ป่วยซ้ำ!',
        html: `เลขผู้ป่วย <strong>${patientData.patient_id}</strong> มีอยู่ในระบบแล้ว<br><br>` +
              'กรุณาใช้เลขผู้ป่วยที่ไม่ซ้ำกัน',
        background: '#1f2937',
        color: '#f9fafb',
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ตกลง'
      });
    } else {
      // Show general error message
      await Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: errorMessage || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        background: '#1f2937',
        color: '#f9fafb',
        confirmButtonColor: '#3b82f6'
      });
    }
  }
}

form?.addEventListener('submit', handleFormSubmit);

  /* --------------------------------------------
    🔍 ระบบค้นหาผู้ป่วยด้วย patient_id, ชื่อ, หรือนามสกุล
  -------------------------------------------- */
  document.getElementById('searchInput')?.addEventListener('input', async (e) => {
    const keyword = e.target.value.trim();
    try {
      if (keyword.length === 0) {
        // ถ้าไม่มีคำค้นหา แสดงผู้ป่วยทั้งหมด
        const patients = await window.electronAPI.getPatients();
        renderPatients(patients);
      } else if (keyword.length >= 1) {
        // ค้นหาเมื่อพิมพ์อย่างน้อย 1 ตัวอักษร
        const patients = await window.electronAPI.searchPatient(keyword);
        renderPatients(patients);
        
        // แสดงจำนวนผลลัพธ์
        const resultCount = patients.length;
        console.log(`🔍 พบผลการค้นหา ${resultCount} รายการสำหรับ "${keyword}"`);
      }
    } catch (err) {
      console.error("❌ Error searching patient:", err);
      // แสดงข้อความข้อผิดพลาดให้ผู้ใช้เห็น
      const tbody = document.querySelector('#patientTable tbody');
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">เกิดข้อผิดพลาดในการค้นหา: ${err.message}</td></tr>`;
    }
  });

  /* --------------------------------------------
    📋 ฟังก์ชันแสดงข้อมูลในตาราง
  -------------------------------------------- */

  function renderPatients(data) {
    const tbody = document.querySelector('#patientTable tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      const searchInput = document.getElementById('searchInput');
      const searchTerm = searchInput?.value.trim();
      const message = searchTerm 
        ? `ไม่พบข้อมูลผู้ป่วยที่ตรงกับ "${searchTerm}"` 
        : 'ไม่พบข้อมูลผู้ป่วย';
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">${message}</td></tr>`;
      return;
    }

    data.forEach((p, index) => {
      const row = `
        <tr onclick="showPage('input_step1_medtech', '${p.patient_id}')" data-patient-id="${p.patient_id}">
          <td>${p.patient_id ?? '-'}</td>
          <td>${p.first_name ?? ''} ${p.last_name ?? ''}</td>
          <td>${p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '-'}</td>
          <td>${p.hospital_id ?? '-'}</td>
          <td> 
            <button class="Edit-btn" onclick="event.stopPropagation(); editPatient(${p.patient_id})"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" onclick="event.stopPropagation(); deletePatient(${p.patient_id})"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>`;
      tbody.insertAdjacentHTML('beforeend', row);
    });

    // 🔗 เพิ่ม Event ให้ทุกปุ่ม Inspect
    attachInspectButtons();
  }

  /* --------------------------------------------
    🪟 Popup Add Patient
  -------------------------------------------- */
  const popupAdd = document.getElementById('popupAdd');
  const addBtn = document.getElementById('addBtn');
  const closeAdd = document.getElementById('closeAdd');
  const popupTitle = popupAdd?.querySelector('h3');

  addBtn?.addEventListener('click', () => {
    // switch to add mode
    isEditMode = false;
    editingPatientId = null;
    popupTitle && (popupTitle.textContent = 'เพิ่มข้อมูลผู้ป่วย');
    // reset form and allow changing patient_id
    form?.reset();
    const idEl = document.getElementById('patient_id');
    if (idEl) {
      idEl.disabled = false; // enable patient_id field in add mode
      idEl.style.backgroundColor = '';
      idEl.style.cursor = '';
    }
    popupAdd.style.display = 'flex';
  });

  closeAdd?.addEventListener('click', closePopup);

  // Real-time duplicate patient_id validation
  const patientIdInput = document.getElementById('patient_id');
  const validationMsg = document.getElementById('patient_id_validation');
  const saveBtn = document.getElementById('savePatientBtn');
  let validationTimeout;
  
  patientIdInput?.addEventListener('input', async (e) => {
    // Clear previous timeout
    clearTimeout(validationTimeout);
    
    // Skip validation if in edit mode
    if (isEditMode) {
      validationMsg.style.display = 'none';
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    
    const patientId = parseInt(e.target.value);
    
    // Skip if empty or invalid
    if (!patientId || isNaN(patientId)) {
      e.target.style.borderColor = '';
      e.target.style.boxShadow = '';
      validationMsg.style.display = 'none';
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    
    // Show loading state
    validationMsg.style.display = 'block';
    validationMsg.style.color = '#6b7280';
    validationMsg.textContent = 'กำลังตรวจสอบ...';
    
    // Debounce: wait 500ms after user stops typing
    validationTimeout = setTimeout(async () => {
      try {
        const existingPatients = await window.electronAPI.getPatients();
        console.log('🔍 Checking patient_id:', patientId, 'type:', typeof patientId);
        console.log('📦 Existing patients sample:', existingPatients.slice(0, 3).map(p => ({ id: p.patient_id, type: typeof p.patient_id, firstName: p.first_name })));
        
        // Strict comparison: convert both to numbers for accurate comparison
        const duplicatePatient = existingPatients.find(p => {
          const dbPatientId = parseInt(p.patient_id);
          const inputPatientId = parseInt(patientId);
          return dbPatientId === inputPatientId && !isNaN(dbPatientId) && !isNaN(inputPatientId);
        });
        
        console.log('🔎 Duplicate found:', duplicatePatient ? `YES - ID: ${duplicatePatient.patient_id}, Name: ${duplicatePatient.first_name} ${duplicatePatient.last_name}` : 'NO');
        
        if (duplicatePatient) {
          e.target.style.borderColor = '#ef4444'; // red border
          e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
          validationMsg.style.display = 'block';
          validationMsg.style.color = '#ef4444';
          validationMsg.textContent = `⚠️ เลขผู้ป่วยซ้ำ! มีอยู่ในระบบแล้ว`;
          // Disable save button
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
          }
        } else {
          e.target.style.borderColor = '#10b981'; // green border
          e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
          validationMsg.style.display = 'block';
          validationMsg.style.color = '#10b981';
          validationMsg.textContent = '✓ เลขผู้ป่วยนี้ใช้ได้';
          // Enable save button
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '';
            saveBtn.style.cursor = '';
          }
        }
      } catch (err) {
        console.error('❌ Error checking duplicate:', err);
        validationMsg.style.display = 'none';
        if (saveBtn) saveBtn.disabled = false;
      }
    }, 500);
  });

  function closePopup() {
    popupAdd.style.display = 'none';
    // reset state back to add mode
    isEditMode = false;
    editingPatientId = null;
    popupTitle && (popupTitle.textContent = 'เพิ่มข้อมูลผู้ป่วย');
    const idEl = document.getElementById('patient_id');
    if (idEl) {
      idEl.disabled = false;
      idEl.style.backgroundColor = '';
      idEl.style.cursor = '';
      idEl.style.borderColor = '';
      idEl.style.boxShadow = '';
    }
    // Hide validation message
    if (validationMsg) {
      validationMsg.style.display = 'none';
    }
    // Reset save button
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '';
      saveBtn.style.cursor = '';
    }
  }


  // ▶️ ปุ่ม Inspect (ทุกปุ่ม)
  function attachInspectButtons() {
    document.querySelectorAll('.inspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.electronAPI.navigate('input_step1_medtech');
      });
    });
  }





  /* --------------------------------------------
    ✏️ Edit Patient Function
  -------------------------------------------- */
  async function editPatient(patientId) {
    try {
      // Get patient data
      const patient = await window.electronAPI.getPatientById(patientId);
      if (!patient) {
        alert('ไม่พบข้อมูลผู้ป่วย');
        return;
      }

      // Populate form with patient data
      document.getElementById('patient_id').value = patient.patient_id;
      document.getElementById('first_name').value = patient.first_name;
      document.getElementById('last_name').value = patient.last_name;
      document.getElementById('age').value = patient.age;
      document.getElementById('gender').value = patient.gender;
      document.getElementById('ethnicity').value = patient.ethnicity;
      document.getElementById('blood_type').value = patient.blood_type;
      document.getElementById('hospital').value = patient.hospital_id;
      document.getElementById('phone').value = patient.phone;

      // Switch to edit mode
      isEditMode = true;
      editingPatientId = patientId;
      popupTitle && (popupTitle.textContent = 'แก้ไขผู้ป่วย');
      const idEl = document.getElementById('patient_id');
      if (idEl) {
        idEl.disabled = true; // disable patient_id field during edit
        idEl.style.backgroundColor = '#e5e7eb'; // visual indicator it's disabled
        idEl.style.cursor = 'not-allowed';
      }
      // Show popup
      popupAdd.style.display = 'flex';
    } catch (err) {
      console.error('❌ Error fetching patient details:', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย');
    }
  }







  /* --------------------------------------------
    🗑️ Delete Patient Function (Improved with SweetAlert2)
  -------------------------------------------- */
  async function deletePatient(patientId) {
    Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      
      // --- Custom Styles for Dark Theme ---
      confirmButtonColor: '#3b82f6', // สีปุ่มยืนยัน (สีน้ำเงิน)
      cancelButtonColor: '#ef4444',   // สีปุ่มยกเลิก (สีแดง)
      customClass: { // 👈 เพิ่ม/แทนที่ด้วยส่วนนี้
        popup: 'swal-dark'
      }

    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await window.electronAPI.deletePatient(patientId);
          
          if (response.success) {
            // แสดง Pop-up แจ้งว่าลบสำเร็จ
            Swal.fire({
              title: 'ลบสำเร็จ!',
              text: response.message || 'ข้อมูลผู้ป่วยถูกลบเรียบร้อยแล้ว',
              icon: 'success',
              confirmButtonColor: '#3b82f6',
              customClass: {
                popup: 'swal-dark'
              }
            }).then(() => {
              location.reload(); // รีโหลดหน้าเว็บหลังกด OK
            });
          } else {
            // แสดง Pop-up แจ้งเตือนถ้าลบไม่สำเร็จ
            Swal.fire({
              title: 'เกิดข้อผิดพลาด!',
              text: response.message || 'ไม่สามารถลบข้อมูลผู้ป่วยได้',
              icon: 'error',
              confirmButtonColor: '#3b82f6',
              customClass: {
                popup: 'swal-dark'
              }
            });
          }

        } catch (err) {
          console.error('❌ Error deleting patient:', err);
          
          // แสดง Pop-up แจ้งเตือนข้อผิดพลาด
          Swal.fire({
            title: 'เกิดข้อผิดพลาด!',
            text: 'ไม่สามารถลบข้อมูลผู้ป่วยได้',
            icon: 'error',
            confirmButtonColor: '#3b82f6',
            customClass: {
              popup: 'swal-dark'
            }
          });
        }
      }
    });
  }

// Navigation helper function
function showPage(pageName, patientId) {
  sessionStorage.setItem('selectedPatientId', patientId);
  window.electronAPI?.navigate(pageName);
}


