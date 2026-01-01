// controllers/pgxReportController.js
const supabase = require('../supabase');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const https = require('https');
const http = require('http');

/**
 * Compare genotype with diplotype table and get matching results
 * @param {string} geneSymbol - DNA Type (e.g., "CYP2D6")
 * @param {string} genotype - Genotype (e.g., "*1/*41")
 * @returns {Promise<Object>} Diplotype match with function details
 */
async function findDiplotype(geneSymbol, genotype) {
  try {
    // Clean genotype: remove " or" and anything after it
    const cleanedGenotype = genotype.replace(/\s+or.*/gi, '').trim();
    
    // Query with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const { data, error } = await supabase
      .from('diplotype')
      .select('description, consultationtext, totalactivityscore')
      .eq('genesymbol', geneSymbol)
      .eq('diplotype', cleanedGenotype)
      .limit(1)
      .maybeSingle();

    clearTimeout(timeoutId);

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error finding diplotype:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('⚠️ Diplotype query timeout');
    } else {
      console.error('❌ Exception in findDiplotype:', err.message);
    }
    return null;
  }
}

/**
 * Create a report entry in the database
 * @param {Object} reportData - Report information
 * @returns {Promise<Object>} Created report with ID
 */
async function createReport(reportData) {
  try {
    const { data, error } = await supabase
      .from('report')
      .insert([{
        request_id: reportData.request_id,
        test_target: reportData.test_target,
        genotype_summary: reportData.genotype_summary,
        predicted_phenotype: reportData.predicted_phenotype,
        recommendation: reportData.recommendation,
        pdf_path: reportData.pdf_path || null,
        genotype: reportData.genotype
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating report:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('❌ Exception in createReport:', err);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างรายงาน' };
  }
}

/**
 * Download image from URL to buffer
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log('🔽 Downloading image from:', imageUrl);
    
    const protocol = imageUrl.startsWith('https:') ? https : http;
    const request = protocol.get(imageUrl, {
      rejectUnauthorized: false,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        console.log('➡️ Following redirect to:', redirectUrl);
        const redirectProtocol = redirectUrl.startsWith('https:') ? https : http;
        redirectProtocol.get(redirectUrl, {
          rejectUnauthorized: false,
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            reject(new Error(`HTTP ${redirectRes.statusCode} after redirect`));
            return;
          }
          
          const chunks = [];
          redirectRes.on('data', chunk => chunks.push(chunk));
          redirectRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('✅ Downloaded', buffer.length, 'bytes after redirect');
            resolve(buffer);
          });
          redirectRes.on('error', reject);
        }).on('error', reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('✅ Downloaded', buffer.length, 'bytes');
        resolve(buffer);
      });
      res.on('error', reject);
    });
    
    request.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Edit existing PDF to add signatures
 * @param {string} existingPdfPath - Storage path or URL of existing PDF
 * @param {string} signature1_url - URL of first signature (left box)
 * @param {string} signature2_url - URL of second signature (right box)
 * @returns {Promise<Buffer>} Modified PDF as buffer
 */
async function addSignaturesToPDF(existingPdfPath, signature1_url, signature2_url) {
  try {
    console.log('📝 Starting PDF editing process...');
    console.log('📄 Existing PDF path:', existingPdfPath);
    console.log('✍️ Signature 1 (LEFT):', signature1_url);
    console.log('✍️ Signature 2 (RIGHT):', signature2_url);
    
    // Download existing PDF
    let existingPdfBuffer;
    if (existingPdfPath.startsWith('http://') || existingPdfPath.startsWith('https://')) {
      console.log('🌐 Downloading PDF from URL...');
      existingPdfBuffer = await downloadImage(existingPdfPath);
    } else {
      // Get PDF from Supabase storage
      console.log('☁️ Downloading PDF from storage:', existingPdfPath);
      const { data, error } = await supabase.storage
        .from('PDF_Bucket')
        .download(existingPdfPath);
      
      if (error) throw new Error(`Failed to download PDF: ${error.message}`);
      existingPdfBuffer = Buffer.from(await data.arrayBuffer());
      console.log('✅ PDF downloaded:', existingPdfBuffer.length, 'bytes');
    }
    
    // Load PDF with pdf-lib
    console.log('📖 Loading PDF document...');
    const pdfDoc = await PDFLibDocument.load(existingPdfBuffer);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width: pageWidth, height: pageHeight } = lastPage.getSize();
    
    console.log('📏 Last page size:', pageWidth, 'x', pageHeight);
    
    // Signature box dimensions (matching original layout)
    const boxWidth = 225; // 450px total / 2
    const boxHeight = 50;
    const boxY = 60; // Distance from bottom
    const leftBoxX = 75; // Left signature X position
    const rightBoxX = 300; // Right signature X position (75 + 225 - 15 space)
    
    // Add first signature (LEFT box)
    if (signature1_url) {
      try {
        console.log('🖼️ Processing LEFT signature...');
        const sig1Buffer = await downloadImage(signature1_url);
        const sig1Image = await pdfDoc.embedPng(sig1Buffer);
        
        // Scale image to fit box while maintaining aspect ratio
        const sig1Dims = sig1Image.scale(1);
        const scale1 = Math.min(boxWidth / sig1Dims.width, boxHeight / sig1Dims.height);
        const sig1Width = sig1Dims.width * scale1;
        const sig1Height = sig1Dims.height * scale1;
        
        // Center signature in box
        const sig1X = leftBoxX + (boxWidth - sig1Width) / 2;
        const sig1Y = boxY + (boxHeight - sig1Height) / 2;
        
        lastPage.drawImage(sig1Image, {
          x: sig1X,
          y: sig1Y,
          width: sig1Width,
          height: sig1Height,
        });
        console.log('✅ LEFT signature added at', sig1X, sig1Y);
      } catch (err) {
        console.error('❌ Error adding LEFT signature:', err.message);
      }
    }
    
    // Add second signature (RIGHT box)
    if (signature2_url) {
      try {
        console.log('🖼️ Processing RIGHT signature...');
        const sig2Buffer = await downloadImage(signature2_url);
        const sig2Image = await pdfDoc.embedPng(sig2Buffer);
        
        // Scale image to fit box while maintaining aspect ratio
        const sig2Dims = sig2Image.scale(1);
        const scale2 = Math.min(boxWidth / sig2Dims.width, boxHeight / sig2Dims.height);
        const sig2Width = sig2Dims.width * scale2;
        const sig2Height = sig2Dims.height * scale2;
        
        // Center signature in box
        const sig2X = rightBoxX + (boxWidth - sig2Width) / 2;
        const sig2Y = boxY + (boxHeight - sig2Height) / 2;
        
        lastPage.drawImage(sig2Image, {
          x: sig2X,
          y: sig2Y,
          width: sig2Width,
          height: sig2Height,
        });
        console.log('✅ RIGHT signature added at', sig2X, sig2Y);
      } catch (err) {
        console.error('❌ Error adding RIGHT signature:', err.message);
      }
    }
    
    // Save modified PDF
    console.log('💾 Saving modified PDF...');
    const modifiedPdfBuffer = await pdfDoc.save();
    console.log('✅ PDF editing complete:', modifiedPdfBuffer.length, 'bytes');
    
    return Buffer.from(modifiedPdfBuffer);
  } catch (err) {
    console.error('❌ Error editing PDF:', err.message);
    console.error('❌ Stack:', err.stack);
    throw err;
  }
}

/**
 * Draw signature image in PDF
 * @param {PDFDocument} doc - PDFKit document
 * @param {string} signatureUrl - URL or path to signature image
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width of signature area
 * @param {number} height - Height of signature area
 */
async function drawSignature(doc, signatureUrl, x, y, width, height) {
  try {
    if (!signatureUrl) {
      console.log('⚠️ No signature URL provided');
      return;
    }

    console.log('🖼️ Drawing signature from URL:', signatureUrl);

    // Check if it's a local file path or URL
    if (signatureUrl.startsWith('http://') || signatureUrl.startsWith('https://')) {
      // Download from URL
      const https = require('https');
      const http = require('http');
      const protocol = signatureUrl.startsWith('https://') ? https : http;
      
      console.log('📥 Downloading signature image...');
      
      const imageBuffer = await new Promise((resolve, reject) => {
        const request = protocol.get(signatureUrl, {
          // Add options for Supabase
          headers: {
            'User-Agent': 'Mozilla/5.0'
          },
          rejectUnauthorized: false // Allow self-signed certificates
        }, (res) => {
          console.log('📡 Response status:', res.statusCode);
          console.log('📡 Content-Type:', res.headers['content-type']);
          
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            console.log('🔄 Following redirect to:', redirectUrl);
            
            // Recursive call for redirect
            const redirectProtocol = redirectUrl.startsWith('https://') ? https : http;
            redirectProtocol.get(redirectUrl, { rejectUnauthorized: false }, (redirectRes) => {
              const chunks = [];
              redirectRes.on('data', chunk => chunks.push(chunk));
              redirectRes.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('✅ Downloaded', buffer.length, 'bytes after redirect');
                resolve(buffer);
              });
              redirectRes.on('error', reject);
            }).on('error', reject);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('✅ Downloaded', buffer.length, 'bytes');
            resolve(buffer);
          });
          res.on('error', reject);
        });
        
        request.on('error', (err) => {
          console.error('❌ Request error:', err.message);
          reject(err);
        });
        
        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      if (!imageBuffer || imageBuffer.length === 0) {
        console.error('❌ Downloaded buffer is empty');
        return;
      }
      
      console.log('🎨 Drawing image to PDF...');
      doc.image(imageBuffer, x, y, { 
        width, 
        height, 
        fit: [width, height], 
        align: 'center', 
        valign: 'center' 
      });
      console.log('✅ Signature image drawn successfully');
    } else if (fs.existsSync(signatureUrl)) {
      // Local file path
      console.log('📁 Loading from local file...');
      doc.image(signatureUrl, x, y, { width, height, fit: [width, height], align: 'center', valign: 'center' });
      console.log('✅ Signature image drawn from local file');
    } else {
      console.log('⚠️ Signature file not found:', signatureUrl);
    }
  } catch (err) {
    console.error('❌ Error drawing signature:', err.message);
    console.error('❌ Error stack:', err.stack);
    console.error('❌ Signature URL was:', signatureUrl);
    // Don't throw - let PDF generation continue without signature
  }
}

