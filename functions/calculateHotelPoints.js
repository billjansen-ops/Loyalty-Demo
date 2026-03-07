/**
 * calculateHotelPoints.js
 * 
 * Points calculation function for Hotel Stay (A) activities.
 * Calculates BASE points based on:
 *   - Eligible spend (total qualifying charges)
 *   - Brand's base earning rate (points per $1)
 * 
 * Formula: ELIGIBLE_SPEND * base_earn_rate
 * 
 * Tier bonuses are handled separately by the bonus engine.
 * 
 * @param {Object} activityData - Activity data: { BRAND, ELIGIBLE_SPEND }
 * @param {Object} context - { db, tenantId }
 * @returns {Object} { success: true, points: number } or { success: false, error: '...', message: '...' }
 */

// Cache brand earn rates - rarely changes, safe to cache
const brandEarnRateCache = new Map();

export default async function calculateHotelPoints(activityData, context) {
  const { BRAND, ELIGIBLE_SPEND } = activityData;
  const { db } = context;
  
  // Eligible spend is required
  if (!ELIGIBLE_SPEND && ELIGIBLE_SPEND !== 0) {
    return {
      success: false,
      error: 'MISSING_ELIGIBLE_SPEND',
      message: 'Eligible spend is required to calculate points'
    };
  }
  
  // Default base earn rate if no brand specified
  let baseEarnRate = 10.00;
  
  // If brand provided, look up earn rate
  if (BRAND) {
    try {
      // Check cache first
      let earnRate = brandEarnRateCache.get(BRAND);
      
      if (earnRate === undefined) {
        // Look up brand earn rate by code
        const result = await db.query(`
          SELECT base_earn_rate 
          FROM brand
          WHERE code = $1
        `, [BRAND]);
        
        if (result.rows.length > 0) {
          earnRate = parseFloat(result.rows[0].base_earn_rate);
          brandEarnRateCache.set(BRAND, earnRate);
        } else {
          // Brand not found - use default
          earnRate = 10.00;
        }
      }
      
      baseEarnRate = earnRate;
    } catch (err) {
      console.error('Error looking up brand earn rate:', err);
      // Continue with default rate
    }
  }
  
  // Calculate base points: spend (dollars) × earn rate
  const basePoints = Math.round((ELIGIBLE_SPEND || 0) * baseEarnRate);
  
  return {
    success: true,
    points: basePoints,
    details: {
      ELIGIBLE_SPEND: ELIGIBLE_SPEND,
      earn_rate: baseEarnRate
    }
  };
}

// Export cache clear helper for testing
export function clearCache() {
  brandEarnRateCache.clear();
}
