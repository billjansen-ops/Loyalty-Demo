/**
 * Template Form Renderer v1.0
 * 
 * Dynamically renders activity input forms based on input templates.
 * Uses molecule definitions for field types, labels, and display widths.
 * 
 * Usage:
 *   const renderer = new TemplateFormRenderer(apiBase, tenantId);
 *   await renderer.loadTemplateByActivityType('A');  // or loadTemplateById(id)
 *   container.innerHTML = renderer.renderHTML();
 *   await renderer.initializeFields();
 *   const data = renderer.getFormData();
 */

class TemplateFormRenderer {
  constructor(apiBase, tenantId) {
    this.apiBase = apiBase || 'http://127.0.0.1:4001';
    this.tenantId = tenantId || '1';
    this.template = null;
    this.molecules = {};  // Cache of molecule definitions
    this.moleculeValues = {};  // Cache of dropdown values
    this.currencyLabel = 'Base Miles';  // Default, will be loaded from tenant
    this.activityType = 'A';  // Current activity type
    this.pointsMode = 'manual';  // 'manual' or 'calculated'
    this.calcFunction = null;  // Function name for calculation
    this.dataEditFunction = null;  // Function name for data edit
  }

  /**
   * Load activity type processing settings from sysparm
   * @param {string} activityType - Activity type code (e.g., 'A', 'P', 'R')
   */
  async loadActivityTypeSettings(activityType) {
    this.activityType = activityType;
    try {
      const [modeRes, calcRes, editRes] = await Promise.all([
        fetch(`${this.apiBase}/v1/sysparm/${activityType}/points_mode?tenant_id=${this.tenantId}`),
        fetch(`${this.apiBase}/v1/sysparm/${activityType}/calc_function?tenant_id=${this.tenantId}`),
        fetch(`${this.apiBase}/v1/sysparm/${activityType}/data_edit_function?tenant_id=${this.tenantId}`)
      ]);
      
      if (modeRes.ok) {
        const data = await modeRes.json();
        this.pointsMode = data.value || 'manual';
      }
      if (calcRes.ok) {
        const data = await calcRes.json();
        this.calcFunction = data.value || null;
      }
      if (editRes.ok) {
        const data = await editRes.json();
        this.dataEditFunction = data.value || null;
      }
      
      console.log(`Activity type ${activityType} settings: pointsMode=${this.pointsMode}, calcFunction=${this.calcFunction}, dataEditFunction=${this.dataEditFunction}`);
    } catch (error) {
      console.warn('Could not load activity type settings:', error);
    }
  }

  /**
   * Load tenant labels (currency label, etc.)
   */
  async loadTenantLabels() {
    try {
      const response = await fetch(`${this.apiBase}/v1/tenants/${this.tenantId}/labels`);
      if (response.ok) {
        const labels = await response.json();
        if (labels.currency_label) {
          this.currencyLabel = labels.currency_label;
        }
      }
    } catch (error) {
      console.warn('Could not load tenant labels:', error);
    }
  }

  /**
   * Load template by activity type code (exact match)
   * @param {string} activityTypeCode - Activity type code (e.g., 'A', 'P', 'R')
   */
  async loadTemplateByActivityType(activityTypeCode) {
    try {
      const response = await fetch(`${this.apiBase}/v1/input-templates?tenant_id=${this.tenantId}`);
      if (!response.ok) throw new Error('Failed to load templates');
      
      const templates = await response.json();
      console.log('Available templates:', templates.map(t => ({ name: t.template_name, activity_type: t.activity_type })));
      console.log('Looking for activity_type:', activityTypeCode);
      
      // Exact match on activity_type code
      this.template = templates.find(t => t.activity_type === activityTypeCode);
      
      if (!this.template) {
        console.warn(`No template found for activity type: ${activityTypeCode}`);
        return false;
      }
      
      console.log('Found template:', this.template.template_name);

      // Load template details
      const detailResponse = await fetch(`${this.apiBase}/v1/input-templates/${this.template.template_id}`);
      if (!detailResponse.ok) throw new Error('Failed to load template details');
      
      this.template = await detailResponse.json();
      console.log('Template details:', this.template);
      console.log('Template lines:', this.template.lines);
      
      // Pre-load molecule definitions for all fields
      await this.loadMoleculeDefinitions();
      
      // Load tenant labels (currency, etc.)
      await this.loadTenantLabels();
      
      // Load activity type processing settings (points mode, calc function, etc.)
      await this.loadActivityTypeSettings(activityTypeCode);
      
      return true;
    } catch (error) {
      console.error('Error loading template:', error);
      return false;
    }
  }