/**
 * Generate PDF report for PGx test (in memory, no local file)
 * @param {Object} reportInfo - Complete report information
 * @returns {Promise<{buffer: Buffer, fileName: string}>} PDF buffer and filename
 */
async function generatePGxPDF(reportInfo) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create unique filename with report_id or request_id
      const timestamp = Date.now();
      const reportId = reportInfo.report_id || reportInfo.request_id || timestamp;
      const fileName = `PGx_${reportInfo.patientId}_${reportInfo.test_target}_${reportId}.pdf`;

      const doc = new PDFDocument({ 
        margin: 40, 
        size: 'A4',
        bufferPages: false
      });
      
      // Collect PDF data in memory
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve({ buffer: pdfBuffer, fileName });
      });
      doc.on('error', reject);

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
      
      // Helper functions
      const setBold = () => hasBoldFont && doc.font('THSarabunBold');
      const setRegular = () => hasRegularFont && doc.font('THSarabun');

    // === HEADER SECTION ===
    // Purple line at top
    doc.rect(40, 35, doc.page.width - 80, 2.5).fill('#8B4789');
    
    // Document code
    doc.fontSize(7).fillColor('#000000');
    setRegular();
    doc.text('รหัสเอกสาร: LAB-02-2374', doc.page.width - 130, 22, { width: 90, align: 'right' });
    
    // Main header box
    const headerY = 48;
    const headerHeight = 62;
    doc.rect(40, headerY, doc.page.width - 80, headerHeight).stroke('#000000');
    
    // Laboratory name - Thai
    doc.fontSize(13);
    setBold();
    doc.fillColor('#000000').text('ห้องปฏิบัติการเภสัชพันธุศาสตร์', 40, headerY + 8, { 
      align: 'center',
      width: doc.page.width - 80
    });
    
    // Laboratory name - English
    doc.fontSize(10);
    setRegular();
    doc.text('(Laboratory for Pharmacogenomics)', 40, headerY + 24, {
      align: 'center',
      width: doc.page.width - 80
    });
    
    // Address
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
    
    // Define columns
    const col1Label = 48;
    const col1Value = 148;
    const col2Label = 300;
    const col2Value = 405;
    
    let y = patientBoxY + 8;
    const lineHeight = 14;
    
    // Row 1: Name and Age
    doc.text('ชื่อ-สกุล (Name):', col1Label, y, { width: 95 });
    doc.text(reportInfo.patientName || 'N/A', col1Value, y, { width: 145 });
    doc.text('อายุ (Age):', col2Label, y, { width: 100 });
    doc.text(`${reportInfo.patientAge || 'N/A'} ปี`, col2Value, y, { width: 110 });
    
    y += lineHeight;
    // Row 2: HN and Gender
    doc.text('เลขประจำตัวผู้ป่วย (HN):', col1Label, y, { width: 95 });
    doc.text(reportInfo.patientId || 'N/A', col1Value, y, { width: 145 });
    doc.text('เพศ (Gender):', col2Label, y, { width: 100 });
    doc.text(reportInfo.patientGender || 'N/A', col2Value, y, { width: 110 });
    
    y += lineHeight;
    // Row 3: Specimen and Patient#
    doc.text('ชนิดสิ่งส่งตรวจ (Specimen):', col1Label, y, { width: 95 });
    doc.text(reportInfo.specimen || 'Nails', col1Value, y, { width: 145 });
    doc.text('เลขที่รับผล (Patient#):', col2Label, y, { width: 100 });
    doc.text((reportInfo.patientNumber || reportInfo.request_id || '68').toString(), col2Value, y, { width: 110 });
    
    y += lineHeight;
    // Row 4: Hospital and Create date
    doc.text('โรงพยาบาล (Hospital):', col1Label, y, { width: 95 });
    doc.text((reportInfo.hospital || '1').toString(), col1Value, y, { width: 145 });
    doc.text('วันที่รับตัวอย่าง (Date):', col2Label, y, { width: 100 });
    doc.text(reportInfo.createDate || '2025-11-10', col2Value, y, { width: 110 });
    
    y += lineHeight;
    // Row 5: Clinician and Update date
    doc.text('แพทย์ผู้ส่งตรวจ (Clinician):', col1Label, y, { width: 95 });
    doc.text(reportInfo.doctorName || 'ศมบูลูป รักไทย', col1Value, y, { width: 145 });
    doc.text('วันที่รายงานผล (Report):', col2Label, y, { width: 100 });
    doc.text(reportInfo.updateDate || '11/12/2568', col2Value, y, { width: 110 });

    doc.y = patientBoxY + patientBoxHeight + 8;

    // === TEST RESULTS SECTION ===
    // Section title with gene and score
    doc.fontSize(8);
    setBold();
    doc.text(`${reportInfo.test_target} genotyping: ${reportInfo.activityScore || 'N/A'}`, {
      align: 'left'
    });
    doc.moveDown(0.2);

    // Gene name
    doc.fontSize(7.5);
    setBold();
    doc.text(`${reportInfo.test_target} gene`);
    doc.moveDown(0.15);

    // === ALLELE TABLE ===
    if (reportInfo.alleles?.length > 0) {
      const tableY = doc.y;
      const tableX = 100;
      const numAlleles = reportInfo.alleles.length;
      const cellWidth = 100;
      const cellHeight = 18;
      const tableWidth = cellWidth * numAlleles;
      
      setRegular();
      doc.fontSize(7.5);
      
      // Draw outer box
      doc.rect(tableX, tableY, tableWidth, cellHeight * 2).stroke('#000000');
      
      // Draw vertical separators
      for (let i = 1; i < numAlleles; i++) {
        const x = tableX + (cellWidth * i);
        doc.moveTo(x, tableY).lineTo(x, tableY + cellHeight * 2).stroke('#000000');
      }
      
      // Draw horizontal separator
      doc.moveTo(tableX, tableY + cellHeight).lineTo(tableX + tableWidth, tableY + cellHeight).stroke('#000000');
      
      // Fill header and value cells
      reportInfo.alleles.forEach((allele, index) => {
        const x = tableX + (cellWidth * index);
        
        // Header (allele name)
        doc.text(allele.name, x + 4, tableY + 4, { 
          width: cellWidth - 8, 
          align: 'center' 
        });
        
        // Value
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
    doc.text(reportInfo.genotype || 'N/A', 180, resultY, { width: doc.page.width - 220 });
    
    resultY += 11;
    doc.text('Total activity score:', 48, resultY);
    doc.text(String(reportInfo.activityScore || 'N/A'), 180, resultY, { width: doc.page.width - 220 });
    
    resultY += 11;
    
    // === GENOTYPE SUMMARY (moved before Phenotype) ===
    doc.fontSize(7.5);
    setBold();
    doc.text('Genotype Summary:', 48, resultY);
    
    setRegular();
    const summaryText = reportInfo.genotype_summary || 'An individual carrying two normal function alleles';
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
    const phenotypeText = reportInfo.predicted_phenotype || 'N/A';
    doc.text(phenotypeText, 180, resultY, { width: doc.page.width - 220, lineGap: 0 });
    
    // Calculate how much vertical space the phenotype text took
    const textHeight = doc.heightOfString(phenotypeText, { width: doc.page.width - 220, lineGap: 0 });
    doc.y = resultY + textHeight + 10;

    // === RECOMMENDATION ===
    const recY = doc.y;
    setBold();
    doc.text('Recommendation:', 48, recY);
    
    setRegular();
    const recText = reportInfo.recommendation || 'Please consult a clinical pharmacist for more specific dosing information based on this patient\'s CYP2D6 metabolizer status.';
    const recTextHeight = doc.heightOfString(recText, { width: doc.page.width - 228, lineGap: 0 });
    doc.text(recText, 180, recY, {
      width: doc.page.width - 228,
      align: 'left',
      lineGap: 0
    });
    
    doc.y = recY + recTextHeight + 8;

    // === SIGNATURE BOX ===
    const sigBoxY = doc.page.height - 110;
    const sigBoxWidth = 450;
    const sigBoxHeight = 50;
    const sigBoxX = 60;
    
    console.log('📝 Drawing signature box with signatures - Left:', reportInfo.signature1_url, 'Right:', reportInfo.signature2_url);
    
    // Draw outer box
    doc.rect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight).stroke('#000000');
    
    // Draw vertical line to split box in half
    const centerX = sigBoxX + (sigBoxWidth / 2);
    doc.moveTo(centerX, sigBoxY).lineTo(centerX, sigBoxY + sigBoxHeight).stroke('#000000');
    
    // Left side labels and signature
    doc.fontSize(7.5);
    setRegular();
    doc.text('วิเคราะห์และแปลผลโดย', sigBoxX + 4, sigBoxY + 4, { width: (sigBoxWidth / 2) - 8, align: 'left' });
    
    // Draw left signature if available (first confirmer)
    if (reportInfo.signature1_url) {
      await drawSignature(doc, reportInfo.signature1_url, sigBoxX + 15, sigBoxY + 18, 100, 25);
    }
    
    // Right side labels and signature
    doc.text('วิเคราะห์และแปลผลโดย', centerX + 4, sigBoxY + 4, { width: (sigBoxWidth / 2) - 8, align: 'left' });
    
    // Draw right signature if available (second confirmer)
    if (reportInfo.signature2_url) {
      await drawSignature(doc, reportInfo.signature2_url, centerX + 15, sigBoxY + 18, 100, 25);
    }

    doc.end();
    } catch (err) {
      console.error('❌ Exception in generatePGxPDF:', err);
      reject(err);
    }
  });
}

