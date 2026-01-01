initializeUserProfile();

// Store all specimens globally
let allSpecimens = [];

// 🧬 Load Specimens from Database
async function loadSpecimens() {
  try {
    console.log('🔄 Loading specimens from database...');
    const response = await window.electronAPI.getSpecimens();
    
    console.log('📦 Raw response:', response);
    
    if (response.success && response.data) {
      allSpecimens = response.data;
      console.log('✅ Loaded', allSpecimens.length, 'specimens');
      console.log('📊 Sample specimen:', allSpecimens[0]);
      console.log('📊 Specimen with category:', allSpecimens.find(s => s.category));
      console.log('📊 Specimens without category:', allSpecimens.filter(s => !s.category).length);
      
      // Initially show all specimens
      populateSpecimenDropdown(allSpecimens);
    } else {
      console.error('❌ Failed to load specimens:', response);
    }
  } catch (error) {
    console.error('❌ Error loading specimens:', error);
  }
}

// Populate specimen dropdown with filtered data
function populateSpecimenDropdown(specimens) {
  const specimenSelect = document.getElementById('specimenType');
  
  if (!specimenSelect) {
    console.error('❌ Specimen select element not found');
    return;
  }
  
  // Clear existing options except the placeholder
  specimenSelect.innerHTML = '<option value="">-- เลือกชนิดของสิ่งส่งตรวจ --</option>';
  
  // Add options from filtered specimens
  specimens.forEach(specimen => {
    const option = document.createElement('option');
    // Use lowercase field name from controller
    option.value = specimen.specimen_name;
    option.textContent = specimen.specimen_name;
    specimenSelect.appendChild(option);
  });
  
  console.log(`✅ Populated ${specimens.length} specimens in dropdown`);
}

// Initialize category filter after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('specimenCategory');
  
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      const selectedCategory = e.target.value;
      
      console.log('📂 Category selected:', selectedCategory);
      
      if (selectedCategory === '') {
        // Show all specimens if no category selected
        console.log('📋 Showing all specimens');
        populateSpecimenDropdown(allSpecimens);
      } else {
        // Filter specimens by selected category
        console.log('🔍 Filtering from', allSpecimens.length, 'total specimens');
        console.log('🔍 Selected category:', selectedCategory);
        
        const filteredSpecimens = allSpecimens.filter(specimen => {
          const hasMatch = specimen.category === selectedCategory;
          if (hasMatch) {
            console.log('✓ Match:', specimen.specimen_name, '|', specimen.category);
          }
          return hasMatch;
        });
        
        console.log(`🔍 Filtered ${filteredSpecimens.length} specimens for category: ${selectedCategory}`);
        console.log('📋 Filtered specimens:', filteredSpecimens.map(s => s.specimen_name));
        populateSpecimenDropdown(filteredSpecimens);
      }
      
      // Reset specimen selection when category changes
      document.getElementById('specimenType').value = '';
    });
  }
});

// Load specimens on page load
loadSpecimens();

// Fetch patient data using patient ID from sessionStorage
const patientId = sessionStorage.getItem('selectedPatientId');

async function fetchPatientData(patientId) {
  try {
    const patients = await window.electronAPI.searchPatient(patientId);
    if (patients && patients.length > 0) {
      return patients[0]; // Return the first matching patient
    }
    return null; // No patient found
  } catch (err) {
    console.error('❌ Error fetching patient data:', err);
    return null; // Error occurred
  }
}

