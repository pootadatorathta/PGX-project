const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const supabase = require('../supabase');

/**
 * Read Excel file and convert each sheet to JSON format
 * @param {string} excelFilePath - Path to the Excel file
 * @returns {Object} - Object with sheet names as keys and data as values
 */
function readExcelToJson(excelFilePath) {
  try {
    console.log('📖 Reading Excel file:', excelFilePath);
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelFilePath);
    const result = {};
    
    // Process each sheet
    workbook.SheetNames.forEach(sheetName => {
      console.log(`📋 Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON (with header row)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      // Store with sheet name as key
      result[sheetName] = {
        sheet_name: sheetName,
        data: jsonData,
        row_count: jsonData.length
      };
    });
    
    console.log('✅ Excel parsed successfully. Sheets:', Object.keys(result));
    return result;
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    throw error;
  }
}

/**
 * Convert Excel data to rulebase format
 * @param {Object} sheetData - Data from Excel sheet
 * @param {string} dnaType - DNA type (CYP2D6, CYP2C19, etc.)
 * @returns {Object} - Formatted rulebase object
 */
function formatToRulebase(sheetData, dnaType) {
  const data = sheetData.data;
  if (!data || data.length === 0) {
    return null;
  }
  
  // Get allele column names (exclude Genotype and Phenotype columns)
  const alleleColumns = Object.keys(data[0]).filter(key => 
    !key.includes('Genotype') && 
    !key.includes('Phenotype') && 
    !key.includes('Haplotype') &&
    !key.includes('Likely')
  );
  
  // Build rules array
  const rules = data.map(row => {
    const rule = {};
    
    // Add allele values (convert column names to allele format)
    alleleColumns.forEach(col => {
      // Convert column name to allele key format
      // e.g., "*10 (100C>T)" -> "allele10"
      const alleleKey = convertColumnToAlleleKey(col, dnaType);
      rule[alleleKey] = row[col] || '';
    });
    
    // Add genotype
    const genotypeCol = Object.keys(row).find(k => k.includes('Genotype') || k.includes('Haplotype'));
    if (genotypeCol) {
      rule.genotype = row[genotypeCol];
    }
    
    // Add phenotype
    const phenotypeCol = Object.keys(row).find(k => k.includes('Phenotype') || k.includes('Likely'));
    if (phenotypeCol) {
      rule.phenotype = row[phenotypeCol];
    }
    
    // Add activity score (default based on phenotype)
    rule.activity_score = calculateActivityScore(rule.phenotype);
    
    return rule;
  });
  
  // Build rulebase structure
  return {
    dna_type: dnaType,
    description: `${dnaType} Pharmacogenomics Rules`,
    alleles: alleleColumns,
    rules: rules,
    default: rules[0] || { genotype: "*1/*1", phenotype: "Normal Metabolizer", activity_score: 2.0 }
  };
}

/**
 * Convert Excel column name to allele key format
 */
function convertColumnToAlleleKey(columnName, dnaType) {
  // Remove special characters and spaces
  let clean = columnName.replace(/[()>*\s-]/g, '');
  
  // Special handling for VKORC1
  if (dnaType === 'VKORC1') {
    if (columnName.includes('1173')) return 'alleleVKORC1_1173';
    if (columnName.includes('1639')) return 'alleleVKORC1_1639';
  }
  
  // Extract allele number (e.g., "*10" -> "allele10", "*3C" -> "allele3C")
  const match = columnName.match(/\*(\d+[A-Z]*)/);
  if (match) {
    return 'allele' + match[1];
  }
  
  // Fallback: use cleaned column name
  return 'allele' + clean;
}

/**
 * Calculate activity score based on phenotype
 */
function calculateActivityScore(phenotype) {
  if (!phenotype) return 1.0;
  
  const p = phenotype.toLowerCase();
  if (p.includes('normal')) return 2.0;
  if (p.includes('intermediate')) return 1.5;
  if (p.includes('poor')) return 0.5;
  if (p.includes('rapid') || p.includes('ultra')) return 3.0;
  
  return 1.0;
}

/**
 * Upload rulebase data to Supabase
 * @param {Object} rulebaseData - Formatted rulebase data
 * @returns {Promise<Object>} - Upload result
 */
async function uploadToSupabase(rulebaseData) {
  try {
    console.log('📤 Uploading rulebase to Supabase:', rulebaseData.dna_type);
    
    // Check if record exists
    const { data: existing } = await supabase
      .from('pgx_rulebase')
      .select('id')
      .eq('dna_type', rulebaseData.dna_type)
      .single();
    
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('pgx_rulebase')
        .update({
          description: rulebaseData.description,
          alleles: rulebaseData.alleles,
          rules: rulebaseData.rules,
          default_rule: rulebaseData.default,
          updated_at: new Date().toISOString()
        })
        .eq('dna_type', rulebaseData.dna_type)
        .select();
      
      if (error) throw error;
      console.log('✅ Updated existing rulebase:', rulebaseData.dna_type);
      return { success: true, action: 'updated', data };
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('pgx_rulebase')
        .insert([{
          dna_type: rulebaseData.dna_type,
          description: rulebaseData.description,
          alleles: rulebaseData.alleles,
          rules: rulebaseData.rules,
          default_rule: rulebaseData.default,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      console.log('✅ Inserted new rulebase:', rulebaseData.dna_type);
      return { success: true, action: 'inserted', data };
    }
  } catch (error) {
    console.error('❌ Error uploading to Supabase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main function: Import Excel file and upload to Supabase
 * @param {string} excelFileName - Name of Excel file in rulebase folder
 * @returns {Promise<Object>} - Import result
 */
async function importExcelToSupabase(excelFileName) {
  try {
    const excelPath = path.join(__dirname, '../rulebase', excelFileName);
    
    // Check if file exists
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel file not found: ${excelPath}`);
    }
    
    // Read Excel
    const sheetsData = readExcelToJson(excelPath);
    
    // Upload each sheet as a DNA type
    const results = [];
    for (const [sheetName, sheetData] of Object.entries(sheetsData)) {
      // Determine DNA type from sheet name
      const dnaType = sheetName.trim().toUpperCase();
      
      // Format to rulebase
      const rulebase = formatToRulebase(sheetData, dnaType);
      
      if (rulebase) {
        // Upload to Supabase
        const result = await uploadToSupabase(rulebase);
        results.push({ dnaType, ...result });
      }
    }
    
    console.log('🎉 Import completed. Results:', results);
    return { success: true, results };
  } catch (error) {
    console.error('❌ Import failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get rulebase from Supabase
 * @param {string} dnaType - DNA type to fetch (optional, fetches all if not provided)
 * @returns {Promise<Object>} - Rulebase data
 */
async function getRulebaseFromSupabase(dnaType = null) {
  try {
    let query = supabase.from('pgx_rulebase').select('*');
    
    if (dnaType) {
      query = query.eq('dna_type', dnaType).single();
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Convert to format expected by frontend
    if (Array.isArray(data)) {
      const formatted = {};
      data.forEach(item => {
        formatted[item.dna_type] = {
          description: item.description,
          alleles: item.alleles,
          rules: item.rules,
          default: item.default_rule
        };
      });
      return formatted;
    } else if (data) {
      return {
        [data.dna_type]: {
          description: data.description,
          alleles: data.alleles,
          rules: data.rules,
          default: data.default_rule
        }
      };
    }
    
    return {};
  } catch (error) {
    console.error('❌ Error fetching rulebase from Supabase:', error);
    return {};
  }
}

module.exports = {
  readExcelToJson,
  formatToRulebase,
  uploadToSupabase,
  importExcelToSupabase,
  getRulebaseFromSupabase
};