  /**
   * Load template by ID
   */
  async loadTemplateById(templateId) {
    try {
      const response = await fetch(`${this.apiBase}/v1/input-templates/${templateId}`);
      if (!response.ok) throw new Error('Failed to load template');
      
      this.template = await response.json();
      await this.loadMoleculeDefinitions();
      await this.loadTenantLabels();
      
      return true;
    } catch (error) {
      console.error('Error loading template:', error);
      return false;
    }
  }

  /**
   * Load molecule definitions for all fields in template
   */
  async loadMoleculeDefinitions() {
    if (!this.template?.lines) return;

    const moleculeKeys = new Set();
    
    for (const line of this.template.lines) {
      const fields = this.parseTemplateString(line.template_string);
      console.log(`Line ${line.line_number} parsed fields:`, fields);
      for (const field of fields) {
        moleculeKeys.add(field.molecule_key);
      }
    }
    
    console.log('Molecule keys needed:', [...moleculeKeys]);

    // Fetch each molecule definition individually (same as activity-input-fields.js)
    const fetchPromises = [...moleculeKeys].map(async (key) => {
      try {
        const response = await fetch(`${this.apiBase}/v1/molecules/get/${key}?tenant_id=${this.tenantId}`);
        if (response.ok) {
          const mol = await response.json();
          this.molecules[key] = mol;
          console.log(`Loaded molecule: ${key}, value_kind: ${mol.value_kind}, molecule_id: ${mol.molecule_id}`);
        } else {
          console.warn(`Failed to load molecule ${key}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error loading molecule ${key}:`, error);
      }
    });
    
    await Promise.all(fetchPromises);
    console.log('Molecules loaded:', Object.keys(this.molecules));
  }

  /**
   * Parse template string into field objects
   * Format: [M,molecule_key,"width",R/O,"prompt"],[M,...]
   *         [T,"text","width"]
   * or legacy: {molecule_key:width:required:prompt}
   */
  parseTemplateString(templateString) {
    if (!templateString) return [];
    
    const fields = [];
    
    // Try new molecule format: [M,molecule_key,"width",R/O,"prompt"]
    const molPattern = /\[M,([^,]+),"([^"]+)",(R|O)(?:,"([^"]*)")?\]/g;
    let match;
    
    while ((match = molPattern.exec(templateString)) !== null) {
      fields.push({
        type: 'molecule',
        molecule_key: match[1],
        width: match[2],
        required: match[3] === 'R',
        prompt: match[4] || ''
      });
    }
    
    // Parse text components: [T,"text"] - no width (auto)
    const textPattern = /\[T,"([^"]+)"\]/g;
    while ((match = textPattern.exec(templateString)) !== null) {
      fields.push({
        type: 'text',
        text: match[1]
      });
    }
    
