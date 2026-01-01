/* ========================
   🔹Language Toggle
======================== */




/* ========================
   🧬 ดึงข้อมูลจาก Step 1
======================== */
const patientName = sessionStorage.getItem("patientName") || "-";
const dnaType = sessionStorage.getItem("selectedDnaType") || "-";
const patientId = sessionStorage.getItem("patientId") || sessionStorage.getItem("selectedPatientId") || "-";
document.getElementById("patientName").textContent = patientId + " " + patientName;
document.getElementById("dnaType").textContent = dnaType;

// พื้นที่สร้าง dropdown
const selectArea = document.getElementById("selectArea");

// Store for auto-prediction
let currentAlleles = {};
let autoGenotype = "-";
let autoPhenotype = "-";
let autoRecommendation = null; // Store therapeutic recommendation from rulebase
let isUpdatingOptions = false; // Flag to prevent recursive updates

/* ========================
   🧩 ฟังก์ชันสร้าง dropdown ตาม DNA Type
======================== */
let rulebaseData = null;

async function loadRulebaseData() {
  if (!rulebaseData) {
    try {
      rulebaseData = await window.electronAPI.getRulebase();
      console.log('✅ Rulebase loaded:', rulebaseData);
    } catch (error) {
      console.error('❌ Failed to load rulebase:', error);
      rulebaseData = {};
    }
  }
  return rulebaseData;
}

async function renderDNAForm(type) {
  // Load rulebase first
  await loadRulebaseData();
  
  // Save phenotype label for this DNA type
  const phenotypeLabel = rulebaseData[type]?.phenotype_label || 'Predicted Phenotype';
  sessionStorage.setItem('phenotypeLabel', phenotypeLabel);
  console.log(`📋 Phenotype label for ${type}: ${phenotypeLabel}`);
  
  let html = "";

  if (type === "CYP2D6") {
    html = `
      <div class="select-row">
        <label for="allele4">*4 (1847G>A):</label>
        <select id="allele4" class="allele-select" data-allele="allele4">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>

        <label for="allele10">*10 (100C>T):</label>
        <select id="allele10" class="allele-select" data-allele="allele10">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="allele41">*41 (2989G>A):</label>
        <select id="allele41" class="allele-select" data-allele="allele41">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>

        <label for="cnvIntron2">CNV intron 2:</label>
        <select id="cnvIntron2" class="allele-select" data-allele="cnvIntron2">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="cnvExon9">CNV exon 9:</label>
        <select id="cnvExon9" class="allele-select" data-allele="cnvExon9">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Genotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
      </div>`;
  } 
  else if (type === "CYP2C19") {
    html = `
      <div class="select-row">
        <label for="allele2">*2:</label>
        <select id="allele2" class="allele-select" data-allele="allele2">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>

        <label for="allele3">*3:</label>
        <select id="allele3" class="allele-select" data-allele="allele3">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="allele17">*17:</label>
        <select id="allele17" class="allele-select" data-allele="allele17">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Genotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
        
      </div>`;
  } 
  else if (type === "CYP2C9") {
    html = `
      <div class="select-row">
        <label for="allele2">*2:</label>
        <select id="allele2" class="allele-select" data-allele="allele2">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>

        <label for="allele3">*3:</label>
        <select id="allele3" class="allele-select" data-allele="allele3">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Genotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
      </div>`;
  } 
  else if (type === "VKORC1") {
    html = `
      <div class="select-row">
        <label for="alleleVKORC1_1173">VKORC1 (1173C>T):</label>
        <select id="alleleVKORC1_1173" class="allele-select" data-allele="alleleVKORC1_1173">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>

        <label for="alleleVKORC1_1639">VKORC1 (-1639G>A):</label>
        <select id="alleleVKORC1_1639" class="allele-select" data-allele="alleleVKORC1_1639">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Haplotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
      </div>`;
  } 
  else if (type === "TPMT") {
    html = `
      <div class="select-row">
        <label for="allele3C">*3C (719A>G):</label>
        <select id="allele3C" class="allele-select" data-allele="allele3C">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Genotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
      </div>`;
  } 
  else if (type === "CYP3A5") {
    html = `
      <div class="select-row">
        <label for="allele3">*3 (6986A>G):</label>
        <select id="allele3" class="allele-select" data-allele="allele3">
          <option value="" disabled selected>เลือกประเภท DNA</option>
        </select>
      </div>

      <div class="select-row">
        <label for="genotype">Genotype:</label>
        <input id="genotype" type="text" value="-" readonly style=" cursor: not-allowed;">
      </div>`;
  } 
  else {
    html = `<p style="color:gray;">ยังไม่มีข้อมูลสำหรับ DNA Type นี้</p>`;
  }

  selectArea.innerHTML = html;
  
  // Populate all dropdowns with initial options
  await populateAlleleOptions();
  
  // Add event listeners to all allele selects for auto-prediction and filtering
  attachAlleleChangeListeners();
}

