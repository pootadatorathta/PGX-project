
/* ========================
   ดึงข้อมูลจาก sessionStorage
======================== */

// Get current user helper function
function getCurrentUser() {
  const sessionData = sessionStorage.getItem('currentUser');
  return sessionData ? JSON.parse(sessionData) : null;
}

const dnaType = sessionStorage.getItem("selectedDnaType") || "-";
const patientName = sessionStorage.getItem("patientName") || "-";
const patientId = sessionStorage.getItem("patientId") || sessionStorage.getItem("selectedPatientId") || "-";
const genotype = sessionStorage.getItem("genotype") || "-";
const phenotype = sessionStorage.getItem("phenotype") || "-";

document.getElementById("patientName").textContent = patientId + " " + patientName;
document.getElementById("dnaType").textContent = dnaType;
document.getElementById("genotype").textContent = genotype;

/* ========================
   แสดง Allele อัตโนมัติ
======================== */
const alleleHeader = document.getElementById("alleleHeader");
const alleleValues = document.getElementById("alleleValues");

function showAlleles(type) {
  let alleles = [];

  if (type === "CYP2D6") alleles = ["allele10","allele4","allele41","allele5"];
  else if (type === "CYP2C19") alleles = ["allele2","allele3","allele17"];
  else if (type === "CYP2C9") alleles = ["allele2","allele3"];

  alleleHeader.innerHTML = "";
  alleleValues.innerHTML = "";

  alleles.forEach(id => {
    const th = document.createElement("th");
    th.textContent = id.replace("allele", "*");
    const td = document.createElement("td");
    td.textContent = sessionStorage.getItem(id) || "-";
    alleleHeader.appendChild(th);
    alleleValues.appendChild(td);
  });
}
showAlleles(dnaType);

/* ========================
   แสดง Phenotype และ Recommendation จาก Rulebase
======================== */
function predictPhenotype(geno) {
  const g = geno.toLowerCase();
  if (g.includes("ultra")) return "Ultrarapid Metabolizer (เพิ่มการเผาผลาญยา)";
  if (g.includes("rapid")) return "Rapid Metabolizer (การเผาผลาญเร็ว)";
  if (g.includes("normal")) return "Normal Metabolizer (การเผาผลาญปกติ)";
  if (g.includes("intermediate")) return "Intermediate Metabolizer (การเผาผลาญลดลง)";
  if (g.includes("poor")) return "Poor Metabolizer (การเผาผลาญช้ามาก)";
  return "-";
}

// Display Phenotype Label (DNA type specific)
const phenotypeLabel = sessionStorage.getItem('phenotypeLabel') || 'Predicted Phenotype';
document.getElementById("phenotypeLabel").textContent = phenotypeLabel;

// Display Likely Phenotype
document.getElementById("phenotype").textContent = phenotype || predictPhenotype(genotype);

// Display Activity Score (if available)
const activityScore = sessionStorage.getItem('activityScore');
if (activityScore) {
  document.getElementById("activityScore").textContent = activityScore;
}

// Display Genotype Summary
const genotypeSummary = sessionStorage.getItem('genotypeSummary');
if (genotypeSummary) {
  document.getElementById("genotypeSummary").textContent = genotypeSummary;
} else {
  document.getElementById("genotypeSummary").textContent = `Genotype ${genotype} for ${dnaType}`;
}

// Display Therapeutic Recommendation
const recommendation = sessionStorage.getItem('recommendation');
if (recommendation) {
  document.getElementById("recommendation").textContent = recommendation;
} else {
  document.getElementById("recommendation").textContent = 'Please consult with clinical pharmacist for medication dosing.';
}

/* ========================
   Check if current user already confirmed
======================== */
async function checkUserConfirmation() {
  const currentUser = getCurrentUser();
  const requestId = sessionStorage.getItem('selectedRequestId');
  
  if (!currentUser || !requestId) {
    return;
  }

  try {
    // Fetch test request data to check confirmations
    const testRequestData = await window.electronAPI.getTestRequestById(requestId);
    
    if (testRequestData) {
      const userFullName = `${currentUser.F_Name || ''} ${currentUser.L_Name || ''}`.trim();
      const confirmBtn = document.querySelector(".confirm-btn");
      
      // More robust comparison with trim
      const alreadyConfirmedBy1 = testRequestData.confirmed_by_1 && testRequestData.confirmed_by_1.trim() === userFullName;
      const alreadyConfirmedBy2 = testRequestData.confirmed_by_2 && testRequestData.confirmed_by_2.trim() === userFullName;
      const userAlreadyConfirmed = alreadyConfirmedBy1 || alreadyConfirmedBy2;
      
      // Check if current user already confirmed (by comparing full name)
      if (userAlreadyConfirmed) {
        // User already confirmed - disable button IMMEDIATELY and SYNCHRONOUSLY
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.style.setProperty('background-color', '#cccccc', 'important');
          confirmBtn.style.setProperty('cursor', 'not-allowed', 'important');
          confirmBtn.style.setProperty('opacity', '0.5', 'important');
          confirmBtn.style.setProperty('pointer-events', 'none', 'important');
          confirmBtn.style.setProperty('border', '1px solid #999', 'important');
          confirmBtn.textContent = 'คุณได้ยืนยันแล้ว ✓';
          confirmBtn.classList.add('disabled-confirmation');
        }
      }
    }
  } catch (error) {
    // Silent error handling
  }
}

// Check on page load
checkUserConfirmation();

document.querySelector(".back-btn").addEventListener("click", () => {
  window.electronAPI.navigate('fill_alleles_pharmacy');
});

