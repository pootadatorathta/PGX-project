const supabase = require('../supabase');

// ดึงข้อมูล test request ทั้งหมดพร้อมข้อมูลผู้ป่วย
async function fetchAllTestRequests() {
  const { data, error } = await supabase
    .from('test_request')
    .select(`
      *,
      patient:patient_id (
        patient_id,
        first_name,
        last_name,
        hospital_id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Fetch Test Requests Error:', error.message);
    return [];
  }
  
  return data || [];
}

// ค้นหา test request ด้วย patient_id หรือชื่อผู้ป่วย
async function searchTestRequests(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return await fetchAllTestRequests();
  }

  const cleanSearchTerm = searchTerm.trim().toLowerCase();
  if (!cleanSearchTerm) {
    return await fetchAllTestRequests();
  }

  // Fetch all test requests with patient data
  const { data, error } = await supabase
    .from('test_request')
    .select(`
      *,
      patient:patient_id (
        patient_id,
        first_name,
        last_name,
        hospital_id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Search Test Requests Error:', error.message);
    return [];
  }

  // Filter using JavaScript for LIKE functionality - search only by patient_id and name
  const filtered = (data || []).filter(req => {
    const patientId = (req.patient_id?.toString() || '').toLowerCase();
    const firstName = (req.patient?.first_name || '').toLowerCase();
    const lastName = (req.patient?.last_name || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    
    return patientId.includes(cleanSearchTerm) ||
           firstName.includes(cleanSearchTerm) ||
           lastName.includes(cleanSearchTerm) ||
           fullName.includes(cleanSearchTerm);
  });

  return filtered;
}

// ดึงข้อมูล test request รายบุคคล
async function getTestRequestById(requestId) {
  try {
    // First, get the test request
    const { data: requestData, error: requestError } = await supabase
      .from('test_request')
      .select(`
        *,
        patient:patient_id (
          patient_id,
          first_name,
          last_name,
          hospital_id,
          age,
          gender,
          phone
        )
      `)
      .eq('request_id', requestId)
      .single();

    if (requestError) {
      console.error('❌ Get Test Request Error:', requestError.message);
      return null;
    }

    // Then, get the report separately using request_id
    const { data: reportData, error: reportError } = await supabase
      .from('report')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle(); // Use maybeSingle to handle cases where report doesn't exist

    if (reportError && reportError.code !== 'PGRST116') {
      console.error('❌ Get Report Error:', reportError.message);
    }

    // Combine the data
    return {
      ...requestData,
      report: reportData
    };
  } catch (error) {
    console.error('❌ Exception in getTestRequestById:', error);
    return null;
  }
}

// เพิ่ม test request ใหม่
async function addTestRequest(requestData) {
  try {
    // Remove request_id if it exists (let database auto-increment)
    const { request_id, created_at, ...cleanData } = requestData;
    
    console.log('📝 Inserting test request:', cleanData);
    
    const { data, error } = await supabase
      .from('test_request')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      console.error('❌ Add Test Request Error:', error.message);
      console.error('❌ Error details:', error);
      return null;
    }
    
    console.log('✅ Test request inserted:', data);
    return data;
  } catch (err) {
    console.error('❌ Exception in addTestRequest:', err);
    return null;
  }
}

// อัปเดต test request
async function updateTestRequest(requestId, updateData) {
  const { data, error } = await supabase
    .from('test_request')
    .update(updateData)
    .eq('request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Update Test Request Error:', error.message);
    return null;
  }
  return data;
}

// ลบ test request
async function deleteTestRequest(requestId) {
  const { error } = await supabase
    .from('test_request')
    .delete()
    .eq('request_id', requestId);

  if (error) {
    console.error('❌ Delete Test Request Error:', error.message);
    return false;
  }
  return true;
}

