// controllers/add_patient_controller.js
const supabase = require('../supabase');
const { logAuditEvent } = require('./auditLogController');

// ดึงข้อมูลผู้ป่วยทั้งหมด
async function fetchPatients() {
  const { data, error } = await supabase
    .from('patient') // ✅ ใช้ชื่อ table เดียวกับใน DB
    .select('*')
    .order('patient_id', { ascending: true });

  if (error) {
    console.error('❌ Supabase Fetch Error:', error.message);
    return [];
  }
  //console.log('✅ Supabase Fetch Data:', data);
  return data;
}

// เพิ่มข้อมูลผู้ป่วย
async function addPatient(patientData, currentUser) {
  const { data, error } = await supabase.from('patient').insert([patientData]).select();
  if (error) {
    console.error('❌ Insert Error:', error.message);
    return data;
  }

  // Log audit event
  if (currentUser && data && data[0]) {
    await logAuditEvent({
      user_id: currentUser.user_id,
      username: currentUser.username,
      role: currentUser.role,
      action: 'create',
      table_name: 'patient',
      record_id: String(data[0].patient_id),
      new_data: { 
        patient_id: data[0].patient_id,
        first_name: data[0].first_name,
        last_name: data[0].last_name
      },
      description: `เพิ่มผู้ป่วยใหม่: ${data[0].first_name} ${data[0].last_name} (ID: ${data[0].patient_id})`
    });
  }

  return data;
}

// ค้นหาผู้ป่วย (ด้วยคำค้นบางส่วนของ patient_id, ชื่อ, หรือนามสกุล)
async function searchPatientById(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return [];
  }

  const cleanSearchTerm = searchTerm.trim();
  if (!cleanSearchTerm) {
    return [];
  }

  const { data, error } = await supabase
    .from('patient')
    .select('*')
    .or(`patient_id.ilike.%${cleanSearchTerm}%,first_name.ilike.%${cleanSearchTerm}%,last_name.ilike.%${cleanSearchTerm}%`)
    .order('patient_id', { ascending: true })
    .limit(50); // Limit results for performance

  if (error) {
    console.error('❌ Search Error:', error.message);
    return [];
  }
  
  return data || [];
}

// ดึงข้อมูลผู้ป่วยรายบุคคล
async function getPatientById(patientId) {
  const { data, error } = await supabase
    .from('patient')
    .select('*')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    console.error('❌ Get By ID Error:', error.message);
    return null;
  }
  return data;
}

// อัปเดตข้อมูลผู้ป่วย
async function updatePatient(patientId, updatedData, currentUser) {
  // Get old data first
  const oldPatient = await getPatientById(patientId);

  const { data, error } = await supabase
    .from('patient')
    .update(updatedData)
    .eq('patient_id', patientId)
    .select()
    .single();

  if (error) {
    console.error('❌ Update Error:', error.message);
    return null;
  }

  // Log audit event
  if (currentUser && oldPatient && data) {
    const changes = [];
    if (oldPatient.first_name !== data.first_name) changes.push('ชื่อ');
    if (oldPatient.last_name !== data.last_name) changes.push('นามสกุล');
    if (oldPatient.age !== data.age) changes.push('อายุ');
    if (oldPatient.gender !== data.gender) changes.push('เพศ');

    await logAuditEvent({
      user_id: currentUser.user_id,
      username: currentUser.username,
      role: currentUser.role,
      action: 'update',
      table_name: 'patient',
      record_id: String(patientId),
      old_data: {
        first_name: oldPatient.first_name,
        last_name: oldPatient.last_name,
        age: oldPatient.age
      },
      new_data: {
        first_name: data.first_name,
        last_name: data.last_name,
        age: data.age
      },
      description: `แก้ไขข้อมูลผู้ป่วย: ${data.first_name} ${data.last_name} (ID: ${patientId})${changes.length ? ' - ' + changes.join(', ') : ''}`
    });
  }

  return data;
}



// ลบข้อมูลผู้ป่วย (with cascading delete for report, test_request)
async function deletePatient(patientId, currentUser) {
  try {
    // Get patient info before deleting
    const patient = await getPatientById(patientId);

    // Step 1: Get all test_request IDs for this patient
    const { data: testRequests, error: fetchError } = await supabase
      .from('test_request')
      .select('request_id')
      .eq('patient_id', patientId);

    if (fetchError) {
      console.error('❌ Fetch Test Requests Error:', fetchError.message);
      return { success: false, message: 'ไม่สามารถดึงข้อมูลการตรวจได้' };
    }

    // Step 2: Delete all reports associated with these test_requests
    if (testRequests && testRequests.length > 0) {
      const requestIds = testRequests.map(req => req.request_id);
      
      const { error: reportError } = await supabase
        .from('report')
        .delete()
        .in('request_id', requestIds);

      if (reportError) {
        console.error('❌ Delete Report Error:', reportError.message);
        return { success: false, message: 'ไม่สามารถลบรายงานที่เกี่ยวข้องได้' };
      }
      console.log(`✅ Deleted ${requestIds.length} report(s) for patient ${patientId}`);
    }

    // Step 3: Delete all test_request records for this patient
    const { error: testRequestError } = await supabase
      .from('test_request')
      .delete()
      .eq('patient_id', patientId);

    if (testRequestError) {
      console.error('❌ Delete Test Request Error:', testRequestError.message);
      return { success: false, message: 'ไม่สามารถลบข้อมูลการตรวจที่เกี่ยวข้องได้' };
    }
    console.log(`✅ Deleted test_request(s) for patient ${patientId}`);

    // Step 4: Now delete the patient
    const { error: patientError } = await supabase
      .from('patient')
      .delete()
      .eq('patient_id', patientId);

    if (patientError) {
      console.error('❌ Delete Patient Error:', patientError.message);
      return { success: false, message: 'ไม่สามารถลบข้อมูลผู้ป่วยได้' };
    }

    // Log audit event
    if (currentUser && patient) {
      await logAuditEvent({
        user_id: currentUser.user_id,
        username: currentUser.username,
        role: currentUser.role,
        action: 'delete',
        table_name: 'patient',
        record_id: String(patientId),
        old_data: {
          first_name: patient.first_name,
          last_name: patient.last_name,
          patient_id: patient.patient_id
        },
        description: `ลบข้อมูลผู้ป่วย: ${patient.first_name} ${patient.last_name} (ID: ${patientId})`
      });
    }

    return { success: true, message: 'ลบข้อมูลผู้ป่วย รายงาน และการตรวจที่เกี่ยวข้องสำเร็จ' };
  } catch (err) {
    console.error('❌ Delete Error:', err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' };
  }
}

module.exports = { fetchPatients, addPatient, searchPatientById, getPatientById, updatePatient, deletePatient };
