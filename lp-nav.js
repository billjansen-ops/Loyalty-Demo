// Loyalty Platform - Unified Navigation System
// Single source of truth for CSR and Admin navigation

(function() {
  'use strict';

  // Global state
  window.LP_STATE = {
    apiBase: 'http://127.0.0.1:4001',
    version: '1.0.0',
    tenantId: 1, // Default tenant - will be set on tenant selection
    labels: {} // Loaded display labels
  };

  // Load display labels for tenant
  async function loadLabels(tenantId) {
    try {
      const response = await fetch(`${window.LP_STATE.apiBase}/v1/tenants/${tenantId}/labels`);
      if (response.ok) {
        window.LP_STATE.labels = await response.json();
        console.log('LP-NAV: Labels loaded:', window.LP_STATE.labels);
        return true;
      }
    } catch (error) {
      console.error('LP-NAV: Failed to load labels:', error);
    }
    return false;
  }

  // Replace label tokens in text (e.g., "{currency_label}" -> "Miles")
  function replaceTokens(text) {
    if (!text) return text;
    return text.replace(/\{([^}]+)\}/g, (match, key) => {
      return window.LP_STATE.labels[key] || match;
    });
  }

  // Navigation definitions
  const NAV_CONFIGS = {
    csr: [
      { icon: '🔍', label: 'Search', href: 'csr.html' },
      { icon: '👤', label: 'Profile', href: 'profile.html', needsMemberId: true },
      { icon: '📊', label: 'Activity', href: 'activity.html', needsMemberId: true },
      { icon: '💰', label: '{currency_label} Summary', href: 'point-summary.html', needsMemberId: true },
      { icon: '🎁', label: 'Promotions', href: 'member_promotions.html', needsMemberId: true },
      { icon: '👥', label: 'Aliases', href: 'aliases.html', needsMemberId: true },
      { icon: '⭐', label: 'Tiers', href: 'tier.html', needsMemberId: true },
      { icon: '📧', label: 'Communications', href: 'communications.html', needsMemberId: true }
    ],
    admin: [
      { icon: '📊', label: 'Overview', href: 'admin.html' },
      { 
        icon: '⚙️', 
        label: 'Program Configuration', 
        submenu: [
          { label: 'Molecules', href: 'admin_molecules.html' },
          { label: 'Composites', href: 'admin_composites.html' }
        ]
      },
      { 
        icon: '🎨', 
        label: 'Templates', 
        submenu: [
          { label: 'Input Templates', href: 'admin_input_templates.html' },
          { label: 'Display Templates', href: 'admin_activity_display_templates.html' }
        ]
      },
      { 
        icon: '📋', 
        label: 'Program Rules', 
        submenu: [
          { label: 'Bonuses', href: 'admin_bonuses.html' },
          { label: 'Promotions', href: 'admin_promotions.html' },
          { label: 'Tiers', href: 'admin_tiers.html' },
          { label: 'Redemptions', href: 'admin_redemptions.html' },
          { label: 'Adjustments', href: 'admin_adjustments.html' },
          { label: 'Partners', href: 'admin_partners.html' }
        ]
      },
      { 
        icon: '📚', 
        label: 'Reference Data', 
        submenu: [
          { label: 'Carriers', href: 'admin_carriers.html' },
          { label: 'Airports', href: 'admin_airports.html' },
          { label: 'Expiration Rules', href: 'admin_expiration.html' }
        ]
      },
      { 
        icon: '🔧', 
        label: 'Settings', 
        submenu: [
          { label: 'Program Settings', href: 'admin_settings.html' },
          { label: 'Branding', href: 'admin_branding.html' }
        ]
      }
    ],
    super: [
      { icon: '🔧', label: 'System Console', href: 'system_console.html' },
      { icon: '💾', label: 'Database Utilities', href: 'system_database.html' },
      { icon: '📊', label: 'Analytics', href: 'system_analytics.html' },
      { icon: '🔒', label: 'Security', href: 'system_security.html' }
    ],
    mainMenu: [
      { icon: '👤', label: 'CSR', href: 'csr.html' },
      { icon: '⚙️', label: 'Client Admin', href: 'admin.html' },
      { icon: '🛠️', label: 'Admin', href: 'super_user.html' },
      { icon: '🏠', label: 'Home', href: 'menu.html' }
    ]
  };

  // Detect page type based on filename
  function getPageType() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    if (filename.startsWith('system_') || filename === 'super_user.html') {
      return 'super';
    } else if (filename.startsWith('admin')) {
      return 'admin';
    } else if ([
      'csr.html', 
      'activity.html',
      'add_activity.html',
      'add_redemption.html',
      'point-summary.html', 
      'profile.html',
      'member_promotions.html',
      'aliases.html',
      'tier.html',
      'communications.html'
    ].includes(filename)) {
      return 'csr';
    }
    return null;
  }

  // Build navigation HTML
  function buildNav(pageType) {
    const currentPage = window.location.pathname.split('/').pop();
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('memberId');
    
    let html = '';
    
    // Add section title
    let sectionTitle;
    if (pageType === 'admin') {
      sectionTitle = 'Client Admin';
    } else if (pageType === 'super') {
      sectionTitle = 'Admin';
    } else {
      sectionTitle = 'CSR Console';
    }
    html += `<div class="nav-section-title">${sectionTitle}</div>`;
    
    // Add nav items
    const navItems = NAV_CONFIGS[pageType] || [];
    navItems.forEach(item => {
      const displayLabel = replaceTokens(item.label);
      
      // Handle items with submenus
      if (item.submenu) {
        // Check if any submenu item is active
        const isSubmenuActive = item.submenu.some(sub => currentPage === sub.href);
        const expandedClass = isSubmenuActive ? ' expanded' : '';
        
        html += `
          <div class="nav-item-with-submenu${expandedClass}">
            <div class="nav-item submenu-parent">
              <span class="nav-icon">${item.icon}</span>
              <span>${displayLabel}</span>
              <span class="submenu-arrow">▼</span>
            </div>
            <div class="nav-submenu">
        `;
        
        item.submenu.forEach(subItem => {
          const isActive = currentPage === subItem.href;
          const activeClass = isActive ? ' active' : '';
          
          html += `
              <a href="${subItem.href}" class="nav-subitem${activeClass}">
                <span>${subItem.label}</span>
              </a>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      } else {
        // Regular nav item without submenu
        let href = item.href;
        let disabledClass = '';
        let clickHandler = '';
        
        // Add memberId to URLs that need it
        if (item.needsMemberId) {
          if (memberId) {
            href += `?memberId=${encodeURIComponent(memberId)}`;
          } else {
            // No member selected - disable the link
            disabledClass = ' disabled';
            href = '#';
            clickHandler = ' onclick="alert(\'Please select a member first from the Search page.\'); return false;"';
          }
        }
        
        const isActive = currentPage === item.href;
        const activeClass = isActive ? ' active' : '';
        
        html += `
          <a href="${href}" class="nav-item${activeClass}${disabledClass}"${clickHandler}>
            <span class="nav-icon">${item.icon}</span>
            <span>${displayLabel}</span>
          </a>
        `;
      }
    });
    
    // Add divider and main menu
    html += '<div class="nav-divider"></div>';
    html += '<div class="nav-section-title">Main Menu</div>';
    
    NAV_CONFIGS.mainMenu.forEach(item => {
      const isActive = currentPage === item.href;
      const activeClass = isActive ? ' active' : '';
      
      html += `
        <a href="${item.href}" class="nav-item${activeClass}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    });
    
    return html;
  }

  // Initialize navigation on page load
  document.addEventListener('DOMContentLoaded', async function() {
    const pageType = getPageType();
    
    if (!pageType) {
      // Not a CSR or Admin page, skip nav injection
      return;
    }
    
    // Find nav container
    const navContainer = document.querySelector('#nav-container, .nav');
    
    if (!navContainer) {
      console.warn('LP-NAV: No navigation container found');
      return;
    }
    
    // Load tenant from sessionStorage if available
    const storedTenantId = sessionStorage.getItem('tenant_id');
    if (storedTenantId) {
      window.LP_STATE.tenantId = parseInt(storedTenantId);
    }
    
    // Load labels first
    await loadLabels(window.LP_STATE.tenantId);
    
    // Build and inject nav HTML
    const navHTML = buildNav(pageType);
    navContainer.innerHTML = navHTML;
    
    // Add click handlers for submenu parents
    const submenuParents = navContainer.querySelectorAll('.submenu-parent');
    submenuParents.forEach(parent => {
      parent.addEventListener('click', function(e) {
        e.preventDefault();
        const wrapper = this.parentElement;
        wrapper.classList.toggle('expanded');
      });
    });
    
    console.log('LP-NAV: Navigation loaded for', pageType);
  });

  // Export utility functions
  window.LP_NAV = {
    getPageType: getPageType,
    buildNav: buildNav,
    setCurrentMember: function(member) {
      // Store current member in sessionStorage
      if (member && member.id) {
        sessionStorage.setItem('currentMember', JSON.stringify(member));
      }
    },
    getCurrentMember: function() {
      const stored = sessionStorage.getItem('currentMember');
      return stored ? JSON.parse(stored) : null;
    },
    navigateTo: function(page, member) {
      if (member && member.id) {
        window.location.href = `${page}?memberId=${encodeURIComponent(member.id)}`;
      } else {
        window.location.href = page;
      }
    },
    setTenant: async function(tenantId) {
      // Set tenant and reload labels
      window.LP_STATE.tenantId = tenantId;
      sessionStorage.setItem('tenantId', tenantId);
      await loadLabels(tenantId);
      
      // Rebuild navigation if on a CSR/Admin page
      const pageType = getPageType();
      if (pageType) {
        const navContainer = document.querySelector('#nav-container, .nav');
        if (navContainer) {
          navContainer.innerHTML = buildNav(pageType);
        }
      }
    },
    getLabel: function(key) {
      // Get a label by key
      return window.LP_STATE.labels[key] || key;
    },
    version: '1.0.0'
  };

})();
