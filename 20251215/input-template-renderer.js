/**
 * Input Template Renderer - Dynamic Activity Forms
 * 
 * Renders activity entry forms dynamically based on input_template configuration.
 * Parallel to display templates - defines HOW to enter activities.
 * 
 * Template Syntax:
 *   [M,molecule_key,"width",R/O]           - Molecule field
 *   [M,molecule_key,"width",R/O,filter_by] - Molecule with cascading filter
 *   [T,"Section Label"]                    - Section header/label
 * 
 * Width options: full, half, third, quarter, auto
 * R = Required, O = Optional
 */

const InputTemplateRenderer = {
  apiBase: 'http://127.0.0.1:4001',
  tenantId: null,
  template: null,
  fieldValues: {},      // Current field values
  fieldElements: {},    // DOM element references
  filterDependencies: {}, // field -> fields that depend on it

  /**
   * Initialize and render form for activity type
   * @param {string} containerId - DOM element ID to render into
   * @param {string} activityType - A, P, J, R
   * @param {Object} options - Additional options
   */
  async render(containerId, activityType, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return false;
    }

    this.apiBase = options.apiBase || this.apiBase;
    this.tenantId = options.tenantId || sessionStorage.getItem('tenant_id') || '1';
    this.fieldValues = {};
    this.fieldElements = {};
    this.filterDependencies = {};

    try {
      // Fetch input template
      const response = await fetch(
        `${this.apiBase}/v1/input-templates/active?tenant_id=${this.tenantId}&activity_type=${activityType}`
      );

      if (!response.ok) {
        console.warn(`No input template for activity type ${activityType}, using fallback`);
        container.innerHTML = this.renderFallback(activityType);
        return false;
      }

      this.template = await response.json();
      console.log('Loaded input template:', this.template);

      // Render form
      container.innerHTML = this.renderForm();

      // Initialize field behaviors (dropdowns, cascading, etc.)
      await this.initializeFields();

      return true;

    } catch (error) {
      console.error('Error loading input template:', error);
      container.innerHTML = this.renderFallback(activityType);
      return false;
    }
  },

  /**
   * Render form HTML from template
   */
  renderForm() {
    if (!this.template || !this.template.parsed_fields) {
      return '<p>No template fields defined</p>';
    }

    // Always include activity date first
    let html = `
      <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 12px;">
        <div class="form-group" style="flex: 0 0 180px;">
          <label class="form-label" for="activityDate">Activity Date</label>
          <input class="form-input" type="date" id="activityDate" required>
        </div>
      </div>
    `;

    // Group fields by row_number
    const rows = {};
    for (const field of this.template.parsed_fields) {
      const rowNum = field.row_number || 0;
      if (!rows[rowNum]) rows[rowNum] = [];
      rows[rowNum].push(field);
    }

    // Render each row
    const sortedRowNums = Object.keys(rows).sort((a, b) => parseInt(a) - parseInt(b));
    
    for (const rowNum of sortedRowNums) {
      const fields = rows[rowNum];
      html += this.renderRow(fields);
    }

    return html;
  },

  /**
   * Render a single row of fields
   */
  renderRow(fields) {
    let html = '<div class="form-row" style="display: flex; gap: 12px; margin-bottom: 12px;">';

    for (const field of fields) {
      if (field.type === 'T') {
        // Text/section header
        html += `<div class="form-section-label" style="flex: 1; font-weight: 600; color: var(--text-secondary); padding: 8px 0;">${field.text}</div>`;
      } else if (field.type === 'M') {
        html += this.renderField(field);
      }
    }

    html += '</div>';
    return html;
  },

  /**
   * Render a single molecule field
   */
  renderField(field) {
    const width = this.getWidthStyle(field.width);
    const required = field.required ? 'required' : '';
    const requiredMark = field.required ? ' *' : '';
    const fieldId = this.getFieldId(field.molecule_key);
    const label = field.label || field.molecule_key;

    // Track filter dependencies
    if (field.filter_by) {
      if (!this.filterDependencies[field.filter_by]) {
        this.filterDependencies[field.filter_by] = [];
      }
      this.filterDependencies[field.filter_by].push(field.molecule_key);
    }

    let inputHtml = '';
    const vk = field.value_kind;

    if (vk === 'lookup' || vk === 'external_list' || vk === 'list' || vk === 'internal_list') {
      // Dropdown field
      inputHtml = `
        <select class="form-input" id="${fieldId}" ${required} data-molecule="${field.molecule_key}" data-filter-by="${field.filter_by || ''}">
          <option value="">Loading...</option>
        </select>
      `;
    } else if (vk === 'scalar' || vk === 'value') {
      // Scalar field - check subtype
      if (field.scalar_type === 'numeric') {
        inputHtml = `
          <input class="form-input" type="number" id="${fieldId}" ${required} 
                 data-molecule="${field.molecule_key}" min="0" step="1">
        `;
      } else if (field.scalar_type === 'date') {
        inputHtml = `
          <input class="form-input" type="date" id="${fieldId}" ${required} 
                 data-molecule="${field.molecule_key}">
        `;
      } else {
        // Text
        inputHtml = `
          <input class="form-input" type="text" id="${fieldId}" ${required} 
                 data-molecule="${field.molecule_key}">
        `;
      }
    } else {
      // Fallback - text input
      inputHtml = `
        <input class="form-input" type="text" id="${fieldId}" ${required} 
               data-molecule="${field.molecule_key}">
      `;
    }

    return `
      <div class="form-group" style="${width}">
        <label class="form-label" for="${fieldId}">${label}${requiredMark}</label>
        ${inputHtml}
      </div>
    `;
  },

  /**
   * Get CSS style for field width
   */
  getWidthStyle(width) {
    switch (width) {
      case 'full': return 'flex: 1 1 100%;';
      case 'half': return 'flex: 1 1 calc(50% - 6px);';
      case 'third': return 'flex: 1 1 calc(33.333% - 8px);';
      case 'quarter': return 'flex: 1 1 calc(25% - 9px);';
      default: return 'flex: 1;';
    }
  },

  /**
   * Convert molecule_key to field ID
   */
  getFieldId(moleculeKey) {
    // Convert snake_case to camelCase for ID
    return moleculeKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  },

  /**
   * Initialize all fields - load dropdowns, set up events
   */
  async initializeFields() {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    const dateField = document.getElementById('activityDate');
    if (dateField) dateField.value = today;

    // Initialize each molecule field
    for (const field of this.template.parsed_fields) {
      if (field.type !== 'M') continue;

      const fieldId = this.getFieldId(field.molecule_key);
      const element = document.getElementById(fieldId);
      
      if (!element) continue;
      
      this.fieldElements[field.molecule_key] = element;
      const vk = field.value_kind;

      if (vk === 'lookup' || vk === 'external_list' || vk === 'list' || vk === 'internal_list') {
        // Load dropdown options
        if (!field.filter_by) {
          // No filter - load immediately
          await this.loadDropdownOptions(field);
        } else {
          // Has filter - wait for parent selection
          element.innerHTML = '<option value="">Select ' + field.filter_by + ' first...</option>';
          element.disabled = true;
        }

        // Set up change handler for cascading
        element.addEventListener('change', (e) => this.handleFieldChange(field.molecule_key, e.target.value));
      }
    }
  },

  /**
   * Load dropdown options from molecule
   */
  async loadDropdownOptions(field, filterValue = null) {
    const fieldId = this.getFieldId(field.molecule_key);
    const element = document.getElementById(fieldId);
    
    if (!element) return;

    try {
      let url = `${this.apiBase}/v1/molecules/get/${field.molecule_key}?tenant_id=${this.tenantId}`;
      
      // If this field has a filter, use the filtered endpoint
      if (field.filter_by && filterValue) {
        // Special handling for partner_program filtered by partner
        if (field.molecule_key === 'partner_program' && field.filter_by === 'partner') {
          url = `${this.apiBase}/v1/partners/${filterValue}/programs?tenant_id=${this.tenantId}`;
        }
        // Add more filter patterns as needed
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        element.innerHTML = '<option value="">Error loading options</option>';
        return;
      }

      const data = await response.json();
      
      // Handle different response formats
      let options = [];
      if (Array.isArray(data)) {
        // Direct array of options (like partner programs)
        options = data.map(item => ({
          value: item.program_id || item.id || item.value,
          label: item.program_name || item.name || item.label || item.code,
          code: item.program_code || item.code,
          // Store extra data for later use
          extra: item
        }));
      } else if (data.values) {
        // Molecule format with values array
        options = data.values.map(v => ({
          value: v.value || v.id,
          label: v.label || v.name || v.description,
          code: v.code
        }));
      }

      // Build dropdown HTML
      let html = '<option value="">Select...</option>';
      for (const opt of options) {
        const display = opt.code ? `${opt.code} - ${opt.label}` : opt.label;
        html += `<option value="${opt.value}" data-extra='${JSON.stringify(opt.extra || {})}'>${display}</option>`;
      }

      element.innerHTML = html;
      element.disabled = false;

    } catch (error) {
      console.error(`Error loading options for ${field.molecule_key}:`, error);
      element.innerHTML = '<option value="">Error loading</option>';
    }
  },

  /**
   * Handle field value change - trigger cascading updates
   */
  async handleFieldChange(moleculeKey, value) {
    this.fieldValues[moleculeKey] = value;

    // Check if any fields depend on this one
    const dependents = this.filterDependencies[moleculeKey];
    if (!dependents || dependents.length === 0) return;

    // Update dependent fields
    for (const depKey of dependents) {
      const depField = this.template.parsed_fields.find(f => f.molecule_key === depKey);
      if (depField) {
        if (value) {
          await this.loadDropdownOptions(depField, value);
        } else {
          // Parent cleared - disable dependent
          const element = this.fieldElements[depKey];
          if (element) {
            element.innerHTML = `<option value="">Select ${moleculeKey} first...</option>`;
            element.disabled = true;
          }
        }
      }
    }
  },

  /**
   * Get all field values for form submission
   */
  getValues() {
    const values = {
      activityDate: document.getElementById('activityDate')?.value
    };

    for (const field of this.template.parsed_fields) {
      if (field.type !== 'M') continue;
      
      const fieldId = this.getFieldId(field.molecule_key);
      const element = document.getElementById(fieldId);
      
      if (element) {
        values[field.molecule_key] = element.value;
      }
    }

    return values;
  },

  /**
   * Validate form - returns true if valid
   */
  validate() {
    let isValid = true;

    for (const field of this.template.parsed_fields) {
      if (field.type !== 'M' || !field.required) continue;
      
      const fieldId = this.getFieldId(field.molecule_key);
      const element = document.getElementById(fieldId);
      
      if (element && !element.value) {
        element.classList.add('error');
        isValid = false;
      } else if (element) {
        element.classList.remove('error');
      }
    }

    return isValid;
  },

  /**
   * Fallback form when no template exists
   */
  renderFallback(activityType) {
    return `
      <div class="form-row" style="display: flex; gap: 12px; margin-bottom: 12px;">
        <div class="form-group" style="flex: 0 0 180px;">
          <label class="form-label" for="activityDate">Activity Date</label>
          <input class="form-input" type="date" id="activityDate" required>
        </div>
      </div>
      <p style="color: var(--text-muted); font-size: 13px;">
        No input template configured for activity type "${activityType}". 
        Please configure a template in Admin → Input Templates.
      </p>
    `;
  }
};