/* ========================
   🔍 Get Possible Values for Allele based on current selections
======================== */
function getPossibleValues(alleleName, currentSelections) {
  if (!rulebaseData || !rulebaseData[dnaType]) return [];
  
  const rules = rulebaseData[dnaType].rules;
  const possibleValues = new Set();
  
  // Filter rules that match current selections
  rules.forEach(rule => {
    let matches = true;
    
    // Check if this rule matches all currently selected alleles
    for (const [selectedAllele, selectedValue] of Object.entries(currentSelections)) {
      if (selectedAllele !== alleleName && rule[selectedAllele] && rule[selectedAllele] !== selectedValue) {
        matches = false;
        break;
      }
    }
    
    // If rule matches current selections, add this allele's value as possible
    if (matches && rule[alleleName]) {
      possibleValues.add(rule[alleleName]);
    }
  });
  
  return Array.from(possibleValues).sort();
}

/* ========================
   📋 Populate dropdown options dynamically
======================== */
async function populateAlleleOptions() {
  const alleleSelects = document.querySelectorAll('.allele-select');
  
  alleleSelects.forEach((select, index) => {
    const alleleName = select.getAttribute('data-allele');
    // Get ALL possible values from rulebase (no filtering)
    const possibleValues = getPossibleValues(alleleName, {});
    
    // Clear existing options except the first one
    select.innerHTML = '<option value="" disabled selected>เลือกประเภท DNA</option>';
    
    // Add all possible values (no filtering)
    possibleValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    
    // Disable all dropdowns except the first one initially
    if (index > 0) {
      select.disabled = true;
      select.style.opacity = '0.5';
      select.style.cursor = 'not-allowed';
    }
  });
  
  // Show initial combination count
  const totalRules = rulebaseData[dnaType]?.rules?.length || 0;
  updateCombinationDisplay(totalRules, 0);
}

/* ========================
   🔒 Enable/Disable dropdowns based on order
======================== */
function updateDropdownStates() {
  const alleleSelects = document.querySelectorAll('.allele-select');
  let lastFilledIndex = -1;
  
  // Find the last filled dropdown
  alleleSelects.forEach((select, index) => {
    if (select.value && select.value !== "") {
      lastFilledIndex = index;
    }
  });
  
  // Enable/disable dropdowns based on sequential order
  alleleSelects.forEach((select, index) => {
    if (index === 0) {
      // First dropdown always enabled
      select.disabled = false;
      select.style.opacity = '1';
      select.style.cursor = 'pointer';
    } else if (index <= lastFilledIndex + 1) {
      // Enable next dropdown after previous is filled
      select.disabled = false;
      select.style.opacity = '1';
      select.style.cursor = 'pointer';
    } else {
      // Disable all other dropdowns
      select.disabled = true;
      select.style.opacity = '0.5';
      select.style.cursor = 'not-allowed';
    }
  });
}

/* ========================
   🧹 Clear subsequent selections when editing
======================== */
function clearSubsequentSelections(changedIndex) {
  const alleleSelects = document.querySelectorAll('.allele-select');
  
  alleleSelects.forEach((select, index) => {
    if (index > changedIndex) {
      select.value = "";
      select.disabled = true;
      select.style.opacity = '0.5';
      select.style.cursor = 'not-allowed';
    }
  });
}

/* ========================
   🔍 Update dropdown options based on previous selections
======================== */
function updateDropdownOptions() {
  const alleleSelects = document.querySelectorAll('.allele-select');
  const currentSelections = {};
  
  // Collect all selections up to now
  alleleSelects.forEach((select, index) => {
    const alleleName = select.getAttribute('data-allele');
    if (select.value && select.value !== "") {
      currentSelections[alleleName] = select.value;
    }
  });
  
  // Update each dropdown to show only valid options
  alleleSelects.forEach((select, index) => {
    const alleleName = select.getAttribute('data-allele');
    const currentValue = select.value;
    
    // Skip if this select already has current selections (don't update previous selections)
    if (currentSelections[alleleName]) {
      return;
    }
    
    // Skip if disabled
    if (select.disabled) {
      return;
    }
    
    // Get possible values based on previous selections
    const possibleValues = getPossibleValues(alleleName, currentSelections);
    
    // Rebuild dropdown
    select.innerHTML = '<option value="" disabled selected>เลือกประเภท DNA</option>';
    
    possibleValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    
    // Restore previous value if still valid
    if (currentValue && possibleValues.includes(currentValue)) {
      select.value = currentValue;
    }
  });
}

