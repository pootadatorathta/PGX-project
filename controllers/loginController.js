// controllers/loginController.js
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');
const { logAuditEvent } = require('./auditLogController');

async function handleLogin(event, { username, password }) {
  try {
    const u = (username || '').trim();
    const p = (password || '').trim().normalize('NFKC');

    const { data, error } = await supabase
      .from('system_users')
      .select('user_id, username, password_hash, role, hospital_id, created_at, F_Name, L_Name, Signature_path')
      .eq('username', u)
      .maybeSingle();

    if (error || !data) {
      // Log failed login attempt
      await logAuditEvent({
        username: u,
        action: 'login_failed',
        description: 'ไม่พบบัญชีผู้ใช้',
        table_name: 'system_users'
      });
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้' };
    }

    const ok = await bcrypt.compare(p, String(data.password_hash || '').trim());
    if (!ok) {
      // Log failed password attempt
      await logAuditEvent({
        user_id: data.user_id,
        username: data.username,
        role: data.role,
        action: 'login_failed',
        description: 'รหัสผ่านไม่ถูกต้อง',
        table_name: 'system_users'
      });
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }

    // Update last login time
    await supabase
      .from('system_users')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', data.user_id);

    // Log successful login
    await logAuditEvent({
      user_id: data.user_id,
      username: data.username,
      role: data.role,
      action: 'login',
      description: `เข้าสู่ระบบสำเร็จ - ${data.role}`,
      table_name: 'system_users'
    });

    // Return complete user data for session storage (excluding password_hash)
    const userData = {
      user_id: data.user_id,
      username: data.username,
      role: data.role,
      hospital_id: data.hospital_id,
      created_at: data.created_at,
      first_name: data.F_Name || null,
      last_name: data.L_Name || null,
      F_Name: data.F_Name || null,
      L_Name: data.L_Name || null,
      signature_url: data.Signature_path || null,
      doctor_name: (data.F_Name && data.L_Name) 
        ? `${data.F_Name} ${data.L_Name}`.trim() 
        : (data.F_Name || data.L_Name || data.username)
    };

    return { 
      success: true, 
      role: data.role,
      data: userData
    };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, message: 'เกิดข้อผิดพลาดระหว่างตรวจสอบ' };
  }
}

module.exports = { handleLogin };