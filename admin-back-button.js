// Admin Back Button Component
// Usage: Call AdminBackButton.render() to insert back button into page header

const AdminBackButton = {
  /**
   * Render back button into the page header
   * @param {string} targetSelector - CSS selector for where to insert button (default: first element in .admin-page-header)
   * @param {string} backUrl - Optional specific URL to go back to (default: browser back)
   */
  render(targetSelector = '.admin-page-header', backUrl = null) {
    const container = document.querySelector(targetSelector);
    if (!container) {
      console.warn('AdminBackButton: target container not found');
      return;
    }

    // Create back button
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = 'Back';
    
    // Add click handler
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (backUrl) {
        window.location.href = backUrl;
      } else {
        window.history.back();
      }
    });

    // Insert as first child of container
    container.insertBefore(backBtn, container.firstChild);
  },

  /**
   * Create back button element without inserting (for manual placement)
   * @param {string} backUrl - Optional specific URL to go back to
   * @returns {HTMLElement} The back button element
   */
  createElement(backUrl = null) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = 'Back';
    
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (backUrl) {
        window.location.href = backUrl;
      } else {
        window.history.back();
      }
    });

    return backBtn;
  }
};

// Auto-initialize on DOM ready if data-admin-back attribute is present
document.addEventListener('DOMContentLoaded', () => {
  const autoInit = document.querySelector('[data-admin-back]');
  if (autoInit) {
    const backUrl = autoInit.getAttribute('data-admin-back') || null;
    AdminBackButton.render('.admin-page-header', backUrl);
  }
});
