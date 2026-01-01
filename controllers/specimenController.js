const supabase = require('../supabase');

/* ============================================
   📦 SPECIMEN CONTROLLER
   ============================================ */

/**
 * Get all specimens from database
 */
async function getSpecimens() {
  try {
    const { data, error } = await supabase
      .from('Specimen')
      .select('Specimen_Id, Specimen_Name, SLA_time, category')
      .order('Specimen_Id', { ascending: true });

    if (error) {
      console.error('❌ Error fetching specimens:', error.message);
      return { success: false, message: error.message };
    }
    
    // Map to lowercase for frontend consistency
    const mappedData = data?.map(item => ({
      specimen_id: item.Specimen_Id,
      specimen_name: item.Specimen_Name,
      sla_time: item.SLA_time,
      category: item.category
    })) || [];
    
    return { success: true, data: mappedData };
    
  } catch (error) {
    console.error('❌ Exception in getSpecimens:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' };
  }
}

/**
 * Add a new specimen
 */
async function addSpecimen(specimenData) {
  try {
    const { data, error } = await supabase
      .from('Specimen')
      .insert([{
        Specimen_Name: specimenData.specimen_name,
        SLA_time: specimenData.sla_time
      }])
      .select();

    if (error) {
      console.error('❌ Error adding specimen:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'เพิ่มข้อมูลสำเร็จ!', data };
    
  } catch (error) {
    console.error('❌ Exception in addSpecimen:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล' };
  }
}

/**
 * Update an existing specimen
 */
async function updateSpecimen(specimenId, specimenData) {
  try {
    const { data, error } = await supabase
      .from('Specimen')
      .update({
        Specimen_Name: specimenData.specimen_name,
        SLA_time: specimenData.sla_time
      })
      .eq('Specimen_Id', specimenId)
      .select();

    if (error) {
      console.error('❌ Error updating specimen:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ!', data };
    
  } catch (error) {
    console.error('❌ Exception in updateSpecimen:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' };
  }
}

/**
 * Delete a specimen
 */
async function deleteSpecimen(specimenId) {
  try {
    const { data, error } = await supabase
      .from('Specimen')
      .delete()
      .eq('Specimen_Id', specimenId)
      .select();

    if (error) {
      console.error('❌ Error deleting specimen:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'ลบข้อมูลสำเร็จ!', data };
    
  } catch (error) {
    console.error('❌ Exception in deleteSpecimen:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' };
  }
}

module.exports = {
  getSpecimens,
  addSpecimen,
  updateSpecimen,
  deleteSpecimen
};
