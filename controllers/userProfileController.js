const supabase = require('../supabase');
const { logAuditEvent } = require('./auditLogController');

/* ============================================
   📋 USER PROFILE CONTROLLER
   ============================================ */

/**
 * Get user profile by user_id
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('system_users')
      .select('user_id, username, role, hospital_id, F_Name, L_Name, Signature_path, created_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching user profile:', error.message);
      return { success: false, message: error.message };
    }

    // Map database fields to frontend-friendly names
    const profileData = {
      user_id: data.user_id,
      username: data.username,
      role: data.role,
      hospital_id: data.hospital_id,
      first_name: data.F_Name,
      last_name: data.L_Name,
      signature_url: data.Signature_path,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    return { success: true, data: profileData };
  } catch (error) {
    console.error('❌ Exception in getUserProfile:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' };
  }
}

/**
 * Update user profile (F_Name, L_Name, Signature_path)
 */
async function updateUserProfile(userId, profileData) {
  try {
    console.log('🔧 updateUserProfile called with:', { userId, profileData });
    
    // Get old data for audit log
    const { data: oldData } = await supabase
      .from('system_users')
      .select('F_Name, L_Name, Signature_path, username, role')
      .eq('user_id', userId)
      .single();

    console.log('📦 Old data from database:', oldData);

    const updateData = {
      updated_at: new Date().toISOString()
    };

    // Map frontend field names to database field names
    if (profileData.first_name !== undefined) {
      updateData.F_Name = profileData.first_name;
    }
    if (profileData.last_name !== undefined) {
      updateData.L_Name = profileData.last_name;
    }
    if (profileData.signature_url !== undefined) {
      updateData.Signature_path = profileData.signature_url;
    }

    console.log('📝 Update data to be sent:', updateData);

    const { data, error } = await supabase
      .from('system_users')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating user profile:', error.message);
      return { success: false, message: error.message };
    }

    console.log('✅ Updated data from database:', data);

    // Log audit event
    const changes = [];
    if (oldData.F_Name !== data.F_Name) changes.push('ชื่อ');
    if (oldData.L_Name !== data.L_Name) changes.push('นามสกุล');
    if (oldData.Signature_path !== data.Signature_path) changes.push('ลายเซ็น');

    if (changes.length > 0) {
      await logAuditEvent({
        user_id: userId,
        username: oldData.username,
        role: oldData.role,
        action: 'updated',
        table_name: 'system_users',
        record_id: String(userId),
        old_data: { F_Name: oldData.F_Name, L_Name: oldData.L_Name, Signature_path: oldData.Signature_path },
        new_data: { F_Name: data.F_Name, L_Name: data.L_Name, Signature_path: data.Signature_path },
        description: `แก้ไขโปรไฟล์: ${changes.join(', ')}`
      });
    }

    console.log('✅ Profile updated successfully for user:', userId);
    return { success: true, message: 'อัปเดตโปรไฟล์สำเร็จ!', data };
  } catch (error) {
    console.error('❌ Exception in updateUserProfile:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' };
  }
}

/**
 * Upload signature image to Supabase Storage
 */
async function uploadSignature(userId, fileBuffer, fileName) {
  try {
    const fileExt = fileName.split('.').pop();
    const filePath = `signatures/${userId}_${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('Image_Bucket')
      .upload(filePath, fileBuffer, {
        contentType: `image/${fileExt}`,
        upsert: false
      });

    if (error) {
      console.error('❌ Error uploading signature:', error.message);
      return { success: false, message: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('Image_Bucket')
      .getPublicUrl(filePath);

    console.log('✅ Signature uploaded:', filePath);
    return { 
      success: true, 
      message: 'อัปโหลดลายเซ็นสำเร็จ!', 
      url: urlData.publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('❌ Exception in uploadSignature:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดลายเซ็น' };
  }
}

/**
 * Delete signature from Supabase Storage
 */
async function deleteSignature(signatureUrl) {
  try {
    // Extract file path from URL
    const url = new URL(signatureUrl);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(pathParts.indexOf('Image_Bucket') + 1).join('/');

    const { error } = await supabase.storage
      .from('Image_Bucket')
      .remove([filePath]);

    if (error) {
      console.error('❌ Error deleting signature:', error.message);
      return { success: false, message: error.message };
    }

    console.log('✅ Signature deleted:', filePath);
    return { success: true, message: 'ลบลายเซ็นสำเร็จ!' };
  } catch (error) {
    console.error('❌ Exception in deleteSignature:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบลายเซ็น' };
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadSignature,
  deleteSignature
};