/* ========================
   🔄 Update dropdown options based on selections
======================== */
function updateAlleleOptions() {
  const alleleSelects = document.querySelectorAll('.allele-select');
  const currentSelections = {};
  
  // Collect current selections
  alleleSelects.forEach(select => {
    const alleleName = select.getAttribute('data-allele');
    if (select.value && select.value !== "") {
      currentSelections[alleleName] = select.value;
    }
  });
  
  // Count possible combinations
  const possibleCount = countPossibleCombinations(currentSelections);
  updateCombinationDisplay(possibleCount, Object.keys(currentSelections).length);
}

/* ========================
   📊 Count possible combinations
======================== */
function countPossibleCombinations(currentSelections) {
  if (!rulebaseData || !rulebaseData[dnaType]) return 0;
  
  const rules = rulebaseData[dnaType].rules;
  let count = 0;
  
  rules.forEach(rule => {
    let matches = true;
    
    for (const [selectedAllele, selectedValue] of Object.entries(currentSelections)) {
      if (rule[selectedAllele] && rule[selectedAllele] !== selectedValue) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      count++;
    }
  });
  
  return count;
}

/* ========================
   📢 Update combination display
======================== */
function updateCombinationDisplay(count, selectedCount) {
  const combCountEl = document.getElementById('combCount');
  if (!combCountEl) return;
  
  if (selectedCount === 0) {
    combCountEl.innerHTML = 'Select alleles to see predictions';
    combCountEl.style.color = '#666';
  } else if (count === 1) {
    combCountEl.innerHTML = '<i class="fa fa-check-circle"></i> Exact match found in rulebase!';
    combCountEl.style.color = '#4CAF50';
    combCountEl.style.fontWeight = 'bold';
  } else if (count > 1) {
    combCountEl.innerHTML = `<i class="fa fa-info-circle"></i> ${count} possible combinations in rulebase`;
    combCountEl.style.color = '#2196F3';
    combCountEl.style.fontWeight = 'normal';
  } else {
    combCountEl.innerHTML = '<i class="fa fa-exclamation-triangle"></i> No exact match - using default prediction';
    combCountEl.style.color = '#FF9800';
    combCountEl.style.fontWeight = 'normal';
  }
}

/* ========================
   🤖 Auto-predict Genotype/Phenotype
======================== */
async function predictFromAlleles() {
  try {
    // Collect all selected alleles
    const alleleSelects = document.querySelectorAll('.allele-select');
    currentAlleles = {};
    let allSelected = true;
    
    alleleSelects.forEach(select => {
      if (select.value && select.value !== "") {
        currentAlleles[select.id] = select.value;
      } else {
        allSelected = false;
      }
    });
    
    // Only predict if all alleles are selected
    if (allSelected && Object.keys(currentAlleles).length > 0) {
      const result = await window.electronAPI.predictPhenotype(dnaType, currentAlleles);
      
      if (result.matched) {
        autoGenotype = result.genotype;
        autoPhenotype = result.phenotype;
        
        // Save therapeutic recommendation for later use
        if (result.therapeutic_recommendation) {
          autoRecommendation = result.therapeutic_recommendation;
        }
        
        // Update genotype field
        const genotypeInput = document.getElementById('genotype');
        if (genotypeInput) {
          genotypeInput.value = result.genotype;
          
        }
      } else {
        autoGenotype = result.genotype || "-";
        autoPhenotype = result.phenotype || "-";
        autoRecommendation = null;
        
        const genotypeInput = document.getElementById('genotype');
        if (genotypeInput) {
          genotypeInput.value = result.genotype + " (Default)";
          
        }
      }
    } else {
      // Reset if not all selected
      autoGenotype = "-";
      autoPhenotype = "-";
      const genotypeInput = document.getElementById('genotype');
      if (genotypeInput) {
        genotypeInput.value = "-";
        
      }
    }
  } catch (error) {
    console.error('❌ Prediction error:', error);
  }
}

