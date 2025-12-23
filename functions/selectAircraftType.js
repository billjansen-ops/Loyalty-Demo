/**
 * selectAircraftType.js
 * 
 * Selects appropriate aircraft type based on route distance.
 * Called after calculateFlightMiles to determine aircraft assignment.
 * 
 * Uses hardcoded mileage bands mapping to 16 aircraft types (smallest to largest).
 * Returns the link value (1-16) to store in the aircraft_type molecule.
 * 
 * @param {Object} activityData - The activity data (must include calculated miles)
 * @param {Object} context - Helper functions and database access
 * @returns {Object} { success: true, value: number } or { success: false, error: '...', message: '...' }
 */

// Aircraft type bands - maps distance ranges to aircraft link values
// Link values 1-16 correspond to aircraft in molecule_value_embedded_list
const AIRCRAFT_BANDS = [
  { maxMiles: 200,  link: 1,  code: 'CRJ2', name: 'CRJ-200' },
  { maxMiles: 350,  link: 2,  code: 'E145', name: 'ERJ-145' },
  { maxMiles: 500,  link: 3,  code: 'E170', name: 'Embraer 170' },
  { maxMiles: 650,  link: 4,  code: 'E175', name: 'Embraer 175' },
  { maxMiles: 800,  link: 5,  code: 'CR9',  name: 'CRJ-900' },
  { maxMiles: 1000, link: 6,  code: 'A319', name: 'Airbus A319' },
  { maxMiles: 1200, link: 7,  code: 'B737', name: 'Boeing 737-700' },
  { maxMiles: 1400, link: 8,  code: 'A320', name: 'Airbus A320' },
  { maxMiles: 1600, link: 9,  code: 'B738', name: 'Boeing 737-800' },
  { maxMiles: 1800, link: 10, code: 'A321', name: 'Airbus A321' },
  { maxMiles: 2200, link: 11, code: 'B739', name: 'Boeing 737-900' },
  { maxMiles: 2800, link: 12, code: 'B752', name: 'Boeing 757-200' },
  { maxMiles: 4000, link: 13, code: 'B763', name: 'Boeing 767-300' },
  { maxMiles: 5500, link: 14, code: 'A333', name: 'Airbus A330-300' },
  { maxMiles: 7500, link: 15, code: 'B772', name: 'Boeing 777-200' },
  { maxMiles: Infinity, link: 16, code: 'A359', name: 'Airbus A350-900' }
];

export default async function selectAircraftType(activityData, context) {
  const { miles } = activityData;
  
  if (miles === undefined || miles === null) {
    return {
      success: false,
      error: 'MISSING_MILES',
      message: 'Miles must be calculated before selecting aircraft type'
    };
  }
  
  // Find appropriate aircraft for this distance
  const aircraft = AIRCRAFT_BANDS.find(band => miles <= band.maxMiles);
  
  if (!aircraft) {
    // Should never happen with Infinity in last band, but safety first
    return {
      success: false,
      error: 'NO_AIRCRAFT_MATCH',
      message: `No aircraft type found for ${miles} miles`
    };
  }
  
  return {
    success: true,
    value: aircraft.link,
    code: aircraft.code,
    name: aircraft.name,
    miles: miles
  };
}

// Export band data for diagnostics/testing
export function getAircraftBands() {
  return AIRCRAFT_BANDS.map(b => ({
    maxMiles: b.maxMiles === Infinity ? '7500+' : b.maxMiles,
    link: b.link,
    code: b.code,
    name: b.name
  }));
}

// Direct lookup by miles (for use without full context)
export function getAircraftForMiles(miles) {
  const aircraft = AIRCRAFT_BANDS.find(band => miles <= band.maxMiles);
  return aircraft ? aircraft.link : 16;
}
