/* ============================================
   LOYALTY PLATFORM - AUTHENTICATION
   Version: 1.0.0
   
   Interface layer for authentication.
   Downstream code uses these functions.
   Swap implementation without changing callers.
   ============================================ */

const Auth = (function() {
  
  // Session storage key
  const SESSION_KEY = 'lp_session';
  
  // ============================================
  // TEMP: Hardcoded users (Phase 1)
  // Phase 2: Replace with database lookup
  // ============================================
  const USERS = {
    'Bill': {
      password: 'Billy',
      displayName: 'Bill',
      tenantId: null,  // null = all tenants
      role: 'superuser'
    },
    'DeltaCSR': {
      password: 'DeltaCSR',
      displayName: 'Delta CSR',
      tenantId: 1,  // Delta tenant
      role: 'csr'
    },
    'DeltaADMIN': {
      password: 'DeltaADMIN',
      displayName: 'Delta Admin',
      tenantId: 1,  // Delta tenant
      role: 'admin'
    }
  };
  
  // ============================================
  // PRIVATE: Session management
  // ============================================
  
  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  function getSession() {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }
  
  // ============================================
  // PUBLIC: Authentication interface
  // ============================================
  
  /**
   * Attempt login with username and password
   * @returns {object} { success: boolean, error?: string }
   */
  function login(username, password) {
    const user = USERS[username];
    
    if (!user || user.password !== password) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    const session = {
      userId: username,
      userName: user.displayName,
      tenantId: user.tenantId,
      role: user.role,
      sessionId: generateSessionId(),
      loginTime: new Date().toISOString()
    };
    
    setSession(session);
    return { success: true };
  }
  
  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return getSession() !== null;
  }
  
  /**
   * Get current user info
   * @returns {object|null} { userId, userName, role }
   */
  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    return {
      userId: session.userId,
      userName: session.userName,
      role: session.role
    };
  }
  
  /**
   * Get current tenant ID
   * For superuser, returns the selected tenant (from sessionStorage override)
   * For others, returns their locked tenant
   */
  function getTenantId() {
    const session = getSession();
    if (!session) return null;
    
    // Superuser can have a selected tenant override
    if (session.role === 'superuser') {
      const override = sessionStorage.getItem('tenant_id');
      return override ? parseInt(override) : 1;  // Default to 1 if not set
    }
    
    return session.tenantId;
  }
  
  /**
   * Get current role
   */
  function getRole() {
    const session = getSession();
    return session ? session.role : null;
  }
  
  /**
   * Get session ID (for logging/audit)
   */
  function getSessionId() {
    const session = getSession();
    return session ? session.sessionId : null;
  }
  
  /**
   * Get login time
   */
  function getLoginTime() {
    const session = getSession();
    return session ? session.loginTime : null;
  }
  
  /**
   * Log out - clear session
   */
  function logout() {
    clearSession();
    sessionStorage.removeItem('tenant_id');
  }
  
  // ============================================
  // PUBLIC: Authorization checks
  // ============================================
  
  /**
   * Can user access admin pages?
   */
  function canAccessAdmin() {
    const role = getRole();
    return role === 'superuser' || role === 'admin';
  }
  
  /**
   * Can user access CSR pages?
   */
  function canAccessCSR() {
    const role = getRole();
    return role === 'superuser' || role === 'admin' || role === 'csr';
  }
  
  /**
   * Can user change tenant?
   */
  function canChangeTenant() {
    return getRole() === 'superuser';
  }
  
  /**
   * Is user superuser?
   */
  function isSuperuser() {
    return getRole() === 'superuser';
  }
  
  /**
   * Set tenant (superuser only)
   * @returns {boolean} success
   */
  function setTenant(tenantId) {
    if (!canChangeTenant()) {
      return false;
    }
    sessionStorage.setItem('tenant_id', tenantId.toString());
    return true;
  }
  
  // ============================================
  // PUBLIC: Page guards
  // ============================================
  
  /**
   * Require login - redirect to login page if not authenticated
   * Call at top of page scripts
   */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
  
  /**
   * Require admin role - redirect if not admin/superuser
   */
  function requireAdmin() {
    if (!requireAuth()) return false;
    if (!canAccessAdmin()) {
      window.location.href = 'unauthorized.html';
      return false;
    }
    return true;
  }
  
  /**
   * Require CSR role - redirect if not csr/admin/superuser
   */
  function requireCSR() {
    if (!requireAuth()) return false;
    if (!canAccessCSR()) {
      window.location.href = 'unauthorized.html';
      return false;
    }
    return true;
  }
  
  // ============================================
  // PUBLIC: Context for logging
  // ============================================
  
  /**
   * Get full session context (for logging)
   */
  function getContext() {
    const session = getSession();
    if (!session) return null;
    return {
      userId: session.userId,
      userName: session.userName,
      tenantId: getTenantId(),
      role: session.role,
      sessionId: session.sessionId,
      loginTime: session.loginTime
    };
  }
  
  // ============================================
  // EXPOSE PUBLIC API
  // ============================================
  
  return {
    // Auth
    login,
    logout,
    isLoggedIn,
    
    // User info
    getCurrentUser,
    getTenantId,
    getRole,
    getSessionId,
    getLoginTime,
    
    // Authorization
    canAccessAdmin,
    canAccessCSR,
    canChangeTenant,
    isSuperuser,
    setTenant,
    
    // Page guards
    requireAuth,
    requireAdmin,
    requireCSR,
    
    // Logging context
    getContext
  };
  
})();
