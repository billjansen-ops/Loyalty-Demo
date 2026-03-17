/**
 * custauth.js — Default Custom Authorization / Hook Function
 * 
 * This is the default no-op implementation. Core calls this at defined
 * hook points during processing. If a tenant has their own custauth.js
 * in tenants/{tenant_key}/, that version is loaded instead.
 * 
 * Hook points:
 *   PRE_ACCRUAL — after activity data is built, before createAccrualActivity
 *                 Use to inspect/modify activity data, add signals, validate
 * 
 * @param {string} hook - The hook point identifier
 * @param {object} data - The data being processed (e.g., activityData)
 * @param {object} context - { tenantId, memberLink, db }
 * @returns {object} The data, modified or unchanged
 */
export default function custauth(hook, data, context) {
  return data;
}
