/**
 * validateFlightActivity.js
 * 
 * Data edit function for Flight (A) activities.
 * Validates and transforms entered data before saving.
 * 
 * @param {Object} activityData - The activity data entered by CSR
 * @param {Object} context - Helper functions and database access
 * @returns {Object} { success: true, data: activityData } or { success: false, error: 'E005', message: '...' }
 */

export default async function validateFlightActivity(activityData, context) {
  const { ORIGIN, DESTINATION } = activityData;
  
  // Check if origin and destination are the same
  if (ORIGIN && DESTINATION && ORIGIN === DESTINATION) {
    return {
      success: false,
      error: 'E005'
    };
  }
  
  // All validations passed - return data (potentially transformed)
  return {
    success: true,
    data: activityData
  };
}
