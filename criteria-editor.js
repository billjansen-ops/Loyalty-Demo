/**
 * criteria-editor.js
 * Self-contained criteria editing component for bonus and promotion rule editors
 * 
 * Usage in consuming page:
 * 1. Include this script: <script src="criteria-editor.js"></script>
 * 2. Call CriteriaEditor.init('bonus') or CriteriaEditor.init('promotion')
 * 3. Optionally define getCriteriaOverlaySubtitle() to provide context
 * 4. Call CriteriaEditor.loadCriteria(entityId) to load existing criteria
 * 5. Access CriteriaEditor.criteriaList when saving
 * 
 * The page needs only:
 * - A element with id="criteriaCount" where you want the count displayed
 * - A button that calls openCriteriaOverlay()
 */

const CriteriaEditor = {
  
  // State
  criteriaList: [],
  editingCriteriaIndex: null,
  entityType: 'bonus', // 'bonus' or 'promotion'
  initialized: false,
  
  // Molecules loaded from API
  moleculesBySource: {
    Activity: [],
    Member: []
  },

  // CSS for the component
  getCSS: function() {
    return `
      /* Criteria Editor Styles */
      .ce-rules-container { background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 4px; padding: 12px; min-height: 200px; }
      .ce-rules-empty { text-align: center; padding: 20px; color: #6b7280; }
      .ce-rules-empty-icon { font-size: 36px; margin-bottom: 8px; }

      .ce-criteria-list { display: flex; flex-direction: column; gap: 8px; }
      .ce-criteria-item { background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; overflow: hidden; }
      .ce-criteria-header { background: #f3f4f6; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
      .ce-criteria-body { padding: 10px; display: grid; grid-template-columns: 180px 100px 140px 1fr auto; gap: 8px; align-items: center; }
      .ce-criteria-label-row { grid-column: 1 / -1; font-size: 11px; color: #6b7280; margin-top: 6px; padding-top: 6px; border-top: 1px solid #f3f4f6; }

      /* Dialog Styles */
      .ce-dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 3000; }
      .ce-dialog-overlay.active { display: flex; }
      .ce-dialog { background: white; border-radius: 4px; width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .ce-dialog-header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
      .ce-dialog-title { font-size: 16px; font-weight: 600; margin: 0; }
      .ce-dialog-body { padding: 16px; }
      .ce-dialog-footer { padding: 10px 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; justify-content: flex-end; }

      .ce-joiner-row { display: flex; justify-content: center; padding: 4px 0; }
      .ce-joiner-select { padding: 4px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: white; font-weight: 600; font-size: 12px; color: #6b7280; cursor: pointer; }

      .ce-action-buttons { display: flex; gap: 8px; }

      /* Full-Screen Criteria Overlay */
      .ce-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: none; z-index: 2000; }
      .ce-overlay.active { display: block; }
      .ce-overlay-content { position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; background: white; border-radius: 4px; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .ce-overlay-header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
      .ce-overlay-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
      .ce-overlay-body { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; }

      /* Form elements inside criteria editor */
      .ce-form-group { display: flex; flex-direction: column; margin-bottom: 16px; }
      .ce-form-group label { font-weight: 600; margin-bottom: 4px; font-size: 12px; }
      .ce-form-group select, .ce-form-group input { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; }
    `;
  },

  // HTML for the overlay and dialog
  getHTML: function() {
    const entityLabel = this.entityType === 'bonus' ? 'Bonus' : 'Promotion';
    const entityLower = this.entityType;
    
    return `
      <!-- Full-Screen Criteria Editor Overlay -->
      <div class="ce-overlay" id="criteriaOverlay">
        <div class="ce-overlay-content">
          <div class="ce-overlay-header">
            <div>
              <h2>${entityLabel} Criteria</h2>
              <div id="criteriaOverlaySubtitle" style="font-size: 14px; color: #6b7280; margin-top: 4px;"></div>
            </div>
            <button class="btn btn-secondary" onclick="closeCriteriaOverlay()">✕ Close</button>
          </div>
          
          <div class="ce-overlay-body">
            <div class="ce-rules-container" style="flex: 1; min-height: auto;">
              <div id="criteriaList" class="ce-criteria-list">
                <!-- Criteria will be added here -->
              </div>

              <div id="rulesEmpty" class="ce-rules-empty">
                <div class="ce-rules-empty-icon">🎯</div>
                <div style="font-weight: 600; margin-bottom: 8px;">Dynamic Rules Engine</div>
                <div>Rules to determine when and how this ${entityLower} applies</div>
              </div>

              <button class="btn btn-secondary" onclick="openCriteriaDialog()" style="margin-top: 8px;">
                + Add Criteria
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Criteria Dialog -->
      <div class="ce-dialog-overlay" id="criteriaDialog">
        <div class="ce-dialog">
          <div class="ce-dialog-header">
            <h2 class="ce-dialog-title" id="dialogTitle">Add Criteria</h2>
          </div>
          <div class="ce-dialog-body">
            <div class="ce-form-group">
              <label>Source</label>
              <select id="criteriaSource" onchange="updateMoleculeOptions()">
                <option value="">Select source...</option>
                <option value="Activity">Activity</option>
                <option value="Member">Member</option>
              </select>
            </div>

            <div class="ce-form-group">
              <label>Molecule</label>
              <select id="criteriaMolecule" disabled onchange="onMoleculeChange()">
                <option value="">Select source first...</option>
              </select>
            </div>

            <div class="ce-form-group">
              <label>Operator</label>
              <select id="criteriaOperator" onchange="onOperatorChange()">
                <option value="equals">equals</option>
                <option value="IN GROUP">in group</option>
                <option value="NOT IN GROUP">not in group</option>
                <option value="!=">not equals</option>
                <option value="in">in (comma-separated)</option>
                <option value="not_in">not in (comma-separated)</option>
                <option value="contains">contains</option>
                <option value="gt">greater than (&gt;)</option>
                <option value="gte">greater than or equal (&gt;=)</option>
                <option value="lt">less than (&lt;)</option>
                <option value="lte">less than or equal (&lt;=)</option>
                <option value="between">between</option>
              </select>
            </div>

            <div class="ce-form-group" id="groupSelectContainer" style="display: none;">
              <label>Group</label>
              <select id="criteriaGroup">
                <option value="">Select a group...</option>
              </select>
            </div>

            <div class="ce-form-group" id="valueContainer">
              <label>Value</label>
              <input type="text" id="criteriaValue" placeholder="e.g., DL, BOS, Gold">
            </div>

            <div id="functionParamsContainer" style="display: none;">
              <!-- Dynamic param inputs will be added here -->
            </div>

            <div class="ce-form-group" style="margin-bottom: 0;">
              <label>Label (for diagnostics) <span style="color: #dc2626;">*</span></label>
              <input type="text" id="criteriaLabel" placeholder="e.g., Fly on Delta" required>
            </div>
          </div>
          <div class="ce-dialog-footer">
            <button class="btn btn-secondary" onclick="closeDialog()">Cancel</button>
            <button class="btn btn-primary" onclick="saveCriteria()">Save Criteria</button>
          </div>
        </div>
      </div>
    `;
  },

  // Inject CSS into page
  injectCSS: function() {
    if (document.getElementById('criteria-editor-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'criteria-editor-styles';
    style.textContent = this.getCSS();
    document.head.appendChild(style);
  },

  // Inject HTML into page
  injectHTML: function() {
    if (document.getElementById('criteriaOverlay')) return;
    
    const container = document.createElement('div');
    container.id = 'criteria-editor-container';
    container.innerHTML = this.getHTML();
    document.body.appendChild(container);
  },

  // Initialize the criteria editor
  init: function(entityType = 'bonus') {
    this.entityType = entityType;
    this.criteriaList = [];
    this.editingCriteriaIndex = null;
    
    // Inject CSS and HTML
    this.injectCSS();
    this.injectHTML();
    
    this.initialized = true;
    this.loadMolecules();
  },

  // Get API base URL
  getApiBase: function() {
    return window.API_BASE || window.LP_STATE?.apiBase || window.location.origin;
  },

  // Get tenant ID
  getTenantId: function() {
    return sessionStorage.getItem('tenant_id') || '1';
  },

  // Load molecules on page init
  loadMolecules: async function() {
    console.log('=== Loading Molecules ===');
    try {
      const tenantId = this.getTenantId();
      
      // Load Activity molecules
      const activityRes = await fetch(`${this.getApiBase()}/v1/molecules/by-source/Activity?tenant_id=${tenantId}`);
      if (activityRes.ok) {
        this.moleculesBySource.Activity = await activityRes.json();
      }
      
      // Load Member molecules
      const memberRes = await fetch(`${this.getApiBase()}/v1/molecules/by-source/Member?tenant_id=${tenantId}`);
      if (memberRes.ok) {
        this.moleculesBySource.Member = await memberRes.json();
      }
    } catch (error) {
      console.error('Error loading molecules:', error);
      // Fallback
      this.moleculesBySource = {
        Activity: [{molecule_key: 'carrier'}, {molecule_key: 'origin'}, {molecule_key: 'destination'}, {molecule_key: 'fare_class'}],
        Member: [{molecule_key: 'tier'}, {molecule_key: 'state'}]
      };
    }
  },

  // Load criteria from API (for existing entities)
  loadCriteria: async function(entityId) {
    if (!entityId) {
      this.criteriaList = [];
      this.renderCriteria();
      return;
    }
    
    const endpoint = this.entityType === 'bonus' 
      ? `${this.getApiBase()}/v1/bonuses/${entityId}/criteria`
      : `${this.getApiBase()}/v1/promotions/${entityId}/criteria`;
    
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        this.criteriaList = await res.json();
      } else {
        this.criteriaList = [];
      }
      this.renderCriteria();
    } catch (err) {
      console.error('Error loading criteria:', err);
      this.criteriaList = [];
      this.renderCriteria();
    }
  },

  // Render criteria list
  renderCriteria: function() {
    const container = document.getElementById('criteriaList');
    const emptyState = document.getElementById('rulesEmpty');
    const countDisplay = document.getElementById('criteriaCount');
    const entityLabel = this.entityType === 'bonus' ? 'bonus' : 'promotion';

    // Update count
    if (countDisplay) {
      countDisplay.textContent = `This ${entityLabel} has ${this.criteriaList.length} ${this.criteriaList.length === 1 ? 'criterion' : 'criteria'}`;
    }

    if (!container || !emptyState) return;

    if (this.criteriaList.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      container.style.display = 'flex';
      emptyState.style.display = 'none';

      container.innerHTML = this.criteriaList.map((c, index) => {
        const joinerHtml = index < this.criteriaList.length - 1 ? `
          <div class="ce-joiner-row">
            <select class="ce-joiner-select" onchange="CriteriaEditor.updateJoiner(${index}, this.value)">
              <option value="AND" ${c.joiner === 'AND' ? 'selected' : ''}>AND</option>
              <option value="OR" ${c.joiner === 'OR' ? 'selected' : ''}>OR</option>
            </select>
          </div>
        ` : '';
        
        // Build params display if any exist
        const params = [];
        if (c.param1_value) params.push(c.param1_value);
        if (c.param2_value) params.push(c.param2_value);
        if (c.param3_value) params.push(c.param3_value);
        if (c.param4_value) params.push(c.param4_value);
        const paramsHtml = params.length > 0 
          ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;"><strong>Params:</strong> ${params.join(', ')}</div>` 
          : '';

        return `
          <div>
            <div class="ce-criteria-item">
              <div class="ce-criteria-header">${c.source} Criteria</div>
              <div class="ce-criteria-body">
                <select disabled style="background: #f9fafb;">
                  <option>${c.source}.${c.molecule_key || c.molecule}</option>
                </select>
                <select disabled style="background: #f9fafb;">
                  <option>${c.operator}</option>
                </select>
                <input type="text" value="${c.value}" disabled style="background: #f9fafb;">
                <input type="text" value="${c.label || ''}" placeholder="Label" disabled style="background: #f9fafb;">
                <div class="ce-action-buttons">
                  <button class="btn btn-secondary btn-sm" onclick="CriteriaEditor.editCriteria(${index})" title="Edit">✏️ Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="CriteriaEditor.deleteCriteria(${index})" title="Delete">🗑️</button>
                </div>
                <div class="ce-criteria-label-row">
                  <strong>Label:</strong> "${c.label || ''}"
                  ${paramsHtml}
                </div>
              </div>
            </div>
            ${joinerHtml}
          </div>
        `;
      }).join('');
    }
  },

  // Update joiner between criteria
  updateJoiner: function(index, joiner) {
    if (this.criteriaList[index]) {
      this.criteriaList[index].joiner = joiner;
    }
  },

  // Open criteria overlay
  openOverlay: function(subtitle = '') {
    const subtitleEl = document.getElementById('criteriaOverlaySubtitle');
    if (subtitleEl) {
      subtitleEl.textContent = subtitle;
    }
    document.getElementById('criteriaOverlay').classList.add('active');
    this.renderCriteria();
  },

  // Close criteria overlay
  closeOverlay: function() {
    document.getElementById('criteriaOverlay').classList.remove('active');
    // Update count in main form
    const countDisplay = document.getElementById('criteriaCount');
    const entityLabel = this.entityType === 'bonus' ? 'bonus' : 'promotion';
    if (countDisplay) {
      countDisplay.textContent = `This ${entityLabel} has ${this.criteriaList.length} ${this.criteriaList.length === 1 ? 'criterion' : 'criteria'}`;
    }
  },

  // Open criteria dialog (add or edit)
  openDialog: async function(index = null) {
    this.editingCriteriaIndex = index;
    const dialog = document.getElementById('criteriaDialog');
    const title = document.getElementById('dialogTitle');
    
    // Reset group UI
    document.getElementById('groupSelectContainer').style.display = 'none';
    document.getElementById('valueContainer').style.display = 'block';
    
    if (index !== null && this.criteriaList[index]) {
      // Edit mode
      const criterion = this.criteriaList[index];
      title.textContent = 'Edit Criteria';
      document.getElementById('criteriaSource').value = criterion.source;
      
      // Wait for molecules to be loaded if they aren't yet
      if (this.moleculesBySource[criterion.source].length === 0) {
        await this.loadMolecules();
      }
      
      // Update molecule dropdown (don't trigger onMoleculeChange yet)
      const source = criterion.source;
      const moleculeSelect = document.getElementById('criteriaMolecule');
      moleculeSelect.disabled = false;
      moleculeSelect.innerHTML = this.moleculesBySource[source].map(m => 
        `<option value="${m.molecule_key}" 
                 data-molecule-id="${m.molecule_id}" 
                 data-value-kind="${m.value_kind || ''}"
                 data-molecule-type="${m.molecule_type || ''}"
                 data-param1-label="${m.param1_label || ''}"
                 data-param2-label="${m.param2_label || ''}"
                 data-param3-label="${m.param3_label || ''}"
                 data-param4-label="${m.param4_label || ''}">${m.molecule_key}</option>`
      ).join('');
      
      // Set molecule value
      const targetKey = criterion.molecule_key || criterion.molecule;
      moleculeSelect.value = targetKey;
      
      // If exact match failed, try case-insensitive
      if (!moleculeSelect.value && targetKey) {
        const lowerTarget = targetKey.toLowerCase();
        for (let i = 0; i < moleculeSelect.options.length; i++) {
          if (moleculeSelect.options[i].value.toLowerCase() === lowerTarget) {
            moleculeSelect.selectedIndex = i;
            break;
          }
        }
      }
      
      document.getElementById('criteriaOperator').value = criterion.operator;
      
      // Handle group vs value based on operator
      if (criterion.operator === 'IN GROUP' || criterion.operator === 'NOT IN GROUP') {
        document.getElementById('groupSelectContainer').style.display = 'block';
        document.getElementById('valueContainer').style.display = 'none';
        await this.loadGroupsForMolecule();
        document.getElementById('criteriaGroup').value = criterion.value;
      } else {
        // Setup value input (may create dropdown for list molecules)
        await this.setupValueInput();
        // Now set the value after the input/dropdown exists
        document.getElementById('criteriaValue').value = criterion.value;
      }
      
      document.getElementById('criteriaLabel').value = criterion.label || '';
      
      // Setup param inputs with existing values
      this.setupParamInputs({
        param1_value: criterion.param1_value,
        param2_value: criterion.param2_value,
        param3_value: criterion.param3_value,
        param4_value: criterion.param4_value
      });
    } else {
      // Add mode
      title.textContent = 'Add Criteria';
      document.getElementById('criteriaSource').value = '';
      document.getElementById('criteriaMolecule').value = '';
      document.getElementById('criteriaMolecule').disabled = true;
      document.getElementById('criteriaOperator').value = 'equals';
      document.getElementById('criteriaValue').value = '';
      document.getElementById('criteriaLabel').value = '';
      // Clear param inputs
      document.getElementById('functionParamsContainer').style.display = 'none';
      document.getElementById('functionParamsContainer').innerHTML = '';
    }
    
    dialog.classList.add('active');
  },

  // Close criteria dialog
  closeDialog: function() {
    document.getElementById('criteriaDialog').classList.remove('active');
    this.editingCriteriaIndex = null;
  },

  // Update molecule dropdown based on source selection
  updateMoleculeOptions: function() {
    const source = document.getElementById('criteriaSource').value;
    const moleculeSelect = document.getElementById('criteriaMolecule');
    
    if (source) {
      moleculeSelect.disabled = false;
      moleculeSelect.innerHTML = this.moleculesBySource[source].map(m => 
        `<option value="${m.molecule_key}" 
                 data-molecule-id="${m.molecule_id}" 
                 data-value-kind="${m.value_kind || ''}"
                 data-molecule-type="${m.molecule_type || ''}"
                 data-param1-label="${m.param1_label || ''}"
                 data-param2-label="${m.param2_label || ''}"
                 data-param3-label="${m.param3_label || ''}"
                 data-param4-label="${m.param4_label || ''}">${m.molecule_key}</option>`
      ).join('');
      this.onMoleculeChange();
    } else {
      moleculeSelect.disabled = true;
      moleculeSelect.innerHTML = '<option value="">Select source first...</option>';
    }
  },

  // When molecule changes, reload available groups and setup value input
  onMoleculeChange: async function() {
    this.loadGroupsForMolecule();
    await this.setupValueInput();
    this.setupParamInputs();
  },

  // Setup function parameter inputs for reference molecules
  setupParamInputs: function(existingValues = {}) {
    const moleculeSelect = document.getElementById('criteriaMolecule');
    const selectedOption = moleculeSelect.options[moleculeSelect.selectedIndex];
    const container = document.getElementById('functionParamsContainer');
    
    if (!selectedOption || !container) return;
    
    const moleculeType = selectedOption.dataset.moleculeType;
    const param1Label = selectedOption.dataset.param1Label;
    const param2Label = selectedOption.dataset.param2Label;
    const param3Label = selectedOption.dataset.param3Label;
    const param4Label = selectedOption.dataset.param4Label;
    
    // Only show for reference molecules with at least one param label
    if (moleculeType !== 'R' || !param1Label) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    
    // Build param input fields
    let html = '<div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 4px;">';
    html += '<div style="font-size: 11px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Function Parameters</div>';
    
    const labels = [param1Label, param2Label, param3Label, param4Label];
    labels.forEach((label, index) => {
      if (label) {
        const paramKey = `param${index + 1}_value`;
        const existingVal = existingValues[paramKey] || '';
        html += `
          <div class="ce-form-group" style="margin-bottom: 8px;">
            <label>${label}</label>
            <input type="text" id="criteriaParam${index + 1}" value="${existingVal}" placeholder="Enter ${label}">
          </div>
        `;
      }
    });
    
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
  },

  // Setup value input based on molecule type
  setupValueInput: async function() {
    const moleculeSelect = document.getElementById('criteriaMolecule');
    const selectedOption = moleculeSelect.options[moleculeSelect.selectedIndex];
    const moleculeKey = moleculeSelect.value;
    const valueContainer = document.getElementById('valueContainer');
    
    if (!moleculeKey) {
      valueContainer.innerHTML = `
        <label>Value</label>
        <input type="text" id="criteriaValue" placeholder="e.g., DL, BOS, Gold">
      `;
      return;
    }
    
    const moleculeId = selectedOption?.dataset?.moleculeId;
    const valueKind = selectedOption?.dataset?.valueKind;
    
    if (valueKind === 'list' || valueKind === 'internal_list') {
      try {
        const response = await fetch(`${this.getApiBase()}/v1/molecules/${moleculeId}/values?tenant_id=${this.getTenantId()}`);
        if (response.ok) {
          const values = await response.json();
          valueContainer.innerHTML = `
            <label>Value</label>
            <select id="criteriaValue">
              <option value="">Select value...</option>
              ${values.map(v => `<option value="${v.value}">${v.value}${v.label ? ' - ' + v.label : ''}</option>`).join('')}
            </select>
          `;
          return;
        }
      } catch (e) {
        console.error('Error loading list values:', e);
      }
    }
    
    valueContainer.innerHTML = `
      <label>Value</label>
      <input type="text" id="criteriaValue" placeholder="e.g., DL, BOS, Gold">
    `;
  },

  // When operator changes, show/hide group selector vs value input
  onOperatorChange: function() {
    const operator = document.getElementById('criteriaOperator').value;
    const groupContainer = document.getElementById('groupSelectContainer');
    const valueContainer = document.getElementById('valueContainer');
    
    if (operator === 'IN GROUP' || operator === 'NOT IN GROUP') {
      groupContainer.style.display = 'block';
      valueContainer.style.display = 'none';
      this.loadGroupsForMolecule();
    } else {
      groupContainer.style.display = 'none';
      valueContainer.style.display = 'block';
    }
  },

  // Load available groups for the selected molecule
  loadGroupsForMolecule: async function() {
    const moleculeKey = document.getElementById('criteriaMolecule').value;
    const groupSelect = document.getElementById('criteriaGroup');
    
    if (!moleculeKey) {
      groupSelect.innerHTML = '<option value="">Select molecule first...</option>';
      return;
    }
    
    try {
      const response = await fetch(`${this.getApiBase()}/v1/molecule-groups?tenant_id=${this.getTenantId()}&molecule_key=${moleculeKey}`);
      if (!response.ok) throw new Error('Failed to load groups');
      
      const groups = await response.json();
      
      if (groups.length === 0) {
        groupSelect.innerHTML = '<option value="">No groups defined for this molecule</option>';
      } else {
        groupSelect.innerHTML = '<option value="">Select a group...</option>' + 
          groups.map(g => `<option value="${g.group_code}">${g.group_code}${g.group_name ? ' - ' + g.group_name : ''} (${g.member_count} members)</option>`).join('');
      }
    } catch (e) {
      console.error('Error loading groups:', e);
      groupSelect.innerHTML = '<option value="">Error loading groups</option>';
    }
  },

  // Get criteria value based on operator type
  getValue: function() {
    const operator = document.getElementById('criteriaOperator').value;
    
    if (operator === 'IN GROUP' || operator === 'NOT IN GROUP') {
      return document.getElementById('criteriaGroup').value;
    } else {
      return document.getElementById('criteriaValue').value;
    }
  },

  // Validate criteria before save
  validate: function(criteria) {
    const operator = document.getElementById('criteriaOperator').value;
    
    if (operator === 'IN GROUP' || operator === 'NOT IN GROUP') {
      if (!criteria.value) {
        alert('Please select a group');
        return false;
      }
    }
    
    if (!criteria.source || !criteria.molecule_key || !criteria.value) {
      alert('Please fill in all required fields');
      return false;
    }
    
    if (!criteria.label || !criteria.label.trim()) {
      alert('Please enter a label for diagnostics (e.g., "Fly on Delta", "Gold member")');
      return false;
    }
    
    return true;
  },

  // Build criteria object from form
  buildCriteria: function() {
    const criteria = {
      source: document.getElementById('criteriaSource').value,
      molecule_key: document.getElementById('criteriaMolecule').value,
      operator: document.getElementById('criteriaOperator').value,
      value: this.getValue(),
      label: document.getElementById('criteriaLabel').value,
      joiner: 'AND'
    };
    
    // Add param values if present
    const param1 = document.getElementById('criteriaParam1');
    const param2 = document.getElementById('criteriaParam2');
    const param3 = document.getElementById('criteriaParam3');
    const param4 = document.getElementById('criteriaParam4');
    
    console.log('buildCriteria - param1 element:', param1);
    console.log('buildCriteria - param1 value:', param1?.value);
    
    if (param1 && param1.value.trim()) criteria.param1_value = param1.value.trim();
    if (param2 && param2.value.trim()) criteria.param2_value = param2.value.trim();
    if (param3 && param3.value.trim()) criteria.param3_value = param3.value.trim();
    if (param4 && param4.value.trim()) criteria.param4_value = param4.value.trim();
    
    console.log('buildCriteria - final criteria:', criteria);
    
    return criteria;
  },

  // Save criteria from dialog
  saveCriteria: function() {
    const criteria = this.buildCriteria();
    
    if (!this.validate(criteria)) {
      return false;
    }

    if (this.editingCriteriaIndex !== null) {
      criteria.joiner = this.criteriaList[this.editingCriteriaIndex].joiner || 'AND';
      this.criteriaList[this.editingCriteriaIndex] = criteria;
    } else {
      this.criteriaList.push(criteria);
    }
    
    this.renderCriteria();
    this.closeDialog();
    return true;
  },

  // Edit criteria
  editCriteria: function(index) {
    this.openDialog(index);
  },

  // Delete criteria
  deleteCriteria: function(index) {
    if (!confirm('Delete this criterion?')) return;
    this.criteriaList.splice(index, 1);
    this.renderCriteria();
  }
};

// Global function wrappers for HTML onclick handlers
function openCriteriaOverlay() {
  let subtitle = '';
  if (typeof getCriteriaOverlaySubtitle === 'function') {
    subtitle = getCriteriaOverlaySubtitle();
  }
  CriteriaEditor.openOverlay(subtitle);
}

function closeCriteriaOverlay() {
  CriteriaEditor.closeOverlay();
}

function openCriteriaDialog() {
  CriteriaEditor.openDialog(null);
}

function closeDialog() {
  CriteriaEditor.closeDialog();
}

function updateMoleculeOptions() {
  CriteriaEditor.updateMoleculeOptions();
}

function onMoleculeChange() {
  CriteriaEditor.onMoleculeChange();
}

function onOperatorChange() {
  CriteriaEditor.onOperatorChange();
}

function saveCriteria() {
  CriteriaEditor.saveCriteria();
}

function renderCriteria() {
  CriteriaEditor.renderCriteria();
}