// ดึงสถิติตามสถานะ with time filter (today/week/month/all)
async function getTestRequestStats(timeFilter = 'today') {
  // Build query
  let query = supabase
    .from('test_request')
    .select('status, created_at');
  
  // Add time filter only if not 'all'
  if (timeFilter !== 'all') {
    let startDate;
    const now = new Date();
    
    switch(timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Get Stats Error:', error.message);
    return { all: 0, need2Confirmation: 0, need1Confirmation: 0, done: 0, reject: 0 };
  }

  const all = data?.length || 0;
  
  const pending = data?.filter(r => {
    const status = r.status?.toLowerCase().trim();
    return status === 'pending';
  })?.length || 0;
  
  const need2Confirmation = data?.filter(r => {
    const status = r.status?.toLowerCase().trim();
    return status === 'need_2_confirmation' || status === 'need 2 confirmation';
  })?.length || 0;
  
  const need1Confirmation = data?.filter(r => {
    const status = r.status?.toLowerCase().trim();
    return status === 'need_1_confirmation' || status === 'need 1 confirmation';
  })?.length || 0;
  
  const done = data?.filter(r => {
    const status = r.status?.toLowerCase().trim();
    return status === 'done';
  })?.length || 0;
  
  const reject = data?.filter(r => {
    const status = r.status?.toLowerCase().trim();
    return status === 'reject';
  })?.length || 0;

  return { 
    all, 
    pending,
    need2Confirmation, 
    need1Confirmation, 
    done,
    reject,
    // Aliases for compatibility
    need2: need2Confirmation,
    need1: need1Confirmation,
    timeFilter
  };
}

// ดึงข้อมูล SLA time ของแต่ละ specimen
async function getSpecimenSLA() {
  try {
    // Try to query the Specimen table
    const { data, error } = await supabase
      .from('Specimen')
      .select('*')
      .limit(10);

    // If table doesn't exist or has errors, use default values (in hours)
    if (error) {
      console.log('⚠️ Specimen table not found, using default SLA values');
      return {
        'blood': 120,      // 5 days
        'hair': 168,       // 7 days  
        'cheek septum': 72,  // 3 days
        'saliva': 48       // 2 days
      };
    }

    // If we got data, try to map it
    const slaMap = {};
    (data || []).forEach(spec => {
      const name = (spec.Specimen_Name || spec.specimen_name)?.toLowerCase().trim();
      const slaDays = parseFloat(spec.SLA_time || spec.sla_time) || 3;
      const slaHours = slaDays * 24; // Convert days to hours
      const id = spec.Specimen_ID || spec.specimen_id || spec.id;
      
      if (name) {
        slaMap[name] = slaHours;
      }
      if (id) {
        slaMap[id] = slaHours;
      }
    });
    
    //console.log('✅ SLA Map loaded:', slaMap);
    
    return Object.keys(slaMap).length > 0 ? slaMap : {
      'blood': 120,      // 5 days
      'hair': 168,       // 7 days
      'cheek septum': 72,  // 3 days
      'saliva': 48       // 2 days
    };
  } catch (err) {
    console.log('⚠️ Error fetching specimen SLA, using defaults');
    return {
      'blood': 120,      // 5 days
      'hair': 168,       // 7 days
      'cheek septum': 72,  // 3 days
      'saliva': 48       // 2 days
    };
  }
}

// ยืนยัน test request (confirmation)
async function confirmTestRequest(requestId, userId) {
  try {
    // Get user's full name and signature from system_users table
    const { data: userData, error: userError } = await supabase
      .from('system_users')
      .select('F_Name, L_Name, Signature_path')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError.message);
    }

    // Create full name (FirstName LastName)
    const confirmedByName = userData 
      ? `${userData.F_Name || ''} ${userData.L_Name || ''}`.trim() 
      : userId.toString();
    
    // Get signature path from user data
    const userSignaturePath = userData?.Signature_path || null;
    console.log('👤 Confirming user signature path:', userSignaturePath);

    // Get current test request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('test_request')
      .select(`
        *,
        patient:patient_id (
          patient_id,
          first_name,
          last_name,
          hospital_id,
          age,
          gender
        )
      `)
      .eq('request_id', requestId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching request:', fetchError.message);
      return { success: false, message: 'ไม่พบข้อมูลคำขอ' };
    }

    // Check if request is pending (not yet ready for confirmation)
    if (currentRequest.status === 'pending') {
      return { success: false, message: 'กรุณากรอกข้อมูล Alleles ก่อนยืนยัน' };
    }

    // Check if this user already confirmed (by comparing full name)
    if (currentRequest.confirmed_by_1 === confirmedByName || currentRequest.confirmed_by_2 === confirmedByName) {
      return { success: false, message: 'คุณได้ยืนยันแล้ว ไม่สามารถยืนยันซ้ำได้' };
    }

    // Determine which confirmation slot to use
    let updateData = {};
    let newStatus = '';

    if (!currentRequest.confirmed_by_1) {
      // First confirmation: need_2_confirmation → need_1_confirmation
      updateData = {
        confirmed_by_1: confirmedByName, // Store doctor name (full name)
        confirmed_at_1: new Date().toISOString(),
        status: 'need_1_confirmation'
      };
      newStatus = 'need_1_confirmation';
    } else if (!currentRequest.confirmed_by_2) {
      // Second confirmation: need_1_confirmation → done
      updateData = {
        confirmed_by_2: confirmedByName, // Store doctor name (full name)
        confirmed_at_2: new Date().toISOString(),
        status: 'done'
      };
      newStatus = 'done';
    } else {
      return { success: false, message: 'เอกสารนี้ได้รับการยืนยันครบแล้ว' };
    }

    // Update the request
    const { error: updateError } = await supabase
      .from('test_request')
      .update(updateData)
      .eq('request_id', requestId);

    if (updateError) {
      console.error('❌ Error updating request:', updateError.message);
      return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก' };
    }

    console.log('✅ Confirmed by user:', userId, '→ New status:', newStatus);

    // Regenerate PDF with signatures after confirmation
    try {
      console.log('🔄 Attempting to regenerate PDF with signatures...');
      const { data: reportData, error: reportError } = await supabase
        .from('report')
        .select('*')
        .eq('request_id', requestId)
        .maybeSingle();

      if (reportError) {
        console.error('❌ Error fetching report:', reportError);
      }

      if (reportData) {
        console.log('📄 Report found, editing PDF to add signatures...');
        // Import PDF editing function
        const { addSignaturesToPDF, uploadPDFToStorage } = require('./pgxReportController');
        
        // Determine signature URLs based on confirmation status
        let signature1_url = null;
        let signature2_url = null;
        
        // Convert user's signature path to URL if it exists
        let currentUserSignatureUrl = null;
        if (userSignaturePath) {
          if (userSignaturePath.startsWith('http://') || userSignaturePath.startsWith('https://')) {
            currentUserSignatureUrl = userSignaturePath;
          } else {
            const { data: urlData } = supabase.storage
              .from('Image_Bucket')
              .getPublicUrl(userSignaturePath);
            currentUserSignatureUrl = urlData.publicUrl;
          }
          console.log('✅ Current user signature URL:', currentUserSignatureUrl);
        }
        
        // Assign signature to correct position based on which confirmation this is
        if (!currentRequest.confirmed_by_1) {
          // First confirmation - signature goes to LEFT box
          signature1_url = currentUserSignatureUrl;
          signature2_url = null;
          console.log('📝 First confirmation - adding signature to LEFT box');
        } else if (!currentRequest.confirmed_by_2) {
          // Second confirmation - keep first signature in LEFT, add new to RIGHT
          // Fetch first confirmer's signature for LEFT box
          const { data: user1 } = await supabase
            .from('system_users')
            .select('Signature_path')
            .eq('user_id', currentRequest.confirmed_by_1)
            .single();
          
          if (user1?.Signature_path) {
            if (user1.Signature_path.startsWith('http://') || user1.Signature_path.startsWith('https://')) {
              signature1_url = user1.Signature_path;
            } else {
              const { data: urlData } = supabase.storage
                .from('Image_Bucket')
                .getPublicUrl(user1.Signature_path);
              signature1_url = urlData.publicUrl;
            }
          }
          
          // Current user's signature goes to RIGHT box
          signature2_url = currentUserSignatureUrl;
          console.log('📝 Second confirmation - LEFT:', signature1_url, 'RIGHT:', signature2_url);
        }
        
        console.log('✍️ Final signature URLs - Left:', signature1_url, 'Right:', signature2_url);

        // Get existing PDF path
        const existingPdfPath = reportData.pdf_path;
        console.log('📄 Existing PDF path:', existingPdfPath);
        
        // Edit PDF to add signatures
        const modifiedPdfBuffer = await addSignaturesToPDF(existingPdfPath, signature1_url, signature2_url);
        
        // Generate new filename with timestamp to avoid cache issues
        const timestamp = Date.now();
        const originalFileName = existingPdfPath.split('/').pop().replace('.pdf', '');
        const uniqueFileName = `${originalFileName}_${timestamp}.pdf`;
        
        console.log('✅ PDF edited, uploading to storage as:', uniqueFileName);
        
        // Upload modified PDF to storage
        const publicUrl = await uploadPDFToStorage(modifiedPdfBuffer, uniqueFileName);
        
        if (publicUrl) {
          // Update report with new PDF path
          await supabase
            .from('report')
            .update({ pdf_path: publicUrl })
            .eq('report_id', reportData.report_id);
          
          console.log('✅ PDF updated with signatures:', publicUrl);
        }
      } else {
        console.log('⚠️ No report found for request_id:', requestId);
      }
    } catch (pdfError) {
      console.error('⚠️ Error regenerating PDF:', pdfError);
      console.error('PDF Error stack:', pdfError.stack);
      // Don't fail the confirmation if PDF generation fails
    }
    
    return { 
      success: true, 
      message: newStatus === 'done' ? 'ยืนยันสำเร็จ! เอกสารผ่านการตรวจสอบครบถ้วน' : 'ยืนยันสำเร็จ! รอการยืนยันจากเจ้าหน้าที่อีก 1 คน',
      newStatus 
    };

  } catch (error) {
    console.error('❌ Exception in confirmTestRequest:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด' };
  }
}

// ปฏิเสธ test request (rejection)
async function rejectTestRequest(requestId, userId, reason) {
  try {
    // Get user's full name from system_users table
    const { data: userData, error: userError } = await supabase
      .from('system_users')
      .select('F_Name, L_Name')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError.message);
    }

    // Create full name (FirstName LastName)
    const rejectedByName = userData 
      ? `${userData.F_Name || ''} ${userData.L_Name || ''}`.trim() 
      : userId.toString();

    // Update status to reject
    const { error } = await supabase
      .from('test_request')
      .update({
        status: 'reject',
        rejected_by: rejectedByName,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('request_id', requestId);

    if (error) {
      console.error('❌ Error rejecting request:', error.message);
      return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก' };
    }

    console.log('✅ Rejected by:', rejectedByName);
    return { success: true, message: 'ปฏิเสธเอกสารสำเร็จ' };

  } catch (error) {
    console.error('❌ Exception in rejectTestRequest:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด' };
  }
}

module.exports = {
  fetchAllTestRequests,
  searchTestRequests,
  getTestRequestById,
  addTestRequest,
  updateTestRequest,
  deleteTestRequest,
  getTestRequestStats,
  getSpecimenSLA,
  confirmTestRequest,
  rejectTestRequest
};

