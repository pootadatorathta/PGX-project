const fs = require('fs');
const path = require('path');
const { getRulebaseFromSupabase } = require('./rulebaseImportController');

// Cache for rulebase data
let rulebaseCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load rulebase from Supabase (with caching)
 * Falls back to JSON file if Supabase fails
 */
async function loadRulebase(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached data if still valid
  if (!forceRefresh && rulebaseCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return rulebaseCache;
  }
  
  try {
    // Try to load from Supabase
    console.log('📥 Loading rulebase from Supabase...');
    const supabaseData = await getRulebaseFromSupabase();
    
    if (supabaseData && Object.keys(supabaseData).length > 0) {
      rulebaseCache = supabaseData;
      cacheTimestamp = now;
      const dnaTypes = Object.keys(supabaseData);
      console.log('✅ Rulebase loaded from Supabase - DNA Types:', dnaTypes.join(', '));
      return rulebaseCache;
    }
  } catch (error) {
    console.error('⚠️ Failed to load from Supabase, falling back to JSON:', error.message);
  }
  
  // Fallback to JSON file
  try {
    const rulebasePath = path.join(__dirname, '../rulebase/cyp_rulebase.json');
    const data = fs.readFileSync(rulebasePath, 'utf8');
    rulebaseCache = JSON.parse(data);
    cacheTimestamp = now;
    const dnaTypes = Object.keys(rulebaseCache);
    console.log('✅ Rulebase loaded from JSON file (FALLBACK) - DNA Types:', dnaTypes.join(', '));
    return rulebaseCache;
  } catch (error) {
    console.error('❌ Error loading rulebase from JSON:', error.message);
    return {};
  }
}

/**
 * Get prediction based on DNA type and allele values
 * @param {string} dnaType - CYP2D6, CYP2C19, or CYP2C9
 * @param {object} alleles - Object with allele values (e.g., { allele10: "C/C", allele4: "G/G", ... })
 * @returns {object} - { genotype, phenotype, activity_score, matched: boolean }
 */
async function predictPhenotype(dnaType, alleles) {
  const rules = await loadRulebase();
  
  if (!rules[dnaType]) {
    console.error(`❌ Unknown DNA type: ${dnaType}`);
    return {
      genotype: '-',
      phenotype: '-',
      activity_score: 0,
      matched: false,
      error: 'Unknown DNA type'
    };
  }

  const typeRules = rules[dnaType];
  
  // Try to find exact match in rules
  for (const rule of typeRules.rules) {
    let isMatch = true;
    
    // Check if all provided alleles match the rule
    for (const [key, value] of Object.entries(alleles)) {
      if (rule[key] && rule[key] !== value) {
        isMatch = false;
        break;
      }
    }
    
    if (isMatch) {
      return {
        genotype: rule.genotype,
        phenotype: rule.phenotype,
        activity_score: rule.activity_score,
        therapeutic_recommendation: rule.therapeutic_recommendation || '',
        matched: true
      };
    }
  }
  
  // No match found, return default
  return {
    genotype: typeRules.default.genotype,
    phenotype: typeRules.default.phenotype,
    activity_score: typeRules.default.activity_score,
    therapeutic_recommendation: '',
    matched: false,
    warning: 'No exact match found in rulebase, using default values'
  };
}

/**
 * Get available alleles for a DNA type
 * @param {string} dnaType - CYP2D6, CYP2C19, or CYP2C9
 * @returns {array} - Array of allele names
 */
async function getAvailableAlleles(dnaType) {
  const rules = await loadRulebase();
  
  if (!rules[dnaType]) {
    return [];
  }
  
  return rules[dnaType].alleles || [];
}

/**
 * Get all possible values for a specific allele
 * @param {string} dnaType - CYP2D6, CYP2C19, or CYP2C9
 * @param {string} alleleName - e.g., "*10", "*2", etc.
 * @returns {array} - Array of unique possible values
 */
async function getAllelePossibleValues(dnaType, alleleName) {
  const rules = await loadRulebase();
  
  if (!rules[dnaType]) {
    return [];
  }
  
  const alleleKey = 'allele' + alleleName.replace('*', '');
  const values = new Set();
  
  rules[dnaType].rules.forEach(rule => {
    if (rule[alleleKey]) {
      values.add(rule[alleleKey]);
    }
  });
  
  return Array.from(values);
}

/**
 * Get all supported DNA types
 * @returns {array} - Array of DNA type names
 */
async function getSupportedDnaTypes() {
  const rules = await loadRulebase();
  return Object.keys(rules);
}

/**
 * Get complete rulebase information
 * @returns {object} - Complete rulebase
 */
async function getRulebase() {
  return await loadRulebase();
}

/**
 * Refresh rulebase cache
 */
async function refreshRulebase() {
  return await loadRulebase(true);
}

module.exports = {
  predictPhenotype,
  getAvailableAlleles,
  getAllelePossibleValues,
  getSupportedDnaTypes,
  getRulebase,
  refreshRulebase
};