document.querySelector(".confirm-btn").addEventListener("click", async (e) => {
  try {
    // Check if button is disabled first
    const btn = e.target;
    if (btn.disabled || btn.style.pointerEvents === 'none') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      await Swal.fire({
        icon: 'error',
        title: 'ไม่พบข้อมูลผู้ใช้',
        text: 'กรุณาเข้าสู่ระบบใหม่',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    // Get request ID from session
    const requestId = sessionStorage.getItem('selectedRequestId');
    if (!requestId) {
      await Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'ไม่พบข้อมูล Request ID',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    // Fetch test request data
    const testRequestData = await window.electronAPI.getTestRequestById(requestId);
    if (!testRequestData) {
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่พบข้อมูล Test Request',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    // Check if current user already confirmed (more robust with trim)
    const userFullName = `${currentUser.F_Name || ''} ${currentUser.L_Name || ''}`.trim();
    const alreadyConfirmedBy1 = testRequestData.confirmed_by_1 && testRequestData.confirmed_by_1.trim() === userFullName;
    const alreadyConfirmedBy2 = testRequestData.confirmed_by_2 && testRequestData.confirmed_by_2.trim() === userFullName;
    
    if (alreadyConfirmedBy1 || alreadyConfirmedBy2) {
      await Swal.fire({
        icon: 'warning',
        title: 'คุณได้ยืนยันแล้ว',
        text: 'คุณได้ทำการยืนยันข้อมูลนี้ไปแล้ว กรุณาให้เภสัชกรท่านอื่นยืนยันอีกครั้ง',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    const sessionData = {
      selectedPatientId: sessionStorage.getItem('selectedPatientId'),
      selectedDnaType: sessionStorage.getItem('selectedDnaType'),
      selectedSpecimen: sessionStorage.getItem('selectedSpecimen')
    };

    if (!sessionData.selectedPatientId || !sessionData.selectedDnaType) {
      await Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกข้อมูลให้ครบในทุกขั้นตอน',
        confirmButtonText: 'ตกลง'
      });
      return;
    }
    
    // Prepare update data with alleles (Do NOT change Doc_Name - it should stay as the medtech's name)
    const updateData = {
      status: 'need_2_confirmation',
      allele_data: JSON.stringify(sessionStorage.getItem('alleles') ? JSON.parse(sessionStorage.getItem('alleles')) : {})
    };

    // Update test request
    const result = await window.electronAPI.updateTestRequest(requestId, updateData);
    console.log('✅ Test request updated:', result);
    
    if (result) {
      const actualRequestId = result.request_id || requestId;
      // Prepare complete test data for report generation
      const alleles = [];
      const alleleKeys = ['allele2', 'allele3', 'allele4', 'allele5', 'allele10', 'allele17', 'allele41'];
      alleleKeys.forEach(key => {
        const value = sessionStorage.getItem(key);
        if (value) {
          alleles.push({
            name: key.replace('allele', '*'),
            value: value
          });
        }
      });

      const completeTestData = {
        request_id: actualRequestId,
        test_target: testRequestData.test_target,
        genotype: genotype,
        predicted_phenotype: document.getElementById('phenotype').textContent || phenotype,
        genotype_summary: sessionStorage.getItem('genotypeSummary') || 
                         `Genotype ${genotype} for ${testRequestData.test_target}`,
        recommendation: sessionStorage.getItem('recommendation') || 
                       'Please consult with clinical pharmacist for medication dosing.',
        patientId: testRequestData.patient_id,
        patientName: patientName,
        patientAge: sessionStorage.getItem('patientAge') || 'N/A',
        patientGender: sessionStorage.getItem('patientGender') || 'N/A',
        specimen: testRequestData.Specimen,
        patientNumber: sessionStorage.getItem('patientNumber') || result.request_id,
        hospital: currentUser.hospital_id || 'N/A',
        createDate: testRequestData.request_date ? new Date(testRequestData.request_date).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH'),
        updateDate: new Date().toLocaleDateString('th-TH'),
        doctorName: testRequestData.Doc_Name || 'N/A',  // Pass doctor name from test request
        alleles: alleles
      };

      // Generate report with PDF
      const reportResult = await window.electronAPI.createPgxReport(completeTestData);
      
      if (reportResult.success) {
        await Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          html: `
            <p>บันทึกข้อมูลการตรวจเรียบร้อยแล้ว</p>
            <p><small>สร้างรายงาน PDF เรียบร้อยแล้ว</small></p>
          `,
          confirmButtonText: 'ตกลง'
        });
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'บันทึกข้อมูลสำเร็จ',
          text: 'แต่ไม่สามารถสร้างรายงาน PDF ได้: ' + (reportResult.message || 'Unknown error'),
          confirmButtonText: 'ตกลง'
        });
      }
      
      // Clear some session data
      sessionStorage.removeItem('selectedRequestId');
      sessionStorage.removeItem('genotype');
      sessionStorage.removeItem('phenotype');
      sessionStorage.removeItem('alleles');
      
      // Navigate back to information page
      window.electronAPI.navigate('information_pharmacy');
    }
  } catch (error) {
    console.error('❌ Error saving test request:', error);
    console.error('Error stack:', error.stack);
    await Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: error.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      confirmButtonText: 'ตกลง'
    });
  }
});

document.querySelector(".print-btn").addEventListener("click", () => {
  window.print();
});

const userMenuToggle = document.getElementById("userMenuToggle");
const userMenu = document.getElementById("userMenu");

userMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  userMenu?.classList.toggle("show");
});

document.addEventListener("click", (event) => {
  if (!userMenu?.contains(event.target) && event.target !== userMenuToggle) {
    userMenu?.classList.remove("show");
  }
});
