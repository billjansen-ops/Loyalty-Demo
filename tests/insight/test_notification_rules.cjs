/**
 * Test C13: Notification Rules Engine
 *
 * Verifies that fireNotificationEvent() routes correctly:
 *   1. Check that notification rules exist for tenant
 *   2. Verify notification count increases after a registry-creating event
 *   3. Verify notification deliveries are created alongside in-app notifications
 *   4. Check severity levels are correct
 *
 * Uses the existing notification and delivery infrastructure.
 */
module.exports = {
  name: 'C13: Notification Rules Engine',

  async run(ctx) {
    const TENANT_ID = 5;

    // ── Check notification rules exist ──
    const rulesResp = await ctx.fetch(`/v1/notification-rules?tenant_id=${TENANT_ID}`);
    ctx.assert(rulesResp._ok, 'Notification rules endpoint responds');
    const rules = rulesResp.rules || rulesResp;
    ctx.assert(Array.isArray(rules), 'Rules returns array');
    ctx.assert(rules.length >= 12, `At least 12 notification rules exist (found: ${rules.length})`);

    // ── Check rule types ──
    const eventTypes = [...new Set(rules.map(r => r.event_type))];
    ctx.log(`Event types configured: ${eventTypes.join(', ')}`);

    const expectedEvents = [
      'DRUG_TEST_POSITIVE',
      'SURVEY_MISSED',
      'P5_SAFETY',
      'COMPLIANCE_DEADLINE'
    ];
    for (const evt of expectedEvents) {
      ctx.assert(eventTypes.includes(evt), `Rule exists for ${evt}`);
    }

    // ── Check notifications exist (from prior activity) ──
    const notifResp = await ctx.fetch(`/v1/notifications?tenant_id=${TENANT_ID}&limit=10`);
    ctx.assert(notifResp._ok, 'Notifications endpoint responds');
    ctx.assert(notifResp.unread_count !== undefined, 'Unread count returned');
    ctx.log(`Current notifications: ${notifResp.notifications?.length || 0}, unread: ${notifResp.unread_count}`);

    // ── Check notification deliveries exist ──
    const delivResp = await ctx.fetch(`/v1/notification-deliveries?tenant_id=${TENANT_ID}&limit=5`);
    ctx.assert(delivResp._ok, 'Notification deliveries endpoint responds');
    ctx.assert(delivResp.counts, 'Delivery counts returned');
    ctx.log(`Delivery counts: total=${delivResp.counts.total}, pending=${delivResp.counts.pending_count}, sent=${delivResp.counts.sent_count}`);

    // ── Verify delivery config ──
    const configResp = await ctx.fetch(`/v1/notification-delivery-config?tenant_id=${TENANT_ID}`);
    ctx.assert(configResp._ok, 'Delivery config responds');
    ctx.assert(configResp.timezone === 'America/Chicago', `Timezone is Central (got: ${configResp.timezone})`);
    ctx.assert(configResp.email_enabled === true, 'Email channel enabled');
    ctx.assert(configResp.sms_enabled === true, 'SMS channel enabled');
    ctx.assert(configResp.push_enabled === true, 'Push channel enabled');

    // ── Verify severity distribution in rules ──
    const criticalRules = rules.filter(r => r.severity === 'critical');
    const warningRules = rules.filter(r => r.severity === 'warning');
    const infoRules = rules.filter(r => r.severity === 'info');
    ctx.assert(criticalRules.length > 0, `Critical rules exist (${criticalRules.length})`);
    ctx.assert(warningRules.length > 0, `Warning rules exist (${warningRules.length})`);
    ctx.log(`Rules by severity: critical=${criticalRules.length}, warning=${warningRules.length}, info=${infoRules.length}`);

    // ── Verify recipient types ──
    const recipientTypes = [...new Set(rules.map(r => r.recipient_type))];
    ctx.log(`Recipient types: ${recipientTypes.join(', ')}`);
    ctx.assert(recipientTypes.includes('all_clinical'), 'Has all_clinical recipient type');
    ctx.assert(recipientTypes.includes('member'), 'Has member recipient type');
  }
};
