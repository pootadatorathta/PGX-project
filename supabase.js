// supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ✅ ตรวจสอบว่า .env ถูกต้อง
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

// ✅ สร้าง Supabase client ที่ใช้งานได้จริง
const supabase = createClient(supabaseUrl, supabaseKey);


console.log('🔧 Using SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('🔧 Using SERVICE_KEY starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10));

module.exports = supabase;
