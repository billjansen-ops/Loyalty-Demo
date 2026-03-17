/* ============================================
   LOYALTY PLATFORM - AUTHENTICATION
   Version: 3.0.0 - Server-side session backed
   
   Browser sessionStorage is now a display cache only.
   The server cookie is the authoritative session.
   ============================================ */

const Auth = (function() {
  
  const SESSION_KEY = 'lp_session';
  const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:4001' 
    : window.location.origin;
  
  // ============================================
  // PRIVATE: Local display cache (not authoritative)
  // ============================================
  
  function getSession() {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  }
  
  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('tenant_id');
    sessionStorage.removeItem('tenant_key');
    sessionStorage.removeItem('tenant_name');
    sessionStorage.removeItem('vertical_key');
  }
  
  // ============================================
  // PUBLIC: Authentication
  // ============================================
  
  async function login(username, password) {
    try {
      const response = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Login failed' };
      }
      
      const user = await response.json();
      
      setSession({
        userId:      user.user_id,
        userName:    user.display_name,
        username:    user.username,
        tenantId:    user.tenant_id,
        tenantKey:   user.tenant_key,
        verticalKey: user.vertical_key,
        role:        user.role,
        loginTime:   new Date().toISOString()
      });

      if (user.tenant_id) {
        sessionStorage.setItem('tenant_id', user.tenant_id.toString());
      }
      if (user.tenant_key) {
        sessionStorage.setItem('tenant_key', user.tenant_key);
      }
      if (user.vertical_key) {
        sessionStorage.setItem('vertical_key', user.vertical_key);
      }

      return { success: true, vertical_key: user.vertical_key };
      
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  }
  
  async function logout() {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.warn('Server logout failed:', e);
    }
    clearSession();
    window.location.href = '/login.html';
  }
  
  function isLoggedIn() {
    return getSession() !== null;
  }
  
  // ============================================
  // PUBLIC: User info (from local cache)
  // ============================================
  
  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    return {
      userId:   session.userId,
      userName: session.userName,
      username: session.username,
      role:     session.role
    };
  }
  
  function getTenantId() {
    const session = getSession();
    if (!session) return null;
    if (session.role === 'superuser') {
      const override = sessionStorage.getItem('tenant_id');
      return override ? parseInt(override) : 1;
    }
    return session.tenantId;
  }
  
  function getRole()      { const s = getSession(); return s ? s.role : null; }
  function getUserId()    { const s = getSession(); return s ? s.userId : null; }
  function getLoginTime() { const s = getSession(); return s ? s.loginTime : null; }
  
  // ============================================
  // PUBLIC: Tenant switching (superuser only)
  // ============================================
  
  async function setTenant(tenantId, tenantName) {
    if (!canChangeTenant()) return false;
    try {
      const response = await fetch(`${API_BASE}/v1/auth/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId })
      });
      if (!response.ok) return false;
    } catch (e) {
      console.warn('setTenant server call failed:', e);
      return false;
    }
    sessionStorage.setItem('tenant_id', tenantId.toString());
    if (tenantName) sessionStorage.setItem('tenant_name', tenantName);
    return true;
  }
  
  // ============================================
  // PUBLIC: Authorization checks
  // ============================================
  
  function canAccessAdmin()  { const r = getRole(); return r === 'superuser' || r === 'admin'; }
  function canAccessCSR()    { const r = getRole(); return r === 'superuser' || r === 'admin' || r === 'csr'; }
  function canChangeTenant() { return getRole() === 'superuser'; }
  function isSuperuser()     { return getRole() === 'superuser'; }
  
  // ============================================
  // PUBLIC: Page guards
  // ============================================
  
  function requireAuth() {
    if (!isLoggedIn()) { window.location.href = '/login.html'; return false; }
    return true;
  }
  
  function requireAdmin() {
    if (!requireAuth()) return false;
    if (!canAccessAdmin()) { window.location.href = '/unauthorized.html'; return false; }
    return true;
  }
  
  function requireCSR() {
    if (!requireAuth()) return false;
    if (!canAccessCSR()) { window.location.href = '/unauthorized.html'; return false; }
    return true;
  }
  
  function requireSuperuser() {
    if (!requireAuth()) return false;
    if (!isSuperuser()) { window.location.href = '/unauthorized.html'; return false; }
    return true;
  }
  
  function getContext() {
    const session = getSession();
    if (!session) return null;
    return {
      userId:    session.userId,
      userName:  session.userName,
      tenantId:  getTenantId(),
      role:      session.role,
      loginTime: session.loginTime
    };
  }
  
  return {
    login, logout, isLoggedIn,
    getCurrentUser, getTenantId, getRole, getUserId, getLoginTime,
    canAccessAdmin, canAccessCSR, canChangeTenant, isSuperuser, setTenant,
    requireAuth, requireAdmin, requireCSR, requireSuperuser,
    getContext
  };
  
})();

// ============================================
// GLOBAL 401 INTERCEPTOR
// Wraps window.fetch - if any API call returns
// 401 (session expired), redirect to login.
// All pages get this automatically via auth.js.
// ============================================
(function() {
  const _originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await _originalFetch.apply(this, args);
    if (response.status === 401) {
      // Clone so the original response isn't consumed
      const data = await response.clone().json().catch(() => ({}));
      // Only redirect on auth failures, not business logic 401s
      if (data.error === 'Not authenticated') {
        sessionStorage.removeItem('lp_session');
        sessionStorage.removeItem('tenant_id');
        sessionStorage.removeItem('tenant_key');
        sessionStorage.removeItem('tenant_name');
        sessionStorage.removeItem('vertical_key');
        window.location.href = '/login.html';
      }
    }
    return response;
  };
})();
