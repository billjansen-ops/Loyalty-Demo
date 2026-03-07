/**
 * Dual Listbox Component
 * 
 * A reusable component for selecting multiple items from a list.
 * Shows available items on left, selected items on right, with move buttons.
 * 
 * Usage:
 *   <div id="myListbox"></div>
 *   
 *   const listbox = new DualListbox('myListbox', {
 *     availableLabel: 'Available Point Types',
 *     selectedLabel: 'Allowed Point Types',
 *     items: [
 *       { id: 1, name: 'Base SkyMiles' },
 *       { id: 2, name: 'Partner Airline Points' },
 *       { id: 3, name: 'Promo Points' }
 *     ],
 *     selectedIds: [1, 2],  // Initially selected
 *     onChange: (selectedIds) => { console.log('Selected:', selectedIds); }
 *   });
 *   
 *   // Get current selection
 *   const ids = listbox.getSelectedIds();
 *   
 *   // Set selection programmatically
 *   listbox.setSelectedIds([1, 3]);
 */

class DualListbox {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`DualListbox: Container #${containerId} not found`);
      return;
    }

    this.options = {
      availableLabel: options.availableLabel || 'Available',
      selectedLabel: options.selectedLabel || 'Selected',
      items: options.items || [],
      selectedIds: new Set(options.selectedIds || []),
      onChange: options.onChange || (() => {}),
      height: options.height || '200px',
      emptyAvailableText: options.emptyAvailableText || 'No items available',
      emptySelectedText: options.emptySelectedText || 'None selected (all allowed)',
      idField: options.idField || 'id',
      nameField: options.nameField || 'name'
    };

    this.render();
    this.bindEvents();
  }

  render() {
    const { availableLabel, selectedLabel, height, emptyAvailableText, emptySelectedText } = this.options;

    this.container.innerHTML = `
      <div class="dual-listbox">
        <div class="dual-listbox-panel">
          <div class="dual-listbox-header">${availableLabel}</div>
          <div class="dual-listbox-search">
            <input type="text" class="dual-listbox-search-input" data-side="available" placeholder="Search...">
          </div>
          <div class="dual-listbox-list" data-side="available" style="height: ${height}">
            <div class="dual-listbox-empty">${emptyAvailableText}</div>
          </div>
        </div>

        <div class="dual-listbox-controls">
          <button type="button" class="dual-listbox-btn" data-action="add" title="Add selected">
            <span>→</span>
          </button>
          <button type="button" class="dual-listbox-btn" data-action="add-all" title="Add all">
            <span>⇒</span>
          </button>
          <button type="button" class="dual-listbox-btn" data-action="remove" title="Remove selected">
            <span>←</span>
          </button>
          <button type="button" class="dual-listbox-btn" data-action="remove-all" title="Remove all">
            <span>⇐</span>
          </button>
        </div>

        <div class="dual-listbox-panel">
          <div class="dual-listbox-header">${selectedLabel}</div>
          <div class="dual-listbox-search">
            <input type="text" class="dual-listbox-search-input" data-side="selected" placeholder="Search...">
          </div>
          <div class="dual-listbox-list" data-side="selected" style="height: ${height}">
            <div class="dual-listbox-empty">${emptySelectedText}</div>
          </div>
        </div>
      </div>
    `;

    this.availableList = this.container.querySelector('[data-side="available"].dual-listbox-list');
    this.selectedList = this.container.querySelector('[data-side="selected"].dual-listbox-list');
    this.availableSearch = this.container.querySelector('[data-side="available"].dual-listbox-search-input');
    this.selectedSearch = this.container.querySelector('[data-side="selected"].dual-listbox-search-input');

    this.renderLists();
  }

  renderLists() {
    const { items, selectedIds, idField, nameField, emptyAvailableText, emptySelectedText } = this.options;

    const availableItems = items.filter(item => !selectedIds.has(item[idField]));
    const selectedItems = items.filter(item => selectedIds.has(item[idField]));

    const availableFilter = (this.availableSearch?.value || '').toLowerCase();
    const selectedFilter = (this.selectedSearch?.value || '').toLowerCase();

    const filteredAvailable = availableItems.filter(item => 
      item[nameField].toLowerCase().includes(availableFilter)
    );
    const filteredSelected = selectedItems.filter(item => 
      item[nameField].toLowerCase().includes(selectedFilter)
    );

    // Render available
    if (filteredAvailable.length === 0) {
      this.availableList.innerHTML = `<div class="dual-listbox-empty">${availableFilter ? 'No matches' : emptyAvailableText}</div>`;
    } else {
      this.availableList.innerHTML = filteredAvailable.map(item => `
        <div class="dual-listbox-item" data-id="${item[idField]}">
          ${this.escapeHtml(item[nameField])}
        </div>
      `).join('');
    }

    // Render selected
    if (filteredSelected.length === 0) {
      this.selectedList.innerHTML = `<div class="dual-listbox-empty">${selectedFilter ? 'No matches' : emptySelectedText}</div>`;
    } else {
      this.selectedList.innerHTML = filteredSelected.map(item => `
        <div class="dual-listbox-item" data-id="${item[idField]}">
          ${this.escapeHtml(item[nameField])}
        </div>
      `).join('');
    }
  }

  bindEvents() {
    // Item click to select
    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.dual-listbox-item');
      if (item) {
        // Toggle selection within the list
        const wasSelected = item.classList.contains('selected');
        
        // If not holding Ctrl/Cmd, clear other selections in same list
        if (!e.ctrlKey && !e.metaKey) {
          item.parentElement.querySelectorAll('.dual-listbox-item').forEach(i => {
            i.classList.remove('selected');
          });
        }
        
        item.classList.toggle('selected', !wasSelected);
      }
    });

    // Double-click to move
    this.container.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.dual-listbox-item');
      if (item) {
        const id = this.parseId(item.dataset.id);
        const inAvailable = item.closest('[data-side="available"]');
        
        if (inAvailable) {
          this.options.selectedIds.add(id);
        } else {
          this.options.selectedIds.delete(id);
        }
        
        this.renderLists();
        this.options.onChange(this.getSelectedIds());
      }
    });

    // Button clicks
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.dual-listbox-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      
      switch (action) {
        case 'add':
          this.moveSelected('available', 'selected');
          break;
        case 'add-all':
          this.moveAll('available', 'selected');
          break;
        case 'remove':
          this.moveSelected('selected', 'available');
          break;
        case 'remove-all':
          this.moveAll('selected', 'available');
          break;
      }
    });

    // Search input
    this.container.addEventListener('input', (e) => {
      if (e.target.classList.contains('dual-listbox-search-input')) {
        this.renderLists();
      }
    });
  }

  moveSelected(fromSide, toSide) {
    const fromList = this.container.querySelector(`[data-side="${fromSide}"].dual-listbox-list`);
    const selectedItems = fromList.querySelectorAll('.dual-listbox-item.selected');
    
    if (selectedItems.length === 0) return;

    selectedItems.forEach(item => {
      const id = this.parseId(item.dataset.id);
      if (toSide === 'selected') {
        this.options.selectedIds.add(id);
      } else {
        this.options.selectedIds.delete(id);
      }
    });

    this.renderLists();
    this.options.onChange(this.getSelectedIds());
  }

  moveAll(fromSide, toSide) {
    const { items, idField } = this.options;
    
    if (toSide === 'selected') {
      // Add all
      items.forEach(item => this.options.selectedIds.add(item[idField]));
    } else {
      // Remove all
      this.options.selectedIds.clear();
    }

    this.renderLists();
    this.options.onChange(this.getSelectedIds());
  }

  parseId(idStr) {
    const num = parseInt(idStr);
    return isNaN(num) ? idStr : num;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Public API

  getSelectedIds() {
    return Array.from(this.options.selectedIds);
  }

  setSelectedIds(ids) {
    this.options.selectedIds = new Set(ids);
    this.renderLists();
  }

  setItems(items) {
    this.options.items = items;
    // Remove any selected IDs that no longer exist
    const validIds = new Set(items.map(i => i[this.options.idField]));
    this.options.selectedIds = new Set(
      Array.from(this.options.selectedIds).filter(id => validIds.has(id))
    );
    this.renderLists();
  }

  clear() {
    this.options.selectedIds.clear();
    this.renderLists();
    this.options.onChange(this.getSelectedIds());
  }
}

