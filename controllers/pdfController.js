const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * Generate PDF report with dynamic rulebase data
 * @param {Object} reportData - Report information with rulebase predictions
 * @param {string} reportData.name - Patient name
 * @param {string} reportData.age - Patient age
 * @param {string} reportData.gender - Patient gender
 * @param {string} reportData.hn - Hospital Number
 * @param {string} reportData.hospital - Hospital ID
 * @param {string} reportData.testTarget - Test target (e.g., "CYP2D6")
 * @param {string} reportData.specimen - Specimen type
 * @param {string} reportData.genotype - Genotype from rulebase (e.g., "*4/*41")
 * @param {string} reportData.predicted_phenotype - Phenotype from rulebase (e.g., "Intermediate Metabolizer (IM)")
 * @param {string} reportData.recommendation - Therapeutic recommendation from rulebase
 * @param {string} reportData.genotype_summary - Genotype summary description
 * @param {Array} reportData.alleles - Array of {name, value} for allele table
 * @param {string} reportData.activityScore - Total activity score
 */
async function generatePDF(reportData) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

  const timestamp = Date.now();
  const fileName = `${reportData.hn || reportData.name || 'report'}_${reportData.testTarget || 'PGx'}_${timestamp}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Load Thai fonts
  const fontPath = path.join(__dirname, '..', 'fonts', 'Sarabun-Regular.ttf');
  const fontBoldPath = path.join(__dirname, '..', 'fonts', 'Sarabun-Bold.ttf');
  
  const hasRegularFont = fs.existsSync(fontPath);
  const hasBoldFont = fs.existsSync(fontBoldPath);
  
  if (hasRegularFont) {
    doc.registerFont('THSarabun', fontPath);
    doc.font('THSarabun');
  }
  
  if (hasBoldFont) {
    doc.registerFont('THSarabunBold', fontBoldPath);
  }
  
  const setBold = () => hasBoldFont && doc.font('THSarabunBold');
  const setRegular = () => hasRegularFont && doc.font('THSarabun');

  // === HEADER SECTION ===
  doc.rect(40, 35, doc.page.width - 80, 2.5).fill('#8B4789');
  
  doc.fontSize(7).fillColor('#000000');
  setRegular();
  doc.text('รหัสเอกสาร: LAB-02-2374', doc.page.width - 130, 22, { width: 90, align: 'right' });
  
  const headerY = 48;
  const headerHeight = 62;
  doc.rect(40, headerY, doc.page.width - 80, headerHeight).stroke('#000000');
  
  doc.fontSize(13);
  setBold();
  doc.fillColor('#000000').text('ห้องปฏิบัติการเภสัชพันธุศาสตร์', 40, headerY + 8, { 
    align: 'center',
    width: doc.page.width - 80
  });
  
  doc.fontSize(10);
  setRegular();
  doc.text('(Laboratory for Pharmacogenomics)', 40, headerY + 24, {
    align: 'center',
    width: doc.page.width - 80
  });
  
  doc.fontSize(7);
  doc.text(
    '6th Floor, Bumrungrat Plus Department Medical Centre, Department of Pathology, Faculty of Medicine',
    40,
    headerY + 40,
    { align: 'center', width: doc.page.width - 80 }
  );
  doc.text(
    'Ramathibodi Hospital Tel. +662-200-4321 Fax +662-200-4322',
    40,
    headerY + 50,
    { align: 'center', width: doc.page.width - 80 }
  );
  
  doc.y = headerY + headerHeight + 4;

  // === TITLE ===
  doc.fontSize(10);
  setBold();
  doc.fillColor('#000000').text('PHARMACOGENOMICS AND PERSONALIZED MEDICINE REPORT', { 
    align: 'center'
  });
  doc.moveDown(0.6);

  // === PATIENT INFORMATION BOX ===
  const patientBoxY = doc.y;
  const patientBoxHeight = 88;
  doc.rect(40, patientBoxY, doc.page.width - 80, patientBoxHeight).stroke('#000000');
  
  setRegular();
  doc.fontSize(7.5);
  doc.fillColor('#000000');
  
  const col1Label = 48;
  const col1Value = 148;
  const col2Label = 300;
  const col2Value = 405;
  
  let y = patientBoxY + 8;
  const lineHeight = 14;
  
  // Row 1: Name and Age
  doc.text('ชื่อ-สกุล (Name):', col1Label, y, { width: 95 });
  doc.text(reportData.name || 'N/A', col1Value, y, { width: 145 });
  doc.text('อายุ (Age):', col2Label, y, { width: 100 });
  doc.text(`${reportData.age || 'N/A'} ปี`, col2Value, y, { width: 110 });
  
  y += lineHeight;
  doc.text('เลขประจำตัวผู้ป่วย (HN):', col1Label, y, { width: 95 });
  doc.text(reportData.hn || 'N/A', col1Value, y, { width: 145 });
  doc.text('เพศ (Gender):', col2Label, y, { width: 100 });
  doc.text(reportData.gender || 'N/A', col2Value, y, { width: 110 });
  
  y += lineHeight;
  doc.text('ชนิดสิ่งส่งตรวจ (Specimen):', col1Label, y, { width: 95 });
  doc.text(reportData.specimen || 'Nails', col1Value, y, { width: 145 });
  doc.text('เลขที่รับผล (Patient#):', col2Label, y, { width: 100 });
  doc.text((reportData.patientNumber || reportData.hn || 'N/A').toString(), col2Value, y, { width: 110 });
  
  y += lineHeight;
  doc.text('โรงพยาบาล (Hospital):', col1Label, y, { width: 95 });
  doc.text((reportData.hospital || '1').toString(), col1Value, y, { width: 145 });
  doc.text('วันที่รับตัวอย่าง (Date):', col2Label, y, { width: 100 });
  
  // Convert to Thai Buddhist calendar format (DD/MM/YYYY+543)
  let formattedCreateDate = '';
  if (reportData.createDate) {
    try {
      const date = new Date(reportData.createDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const thaiYear = date.getFullYear() + 543;
      formattedCreateDate = `${day}/${month}/${thaiYear}`;
    } catch (e) {
      formattedCreateDate = reportData.createDate;
    }
  } else {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const thaiYear = today.getFullYear() + 543;
    formattedCreateDate = `${day}/${month}/${thaiYear}`;
  }
  
  doc.text(formattedCreateDate, col2Value, y, { width: 110 });
  
  y += lineHeight;
  doc.text('แพทย์ผู้ส่งตรวจ (Clinician):', col1Label, y, { width: 95 });
  doc.text(reportData.doctorName || '-', col1Value, y, { width: 145 });
  doc.text('วันที่รายงานผล (Report):', col2Label, y, { width: 100 });
  
  // Convert report date to Thai Buddhist calendar format
  let formattedUpdateDate = '';
  if (reportData.updateDate) {
    // If already in Thai format (contains /), use it directly
    if (reportData.updateDate.includes('/')) {
      formattedUpdateDate = reportData.updateDate;
    } else {
      try {
        const date = new Date(reportData.updateDate);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const thaiYear = date.getFullYear() + 543;
        formattedUpdateDate = `${day}/${month}/${thaiYear}`;
      } catch (e) {
        formattedUpdateDate = reportData.updateDate;
      }
    }
  } else {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const thaiYear = today.getFullYear() + 543;
    formattedUpdateDate = `${day}/${month}/${thaiYear}`;
  }
  
  doc.text(formattedUpdateDate, col2Value, y, { width: 110 });

  doc.y = patientBoxY + patientBoxHeight + 8;

  // === TEST RESULTS SECTION ===
  const testTarget = reportData.testTarget || reportData.test_target || 'N/A';
  doc.fontSize(8);
  setBold();
  doc.text(`${testTarget} genotyping: ${reportData.activityScore || 'N/A'}`, {
    align: 'left'
  });
  doc.moveDown(0.2);

  doc.fontSize(7.5);
  setBold();
  doc.text(`${testTarget} gene`);
  doc.moveDown(0.15);

  // === ALLELE TABLE ===
  if (reportData.alleles?.length > 0) {
    const tableY = doc.y;
    const tableX = 100;
    const numAlleles = reportData.alleles.length;
    const cellWidth = 100;
    const cellHeight = 18;
    const tableWidth = cellWidth * numAlleles;
    
    setRegular();
    doc.fontSize(7.5);
    
    doc.rect(tableX, tableY, tableWidth, cellHeight * 2).stroke('#000000');
    
    for (let i = 1; i < numAlleles; i++) {
      const x = tableX + (cellWidth * i);
      doc.moveTo(x, tableY).lineTo(x, tableY + cellHeight * 2).stroke('#000000');
    }
    
    doc.moveTo(tableX, tableY + cellHeight).lineTo(tableX + tableWidth, tableY + cellHeight).stroke('#000000');
    
    reportData.alleles.forEach((allele, index) => {
      const x = tableX + (cellWidth * index);
      doc.text(allele.name, x + 4, tableY + 4, { 
        width: cellWidth - 8, 
        align: 'center' 
      });
      doc.text(allele.value, x + 4, tableY + cellHeight + 4, { 
        width: cellWidth - 8, 
        align: 'center' 
      });
    });
    
    doc.y = tableY + cellHeight * 2 + 8;
  }

  // === GENOTYPE, ACTIVITY SCORE, GENOTYPE SUMMARY, PHENOTYPE ===
  setRegular();
  doc.fontSize(7.5);
  let resultY = doc.y;
  
  doc.text('Genotype:', 48, resultY);
  doc.text(reportData.genotype || 'N/A', 180, resultY, { width: doc.page.width - 220 });
  
  resultY += 11;
  doc.text('Total activity score:', 48, resultY);
  doc.text(String(reportData.activityScore || 'N/A'), 180, resultY, { width: doc.page.width - 220 });
  
  resultY += 11;
  
  // === GENOTYPE SUMMARY (moved before Phenotype) ===
  doc.fontSize(7.5);
  setBold();
  doc.text('Genotype Summary:', 48, resultY);
  
  setRegular();
  const summaryText = reportData.genotype_summary || 'An individual carrying normal function alleles';
  const summaryTextHeight = doc.heightOfString(summaryText, { width: doc.page.width - 228, lineGap: 0 });
  doc.text(summaryText, 180, resultY, {
    width: doc.page.width - 228,
    align: 'left',
    lineGap: 0
  });
  
  resultY += summaryTextHeight + 11;
  
  // === PREDICTED PHENOTYPE (moved after Genotype Summary) ===
  setBold();
  doc.text('Predicted Phenotype:', 48, resultY);
  
  setRegular();
  const phenotypeText = reportData.predicted_phenotype || 'N/A';
  doc.text(phenotypeText, 180, resultY, { width: doc.page.width - 220, lineGap: 0 });
  
  const textHeight = doc.heightOfString(phenotypeText, { width: doc.page.width - 220, lineGap: 0 });
  doc.y = resultY + textHeight + 10;

  // === RECOMMENDATION (from Rulebase) ===
  const recY = doc.y;
  setBold();
  doc.text('Recommendation:', 48, recY);
  
  setRegular();
  const recText = reportData.recommendation || 'Please consult a clinical pharmacist for more specific dosing information.';
  const recTextHeight = doc.heightOfString(recText, { width: doc.page.width - 228, lineGap: 0 });
  doc.text(recText, 180, recY, {
    width: doc.page.width - 228,
    align: 'left',
    lineGap: 0
  });
  
  doc.y = recY + recTextHeight + 8;

  // === SIGNATURE BOX ===
  const sigBoxY = doc.page.height - 95;
  const sigBoxWidth = 400;
  const sigBoxHeight = 35;
  const sigBoxX = 85;
  
  doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight).stroke('#000000');
  
  const centerX = sigBoxX + (sigBoxWidth / 2);
  doc.moveTo(centerX, sigBoxY).lineTo(centerX, sigBoxY + sigBoxHeight).stroke('#000000');
  
  doc.fontSize(7.5);
  setRegular();
  doc.text('วิเคราะห์และแปลผลโดย', sigBoxX + 4, sigBoxY + 4, { width: (sigBoxWidth / 2) - 8, align: 'left' });
  doc.text('วิเคราะห์และแปลผลโดย', centerX + 4, sigBoxY + 4, { width: (sigBoxWidth / 2) - 8, align: 'left' });

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  console.log('✅ PDF generated successfully:', filePath);
  return filePath;
}

module.exports = { generatePDF };
