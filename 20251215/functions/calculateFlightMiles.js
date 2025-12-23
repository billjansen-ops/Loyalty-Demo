/**
 * calculateFlightMiles.js
 * 
 * Points calculation function for Flight (A) activities.
 * Calculates miles based on origin/destination using haversine formula.
 * 
 * Uses LRU (Least Recently Used) cache with max 1,000 entries.
 * Once a route distance is calculated, it's stored and reused.
 * When cache is full, least recently accessed routes are evicted.
 * Cache rebuilds on server restart.
 * 
 * @param {Object} activityData - The activity data entered by CSR
 * @param {Object} context - Helper functions and database access
 * @returns {Object} { success: true, points: number } or { success: false, error: '...', message: '...' }
 */

// LRU Cache configuration
const MAX_CACHE_SIZE = 1000;

// Route cache - persists for lifetime of server process
const routeCache = new Map();

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;
let cacheEvictions = 0;

// LRU helper: get from cache and move to "most recent" position
function cacheGet(key) {
  if (!routeCache.has(key)) {
    return undefined;
  }
  // Move to end (most recently used) by deleting and re-adding
  const value = routeCache.get(key);
  routeCache.delete(key);
  routeCache.set(key, value);
  return value;
}

// LRU helper: set in cache with eviction if needed
function cacheSet(key, value) {
  // If key exists, delete first (so re-add puts it at end)
  if (routeCache.has(key)) {
    routeCache.delete(key);
  }
  // Evict oldest if at capacity
  else if (routeCache.size >= MAX_CACHE_SIZE) {
    // Map iterates in insertion order - first key is oldest
    const oldestKey = routeCache.keys().next().value;
    routeCache.delete(oldestKey);
    cacheEvictions++;
  }
  routeCache.set(key, value);
}

// Haversine formula - returns distance in miles
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const toRad = d => d * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.round(R * c);
}

export default async function calculateFlightMiles(activityData, context) {
  const { origin, destination } = activityData;
  const { db } = context;
  
  if (!origin || !destination) {
    return {
      success: false,
      error: 'MISSING_ROUTE',
      message: 'Origin and destination are required to calculate miles'
    };
  }
  
  // Create cache key - use sorted pair so MSP-LGA = LGA-MSP (same distance)
  const pair = [origin, destination].sort();
  const cacheKey = `${pair[0]}-${pair[1]}`;
  
  // Check cache first
  const cachedMiles = cacheGet(cacheKey);
  if (cachedMiles !== undefined) {
    cacheHits++;
    return {
      success: true,
      points: cachedMiles,
      cached: true
    };
  }
  
  cacheMisses++;
  
  // Look up coordinates from database
  try {
    const result = await db.query(
      'SELECT code, lat, long FROM airports WHERE code IN ($1, $2)',
      [origin, destination]
    );
    
    if (result.rows.length < 2) {
      const found = result.rows.map(r => r.code);
      const missing = [origin, destination].filter(c => !found.includes(c));
      return { success: false, error: 'AIRPORT_NOT_FOUND', message: `Airport not found: ${missing.join(', ')}` };
    }
    
    const originAirport = result.rows.find(r => r.code === origin);
    const destAirport = result.rows.find(r => r.code === destination);
    
    if (!originAirport.lat || !originAirport.long || !destAirport.lat || !destAirport.long) {
      return { success: false, error: 'MISSING_COORDINATES', message: 'Airport coordinates not available' };
    }
    
    // Calculate distance using haversine
    const miles = haversine(
      parseFloat(originAirport.lat),
      parseFloat(originAirport.long),
      parseFloat(destAirport.lat),
      parseFloat(destAirport.long)
    );
    
    // Store in cache (LRU eviction if needed)
    cacheSet(cacheKey, miles);
    
    return {
      success: true,
      points: miles,
      cached: false
    };
    
  } catch (err) {
    console.error('Error calculating miles:', err);
    return { success: false, error: 'CALC_ERROR', message: err.message };
  }
}

// Export cache stats helper for diagnostics
export function getCacheStats() {
  return {
    size: routeCache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    evictions: cacheEvictions,
    hitRate: cacheHits + cacheMisses > 0 
      ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) + '%' 
      : 'N/A'
  };
}

// Export cache clear helper for testing
export function clearCache() {
  routeCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
  cacheEvictions = 0;
}
