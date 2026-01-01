/* ============================================
   📋 TEST REQUEST MANAGEMENT MODULE
   ============================================
   Centralized functions for managing test requests
   across all pages and roles
   ============================================ */

/* ============================================
   📥 FETCH OPERATIONS
   ============================================ */

/**
 * Fetch all test requests
 * @returns {Promise<Array>} Array of test requests
 */
async function getAllTestRequests() {
  try {
    console.log('📋 Fetching all test requests...');
    const requests = await window.electronAPI.getTestRequests();
    console.log('✅ Loaded test requests:', requests.length);
    return requests || [];
  } catch (error) {
    console.error('❌ Error fetching test requests:', error);
    return [];
  }
}

/**
 * Search test requests by term
 * @param {string} searchTerm - Search term (request_id or patient info)
 * @returns {Promise<Array>} Filtered test requests
 */
async function searchTestRequests(searchTerm) {
  try {
    console.log('🔍 Searching test requests:', searchTerm);
    const requests = await window.electronAPI.searchTestRequests(searchTerm);
    console.log('✅ Found test requests:', requests.length);
    return requests || [];
  } catch (error) {
    console.error('❌ Error searching test requests:', error);
    return [];
  }
}

/**
 * Get test request by ID
 * @param {number} requestId - Test request ID
 * @returns {Promise<Object|null>} Test request data
 */
async function getTestRequestById(requestId) {
  try {
    console.log('📋 Fetching test request:', requestId);
    const request = await window.electronAPI.getTestRequestById(requestId);
    if (request) {
      console.log('✅ Test request loaded:', request);
    } else {
      console.warn('⚠️ Test request not found:', requestId);
    }
    return request;
  } catch (error) {
    console.error('❌ Error fetching test request:', error);
    return null;
  }
}

/**
 * Get test request statistics
 * @param {string} timeFilter - 'today', 'week', or 'month'
 * @returns {Promise<Object>} Statistics object
 */
async function getTestRequestStats(timeFilter = 'today') {
  try {
    console.log('📊 Fetching test request stats:', timeFilter);
    const stats = await window.electronAPI.getTestRequestStats(timeFilter);
    console.log('✅ Stats loaded:', stats);
    return stats || { total: 0, done: 0, inProgress: 0, error: 0 };
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    return { total: 0, done: 0, inProgress: 0, error: 0 };
  }
}

/* ============================================
   ✏️ CREATE/UPDATE OPERATIONS
   ============================================ */

/**
 * Create a new test request
 * @param {Object} testRequestData - Test request data
 * @param {string} testRequestData.patient_id - Patient ID
 * @param {string} testRequestData.test_target - DNA type
 * @param {string} testRequestData.Specimen - Specimen type
 * @param {string} testRequestData.request_date - Request date (YYYY-MM-DD)
 * @param {string} testRequestData.status - Status
 * @param {number} testRequestData.users_id - User ID
 * @param {string} testRequestData.Doc_Name - Document name/genotype info
 * @returns {Promise<Object|null>} Created test request
 */
async function createTestRequest(testRequestData) {
  try {
    console.log('➕ Creating test request:', testRequestData);
    
    // Validate required fields
    if (!testRequestData.patient_id) {
      throw new Error('Patient ID is required');
    }
    if (!testRequestData.test_target) {
      throw new Error('Test target (DNA type) is required');
    }
    if (!testRequestData.Specimen) {
      throw new Error('Specimen type is required');
    }
    
    // Set defaults if not provided
    const requestData = {
      patient_id: testRequestData.patient_id,
      test_target: testRequestData.test_target,
      Specimen: testRequestData.Specimen,
      request_date: testRequestData.request_date || new Date().toISOString().split('T')[0],
      status: testRequestData.status || 'need 2 confirmation',
      users_id: testRequestData.users_id || null,
      Doc_Name: testRequestData.Doc_Name || null
    };
    
    console.log('📤 Sending to IPC:', requestData);
    const response = await window.electronAPI.addTestRequest(requestData);
    console.log('📥 Response from IPC:', response);
    
    if (response && response.success) {
      console.log('✅ Test request created:', response.data);
      return response.data;
    } else {
      throw new Error(response?.message || 'Failed to create test request');
    }
  } catch (error) {
    console.error('❌ Error creating test request:', error);
    throw error;
  }
}

/**
 * Update an existing test request
 * @param {number} requestId - Test request ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object|null>} Updated test request
 */
async function updateTestRequest(requestId, updateData) {
  try {
    console.log('✏️ Updating test request:', requestId, updateData);
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    const response = await window.electronAPI.updateTestRequest(requestId, updateData);
    console.log('📥 Update response:', response);
    
    if (response && response.success) {
      console.log('✅ Test request updated:', response.data);
      return response.data;
    } else {
      throw new Error(response?.message || 'Failed to update test request');
    }
  } catch (error) {
    console.error('❌ Error updating test request:', error);
    throw error;
  }
}

/**
 * Update test request status
 * @param {number} requestId - Test request ID
 * @param {string} newStatus - New status value
 * @returns {Promise<Object|null>} Updated test request
 */
async function updateTestRequestStatus(requestId, newStatus) {
  try {
    console.log('🔄 Updating test request status:', requestId, newStatus);
    return await updateTestRequest(requestId, { status: newStatus });
  } catch (error) {
    console.error('❌ Error updating status:', error);
    throw error;
  }
}

/* ============================================
   🗑️ DELETE OPERATIONS
   ============================================ */