/**
 * Upload PDF to Supabase storage
 * @param {Buffer} fileBuffer - PDF buffer
 * @param {string} fileName - Desired file name in storage
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadPDFToStorage(fileBuffer, fileName) {
  try {
    // Try PDF_Bucket first, then fall back to checking available buckets
    let bucketName = 'PDF_Bucket';
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('❌ Error uploading to storage:', error);
      
      // If bucket not found, list available buckets
      if (error.message?.includes('Bucket not found')) {
        const { data: buckets } = await supabase.storage.listBuckets();
        console.log('📦 Available buckets:', buckets?.map(b => b.name));
        
        // Try to find a PDF or report bucket
        const pdfBucket = buckets?.find(b => 
          b.name.toLowerCase().includes('pdf') || 
          b.name.toLowerCase().includes('report')
        );
        
        if (pdfBucket) {
          console.log(`🔄 Retrying with bucket: ${pdfBucket.name}`);
          bucketName = pdfBucket.name;
          
          const { data: retryData, error: retryError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, fileBuffer, {
              contentType: 'application/pdf',
              upsert: true
            });
            
          if (retryError) {
            console.error('❌ Retry failed:', retryError);
            return null;
          }
        } else {
          console.error('❌ No PDF bucket found. Please create "PDF_Bucket" in Supabase Storage.');
          return null;
        }
      } else {
        return null;
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    console.log('✅ PDF uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('❌ Exception in uploadPDFToStorage:', err);
    return null;
  }
}

/**
 * Complete workflow: Generate report, create PDF, upload, and save to database
 * @param {Object} testData - Complete test information
 * @returns {Promise<Object>} Result with report data and PDF path
 */
