// member-search-api.js - Shared member search logic
// Used by csr.html and member-search-modal.js

const MemberSearchAPI = {
  
  /**
   * Search for members using separate field parameters
   * @param {Object} params - Search parameters
   * @param {string} params.lname - Last name (prefix match)
   * @param {string} params.fname - First name (prefix match)
   * @param {string} params.email - Email (prefix match)
   * @param {string} params.phone - Phone (prefix match)
   * @param {string} params.membership_number - Member number (prefix match)
   * @param {string} params.tenant_id - Tenant ID (required)
   * @param {string} apiBase - API base URL (defaults to localhost:4001)
   * @returns {Promise<Array|null>} Array of members or null on error
   */
  search: async function({ lname, fname, email, phone, membership_number, tenant_id }, apiBase = 'http://localhost:4001') {
    // Build query parameters
    const params = new URLSearchParams();
    
    // Always include tenant_id
    params.append('tenant_id', tenant_id || sessionStorage.getItem('tenant_id') || '1');
    
    if (membership_number && membership_number.trim()) {
      params.append('membership_number', membership_number.trim());
    }
    if (lname && lname.trim()) {
      params.append('lname', lname.trim());
    }
    if (fname && fname.trim()) {
      params.append('fname', fname.trim());
    }
    if (email && email.trim()) {
      params.append('email', email.trim());
    }
    if (phone && phone.trim()) {
      params.append('phone', phone.trim());
    }
    
    // Must have at least one search field (besides tenant_id)
    const searchParams = ['membership_number', 'lname', 'fname', 'email', 'phone'];
    const hasSearch = searchParams.some(p => params.has(p));
    if (!hasSearch) {
      return [];
    }
    
    try {
      const response = await fetch(`${apiBase}/v1/member/search?${params.toString()}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        return null;
      }
      
      const results = await response.json();
      return Array.isArray(results) ? results : null;
    } catch (error) {
      console.error('Member search error:', error);
      return null;
    }
  },
  
  /**
   * Validate search parameters
   * @param {Object} params - Search parameters
   * @param {string} searchType - Type of search: 'membership_number', 'email', 'phone', 'name'
   * @returns {Object} { valid: boolean, error: string|null }
   */
  validate: function({ lname, fname, email, phone, membership_number }, searchType) {
    switch (searchType) {
      case 'membership_number':
        if (!membership_number || !membership_number.trim()) {
          return { valid: false, error: 'Enter a member number.' };
        }
        return { valid: true, error: null };
        
      case 'email':
        if (!email || !email.trim()) {
          return { valid: false, error: 'Enter an email address.' };
        }
        return { valid: true, error: null };
        
      case 'phone':
        if (!phone || !phone.trim()) {
          return { valid: false, error: 'Enter a phone number.' };
        }
        return { valid: true, error: null };
        
      case 'name':
        if (!lname || !lname.trim()) {
          return { valid: false, error: 'Enter a last name.' };
        }
        // If first name specified, require at least 3 chars of last name
        if (fname && fname.trim() && lname.trim().length < 3) {
          return { valid: false, error: 'Enter at least 3 characters of last name when searching by first name.' };
        }
        return { valid: true, error: null };
        
      default:
        // Legacy validation - at least one field
        if (!lname && !fname && !email && !phone && !membership_number) {
          return { valid: false, error: 'Enter search criteria.' };
        }
        // If first name specified, require at least 3 chars of last name
        if (fname && fname.trim() && (!lname || lname.trim().length < 3)) {
          return { valid: false, error: 'Enter at least 3 characters of last name when searching by first name.' };
        }
        return { valid: true, error: null };
    }
  },
  
  /**
   * Map server response to standard member object
   * @param {Object} obj - Server response object
   * @returns {Object|null} Standardized member object
   */
  mapMember: function(obj) {
    if (!obj) return null;
    
    // Use membership_number as the ID for navigation
    const id = obj.membership_number;
    if (!id) return null;
    
    return {
      id: String(id),
      membership_number: obj.membership_number || String(id),
      link: obj.link || '',
      first: obj.fname || '',
      last: obj.lname || '',
      fname: obj.fname || '',
      lname: obj.lname || '',
      email: obj.email || '',
      phone: obj.phone || '',
      is_active: obj.is_active !== false
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.MemberSearchAPI = MemberSearchAPI;
}
