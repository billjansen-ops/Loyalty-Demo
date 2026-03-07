// simulation-modal.js - Shared simulation modal for bonuses and promotions
// Provides historical replay analysis: run past activity through rules to forecast future usage

const SimulationModal = {
  jobId: null,
  pollInterval: null,
  entityType: null,  // 'bonus' or 'promotion'
  entityCode: null,
  
  // Open the choice modal: Test Single Activity vs Run Simulation
  openChoice: function(entityType, entityCode) {
    this.entityType = entityType;
    this.entityCode = entityCode;
    
    const typeLabel = entityType === 'bonus' ? 'Bonus' : 'Promotion';
    const testModalFn = entityType === 'bonus' ? 'BonusTestModal.open' : 'PromoTestModal.open';
    
    const modalHTML = `
      <div id="simulationChoiceModal" style="
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
          padding: 24px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 600; color: #111827;">
              🧪 Test ${typeLabel}
            </div>
            <button onclick="SimulationModal.closeChoice()" style="
              padding: 4px 8px;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            ">✕</button>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <span style="font-size: 13px; color: #6b7280;">Testing:</span>
            <span style="
              font-size: 13px;
              font-weight: 600;
              color: #0066cc;
              background: #e0f2fe;
              padding: 3px 8px;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
            ">${entityCode}</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button onclick="SimulationModal.closeChoice(); ${testModalFn}('${entityCode}');" style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 16px;
              background: #f9fafb;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              text-align: left;
              transition: all 0.15s;
            " onmouseover="this.style.borderColor='#0066cc'; this.style.background='#f0f9ff';" 
               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
              <div style="font-size: 28px;">🔬</div>
              <div>
                <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Test Single Activity</div>
                <div style="font-size: 13px; color: #6b7280;">Enter activity details and see if it qualifies</div>
              </div>
            </button>
            
            <button onclick="SimulationModal.closeChoice(); SimulationModal.openSimulation('${entityType}', '${entityCode}');" style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 16px;
              background: #f9fafb;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              text-align: left;
              transition: all 0.15s;
            " onmouseover="this.style.borderColor='#0066cc'; this.style.background='#f0f9ff';" 
               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
              <div style="font-size: 28px;">📊</div>
              <div>
                <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Run Simulation</div>
                <div style="font-size: 13px; color: #6b7280;">Replay historical activity to forecast usage</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },
  
  closeChoice: function() {
    const modal = document.getElementById('simulationChoiceModal');
    if (modal) modal.remove();
  },
  
  // Open the simulation configuration modal
  openSimulation: function(entityType, entityCode) {
    this.entityType = entityType;
    this.entityCode = entityCode;
    
    const typeLabel = entityType === 'bonus' ? 'Bonus' : 'Promotion';
    
    // Default dates: last quarter (3 months ago to today)
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const dateFrom = threeMonthsAgo.toISOString().slice(0, 10);
    const dateTo = today.toISOString().slice(0, 10);
    
    const modalHTML = `
      <div id="simulationModal" style="
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        ">
          <!-- Header -->
          <div style="
            padding: 16px 20px;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 18px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 8px;">
                  📊 ${typeLabel} Simulation
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                  <span style="font-size: 12px; color: #6b7280;">Simulating:</span>
                  <span style="
                    font-size: 13px;
                    font-weight: 600;
                    color: #0066cc;
                    background: #e0f2fe;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-family: 'Monaco', 'Courier New', monospace;
                  ">${entityCode}</span>
                </div>
              </div>
              <button onclick="SimulationModal.close()" style="
                padding: 5px 12px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
              ">✕ Close</button>
            </div>
          </div>
          
          <!-- Content -->
          <div style="flex: 1; overflow-y: auto; padding: 20px;">
            <!-- Configuration Section -->
            <div id="simConfig">
              <div style="
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 16px;
                font-size: 13px;
                color: #0369a1;
              ">
                💡 Select a historical date range. Activity from this period will be run through the ${typeLabel.toLowerCase()} rules to estimate future usage.
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px;">
                    Activity Start Date
                  </label>
                  <input type="date" id="simDateFrom" value="${dateFrom}" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                  ">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px;">
                    Activity End Date
                  </label>
                  <input type="date" id="simDateTo" value="${dateTo}" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                  ">
                </div>
              </div>
            </div>
            
            <!-- Progress Section (hidden initially) -->
            <div id="simProgress" style="display: none;">
              <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span id="simProgressStatus" style="font-weight: 600; color: #374151;">Preparing...</span>
                  <span id="simProgressPercent" style="font-size: 14px; color: #6b7280;">0%</span>
                </div>
                <div style="
                  height: 8px;
                  background: #e5e7eb;
                  border-radius: 4px;
                  overflow: hidden;
                ">
                  <div id="simProgressBar" style="
                    height: 100%;
                    width: 0%;
                    background: #0066cc;
                    transition: width 0.3s ease;
                  "></div>
                </div>
                <div id="simProgressDetail" style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                  0 / 0 eligible members processed
                </div>
              </div>
              
              <div style="display: flex; justify-content: center;">
                <button onclick="SimulationModal.stop()" id="simStopBtn" style="
                  padding: 8px 16px;
                  background: #fef2f2;
                  border: 1px solid #fecaca;
                  border-radius: 6px;
                  color: #991b1b;
                  font-weight: 600;
                  cursor: pointer;
                ">⏹ Stop</button>
              </div>
            </div>
            
            <!-- Results Section (hidden initially) -->
            <div id="simResults" style="display: none;">
              <div style="
                background: #f0fdf4;
                border: 1px solid #86efac;
                border-radius: 8px;
                padding: 20px;
              ">
                <div style="font-size: 16px; font-weight: 600; color: #166534; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                  ✅ Simulation Complete
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                  <div style="text-align: center; padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                    <div style="font-size: 28px; font-weight: 700; color: #059669;" id="simResultMembers">0</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Members Awarded</div>
                  </div>
                  <div style="text-align: center; padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                    <div style="font-size: 28px; font-weight: 700; color: #059669;" id="simResultAwards">0</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Times Awarded</div>
                  </div>
                  <div style="text-align: center; padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                    <div style="font-size: 28px; font-weight: 700; color: #059669;" id="simResultPoints">0</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;" id="simResultPointsLabel">Points</div>
                  </div>
                </div>
                
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #d1fae5;">
                  <div style="font-size: 13px; color: #6b7280;">
                    <span id="simResultSummary"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div id="simFooter" style="
            padding: 12px 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            flex-shrink: 0;
          ">
            <button onclick="SimulationModal.close()" style="
              padding: 8px 16px;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
            ">Cancel</button>
            <button onclick="SimulationModal.start()" id="simStartBtn" style="
              padding: 8px 16px;
              background: #0066cc;
              border: none;
              border-radius: 6px;
              color: white;
              font-weight: 600;
              cursor: pointer;
            ">▶ Run Simulation</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },
  
  close: function() {
    // Stop polling if running
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    const modal = document.getElementById('simulationModal');
    if (modal) modal.remove();
  },
  
  start: async function() {
    const API_BASE = window.LP_STATE?.apiBase || window.location.origin;
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    const dateFrom = document.getElementById('simDateFrom').value;
    const dateTo = document.getElementById('simDateTo').value;
    
    if (!dateFrom || !dateTo) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (dateFrom > dateTo) {
      alert('Start date must be before end date');
      return;
    }
    
    // Hide config, show progress
    document.getElementById('simConfig').style.display = 'none';
    document.getElementById('simProgress').style.display = 'block';
    document.getElementById('simResults').style.display = 'none';
    document.getElementById('simStartBtn').style.display = 'none';
    
    try {
      const response = await fetch(`${API_BASE}/v1/admin/simulate-${this.entityType}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityCode: this.entityCode,
          tenantId: tenantId,
          dateFrom: dateFrom,
          dateTo: dateTo
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      this.jobId = result.jobId;
      
      // Start polling for progress
      this.pollInterval = setInterval(() => this.updateProgress(), 500);
      
    } catch (error) {
      alert('Error starting simulation: ' + error.message);
      document.getElementById('simConfig').style.display = 'block';
      document.getElementById('simProgress').style.display = 'none';
      document.getElementById('simStartBtn').style.display = 'inline-block';
    }
  },
  
  updateProgress: async function() {
    const API_BASE = window.LP_STATE?.apiBase || window.location.origin;
    
    try {
      const response = await fetch(`${API_BASE}/v1/admin/simulate-${this.entityType}/progress/${this.jobId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get progress');
      }
      
      const progress = await response.json();
      
      // Update UI
      document.getElementById('simProgressStatus').textContent = 
        progress.status === 'running' ? 'Processing...' : 
        progress.status === 'complete' ? 'Complete!' : 
        progress.status === 'stopped' ? 'Stopped' : progress.status;
      
      const pct = Math.round(progress.percentage || 0);
      document.getElementById('simProgressPercent').textContent = pct + '%';
      document.getElementById('simProgressBar').style.width = pct + '%';
      document.getElementById('simProgressDetail').textContent = 
        `${(progress.completed || 0).toLocaleString()} / ${(progress.total || 0).toLocaleString()} eligible members processed`;
      
      // Check if done
      if (progress.status === 'complete' || progress.status === 'stopped') {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        this.showResults(progress);
      }
      
    } catch (error) {
      console.error('Progress update error:', error);
    }
  },
  
  stop: async function() {
    const API_BASE = window.LP_STATE?.apiBase || window.location.origin;
    
    try {
      await fetch(`${API_BASE}/v1/admin/simulate-${this.entityType}/stop/${this.jobId}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error stopping simulation:', error);
    }
  },
  
  showResults: function(progress) {
    document.getElementById('simProgress').style.display = 'none';
    document.getElementById('simResults').style.display = 'block';
    
    const results = progress.results || {};
    const resultsContainer = document.getElementById('simResults');
    
    const dateFrom = document.getElementById('simDateFrom').value;
    const dateTo = document.getElementById('simDateTo').value;
    const elapsed = progress.elapsedSeconds ? progress.elapsedSeconds.toFixed(1) : '?';
    
    if (this.entityType === 'bonus') {
      // Bonus results
      document.getElementById('simResultMembers').textContent = (results.uniqueMembers || 0).toLocaleString();
      document.getElementById('simResultAwards').textContent = (results.totalAwards || 0).toLocaleString();
      document.getElementById('simResultPoints').textContent = (results.totalPoints || 0).toLocaleString();
      document.getElementById('simResultPointsLabel').textContent = results.pointTypeLabel || 'Points';
      
      document.getElementById('simResultSummary').textContent = 
        `Analyzed ${(progress.total || 0).toLocaleString()} members with activity from ${dateFrom} to ${dateTo} in ${elapsed} seconds.`;
    } else {
      // Promotion results - rebuild the results HTML
      let outcomesHTML = '';
      if (results.outcomes && results.outcomes.length > 0) {
        outcomesHTML = results.outcomes.map(o => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <span style="color: #374151;">${o.label || o.resultType}</span>
            <span style="font-weight: 600; color: #059669;">
              ${o.count.toLocaleString()}${o.resultType === 'points' && o.totalPoints ? ` (${o.totalPoints.toLocaleString()} ${results.currencyLabel || 'pts'})` : ''}
            </span>
          </div>
        `).join('');
      } else {
        outcomesHTML = '<div style="color: #6b7280; padding: 8px 0;">No promotion results defined</div>';
      }
      
      let noteHTML = '';
      if (results.note) {
        noteHTML = `<div style="margin-top: 12px; padding: 8px 12px; background: #fef3c7; border-radius: 4px; font-size: 12px; color: #92400e;">
          ⚠️ ${results.note}
        </div>`;
      }
      
      resultsContainer.innerHTML = `
        <div style="
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 20px;
        ">
          <div style="font-size: 16px; font-weight: 600; color: #166534; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            ✅ Simulation Complete
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
            <div style="text-align: center; padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
              <div style="font-size: 28px; font-weight: 700; color: #059669;">${(results.registered || 0).toLocaleString()}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Registered</div>
            </div>
            <div style="text-align: center; padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
              <div style="font-size: 28px; font-weight: 700; color: #059669;">${(results.qualified || 0).toLocaleString()}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Qualified</div>
            </div>
          </div>
          
          <div style="background: white; border-radius: 6px; border: 1px solid #d1fae5; padding: 12px;">
            <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">Outcomes</div>
            ${outcomesHTML}
          </div>
          
          ${noteHTML}
          
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #d1fae5;">
            <div style="font-size: 13px; color: #6b7280;">
              Analyzed ${(progress.total || 0).toLocaleString()} members with activity from ${dateFrom} to ${dateTo} in ${elapsed} seconds.
            </div>
          </div>
        </div>
      `;
    }
    
    // Update footer
    document.getElementById('simFooter').innerHTML = `
      <button onclick="SimulationModal.close()" style="
        padding: 8px 16px;
        background: #0066cc;
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        cursor: pointer;
      ">Done</button>
    `;
  }
};
