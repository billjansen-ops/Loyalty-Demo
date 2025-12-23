#!/usr/bin/env node
/**
 * Standalone Stress Test Client
 * Runs as separate process, POSTs to API like real production traffic
 * 
 * Usage: node stress_client.js '{"config": {...}}'
 * Communicates progress via stdout JSON lines
 */

const config = JSON.parse(process.argv[2] || '{}');
const API_BASE = `http://127.0.0.1:${config.port || 4001}`;

// Progress tracking
const job = {
  total: config.accrualCount || 1000,
  completed: 0,
  success: 0,
  failures: 0,
  inFlight: 0,
  errors: [],
  status: 'running'
};

// Response time tracking
const responseTimes = [];

// Send progress to parent
function sendProgress() {
  console.log(JSON.stringify({ type: 'progress', ...job }));
}

// Send progress every 500ms
const progressInterval = setInterval(sendProgress, 500);

// Handle kill signal
process.on('SIGTERM', () => {
  job.status = 'stopped';
  clearInterval(progressInterval);
  sendProgress();
  process.exit(0);
});

process.on('SIGINT', () => {
  job.status = 'stopped';
  clearInterval(progressInterval);
  sendProgress();
  process.exit(0);
});

// Helpers
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function loadTestData() {
  const tenantId = config.tenantId || 1;
  
  // Load ALL membership numbers - no limit
  const membersResp = await fetch(`${API_BASE}/v1/admin/databases/current/members?tenant_id=${tenantId}&limit=10000000`);
  if (!membersResp.ok) {
    const text = await membersResp.text();
    throw new Error(`Failed to load members: ${membersResp.status} - ${text.substring(0, 100)}`);
  }
  const membersData = await membersResp.json();
  const membershipNumbers = (membersData.members || []).map(m => m.membership_number).filter(Boolean);
  
  if (membershipNumbers.length === 0) {
    throw new Error('No members found');
  }
  
  // Load carriers from cache endpoint
  let carrierCodes = ['DL', 'AA', 'UA'];
  try {
    const carriersResp = await fetch(`${API_BASE}/v1/carriers?tenant_id=${tenantId}`);
    const carriersData = await carriersResp.json();
    if (Array.isArray(carriersData) && carriersData.length > 0) {
      carrierCodes = carriersData.map(c => c.code);
    }
  } catch (e) { /* use defaults */ }
  
  // Load airports
  let airportCodes = ['MSP', 'DTW', 'LAX', 'JFK', 'ATL'];
  try {
    const airportsResp = await fetch(`${API_BASE}/v1/airports?limit=1000`);
    const airportsData = await airportsResp.json();
    if (Array.isArray(airportsData) && airportsData.length > 0) {
      airportCodes = airportsData.map(a => a.code);
    }
  } catch (e) { /* use defaults */ }
  
  // Load fare classes from molecule values
  let fareClassCodes = ['Y', 'F'];
  try {
    const fareResp = await fetch(`${API_BASE}/v1/molecules/values/fare_class?tenant_id=${tenantId}`);
    const fareData = await fareResp.json();
    if (Array.isArray(fareData) && fareData.length > 0) {
      fareClassCodes = fareData.map(f => f.value);
    }
  } catch (e) { /* use defaults */ }
  
  return { membershipNumbers, carrierCodes, airportCodes, fareClassCodes };
}

