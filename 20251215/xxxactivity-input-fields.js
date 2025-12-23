/**
 * Activity Input Fields - Reusable Component v2.2
 * 
 * Provides consistent activity input form across:
 * - bonus_test.html (test rig)
 * - add_activity.html (real activity entry)
 * 
 * Handles both list molecules (fare_class) and lookup molecules (carrier, origin, destination)
 * with dynamic labels and values loaded from molecules.
 */

const ActivityInputFields = {
  apiBase: 'http://127.0.0.1:4001',
  tenantId: null,

  /**
   * Render the form HTML
   * @param {Object} options - Configuration options
   * @param {boolean} options.includeMemberId - Show member ID field (default: false)
   * @param {boolean} options.includeTitle - Show form title (default: false)
   * @param {string} options.cssClass - CSS class for form rows (default: 'form-grid')
   * @returns {string} HTML string
   */
  renderHTML(options = {}) {
    const { includeMemberId = false, includeTitle = false, cssClass = 'form-grid' } = options;
    
    let html = '';
    
    if (includeTitle) {
      html += `
        <h2 style="margin-bottom: 20px; font-size: 20px;">Activity Details</h2>
      `;
    }
    
    if (includeMemberId) {
      html += `
        <div class="${cssClass}" style="grid-template-columns: 1fr;">
          <div class="form-group">
            <label class="form-label" for="memberId">Member ID</label>
            <input class="form-input" type="text" id="memberId" placeholder="e.g., 2153442807" required>
          </div>
        </div>
      `;
    }
    
    html += `
      <div class="${cssClass}">
        <div class="form-group">
          <label class="form-label" for="activityDate">Activity Date</label>
          <input class="form-input" type="date" id="activityDate" required style="max-width: 180px;">
        </div>
        <div class="form-group">
          <label class="form-label" for="carrier" id="carrierLabel">Carrier</label>
          <select class="form-input" id="carrier" required>
            <option value="">Loading...</option>
          </select>
        </div>
      </div>

      <div class="${cssClass}">
        <div class="form-group">
          <label class="form-label" for="origin" id="originLabel">Origin</label>
          <select class="form-input" id="origin" required>
            <option value="">Loading...</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="destination" id="destinationLabel">Destination</label>
          <select class="form-input" id="destination" required>
            <option value="">Loading...</option>
          </select>
        </div>
      </div>

      <div class="${cssClass}">
        <div class="form-group">
          <label class="form-label" for="fareClass" id="fareClassLabel">Fare Class</label>
          <select class="form-input" id="fareClass" required style="max-width: 250px;">
            <option value="">Loading...</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="flightNumber">Flight Number</label>
          <input class="form-input" type="number" id="flightNumber" placeholder="e.g., 1234" min="1" style="max-width: 180px;">
        </div>
      </div>

      <div class="${cssClass}">
        <div class="form-group">
          <label class="form-label" for="baseMiles" id="baseMilesLabel">Base Miles</label>
          <input class="form-input" type="number" id="baseMiles" value="1000" min="0" required style="max-width: 180px;">
        </div>
      </div>
    `;
    
    return html;
  },

  /**
   * Initialize the form - load all molecule dropdowns
   * @param {string} apiBase - API base URL
   * @param {string} tenantId - Tenant ID
   */
  async initialize(apiBase, tenantId) {
    this.apiBase = apiBase || this.apiBase;
    this.tenantId = tenantId;
    
    // Set today's date as default
    const dateField = document.getElementById('activityDate');
    if (dateField) {
      dateField.value = new Date().toLocaleDateString('en-CA');
    }
    
    // Load all dropdowns
    await Promise.all([
      this.loadMoleculeDropdown('carrier', 'carrier', 'carrierLabel'),
      this.loadMoleculeDropdown('origin', 'origin', 'originLabel'),
      this.loadMoleculeDropdown('destination', 'destination', 'destinationLabel'),
      this.loadMoleculeDropdown('fare_class', 'fareClass', 'fareClassLabel')
    ]);
    
    // Update base miles label if it exists
    await this.updateBaseMilesLabel();
  },

  /**
   * Load dropdown values for any molecule (list or lookup)
   * @param {string} moleculeKey - Molecule key (e.g., 'carrier', 'fare_class')
   * @param {string} selectId - HTML select element ID
   * @param {string} labelId - HTML label element ID (optional)
   */
  async loadMoleculeDropdown(moleculeKey, selectId, labelId) {
    try {
      // Get molecule definition
      const defResponse = await fetch(`${this.apiBase}/v1/molecules/get/${moleculeKey}?tenant_id=${this.tenantId}`);
      if (!defResponse.ok) throw new Error(`Failed to load ${moleculeKey} molecule`);
      
      const moleculeDef = await defResponse.json();
      
      // Update label if provided
      if (labelId) {
        const labelElement = document.getElementById(labelId);
        if (labelElement) {
          labelElement.textContent = moleculeDef.label || moleculeKey;
        }
      }
      
      let values = [];
      
      // Load values based on molecule type
      if (moleculeDef.value_kind === 'list') {
        // List molecule: load from molecule_value_text
        const valuesResponse = await fetch(`${this.apiBase}/v1/molecules/${moleculeDef.molecule_id}/values?tenant_id=${this.tenantId}`);
        if (!valuesResponse.ok) throw new Error(`Failed to load ${moleculeKey} values`);
        
        const listValues = await valuesResponse.json();
        values = listValues.map(v => ({
          code: v.value,
          name: v.label || v.value
        }));
        
      } else if (moleculeDef.value_kind === 'lookup') {
        // Lookup molecule: load from external table using generic endpoint
        const valuesResponse = await fetch(`${this.apiBase}/v1/lookup-values/${moleculeKey}?tenant_id=${this.tenantId}`);
        if (!valuesResponse.ok) throw new Error(`Failed to load ${moleculeKey} values`);
        
        values = await valuesResponse.json();
      }
      
      // Populate dropdown
      const selectElement = document.getElementById(selectId);
      if (!selectElement) return;
      
      selectElement.innerHTML = `<option value="">-- Select ${moleculeDef.label || moleculeKey} --</option>`;
      
      values.forEach(v => {
        const option = document.createElement('option');
        option.value = v.code;
        option.textContent = `${v.code} - ${v.name}`;
        selectElement.appendChild(option);
      });
      
    } catch (error) {
      console.error(`Error loading ${moleculeKey}:`, error);
      const selectElement = document.getElementById(selectId);
      if (selectElement) {
        selectElement.innerHTML = `<option value="">Error loading ${moleculeKey}</option>`;
      }
    }
  },

  /**
   * Update the base miles label with tenant-specific currency label
   */
  async updateBaseMilesLabel() {
    try {
      const response = await fetch(`${this.apiBase}/v1/tenants/${this.tenantId}/labels`);
      if (!response.ok) return;
      
      const labels = await response.json();
      const labelElement = document.getElementById('baseMilesLabel');
      
      if (labelElement && labels.currency_label) {
        labelElement.textContent = `Base ${labels.currency_label}`;
      }
    } catch (error) {
      console.error('Error loading currency label:', error);
    }
  },

  /**
   * Get form data as an object
   * @returns {Object} Activity data
   */
  getFormData() {
    const memberIdField = document.getElementById('memberId');
    const flightNumberField = document.getElementById('flightNumber');
    
    return {
      member_id: (memberIdField && memberIdField.value) ? memberIdField.value.trim() : null,
      activity_date: document.getElementById('activityDate')?.value,
      carrier: document.getElementById('carrier')?.value,
      origin: document.getElementById('origin')?.value,
      destination: document.getElementById('destination')?.value,
      fare_class: document.getElementById('fareClass')?.value,
      flight_number: flightNumberField?.value ? parseInt(flightNumberField.value) : undefined,
      base_miles: parseInt(document.getElementById('baseMiles')?.value || 0)
    };
  },

  /**
   * Validate form data
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate() {
    const errors = [];
    const data = this.getFormData();
    
    if (!data.activity_date) errors.push('Activity date is required');
    if (!data.carrier) errors.push('Carrier is required');
    if (!data.origin) errors.push('Origin is required');
    if (!data.destination) errors.push('Destination is required');
    if (!data.fare_class) errors.push('Fare class is required');
    if (!data.base_miles || data.base_miles <= 0) errors.push('Base miles must be greater than 0');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Make it available globally
window.ActivityInputFields = ActivityInputFields;
