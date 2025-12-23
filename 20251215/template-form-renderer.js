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
      console.log('Template fields:', this.template.fields);
      
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
    if (!this.template?.fields) return;

    const moleculeKeys = new Set();
    
    // New structure: template.fields is already an array of field objects
    for (const field of this.template.fields) {
      if (field.molecule_key) {
        moleculeKeys.add(field.molecule_key);
      }
    }
    
    console.log('Molecule keys needed:', [...moleculeKeys]);

    // Fetch each molecule definition individually
    const fetchPromises = [...moleculeKeys].map(async (key) => {
      const url = `${this.apiBase}/v1/molecules/get/${key}?tenant_id=${this.tenantId}`;
      console.log(`Fetching molecule: ${key} from ${url}`);
      try {
        const response = await fetch(url);
        console.log(`Response for ${key}: status=${response.status}`);
        if (response.ok) {
          const mol = await response.json();
          this.molecules[key] = mol;
          console.log(`✓ Loaded molecule: ${key}, value_kind: ${mol.value_kind}, input_type: ${mol.input_type}, molecule_id: ${mol.molecule_id}`);
        } else {
          const errorText = await response.text();
          console.warn(`✗ Failed to load molecule ${key}: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.error(`✗ Error loading molecule ${key}:`, error);
      }
    });
    
    await Promise.all(fetchPromises);
    console.log('Molecules loaded:', Object.keys(this.molecules));
    console.log('Full molecules object:', this.molecules);
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
    let match;
    
    // Try new flags format: [M,molecule_key,"width","flags","prompt"]
    // flags: R=required, U=uppercase, N=numeric, - = none
    const newFlagsPattern = /\[M,([^,]+),"([^"]+)","([^"]+)"(?:,"([^"]*)")?\]/g;
    
    while ((match = newFlagsPattern.exec(templateString)) !== null) {
      const flags = match[3];
      fields.push({
        type: 'molecule',
        molecule_key: match[1],
        width: match[2],
        required: flags.includes('R'),
        uppercase: flags.includes('U'),
        numeric: flags.includes('N'),
        prompt: match[4] || ''
      });
    }
    
    // Try old molecule format: [M,molecule_key,"width",R/O,"prompt"]
    const oldMolPattern = /\[M,([^,]+),"([^"]+)",(R|O)(?:,"([^"]*)")?\]/g;
    
    while ((match = oldMolPattern.exec(templateString)) !== null) {
      fields.push({
        type: 'molecule',
        molecule_key: match[1],
        width: match[2],
        required: match[3] === 'R',
        uppercase: false,
        numeric: false,
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
          uppercase: false,
          numeric: false,
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
    
    if (!this.template?.fields || this.template.fields.length === 0) {
      return '<p style="color: #999;">No template loaded</p>';
    }

    let html = `<div class="${cssClass}">`;
    
    // Optional member ID field
    if (includeMemberId) {
      html += `
        <div class="template-row">
          <div class="template-field" data-span="12">
            <label class="template-label" for="tpl_memberId">Membership Number <span class="required">*</span></label>
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

    // Group fields by row_number
    const fieldsByRow = {};
    for (const field of this.template.fields) {
      const rowNum = field.row_number;
      if (!fieldsByRow[rowNum]) {
        fieldsByRow[rowNum] = [];
      }
      fieldsByRow[rowNum].push(field);
    }
    
    // Sort rows and render
    const rowNumbers = Object.keys(fieldsByRow).map(Number).sort((a, b) => a - b);
    
    for (const rowNum of rowNumbers) {
      const fields = fieldsByRow[rowNum].sort((a, b) => a.sort_order - b.sort_order);
      
      html += '<div class="template-row">';
      
      for (const field of fields) {
        // Convert 100-column grid to 12-column grid span
        const pct = field.display_width || 50;
        const span = this.getGridSpan(pct);
        
        // Check if field is enterable (user input) or system-generated
        const isEnterable = field.enterable !== 'N';
        
        // Handle molecule fields
        const mol = this.molecules[field.molecule_key];
        const label = field.display_label || mol?.label || field.molecule_key;
        // Support both old and new value_kind names
        const vk = mol?.value_kind;
        const isDropdown = vk === 'lookup' || vk === 'external_list' || vk === 'list' || vk === 'internal_list' || vk === 'embedded_list';
        const isTypeahead = isDropdown && mol?.input_type === 'T';
        
        console.log(`Rendering field ${field.molecule_key}: mol=${!!mol}, vk=${vk}, input_type=${mol?.input_type}, isDropdown=${isDropdown}, isTypeahead=${isTypeahead}, label=${label}, enterable=${isEnterable}`);
        const fieldId = `tpl_${field.molecule_key}`;
        
        // Calculate input width style for text inputs
        let inputStyle = '';
        if (!isDropdown && field.field_width) {
          inputStyle = `width: ${field.field_width}em; max-width: ${field.field_width}em;`;
        } else if (!isDropdown && mol?.display_width) {
          inputStyle = `width: ${mol.display_width * 1.2}em; max-width: ${mol.display_width * 1.2}em;`;
        }
        
        // Non-enterable fields (system-generated)
        if (!isEnterable) {
          html += `
            <div class="template-field" data-span="${span}">
              <label class="template-label" for="${fieldId}">${label} <span style="color: #9ca3af; font-size: 10px;">🔒 auto</span></label>
              <input class="template-input" type="text" id="${fieldId}" data-molecule="${field.molecule_key}" 
                     data-system-generated="${field.system_generated || ''}" 
                     readonly style="background: #fef3c7; ${inputStyle}">
            </div>
          `;
          continue;
        }
        
        html += `
          <div class="template-field" data-span="${span}">
            <label class="template-label" for="${fieldId}">${label}${field.is_required ? ' <span class="required">*</span>' : ''}</label>
        `;
        
        if (isTypeahead) {
          // Typeahead for large lookup lists
          html += `
            <div class="typeahead-container" style="position: relative;">
              <input class="template-input typeahead-input" type="text" id="${fieldId}" 
                     data-molecule="${field.molecule_key}" 
                     placeholder="Type code or city..."
                     autocomplete="off"
                     ${field.is_required ? 'required' : ''}>
              <input type="hidden" id="${fieldId}_code" data-molecule="${field.molecule_key}" class="typeahead-value">
              <div class="typeahead-dropdown" id="${fieldId}_dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"></div>
            </div>
          `;
        } else if (isDropdown) {
          html += `
            <select class="template-input template-select" id="${fieldId}" data-molecule="${field.molecule_key}" ${field.is_required ? 'required' : ''}>
              <option value="">-- Select ${label.replace(' *', '')} --</option>
            </select>
          `;
        } else {
          // Determine input type based on scalar_type
          const scalarType = mol?.scalar_type || 'text';
          let inputType = 'text';
          let inputAttrs = '';
          
          if (scalarType === 'numeric') {
            inputType = 'text';
            inputAttrs = 'inputmode="numeric" pattern="[0-9]*"';
          } else if (scalarType === 'date') {
            inputType = 'date';
          }
          
          html += `
            <input class="template-input" type="${inputType}" id="${fieldId}" data-molecule="${field.molecule_key}" ${field.is_required ? 'required' : ''} ${inputAttrs} style="${inputStyle}">
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
            <label class="template-label" for="tpl_basePoints">${currencyLabel} ${requiredMark}${hint}</label>
            <input class="template-input" type="number" id="tpl_basePoints" data-field="base_points" value="${defaultValue}" min="0" ${readonlyAttr} ${isCalculated ? '' : 'required'} style="max-width: 120px; ${isCalculated ? 'background: var(--bg-secondary);' : ''}">
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
    
    // Also load values for system-generated fields that need lookups
    const sysGenFields = document.querySelectorAll('[data-system-generated]');
    for (const field of sysGenFields) {
      const moleculeKey = field.dataset.molecule;
      const funcName = field.dataset.systemGenerated;
      if (moleculeKey && funcName) {
        console.log(`Loading values for system-generated field: ${moleculeKey}`);
        loadPromises.push(this.loadSystemGeneratedValues(moleculeKey));
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
    
    // Set up uppercase inputs - force value to uppercase on input
    const uppercaseInputs = document.querySelectorAll('input[data-uppercase="true"]');
    for (const input of uppercaseInputs) {
      input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);
      });
    }
    
    // Set up numeric-only inputs - block non-digit characters
    const numericInputs = document.querySelectorAll('input[inputmode="numeric"]');
    for (const input of numericInputs) {
      // Block non-numeric keypresses (keypress only fires for printable chars)
      input.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      });
      // Also strip non-digits on input (handles paste)
      input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        if (cleaned !== e.target.value) {
          e.target.value = cleaned;
          e.target.setSelectionRange(start - 1, start - 1);
        }
      });
    }
  }

  /**
   * Load values for system-generated fields (for display lookups)
   */
  async loadSystemGeneratedValues(moleculeKey) {
    const mol = this.molecules[moleculeKey];
    if (!mol) {
      console.warn(`Molecule not found: ${moleculeKey}`);
      return;
    }
    
    // If values already loaded, skip
    if (mol.values && mol.values.length > 0) {
      console.log(`Values already loaded for ${moleculeKey}: ${mol.values.length} items`);
      return;
    }
    
    // Load values from molecule endpoint
    try {
      const url = `${this.apiBase}/v1/molecules/${mol.molecule_id}/values?tenant_id=${this.tenantId}`;
      console.log(`Fetching values for system-generated field: ${moleculeKey} from ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const values = await response.json();
        mol.values = values;
        console.log(`Loaded ${values.length} values for ${moleculeKey}`);
      }
    } catch (error) {
      console.error(`Error loading values for ${moleculeKey}:`, error);
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
      // Handle uppercase if flagged
      if (input.dataset.uppercase === 'true') {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);
      }
      
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
    const milesInput = document.getElementById('tpl_basePoints');
    
    if (!originHidden || !destHidden || !milesInput) {
      console.warn('Could not find origin, destination, or miles fields for auto-calculation');
      return;
    }
    
    const calculateMiles = async () => {
      const origin = originHidden.value;
      const destination = destHidden.value;
      
      if (!origin || !destination) {
        milesInput.value = '';
        this.updateSystemGeneratedFields(null);
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
          
          // Update system-generated fields that depend on miles
          this.updateSystemGeneratedFields(result.miles);
        } else {
          const error = await response.json();
          console.warn('Miles calculation failed:', error);
          milesInput.value = '';
          this.updateSystemGeneratedFields(null);
        }
      } catch (e) {
        console.error('Error calculating miles:', e);
        milesInput.value = '';
        this.updateSystemGeneratedFields(null);
      }
    };
    
    originHidden.addEventListener('change', calculateMiles);
    destHidden.addEventListener('change', calculateMiles);
  }

  /**
   * Update system-generated fields based on calculated values
   */
  async updateSystemGeneratedFields(miles) {
    // Find all system-generated fields
    const sysGenFields = document.querySelectorAll('[data-system-generated]');
    
    for (const field of sysGenFields) {
      const funcName = field.dataset.systemGenerated;
      const moleculeKey = field.dataset.molecule;
      
      if (!funcName || !moleculeKey) continue;
      
      console.log(`Updating system-generated field: ${moleculeKey} using ${funcName}`);
      
      if (funcName === 'selectAircraftType') {
        await this.selectAircraftType(field, miles);
      }
      // Add other system-generated functions here as needed
    }
  }

  /**
   * Select aircraft type based on flight distance (miles)
   */
  async selectAircraftType(field, miles) {
    if (!miles) {
      field.value = '';
      return;
    }
    
    // Aircraft type selection based on route distance
    // Smaller aircraft for shorter routes, larger for longer
    let aircraftCode;
    if (miles < 300) {
      aircraftCode = 'CRJ2';      // CRJ-200 for very short hops
    } else if (miles < 500) {
      aircraftCode = 'E145';      // ERJ-145
    } else if (miles < 700) {
      aircraftCode = 'E175';      // Embraer 175
    } else if (miles < 1000) {
      aircraftCode = 'CR9';       // CRJ-900
    } else if (miles < 1500) {
      aircraftCode = 'A319';      // Airbus A319
    } else if (miles < 2000) {
      aircraftCode = 'B738';      // Boeing 737-800
    } else if (miles < 2500) {
      aircraftCode = 'A321';      // Airbus A321
    } else if (miles < 3000) {
      aircraftCode = 'B752';      // Boeing 757-200
    } else if (miles < 4000) {
      aircraftCode = 'B763';      // Boeing 767-300
    } else if (miles < 6000) {
      aircraftCode = 'A333';      // Airbus A330-300
    } else if (miles < 8000) {
      aircraftCode = 'B772';      // Boeing 777-200
    } else {
      aircraftCode = 'A359';      // Airbus A350-900 for ultra-long haul
    }
    
    console.log(`selectAircraftType: miles=${miles}, selected code=${aircraftCode}`);
    
    // Look up the display label from molecule values
    const mol = this.molecules['aircraft_type'];
    console.log(`aircraft_type molecule:`, mol);
    console.log(`aircraft_type values:`, mol?.values);
    
    if (mol?.values && mol.values.length > 0) {
      // API returns: { value_id, value (code), label (description), sort_order }
      const match = mol.values.find(v => v.value === aircraftCode);
      console.log(`Looking for ${aircraftCode}, found:`, match);
      if (match) {
        const code = match.value;
        const desc = match.label;
        field.value = desc ? `${code} - ${desc}` : code;
        field.dataset.selectedCode = aircraftCode;
        console.log(`Selected aircraft: ${field.value}`);
        return;
      }
    }
    
    // Fallback - just show the code
    field.value = aircraftCode;
    field.dataset.selectedCode = aircraftCode;
    console.log(`Selected aircraft (no lookup): ${aircraftCode} for ${miles} miles`);
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
      
      const vk = mol.value_kind;
      console.log(`Loading dropdown for ${moleculeKey}, value_kind: ${vk}`);

      let values = [];

      if (vk === 'list' || vk === 'internal_list') {
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
      } else if (vk === 'lookup' || vk === 'external_list') {
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
      } else if (vk === 'embedded_list') {
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
      
      // Skip system-generated fields - server calculates these
      if (input.dataset.systemGenerated) {
        continue;
      }
      
      // Check for molecule key (template-defined fields)
      const moleculeKey = input.dataset.molecule;
      if (moleculeKey && !data[moleculeKey]) {
        data[moleculeKey] = input.value;
      }
      
      // Check for field key (built-in fields like activity_date, base_points)
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
   * Set form data - populate fields with existing values
   * @param {Object} values - Object with molecule_key: value pairs
   */
  async setFormData(values) {
    if (!values) return;
    
    for (const [moleculeKey, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      
      // Try to find the input by molecule key
      const input = document.querySelector(`[data-molecule="${moleculeKey}"]`);
      if (input) {
        if (input.tagName === 'SELECT') {
          // For dropdowns, need to find option by display text or value
          const mol = this.molecules[moleculeKey];
          if (mol && (mol.value_kind === 'external_list' || mol.value_kind === 'lookup' ||
                      mol.value_kind === 'internal_list' || mol.value_kind === 'list')) {
            // Value might be the display text, need to find the option
            // First try direct value match
            let found = false;
            for (const opt of input.options) {
              if (opt.value === String(value) || opt.textContent === value) {
                input.value = opt.value;
                found = true;
                break;
              }
            }
            if (!found) {
              console.warn(`Could not find option for ${moleculeKey} = ${value}`);
            }
          } else {
            input.value = value;
          }
        } else {
          input.value = value;
        }
      }
      
      // Also check for typeahead hidden inputs
      const hiddenInput = document.querySelector(`.typeahead-value[data-molecule="${moleculeKey}"]`);
      if (hiddenInput) {
        hiddenInput.value = value;
        // Also update the display input
        const displayInput = document.getElementById(hiddenInput.id.replace('_code', ''));
        if (displayInput) {
          displayInput.value = value; // Will show code, could enhance to show description
        }
      }
    }
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
