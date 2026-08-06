/* ============================================
   LOYALTY PLATFORM - AUTHENTICATION
   Version: 3.0.0 - Server-side session backed
   
   Browser sessionStorage is now a display cache only.
   The server cookie is the authoritative session.
   ============================================ */

const Auth = (function() {
  
  const SESSION_KEY = 'lp_session';
  // The page's own address IS the API base — same origin everywhere, so the
  // session cookie always rides (a pinned 127.0.0.1 base made localhost
  // browsing a cross-origin session that couldn't hold — S153 cleanup).
  const API_BASE = window.location.origin;
  
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
    sessionStorage.removeItem('authorized_tenants');
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
        services:    user.services || {},
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
      // Multi-program logins (v117 tenant chooser): the DISPLAY list for the
      // login-page chooser + header switcher. Enforcement is server-side —
      // every switch re-checks the authorization table.
      if (user.authorized_tenants && user.authorized_tenants.length > 1) {
        sessionStorage.setItem('authorized_tenants', JSON.stringify(user.authorized_tenants));
      } else {
        sessionStorage.removeItem('authorized_tenants');
      }

      // Load member terminology labels (non-blocking)
      if (typeof PageContext !== 'undefined' && PageContext.loadMemberLabels) {
        PageContext.loadMemberLabels().catch(e => console.warn('Member labels load error:', e.message));
      }

      return { success: true, vertical_key: user.vertical_key, authorized_tenants: user.authorized_tenants || null };
      
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
  // PRIVATE: Rebuild the display cache from the server session
  // ============================================
  //
  // sessionStorage is PER-TAB, so a page opened in a NEW tab starts with an
  // empty cache even though the server cookie still vouches for the user.
  // Before this existed, every guard treated "empty cache" as "not logged
  // in" and bounced straight to login — any Open-in-new-tab link did it
  // (found via the molecule page's lookup-maintenance link). The server
  // session is the truth and the cache is just its shadow, so an empty
  // cache is a question for the server, not an answer.
  //
  // Rebuilds exactly what login() caches, from the two doors login.html
  // already trusts: /v1/auth/me (who am I) + /v1/auth/my-tenants (which
  // program is this session BOUND to — /me reports the HOME tenant, which
  // is the wrong answer for a superuser or multi-program user mid-switch).
  // Returns true when the server vouched and the cache is rebuilt.
  async function rehydrate() {
    try {
      const meResp = await fetch(`${API_BASE}/v1/auth/me`, { credentials: 'include' });
      if (!meResp.ok) return false;
      const me = await meResp.json();

      // The session's ACTIVE program + the switcher list. Non-fatal: if this
      // door fails we still have /me's home-tenant answer.
      let activeTenantId = me.tenant_id, tenants = [];
      try {
        const mtResp = await fetch(`${API_BASE}/v1/auth/my-tenants`, { credentials: 'include' });
        if (mtResp.ok) {
          const mt = await mtResp.json();
          if (mt.active_tenant_id) activeTenantId = mt.active_tenant_id;
          tenants = mt.tenants || [];
        }
      } catch (e) { /* home-tenant fallback below */ }
      const active = tenants.find(t => t.tenant_id === activeTenantId) || {};

      setSession({
        userId:      me.user_id,
        userName:    me.display_name,
        username:    me.username,
        tenantId:    activeTenantId,
        tenantKey:   active.tenant_key || me.tenant_key,
        verticalKey: active.vertical_key || me.vertical_key,
        role:        me.role,
        // services (the login-time ML snapshot) is unknowable here — /me
        // doesn't report it. Left absent deliberately; consumers must treat
        // "absent" as unknown, not as down (the dashboard banner does).
        loginTime:   new Date().toISOString()
      });
      if (activeTenantId)                          sessionStorage.setItem('tenant_id', String(activeTenantId));
      if (active.tenant_key || me.tenant_key)      sessionStorage.setItem('tenant_key', active.tenant_key || me.tenant_key);
      if (active.vertical_key || me.vertical_key)  sessionStorage.setItem('vertical_key', active.vertical_key || me.vertical_key);
      if (active.name || me.tenant_name)           sessionStorage.setItem('tenant_name', active.name || me.tenant_name);
      // The switcher list — same rule as login(): only non-superusers with
      // more than one program carry it (superusers switch freely already).
      if (me.role !== 'superuser' && tenants.length > 1) {
        sessionStorage.setItem('authorized_tenants', JSON.stringify(tenants));
      }
      return true;
    } catch (e) {
      console.warn('Session rehydrate failed:', e.message);
      return false;
    }
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
  function getServices()  { const s = getSession(); return s ? (s.services || {}) : {}; }
  
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
      // Refresh the display cache from the server's answer (tenant_key and
      // vertical_key ride along so cross-vertical switches stay honest).
      try {
        const data = await response.json();
        if (data.tenant) {
          if (data.tenant.tenant_key)   sessionStorage.setItem('tenant_key', data.tenant.tenant_key);
          if (data.tenant.vertical_key) sessionStorage.setItem('vertical_key', data.tenant.vertical_key);
          if (data.tenant.name)         sessionStorage.setItem('tenant_name', data.tenant.name);
        }
      } catch (e) { /* display cache only — the session is already rebound */ }
    } catch (e) {
      console.warn('setTenant server call failed:', e);
      return false;
    }
    sessionStorage.setItem('tenant_id', tenantId.toString());
    if (tenantName) sessionStorage.setItem('tenant_name', tenantName);
    // Reload member labels for new tenant
    if (typeof PageContext !== 'undefined' && PageContext.loadMemberLabels) {
      PageContext.loadMemberLabels().catch(e => console.warn('Member labels load error:', e.message));
    }
    return true;
  }
  
  // ============================================
  // PUBLIC: Authorization checks
  // ============================================
  
  function canAccessAdmin()  { const r = getRole(); return r === 'superuser' || r === 'admin'; }
  function canAccessCSR()    { const r = getRole(); return r === 'superuser' || r === 'admin' || r === 'csr'; }
  function canChangeTenant() {
    if (getRole() === 'superuser') return true;
    // Multi-program logins may switch among their authorized programs
    // (v117); the server re-checks the grant on every switch.
    try { return (JSON.parse(sessionStorage.getItem('authorized_tenants') || '[]')).length > 1; }
    catch (e) { return false; }
  }
  function getAuthorizedTenants() {
    try { return JSON.parse(sessionStorage.getItem('authorized_tenants') || '[]'); }
    catch (e) { return []; }
  }
  function isSuperuser()     { return getRole() === 'superuser'; }
  
  // ============================================
  // PUBLIC: Page guards
  // ============================================
  
  function requireAuth() {
    if (isLoggedIn()) return true;
    // Empty cache ≠ logged out: a new tab starts blank while the server
    // cookie may still vouch for the user. Ask the server (rehydrate); on
    // yes, reload so the page runs again with the cache in place; only on
    // the server's no does anyone go to login. Returning false either way
    // stops the caller from rendering an unauthenticated page meanwhile.
    rehydrate().then(ok => {
      if (ok) window.location.reload();
      else window.location.href = '/login.html';
    });
    return false;
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
    login, logout, isLoggedIn, rehydrate,
    getCurrentUser, getTenantId, getRole, getUserId, getLoginTime, getServices,
    canAccessAdmin, canAccessCSR, canChangeTenant, isSuperuser, setTenant, getAuthorizedTenants,
    requireAuth, requireAdmin, requireCSR, requireSuperuser,
    getContext
  };
  
})();

// ============================================
// GLOBAL 401 INTERCEPTOR — LIVES IN brand-loader.js, NOT HERE.
// This file used to carry a twin copy; the two drifted (different
// wordings matched, different keys cleared) and the drift half-hid the
// S166 login redirect loop. brand-loader's copy survives because
// brand-loader is on every page (109 at the S166 census; auth.js is on
// 12, ten of which also load brand-loader). The two auth.js-only pages
// need no interceptor: login.html clears its own cache in its
// session-verify probe, and unauthorized.html fetches nothing. Do NOT
// add a second interceptor here — one wrapper, one behavior.
// ============================================