function generateRandomDate() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  for (let attempt = 0; attempt < 10; attempt++) {
    let dateStr;
    if (config.dateFrom && config.dateTo) {
      const [fromY, fromM, fromD] = config.dateFrom.split('-').map(Number);
      const [toY, toM, toD] = config.dateTo.split('-').map(Number);
      const fromDate = new Date(fromY, fromM - 1, fromD);
      const toDate = new Date(toY, toM - 1, toD);
      const dayRange = Math.floor((toDate - fromDate) / (24 * 60 * 60 * 1000));
      const randomDays = randomInt(0, Math.max(0, dayRange));
      const activityDate = new Date(fromDate);
      activityDate.setDate(activityDate.getDate() + randomDays);
      dateStr = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}`;
    } else {
      const maxDaysAgo = (config.dateRangeMonths || 24) * 30;
      const daysAgo = randomInt(0, maxDaysAgo);
      const activityDate = new Date();
      activityDate.setDate(activityDate.getDate() - daysAgo);
      dateStr = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}-${String(activityDate.getDate()).padStart(2, '0')}`;
    }
    
    // If not in future, use it
    if (dateStr <= todayStr) {
      return dateStr;
    }
  }
  
  // Fallback to today
  return todayStr;
}

async function runStressTest() {
  console.log(JSON.stringify({ type: 'status', message: 'Loading test data...' }));
  
  const { membershipNumbers, carrierCodes, airportCodes, fareClassCodes } = await loadTestData();
  
  console.log(JSON.stringify({ 
    type: 'status', 
    message: `Loaded ${membershipNumbers.length} members, ${carrierCodes.length} carriers, ${airportCodes.length} airports, ${fareClassCodes.length} fare classes` 
  }));
  
  const tenantId = config.tenantId || 1;
  const numWorkers = config.concurrency || 10;
  
  // Shared work counter
  let nextWork = 0;
  const getNextWork = () => {
    if (nextWork >= config.accrualCount) return null;
    return nextWork++;
  };
  
  // Worker function
  const workerFn = async (workerId) => {
    while (job.status === 'running') {
      const workIndex = getNextWork();
      if (workIndex === null) break;
      
      job.inFlight++;
      
      const membershipNumber = randomPick(membershipNumbers);
      const dateStr = generateRandomDate();
      const origin = randomPick(airportCodes);
      let destination = randomPick(airportCodes);
      while (destination === origin && airportCodes.length > 1) {
        destination = randomPick(airportCodes);
      }
      
      try {
        const activityData = {
          activity_date: dateStr,
          tenant_id: tenantId,
          carrier: randomPick(carrierCodes),
          origin: origin,
          destination: destination,
          fare_class: randomPick(fareClassCodes),
          flight_number: randomInt(100, 9999),
          mqd: randomInt(200, 1500)
        };
        
        if (!config.dryRun) {
          const startTime = Date.now();
          const response = await fetch(`${API_BASE}/v1/members/${membershipNumber}/accruals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activityData)
          });
          const elapsed = Date.now() - startTime;
          responseTimes.push(elapsed);
          
          if (!response.ok) {
            const err = await response.json();
            throw new Error(JSON.stringify(err));
          }
        }
        
        job.success++;
      } catch (error) {
        job.failures++;
        console.error(JSON.stringify({ type: 'worker_error', message: error.message, date: dateStr }));
      }
      
      job.completed++;
      job.inFlight--;
    }
  };
  
  // Launch workers
  console.log(JSON.stringify({ type: 'timer_start' }));
  console.log(JSON.stringify({ type: 'status', message: `Starting ${numWorkers} workers...` }));
  
  const workerPromises = [];
  for (let i = 0; i < numWorkers; i++) {
    workerPromises.push(workerFn(i));
  }
  
  await Promise.all(workerPromises);
  
  job.status = 'complete';
  clearInterval(progressInterval);
  sendProgress();
  
  // Calculate response time stats
  let responseStats = null;
  if (responseTimes.length > 0) {
    responseTimes.sort((a, b) => a - b);
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / responseTimes.length);
    const min = responseTimes[0];
    const max = responseTimes[responseTimes.length - 1];
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95 = responseTimes[p95Index];
    const p99 = responseTimes[p99Index];
    responseStats = { min, max, avg, p95, p99 };
  }
  
  console.log(JSON.stringify({ type: 'done', success: job.success, failures: job.failures, errors: job.errors, responseStats }));
}

// Run
runStressTest().catch(err => {
  console.log(JSON.stringify({ type: 'error', message: err.message }));
  process.exit(1);
});