/**
 * Delete a test request
 * @param {number} requestId - Test request ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteTestRequest(requestId) {
  try {
    console.log('🗑️ Deleting test request:', requestId);
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    const result = await window.electronAPI.deleteTestRequest(requestId);
    
    if (result) {
      console.log('✅ Test request deleted:', requestId);
      return true;
    } else {
      throw new Error('Failed to delete test request');
    }
  } catch (error) {
    console.error('❌ Error deleting test request:', error);
    throw error;
  }
}

/* ============================================
   📊 UTILITY FUNCTIONS
   ============================================ */

/**
 * Get test requests by status
 * @param {string} status - Status to filter by
 * @returns {Promise<Array>} Filtered test requests
 */
async function getTestRequestsByStatus(status) {
  try {
    const allRequests = await getAllTestRequests();
    return allRequests.filter(req => req.status === status);
  } catch (error) {
    console.error('❌ Error filtering by status:', error);
    return [];
  }
}

/**
 * Get test requests by patient ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<Array>} Patient's test requests
 */
async function getTestRequestsByPatient(patientId) {
  try {
    const allRequests = await getAllTestRequests();
    return allRequests.filter(req => req.patient_id === patientId);
  } catch (error) {
    console.error('❌ Error filtering by patient:', error);
    return [];
  }
}

/**
 * Get test requests by DNA type
 * @param {string} dnaType - DNA type (e.g., CYP2D6)
 * @returns {Promise<Array>} Filtered test requests
 */
async function getTestRequestsByDNAType(dnaType) {
  try {
    const allRequests = await getAllTestRequests();
    return allRequests.filter(req => req.test_target === dnaType);
  } catch (error) {
    console.error('❌ Error filtering by DNA type:', error);
    return [];
  }
}

/**
 * Format test request for display
 * @param {Object} request - Test request object
 * @returns {Object} Formatted request
 */
function formatTestRequest(request) {
  if (!request) return null;
  
  return {
    ...request,
    displayDate: request.request_date ? new Date(request.request_date).toLocaleDateString('th-TH') : '-',
    displayStatus: formatStatus(request.status),
    patientName: request.patient ? `${request.patient.first_name} ${request.patient.last_name}` : '-',
    hospitalName: request.patient?.hospital_id || '-'
  };
}

/**
 * Format status for display
 * @param {string} status - Status string
 * @returns {string} Formatted status
 */
function formatStatus(status) {
  const statusMap = {
    'done': 'เสร็จสิ้น',
    'need 1 confirmation': 'รอยืนยันครั้งที่ 1',
    'need 2 confirmation': 'รอยืนยันครั้งที่ 2',
    'reject': 'ปฏิเสธ',
    'in_progress': 'กำลังดำเนินการ',
    'pending': 'รอดำเนินการ'
  };
  
  return statusMap[status] || status;
}

/**
 * Get status color class
 * @param {string} status - Status string
 * @returns {string} CSS class name
 */
function getStatusColorClass(status) {
  const colorMap = {
    'done': 'status-success',
    'need 1 confirmation': 'status-warning',
    'need 2 confirmation': 'status-warning',
    'reject': 'status-danger',
    'in_progress': 'status-info',
    'pending': 'status-secondary'
  };
  
  return colorMap[status] || 'status-secondary';
}

/* ============================================
   💾 SESSION STORAGE HELPERS
   ============================================ */

/**
 * Save test request data to session storage
 * @param {Object} data - Data to save
 */
function saveTestRequestToSession(data) {
  try {
    Object.keys(data).forEach(key => {
      sessionStorage.setItem(key, data[key]);
    });
    console.log('💾 Test request data saved to session');
  } catch (error) {
    console.error('❌ Error saving to session:', error);
  }
}

/**
 * Load test request data from session storage
 * @returns {Object} Loaded data
 */
function loadTestRequestFromSession() {
  try {
    return {
      selectedPatientId: sessionStorage.getItem('selectedPatientId'),
      selectedDnaType: sessionStorage.getItem('selectedDnaType'),
      selectedSpecimen: sessionStorage.getItem('selectedSpecimen'),
      genotype: sessionStorage.getItem('genotype'),
      phenotype: sessionStorage.getItem('phenotype'),
      patientName: sessionStorage.getItem('patientName')
    };
  } catch (error) {
    console.error('❌ Error loading from session:', error);
    return {};
  }
}

/**
 * Clear test request data from session storage
 */
function clearTestRequestSession() {
  try {
    const keysToRemove = [
      'selectedPatientId',
      'selectedDnaType',
      'selectedSpecimen',
      'genotype',
      'phenotype',
      'patientName'
    ];
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log('🗑️ Test request session data cleared');
  } catch (error) {
    console.error('❌ Error clearing session:', error);
  }
}

/* ============================================
   🎯 EXPORTS
   ============================================ */

// Make functions available globally
if (typeof window !== 'undefined') {
  window.testRequestModule = {
    // Fetch operations
    getAllTestRequests,
    searchTestRequests,
    getTestRequestById,
    getTestRequestStats,
    
    // Create/Update operations
    createTestRequest,
    updateTestRequest,
    updateTestRequestStatus,
    
    // Delete operations
    deleteTestRequest,
    
    // Utility functions
    getTestRequestsByStatus,
    getTestRequestsByPatient,
    getTestRequestsByDNAType,
    formatTestRequest,
    formatStatus,
    getStatusColorClass,
    
    // Session storage helpers
    saveTestRequestToSession,
    loadTestRequestFromSession,
    clearTestRequestSession
  };
  
  console.log('✅ Test Request Module loaded');
}