// Inject styles if not already present
if (!document.getElementById('dual-listbox-styles')) {
  const style = document.createElement('style');
  style.id = 'dual-listbox-styles';
  style.textContent = `
    .dual-listbox {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .dual-listbox-panel {
      flex: 1;
      min-width: 180px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      overflow: hidden;
    }

    .dual-listbox-header {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 13px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      color: #374151;
    }

    .dual-listbox-search {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .dual-listbox-search-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }

    .dual-listbox-search-input:focus {
      outline: none;
      border-color: var(--primary, #4f46e5);
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }

    .dual-listbox-list {
      overflow-y: auto;
      min-height: 100px;
    }

    .dual-listbox-item {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.1s;
    }

    .dual-listbox-item:hover {
      background: #f3f4f6;
    }

    .dual-listbox-item.selected {
      background: #e0e7ff;
      color: #3730a3;
    }

    .dual-listbox-item:last-child {
      border-bottom: none;
    }

    .dual-listbox-empty {
      padding: 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
      font-style: italic;
    }

    .dual-listbox-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 40px;
    }

    .dual-listbox-btn {
      width: 36px;
      height: 32px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      color: #6b7280;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dual-listbox-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .dual-listbox-btn:active {
      background: #e5e7eb;
    }
  `;
  document.head.appendChild(style);
}