    // Parse label components: [L,molecule_key] - display only
    const labelPattern = /\[L,([^\]]+)\]/g;
    while ((match = labelPattern.exec(templateString)) !== null) {
      fields.push({
        type: 'label',
        molecule_key: match[1]
      });
    }
    
    // If no matches, try legacy format: {molecule_key:width:required:prompt}
    if (fields.length === 0) {
      const legacyPattern = /\{([^}]+)\}/g;
      while ((match = legacyPattern.exec(templateString)) !== null) {
        const parts = match[1].split(':');
        fields.push({
          molecule_key: parts[0],
          width: parts[1] || 'third',
          required: parts[2] !== 'false',
          prompt: parts[3] || ''
        });
      }
    }
    
    return fields;
  }

  /**
   * Get width as percentage number
   */
  getWidthPercent(width) {
    const nameMap = {
      'quarter': 25,
      'third': 33,
      'half': 50,
      'three-quarters': 75,
      'full': 100
    };
    
    if (typeof width === 'number') return width;
    if (!isNaN(parseInt(width))) return parseInt(width);
    return nameMap[width] || 33;
  }

  /**
   * Convert percentage to 12-column grid span
   */
  getGridSpan(pct) {
    if (pct >= 100) return 12;
    if (pct >= 75) return 9;
    if (pct >= 67) return 8;
    if (pct >= 50) return 6;
    if (pct >= 33) return 4;
    if (pct >= 25) return 3;
    return 4; // default to 1/3
  }

  /**
   * Render the form HTML
   */
  renderHTML(options = {}) {
    const { includeMemberId = false, includeActivityDate = true, includeBaseMiles = true, cssClass = 'template-form' } = options;
    
    if (!this.template?.lines) {
      return '<p style="color: #999;">No template loaded</p>';
    }

    let html = `<div class="${cssClass}">`;
    
    // Optional member ID field
    if (includeMemberId) {
      html += `
        <div class="template-row">
          <div class="template-field" data-span="12">
            <label class="template-label" for="tpl_memberId">Member ID <span class="required">*</span></label>
            <input class="template-input" type="text" id="tpl_memberId" data-field="member_id" required>
          </div>
        </div>
      `;
    }
    
    // Activity date (usually needed)
    if (includeActivityDate) {
      html += `
        <div class="template-row">
          <div class="template-field" data-span="4">
            <label class="template-label" for="tpl_activityDate">Activity Date <span class="required">*</span></label>
            <input class="template-input" type="date" id="tpl_activityDate" data-field="activity_date" required style="max-width: 180px;">
          </div>
        </div>
      `;
    }

    // Render template lines
    const lines = [...this.template.lines].sort((a, b) => a.line_number - b.line_number);
    
    for (const line of lines) {
      const fields = this.parseTemplateString(line.template_string);
      
      html += '<div class="template-row">';
      
      for (const field of fields) {
        const pct = this.getWidthPercent(field.width);
        const span = this.getGridSpan(pct);
        
        // Handle text components - auto width (shrink to content)
        if (field.type === 'text') {
          html += `
            <div class="template-text" style="grid-column: span 2;">
              <span class="template-text-content">${field.text}</span>
            </div>
          `;
          continue;
        }
        
        // Handle label components - display molecule value (read-only)
        if (field.type === 'label') {
          const mol = this.molecules[field.molecule_key];
          const label = mol?.label || field.molecule_key;
          const fieldId = `tpl_label_${field.molecule_key}`;
          html += `
            <div class="template-label-display" style="grid-column: span 4; background: #fef3c7; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px;">
              <span class="template-label-name" style="font-weight: 600; color: #92400e;">${label}:</span>
              <span class="template-label-value" id="${fieldId}" data-molecule="${field.molecule_key}" style="color: #78350f;">[loading...]</span>
            </div>
          `;
          continue;
        }
        
        // Handle molecule fields - grid span based on percentage
        const mol = this.molecules[field.molecule_key];
        const label = field.prompt || mol?.label || field.molecule_key;
        const isDropdown = mol?.value_kind === 'lookup' || mol?.value_kind === 'list' || mol?.value_kind === 'embedded_list';
        const isTypeahead = isDropdown && mol?.input_type === 'T';
        const fieldId = `tpl_${field.molecule_key}`;
        
        // Calculate input width style for text inputs
        let inputStyle = '';
        if (!isDropdown && mol?.display_width) {
          inputStyle = `width: ${mol.display_width * 1.2}em; max-width: ${mol.display_width * 1.2}em;`;
          console.log(`Field ${field.molecule_key}: applying display_width ${mol.display_width} -> ${inputStyle}`);
        }
        
        html += `
          <div class="template-field" data-span="${span}">
            <label class="template-label" for="${fieldId}">${label}${field.required ? ' <span class="required">*</span>' : ''}</label>
        `;
        
        if (isTypeahead) {
          // Typeahead for large lookup lists
          html += `
            <div class="typeahead-container" style="position: relative;">
              <input class="template-input typeahead-input" type="text" id="${fieldId}" 
                     data-molecule="${field.molecule_key}" 
                     placeholder="Type code or city..."
                     autocomplete="off"
                     ${field.required ? 'required' : ''}>
              <input type="hidden" id="${fieldId}_code" data-molecule="${field.molecule_key}" class="typeahead-value">
              <div class="typeahead-dropdown" id="${fieldId}_dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"></div>
            </div>
          `;
        } else if (isDropdown) {
          html += `
            <select class="template-input template-select" id="${fieldId}" data-molecule="${field.molecule_key}" ${field.required ? 'required' : ''}>
              <option value="">-- Select ${label.replace(' *', '')} --</option>
            </select>
          `;
        } else {
          // Determine input type based on scalar_type
          const scalarType = mol?.scalar_type || 'text';
          let inputType = 'text';
          let inputAttrs = '';
          
          if (scalarType === 'numeric') {
            inputType = 'number';
            inputAttrs = 'step="any"';
          } else if (scalarType === 'date') {
            inputType = 'date';
          }
          
          html += `
            <input class="template-input" type="${inputType}" id="${fieldId}" data-molecule="${field.molecule_key}" ${field.required ? 'required' : ''} ${inputAttrs} style="${inputStyle}">
          `;
        }
        
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    // Base miles/points field (core activity field, not a molecule)
    if (includeBaseMiles) {
      const currencyLabel = `Base ${this.currencyLabel || 'Miles'}`;
      const isCalculated = this.pointsMode === 'calculated';
      const readonlyAttr = isCalculated ? 'readonly' : '';
      const defaultValue = isCalculated ? '' : '1000';
      const hint = isCalculated ? '<span class="calc-hint" style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">(auto-calculated)</span>' : '';
      const requiredMark = isCalculated ? '' : '<span class="required">*</span>';
      
      html += `
        <div class="template-row">
          <div class="template-field" data-span="4">
            <label class="template-label" for="tpl_baseMiles">${currencyLabel} ${requiredMark}${hint}</label>
            <input class="template-input" type="number" id="tpl_baseMiles" data-field="base_miles" value="${defaultValue}" min="0" ${readonlyAttr} ${isCalculated ? '' : 'required'} style="max-width: 120px; ${isCalculated ? 'background: var(--bg-secondary);' : ''}">
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    
    return html;
  }

  /**
   * Initialize all form fields (load dropdown values, set defaults)
   */
  async initializeFields() {
    // Set today's date as default
    const dateField = document.getElementById('tpl_activityDate');
    if (dateField) {
      dateField.value = new Date().toLocaleDateString('en-CA');
    }

    // Set up typeahead for all typeahead inputs
    const typeaheadInputs = document.querySelectorAll('.typeahead-input');
    for (const input of typeaheadInputs) {
      this.setupTypeahead(input.id);
    }

    // Load dropdown values for each molecule
    const dropdowns = document.querySelectorAll('.template-select');
    const loadPromises = [];
    
    for (const select of dropdowns) {
      const moleculeKey = select.dataset.molecule;
      if (moleculeKey) {
        loadPromises.push(this.loadDropdownValues(moleculeKey, select.id));
      }
    }
    
    await Promise.all(loadPromises);
    
    // Set up auto-calculation for miles if pointsMode is 'calculated'
    if (this.pointsMode === 'calculated') {
      this.setupMilesCalculation();
    }
    
    // Populate label values (display-only fields)
    const labels = document.querySelectorAll('.template-label-value');
    for (const label of labels) {
      const moleculeKey = label.dataset.molecule;
      if (moleculeKey) {
        // Labels display context-specific values
        // For now, show molecule label or "N/A" - actual values loaded when member context available
        const mol = this.molecules[moleculeKey];
        if (mol) {
          label.textContent = mol.label || moleculeKey;
        } else {
          label.textContent = 'N/A';
        }
      }
    }
  }

  /**
   * Set up typeahead for airport fields
   */
  setupTypeahead(inputId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(`${inputId}_dropdown`);
    const hiddenInput = document.getElementById(`${inputId}_code`);
    
    if (!input || !dropdown || !hiddenInput) {
      return;
    }
    
    let debounceTimer;
    
    input.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      
      // Clear hidden value when typing
      hiddenInput.value = '';
      
      clearTimeout(debounceTimer);
      
      if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      
      debounceTimer = setTimeout(async () => {
        try {
          const response = await fetch(`${this.apiBase}/v1/airports/search?q=${encodeURIComponent(query)}`);
          if (!response.ok) return;
          
          const airports = await response.json();
          
          if (airports.length === 0) {
            dropdown.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted);">No results found</div>';
            dropdown.style.display = 'block';
            return;
          }
          
          dropdown.innerHTML = airports.map(a => `
            <div class="typeahead-item" data-code="${a.code}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
              <strong>${a.code}</strong> - ${a.name}${a.city ? `, ${a.city}` : ''}
            </div>
          `).join('');
          
          dropdown.style.display = 'block';
          
          // Add click handlers
          dropdown.querySelectorAll('.typeahead-item').forEach(item => {
            item.addEventListener('click', () => {
              const code = item.dataset.code;
              input.value = item.textContent.trim();
              hiddenInput.value = code;
              dropdown.style.display = 'none';
              
              // Dispatch change event for miles calculation
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
            
            item.addEventListener('mouseenter', () => {
              item.style.background = 'var(--bg-secondary)';
            });
            item.addEventListener('mouseleave', () => {
              item.style.background = 'white';
            });
          });
          
        } catch (err) {
          console.error('Typeahead search error:', err);
        }
      }, 200);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
    
    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });
  }

  /**
   * Set up auto-calculation for miles when origin/destination change
   */
  setupMilesCalculation() {
    const originHidden = document.getElementById('tpl_origin_code');
    const destHidden = document.getElementById('tpl_destination_code');
    const milesInput = document.getElementById('tpl_baseMiles');
    
    if (!originHidden || !destHidden || !milesInput) {
      console.warn('Could not find origin, destination, or miles fields for auto-calculation');
      return;
    }
    
    const calculateMiles = async () => {
      const origin = originHidden.value;
      const destination = destHidden.value;
      
      if (!origin || !destination) {
        milesInput.value = '';
        return;
      }
      
      try {
        milesInput.value = '...';
        const response = await fetch(`${this.apiBase}/v1/calculate-miles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: this.tenantId,
            activity_type: this.activityType,
            origin,
            destination
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          milesInput.value = result.miles;
          console.log(`Calculated miles: ${result.miles} (cached: ${result.cached})`);
        } else {
          const error = await response.json();
          console.warn('Miles calculation failed:', error);
          milesInput.value = '';
        }
      } catch (e) {
        console.error('Error calculating miles:', e);
        milesInput.value = '';
      }
    };
    
    originHidden.addEventListener('change', calculateMiles);
    destHidden.addEventListener('change', calculateMiles);
  }
  
  /**
   * Set a label value (for display-only fields)
   * Call this when member/context data is available
   */
  setLabelValue(moleculeKey, value) {
    const label = document.getElementById(`tpl_label_${moleculeKey}`);
    if (label) {
      label.textContent = value || 'N/A';
    }
  }

  /**
   * Load dropdown values for a molecule
   */
  async loadDropdownValues(moleculeKey, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
      const mol = this.molecules[moleculeKey];
      if (!mol) {
        console.warn(`No molecule definition found for ${moleculeKey}`);
        return;
      }
      
      console.log(`Loading dropdown for ${moleculeKey}, value_kind: ${mol.value_kind}`);

      let values = [];

      if (mol.value_kind === 'list') {
        // Internal list - get values from molecule_list_value
        const url = `${this.apiBase}/v1/molecules/${mol.molecule_id}/values?tenant_id=${this.tenantId}`;
        console.log(`Fetching list values from: ${url}`);
        const response = await fetch(url);
        if (response.ok) {
          values = await response.json();
          console.log(`Got ${values.length} list values for ${moleculeKey}`);
        } else {
          console.error(`Failed to load list values: ${response.status}`);
        }
      } else if (mol.value_kind === 'lookup') {
        // External lookup - get from lookup-values endpoint
        const url = `${this.apiBase}/v1/lookup-values/${moleculeKey}?tenant_id=${this.tenantId}`;
        console.log(`Fetching lookup values from: ${url}`);
        const response = await fetch(url);
        if (response.ok) {
          values = await response.json();
          console.log(`Got ${values.length} lookup values for ${moleculeKey}`);
        } else {
          console.error(`Failed to load lookup values: ${response.status}`);
        }
      } else if (mol.value_kind === 'embedded_list') {
        // Embedded list - for now, skip as it needs category selection
        console.warn(`embedded_list molecule ${moleculeKey} not yet supported in template renderer`);
      }

      // Cache values
      this.moleculeValues[moleculeKey] = values;

      // Populate dropdown
      const label = mol.label || moleculeKey;
      select.innerHTML = `<option value="">-- Select ${label} --</option>`;
      
      for (const val of values) {
        // Handle different response formats
        const code = val.code || val.lookup_code || val.value_code || val.value;
        const display = val.name || val.label || val.display_value || val.description || code;
        // Show code and name like: "MSP - Minneapolis"
        const displayText = display !== code ? `${code} - ${display}` : code;
        select.innerHTML += `<option value="${code}">${displayText}</option>`;
      }
    } catch (error) {
      console.error(`Error loading dropdown for ${moleculeKey}:`, error);
      select.innerHTML = '<option value="">Error loading options</option>';
    }
  }

  /**
   * Get form data as object
   */
  getFormData() {
    const data = {};
    
    // Get values from typeahead hidden inputs first
    const typeaheadValues = document.querySelectorAll('.typeahead-value');
    for (const hidden of typeaheadValues) {
      const moleculeKey = hidden.dataset.molecule;
      if (moleculeKey && hidden.value) {
        data[moleculeKey] = hidden.value;
      }
    }
    
    // Get all template inputs
    const inputs = document.querySelectorAll('.template-input');
    
    for (const input of inputs) {
      // Skip typeahead display inputs (we already got values from hidden inputs)
      if (input.classList.contains('typeahead-input')) {
        continue;
      }
      
      // Check for molecule key (template-defined fields)
      const moleculeKey = input.dataset.molecule;
      if (moleculeKey && !data[moleculeKey]) {
        data[moleculeKey] = input.value;
      }
      
      // Check for field key (built-in fields like activity_date, base_miles)
      const fieldKey = input.dataset.field;
      if (fieldKey) {
        data[fieldKey] = input.value;
      }
    }
    
    return data;
  }

  /**
   * Validate form
   * @returns {{ isValid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    const requiredInputs = document.querySelectorAll('.template-input[required]');
    
    for (const input of requiredInputs) {
      // For typeahead inputs, check the hidden input value
      if (input.classList.contains('typeahead-input')) {
        const hiddenId = input.id + '_code';
        const hiddenInput = document.getElementById(hiddenId);
        if (!hiddenInput || !hiddenInput.value || hiddenInput.value.trim() === '') {
          const label = input.closest('.template-field')?.querySelector('.template-label')?.textContent?.replace(' *', '') || 
                        input.dataset.molecule || 
                        'Field';
          errors.push(`${label} is required`);
        }
      } else if (!input.value || input.value.trim() === '') {
        const label = input.previousElementSibling?.textContent?.replace(' *', '') || 
                      input.dataset.molecule || 
                      input.dataset.field || 
                      'Field';
        errors.push(`${label} is required`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get CSS styles for template forms
   */
  static getStyles() {
    return `
      .template-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .template-row {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 16px;
        align-items: end;
      }
      
      .template-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      
      /* Grid span classes based on column count */
      .template-field[data-span="3"] { grid-column: span 3; }
      .template-field[data-span="4"] { grid-column: span 4; }
      .template-field[data-span="6"] { grid-column: span 6; }
      .template-field[data-span="8"] { grid-column: span 8; }
      .template-field[data-span="9"] { grid-column: span 9; }
      .template-field[data-span="12"] { grid-column: span 12; }
      
      .template-label {
        font-size: 13px;
        font-weight: 600;
        color: #374151;
      }
      
      .template-label .required {
        color: #dc2626;
      }
      
      .template-input {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 14px;
        width: 100%;
        box-sizing: border-box;
      }
      
      .template-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      .template-select {
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 8px center;
        background-repeat: no-repeat;
        background-size: 16px;
        padding-right: 32px;
      }
      
      .template-text {
        display: flex;
        align-items: center;
        min-width: 0;
      }
      
      .template-text-content {
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        padding: 8px 0;
      }
    `;
  }
}

// Export for use
window.TemplateFormRenderer = TemplateFormRenderer;