async function processCompleteReport(testData) {
  try {
    // Step 1: Try to find diplotype match (optional, with timeout)
    let diplotype = null;
    try {
      diplotype = await Promise.race([
        findDiplotype(testData.test_target, testData.genotype),
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);
    } catch (err) {
      console.log('⚠️ Diplotype lookup skipped:', err.message);
    }
    
    // Get description and consultation from diplotype if available, otherwise use provided data
    const genotypeDescription = diplotype?.description || testData.genotype_summary || 'An individual carrying normal function alleles';
    const consultationText = diplotype?.consultationtext || testData.recommendation || 'Please consult a clinical pharmacist for more specific dosing information.';

    // Step 2: Prepare report data (without PDF path first)
    const reportData = {
      request_id: testData.request_id,
      test_target: testData.test_target,
      genotype: testData.genotype,
      genotype_summary: genotypeDescription,
      predicted_phenotype: testData.predicted_phenotype,
      recommendation: consultationText
    };

    // Step 3: Create report first to get report_id
    const reportResult = await createReport(reportData);
    
    if (!reportResult.success) {
      return reportResult;
    }

    const reportId = reportResult.data.report_id;

    // Step 4: Fetch confirmer signatures if they exist
    let signature1_url = null;
    let signature2_url = null;
    
    console.log('🔍 Checking for confirmers - confirmed_by_1:', testData.confirmed_by_1, 'confirmed_by_2:', testData.confirmed_by_2);
    
    if (testData.confirmed_by_1) {
      const { data: user1 } = await supabase
        .from('system_users')
        .select('Signature_path')
        .eq('user_id', testData.confirmed_by_1)
        .single();
      
      if (user1?.Signature_path) {
        // Convert storage path to public URL
        if (user1.Signature_path.startsWith('http://') || user1.Signature_path.startsWith('https://')) {
          signature1_url = user1.Signature_path;
        } else {
          // It's a storage path like "signatures/userId_timestamp.png"
          const { data: urlData } = supabase.storage
            .from('Image_Bucket')
            .getPublicUrl(user1.Signature_path);
          signature1_url = urlData.publicUrl;
        }
      }
    }
    
    if (testData.confirmed_by_2) {
      const { data: user2 } = await supabase
        .from('system_users')
        .select('Signature_path')
        .eq('user_id', testData.confirmed_by_2)
        .single();
      
      if (user2?.Signature_path) {
        // Convert storage path to public URL
        if (user2.Signature_path.startsWith('http://') || user2.Signature_path.startsWith('https://')) {
          signature2_url = user2.Signature_path;
        } else {
          // It's a storage path like "signatures/userId_timestamp.png"
          const { data: urlData } = supabase.storage
            .from('Image_Bucket')
            .getPublicUrl(user2.Signature_path);
          signature2_url = urlData.publicUrl;
        }
      }
    }

    // Step 5: Generate PDF with report_id in filename (in memory)
    const pdfInfo = {
      ...testData,
      report_id: reportId,
      genotype_summary: genotypeDescription,
      recommendation: consultationText,
      activityScore: diplotype?.totalactivityscore || 'N/A',
      signature1_url,
      signature2_url
    };

    const { buffer: pdfBuffer, fileName } = await generatePGxPDF(pdfInfo);

    // Step 6: Upload to Supabase storage
    const publicUrl = await uploadPDFToStorage(pdfBuffer, fileName);

    if (!publicUrl) {
      // Report already created, just return without PDF URL
      return {
        success: true,
        warning: 'รายงานถูกสร้างแล้ว แต่ไม่สามารถอัพโหลด PDF ได้',
        data: {
          report: reportResult.data,
          pdf_url: null,
          diplotype: diplotype
        }
      };
    }

    // Step 7: Update report with PDF path
    const { error: updateError } = await supabase
      .from('report')
      .update({ pdf_path: publicUrl })
      .eq('report_id', reportId);

    if (updateError) {
      console.error('❌ Error updating PDF path:', updateError.message);
    }

    // Step 8: Clean up local file (optional)
    // fs.unlinkSync(localPdfPath);

    return {
      success: true,
      data: {
        report: reportResult.data,
        pdf_url: publicUrl,
        diplotype: diplotype
      }
    };

  } catch (err) {
    console.error('❌ Exception in processCompleteReport:', err);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรายงาน: ' + err.message
    };
  }
}

module.exports = {
  findDiplotype,
  createReport,
  generatePGxPDF,
  uploadPDFToStorage,
  processCompleteReport,
  addSignaturesToPDF
};