function attachAlleleChangeListeners() {
  const alleleSelects = document.querySelectorAll('.allele-select');
  alleleSelects.forEach((select, index) => {
    select.addEventListener('change', () => {
      // Clear all selections after this one
      clearSubsequentSelections(index);
      
      // Update dropdown states (enable next dropdown)
      updateDropdownStates();
      
      // Update dropdown options to show only valid values
      updateDropdownOptions();
      
      // Update combination count and check validity
      updateAlleleOptions();
      
      // Predict the phenotype
      predictFromAlleles();
    });
  });
}

// เรียกฟังก์ชันตอนโหลดหน้า
renderDNAForm(dnaType);

/* ========================
   🔙 ปุ่ม Back / ✅ Confirm
======================== */
document.querySelector(".back-btn").addEventListener("click", () => {
  window.electronAPI.navigate('test_request_manager');
});

document.querySelector(".confirm-btn").addEventListener("click", async () => {
  // Check if all alleles are selected
  const selects = selectArea.querySelectorAll("select.allele-select");
  let allSelected = true;
  let missingAlleles = [];
  
  selects.forEach((sel) => {
    if (!sel.value || sel.value === "") {
      allSelected = false;
      const label = document.querySelector(`label[for="${sel.id}"]`);
      missingAlleles.push(label ? label.textContent : sel.id);
    }
  });
  
  if (!allSelected) {
    alert(`⚠️ กรุณาเลือกค่าให้ครบทุก allele!\n\nยังไม่ได้เลือก: ${missingAlleles.join(', ')}`);
    return;
  }
  
  // Check if there's an exact match in rulebase
  if (!autoGenotype || autoGenotype === "-" || !autoPhenotype || autoPhenotype === "-") {
    alert('❌ ไม่พบข้อมูลในฐานข้อมูล!\n\nกรุณาตรวจสอบค่า allele ที่เลือกหรือติดต่อผู้ดูแลระบบ');
    return;
  }
  
  // Check if using default (no exact match)
  const genotypeInput = document.getElementById('genotype');
  if (genotypeInput && genotypeInput.value.includes('(Default)')) {
    alert('❌ ไม่พบข้อมูลที่ตรงกันในฐานข้อมูล!\n\nการรวมกันของ allele ที่เลือกไม่มีในระบบ\nกรุณาเลือก allele ที่ถูกต้องหรือติดต่อผู้ดูแลระบบ');
    return;
  }
  
  // Verify one more time by checking prediction result
  const alleleSelects = document.querySelectorAll('.allele-select');
  const currentAlleles = {};
  alleleSelects.forEach(select => {
    if (select.value && select.value !== "") {
      currentAlleles[select.id] = select.value;
    }
  });
  
  const result = await window.electronAPI.predictPhenotype(dnaType, currentAlleles);
  
  if (!result.matched) {
    alert('❌ ไม่พบข้อมูลที่ตรงกันในฐานข้อมูล!\n\nการรวมกันของ allele:\n' + 
      Object.entries(currentAlleles).map(([k, v]) => `${k}: ${v}`).join('\n') + 
      '\n\nไม่มีในระบบ กรุณาตรวจสอบหรือติดต่อผู้ดูแลระบบ');
    return;
  }
  
  // If we reach here, everything is valid - collect and save data
  selects.forEach((sel) => {
    sessionStorage.setItem(sel.id, sel.value || "-");
  });
  
  // Save auto-predicted genotype, phenotype, and recommendation
  sessionStorage.setItem("genotype", autoGenotype);
  sessionStorage.setItem("phenotype", autoPhenotype);
  sessionStorage.setItem("alleles", JSON.stringify(currentAlleles));
  
  // Save activity score from rulebase
  if (result.activity_score !== undefined && result.activity_score !== null) {
    sessionStorage.setItem("activityScore", result.activity_score);
  }
  
  // Save therapeutic recommendation from rulebase (CRITICAL for PDF)
  if (result.therapeutic_recommendation) {
    sessionStorage.setItem("recommendation", result.therapeutic_recommendation);
  }
  
  // Save genotype summary if available
  if (result.genotype_summary) {
    sessionStorage.setItem("genotypeSummary", result.genotype_summary);
  }

  // ไปหน้า Confirm Alleles (pharmacy step 3)
  window.electronAPI.navigate('confirm_alleles_pharmacy');
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