// Display patient data
(async () => {
  const patientData = await fetchPatientData(patientId);

  if (patientData) {
    // Store all patient data in sessionStorage
    sessionStorage.setItem("patientName", `${patientData.first_name} ${patientData.last_name}`);
    sessionStorage.setItem("patientAge", patientData.age || 'N/A');
    sessionStorage.setItem("patientGender", patientData.gender || 'N/A');
    sessionStorage.setItem("patientId", patientData.patient_id || patientId);
    sessionStorage.setItem("patientHospital", patientData.hospital_id || 'N/A');
    sessionStorage.setItem("patientEthnicity", patientData.ethnicity || 'N/A');
    sessionStorage.setItem("patientPhone", patientData.phone || 'N/A');
    sessionStorage.setItem("patientBloodType", patientData.blood_type || 'N/A');
  } else {
    sessionStorage.setItem("patientName", "สมชาย ใจดี");
  }

  const patientBox = document.getElementById('patient-info');
  if (patientData) {
    patientBox.innerHTML = `
      <table>
        <tr><td class="label">เลขประจำตัวผู้ป่วย:</td><td class="value">${patientData.patient_id}</td></tr>
        <tr><td class="label">ชื่อ-สกุล:</td><td class="value">${patientData.first_name} ${patientData.last_name}</td></tr>
        <tr><td class="label">อายุ:</td><td class="value">${patientData.age} ปี</td></tr>
        <tr><td class="label">โรงพยาบาล:</td><td class="value">${patientData.hospital_id}</td></tr>
        <tr><td class="label">เชื้อชาติ:</td><td class="value">${patientData.ethnicity}</td></tr>
        <tr><td class="label">เพศ:</td><td class="value">${patientData.gender}</td></tr>
        <tr><td class="label">เบอร์โทรศัพท์:</td><td class="value">${patientData.phone}</td></tr>
        <tr><td class="label">กรุ๊ปเลือด:</td><td class="value">${patientData.blood_type}</td></tr>
        <tr><td class="label">วันที่ส่งผลตรวจ:</td><td class="value">${new Date().toLocaleDateString()}</td></tr>
      </table>
    `;
  } else {
    patientBox.innerHTML = '<p>ไม่พบข้อมูลผู้ป่วย</p>';
  }

})(); 


// Back Button
const backBtn = document.querySelector(".back-btn");
backBtn.addEventListener("click", () => {
  window.electronAPI.navigate('patient_medtech'); // Navigate back to the patient page
});

// Next Button - Create test request with pending status
const nextBtn = document.querySelector(".next-btn");
nextBtn.addEventListener("click", async () => {
  const dnaType = document.getElementById("dnaType").value;
  const specimenType = document.getElementById("specimenType").value;
  
  if (!dnaType) {
    Swal.fire({
      icon: 'warning',
      title: 'ข้อมูลไม่ครบถ้วน',
      text: 'กรุณาเลือกประเภท DNA ก่อนดำเนินการต่อ',
      confirmButtonText: 'ตกลง'
    });
    return;
  }
  
  if (!specimenType) {
    Swal.fire({
      icon: 'warning',
      title: 'ข้อมูลไม่ครบถ้วน',
      text: 'กรุณาเลือกประเภทสิ่งส่งตรวจก่อนดำเนินการต่อ',
      confirmButtonText: 'ตกลง'
    });
    return;
  }

  try {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const patientId = sessionStorage.getItem('selectedPatientId');
    
    if (!currentUser.user_id) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบข้อมูลผู้ใช้',
        text: 'กรุณาเข้าสู่ระบบใหม่',
        confirmButtonText: 'ตกลง'
      });
      window.electronAPI.navigate('login');
      return;
    }

    // Create test request with pending status and doctor name from logged-in user
    const doctorName = currentUser.doctor_name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username;
    const testRequestData = {
      patient_id: patientId,
      test_target: dnaType,
      Specimen: specimenType,
      status: 'pending',
      users_id: currentUser.user_id,
      Doc_Name: doctorName, // Set doctor name from logged-in user
      request_date: new Date().toISOString()
    };

    console.log('📝 Creating test request with doctor name:', doctorName, testRequestData);
    const result = await window.electronAPI.addTestRequest(testRequestData);
    
    console.log('📦 Result from addTestRequest:', result);

    if (result && result.success && result.data && result.data.request_id) {
      console.log('✅ Test request created:', result.data.request_id);
      await Swal.fire({
        icon: 'success',
        title: 'สร้างคำขอตรวจสอบสำเร็จ!',
        html: `<strong>Request ID: ${result.data.request_id}</strong><br>สถานะ: รอเภสัชกรกรอกข้อมูล Allele`,
        confirmButtonText: 'ตกลง'
      });
      
      // Navigate back to patient page
      window.electronAPI.navigate('patient_medtech');
    } else {
      console.error('❌ Failed to create test request - Result:', result);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: result?.message || 'เกิดข้อผิดพลาดในการสร้างคำขอตรวจสอบ',
        confirmButtonText: 'ตกลง'
      });
    }
  } catch (error) {
    console.error('❌ Error creating test request:', error);
    await Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'เกิดข้อผิดพลาดในการสร้างคำขอตรวจสอบ',
      confirmButtonText: 'ตกลง'
    });
  }
});

// ปุ่ม Back
