/**
 * criteria-editor.js
 * Shared criteria editing functionality for bonus and promotion rule editors
 * 
 * Required HTML elements in consuming page:
 * - #criteriaOverlay (div)
 * - #criteriaOverlaySubtitle (div)
 * - #criteriaList (div)
 * - #rulesEmpty (div)
 * - #criteriaCount (span) - optional
 * - #criteriaDialog (div)
 * - #dialogTitle (h2)
 * - #criteriaSource (select)
 * - #criteriaMolecule (select)
 * - #criteriaOperator (select)
 * - #criteriaGroup (select)
 * - #criteriaValue (input)
 * - #criteriaLabel (input)
 * - #groupSelectContainer (div)
 * - #valueContainer (div)
 * 
 * Required in consuming page:
 * - window.API_BASE (or set before including this script)
 * - Call CriteriaEditor.init(entityType) on page load
 * - Call CriteriaEditor.loadCriteria(entityId) to load existing criteria
 * - Access CriteriaEditor.criteriaList to get criteria for saving
 */

// Global API_BASE for backward compatibility with pages that expect it
const API_BASE = window.API_BASE || window.LP_STATE?.apiBase || 'http://127.0.0.1:4001';

const CriteriaEditor = {
  
  // State
  criteriaList: [],
  editingCriteriaIndex: null,
  entityType: 'bonus', // 'bonus' or 'promotion'
  
  // Molecules loaded from API - store full objects for metadata
  moleculesBySource: {
    Activity: [],
    Member: []
  },

  // Initialize the criteria editor
  init: function(entityType = 'bonus') {
    this.entityType = entityType;
    this.criteriaList = [];
    this.editingCriteriaIndex = null;
    this.loadMolecules();
  },

  // Get API base URL
  getApiBase: function() {
    return window.API_BASE || 'http://127.0.0.1:4001';
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
      console.log('Tenant ID:', tenantId);
      
      // Load Activity molecules
      const activityUrl = `${this.getApiBase()}/v1/molecules/by-source/Activity?tenant_id=${tenantId}`;
      console.log('Fetching Activity molecules from:', activityUrl);
      const activityRes = await fetch(activityUrl);
      console.log('Activity response status:', activityRes.status);
      
      if (activityRes.ok) {
        const activityMolecules = await activityRes.json();
        console.log('Activity molecules received:', activityMolecules);
        this.moleculesBySource.Activity = activityMolecules;
        console.log('Activity molecule keys:', this.moleculesBySource.Activity.map(m => m.molecule_key));
      } else {
        const errorText = await activityRes.text();
        console.error('Failed to load Activity molecules:', errorText);
      }
      
      // Load Member molecules
      const memberUrl = `${this.getApiBase()}/v1/molecules/by-source/Member?tenant_id=${tenantId}`;
      console.log('Fetching Member molecules from:', memberUrl);
      const memberRes = await fetch(memberUrl);
      console.log('Member response status:', memberRes.status);
      
      if (memberRes.ok) {
        const memberMolecules = await memberRes.json();
        console.log('Member molecules received:', memberMolecules);
        this.moleculesBySource.Member = memberMolecules;
        console.log('Member molecule keys:', this.moleculesBySource.Member.map(m => m.molecule_key));
      } else {
        const errorText = await memberRes.text();
        console.error('Failed to load Member molecules:', errorText);
      }
      
      console.log('Final moleculesBySource:', this.moleculesBySource);
    } catch (error) {
      console.error('Error loading molecules:', error);
      // Fallback to basic set if API fails
      this.moleculesBySource = {
        Activity: [{molecule_key: 'carrier'}, {molecule_key: 'origin'}, {molecule_key: 'destination'}, {molecule_key: 'fare_class'}],
        Member: [{molecule_key: 'tier'}, {molecule_key: 'state'}]
      };
      console.log('Using fallback moleculesBySource:', this.moleculesBySource);
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
        console.log('Loaded criteria:', this.criteriaList.length);
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

    if (this.criteriaList.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      container.style.display = 'flex';
      emptyState.style.display = 'none';

      container.innerHTML = this.criteriaList.map((c, index) => {
        // Show joiner between criteria (not after last one)
        const joinerHtml = index < this.criteriaList.length - 1 ? `
          <div class="joiner-row">
            <select class="joiner-select" onchange="CriteriaEditor.updateJoiner(${index}, this.value)">
              <option value="AND" ${c.joiner === 'AND' ? 'selected' : ''}>AND</option>
              <option value="OR" ${c.joiner === 'OR' ? 'selected' : ''}>OR</option>
            </select>
          </div>
        ` : '';

        return `
          <div>
            <div class="criteria-item">
              <div class="criteria-header">${c.source} Criteria</div>
              <div class="criteria-body">
                <select disabled style="background: #f9fafb;">
                  <option>${c.source}.${c.molecule_key || c.molecule}</option>
                </select>
                <select disabled style="background: #f9fafb;">
                  <option>${c.operator}</option>
                </select>
                <input type="text" value="${c.value}" disabled style="background: #f9fafb;">
                <input type="text" value="${c.label}" placeholder="Label for diagnostics" disabled style="background: #f9fafb;">
                <div class="action-buttons">
                  <button class="btn btn-secondary btn-sm" onclick="CriteriaEditor.editCriteria(${index})" title="Edit criteria">✏️ Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="CriteriaEditor.deleteCriteria(${index})" title="Delete criteria">🗑️ Delete</button>
                </div>
                <div class="criteria-label-row">
                  <strong>Label:</strong> "${c.label}"
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
      
      this.updateMoleculeOptions();
      
      // Set molecule value - try exact match first, then case-insensitive
      const moleculeSelect = document.getElementById('criteriaMolecule');
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
        this.loadGroupsForMolecule().then(() => {
          document.getElementById('criteriaGroup').value = criterion.value;
        });
      } else {
        document.getElementById('criteriaValue').value = criterion.value;
      }
      
      document.getElementById('criteriaLabel').value = criterion.label || '';
    } else {
      // Add mode
      title.textContent = 'Add Criteria';
      document.getElementById('criteriaSource').value = '';
      document.getElementById('criteriaMolecule').value = '';
      document.getElementById('criteriaMolecule').disabled = true;
      document.getElementById('criteriaOperator').value = 'equals';
      document.getElementById('criteriaValue').value = '';
      document.getElementById('criteriaLabel').value = '';
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
        `<option value="${m.molecule_key}" data-molecule-id="${m.molecule_id}" data-value-kind="${m.value_kind || ''}">${m.molecule_key}</option>`
      ).join('');
      // Setup value input for the first molecule
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
  },

  // Setup value input based on molecule type (dropdown for lists, text for others)
  setupValueInput: async function() {
    const moleculeSelect = document.getElementById('criteriaMolecule');
    const selectedOption = moleculeSelect.options[moleculeSelect.selectedIndex];
    const moleculeKey = moleculeSelect.value;
    const valueContainer = document.getElementById('valueContainer');
    
    if (!moleculeKey) {
      // Reset to text input
      valueContainer.innerHTML = `
        <label>Value</label>
        <input type="text" id="criteriaValue" placeholder="e.g., DL, BOS, Gold">
      `;
      return;
    }
    
    // Get molecule metadata from data attributes
    const moleculeId = selectedOption?.dataset?.moleculeId;
    const valueKind = selectedOption?.dataset?.valueKind;
    
    // Check if this is a list molecule
    if (valueKind === 'list' || valueKind === 'internal_list') {
      try {
        // Fetch list values
        const response = await fetch(`${this.getApiBase()}/v1/molecules/${moleculeId}/values?tenant_id=${this.getTenantId()}`);
        if (response.ok) {
          const values = await response.json();
          
          // Create dropdown
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
    
    // Default: text input
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
    return {
      source: document.getElementById('criteriaSource').value,
      molecule_key: document.getElementById('criteriaMolecule').value,
      operator: document.getElementById('criteriaOperator').value,
      value: this.getValue(),
      label: document.getElementById('criteriaLabel').value,
      joiner: 'AND'
    };
  },

  // Save criteria from dialog
  saveCriteria: function() {
    const criteria = this.buildCriteria();
    
    if (!this.validate(criteria)) {
      return false;
    }

    if (this.editingCriteriaIndex !== null) {
      // Preserve existing joiner when editing
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
  // Get subtitle from page-specific function if it exists
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
