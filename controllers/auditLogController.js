// controllers/auditLogController.js
const supabase = require('../supabase');

/**
 * 📝 Log an audit event to the database
 * @param {Object} params - Audit log parameters
 * @param {number} params.user_id - User ID (optional)
 * @param {string} params.username - Username performing the action
 * @param {string} params.role - User role (optional)
 * @param {string} params.action - Action type: 'create', 'update', 'delete', 'login', 'logout', etc.
 * @param {string} params.table_name - Database table affected (optional)
 * @param {string} params.record_id - ID of affected record (optional)
 * @param {Object} params.old_data - Previous data snapshot (optional)
 * @param {Object} params.new_data - New data snapshot (optional)
 * @param {string} params.description - Human-readable description (optional)
 * @param {string} params.ip_address - User IP address (optional)
 * @param {string} params.user_agent - User agent string (optional)
 * @returns {Promise<Object>} Result object with success status
 */
async function logAuditEvent({
  user_id = null,
  username,
  role = null,
  action,
  table_name = null,
  record_id = null,
  old_data = null,
  new_data = null,
  description = null,
  ip_address = null,
  user_agent = null
}) {
  try {
    if (!username || !action) {
      console.error('❌ Audit log requires username and action');
      return { success: false, message: 'Missing required fields' };
    }

    const auditEntry = {
      user_id,
      username,
      role,
      action,
      table_name,
      record_id: record_id ? String(record_id) : null,
      old_data,
      new_data,
      description,
      ip_address,
      user_agent,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('audit_log')
      .insert([auditEntry])
      .select();

    if (error) {
      console.error('❌ Audit Log Insert Error:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, data: data?.[0] };
  } catch (err) {
    console.error('❌ Audit Log Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 📋 Fetch audit logs with optional filters
 * @param {Object} filters - Filter criteria
 * @param {string} filters.username - Filter by username
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.table_name - Filter by table name
 * @param {string} filters.search - Search term for description/record_id
 * @param {string} filters.startDate - Filter by start date (ISO string)
 * @param {string} filters.endDate - Filter by end date (ISO string)
 * @param {number} filters.limit - Max records to return (default: 100)
 * @param {number} filters.offset - Pagination offset (default: 0)
 * @returns {Promise<Array>} Array of audit log entries
 */
async function fetchAuditLogs({
  username = null,
  action = null,
  table_name = null,
  search = null,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0
} = {}) {
  try {
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (username && username !== 'all') {
      query = query.eq('username', username);
    }

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (table_name && table_name !== 'all') {
      query = query.eq('table_name', table_name);
    }

    // Time range filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lt('created_at', endDate);
    }

    // Search in description and record_id
    if (search) {
      query = query.or(`description.ilike.%${search}%,record_id.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('❌ Fetch Audit Logs Error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('❌ Fetch Audit Logs Error:', err);
    return [];
  }
}

/**
 * 👥 Get unique usernames from audit logs (for filter dropdown)
 * @returns {Promise<Array<string>>} Array of unique usernames
 */
async function getUniqueUsers() {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('username')
      .order('username', { ascending: true });

    if (error) {
      console.error('❌ Fetch Users Error:', error.message);
      return [];
    }

    // Extract unique usernames
    const uniqueUsers = [...new Set((data || []).map(item => item.username))];
    console.log('✅ Unique users:', uniqueUsers.length);
    return uniqueUsers;
  } catch (err) {
    console.error('❌ Get Unique Users Error:', err);
    return [];
  }
}

/**
 * 🔍 Get detailed information for a specific audit log entry
 * @param {number} logId - Audit log ID
 * @returns {Promise<Object|null>} Audit log entry with full details
 */
async function getAuditLogDetail(logId) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('id', logId)
      .single();

    if (error) {
      console.error('❌ Fetch Audit Detail Error:', error.message);
      return null;
    }

    console.log('✅ Fetched audit detail:', logId);
    return data;
  } catch (err) {
    console.error('❌ Get Audit Detail Error:', err);
    return null;
  }
}

/**
 * 📊 Get audit log statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getAuditStats() {
  try {
    // Total count
    const { count: totalCount, error: countError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count Error:', countError.message);
    }

    // Count by action
    const { data: actionData, error: actionError } = await supabase
      .from('audit_log')
      .select('action');

    const actionCounts = {};
    if (!actionError && actionData) {
      actionData.forEach(item => {
        actionCounts[item.action] = (actionCounts[item.action] || 0) + 1;
      });
    }

    // Recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: recentError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    return {
      total: totalCount || 0,
      byAction: actionCounts,
      last24Hours: recentCount || 0
    };
  } catch (err) {
    console.error('❌ Get Audit Stats Error:', err);
    return { total: 0, byAction: {}, last24Hours: 0 };
  }
}

module.exports = {
  logAuditEvent,
  fetchAuditLogs,
  getUniqueUsers,
  getAuditLogDetail,
  getAuditStats
};
