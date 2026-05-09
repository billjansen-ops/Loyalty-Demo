/**
 * Test C10: Follow-up Scheduling + Outcome Tracking
 *
 * Verifies:
 *   A: Follow-ups exist for registry items with dominant drivers
 *   B: Follow-up summary endpoint returns correct counts
 *   C: Completing a follow-up with outcome works
 *
 * Uses existing registry items and follow-ups.
 */
module.exports = {
  name: 'C10: Follow-up Scheduling + Outcome',

  async run(ctx) {
    const TENANT_ID = 5;

    // ── Fetch follow-ups ──
    ctx.log('--- Fetch follow-ups ---');
    const fuResp = await ctx.fetch(`/v1/registry-followups?tenant_id=${TENANT_ID}`);
    ctx.assert(fuResp._ok, 'Follow-ups endpoint responds');

    const followups = fuResp.followups || [];
    ctx.assert(followups.length > 0, `Follow-ups exist (got: ${followups.length})`);

    if (!followups.length) return;

    // ── Verify follow-up structure ──
    ctx.log('--- Verify follow-up structure ---');
    const sample = followups[0];
    ctx.assert(sample.followup_id, 'Follow-up has ID');
    ctx.assert(sample.registry_link, 'Follow-up has registry_link');
    ctx.assert(sample.followup_type, `Follow-up has type (got: ${sample.followup_type})`);
    ctx.assert(sample.scheduled_date_display || sample.scheduled_date, 'Follow-up has scheduled date');
    ctx.assert(sample.fname, 'Follow-up has member name');

    // ── Verify follow-up types ──
    const validTypes = ['48h', 'weekly', '2wk', '4wk', '8wk', 'compliance_period'];
    for (const fu of followups.slice(0, 10)) {
      ctx.assert(validTypes.includes(fu.followup_type),
        `Valid follow-up type: ${fu.followup_type} (member: ${fu.membership_number})`);
    }

    // ── Verify sort order: pending first, then completed most-recent-first ──
    // Per Erica's feedback — completed follow-ups were sorted oldest-first,
    // pushing the most recent completion to the bottom. The list now sorts
    // pending first (by scheduled_date ASC), then completed (by completed_ts
    // DESC). This assertion catches a regression to the old order.
    ctx.log('--- Verify sort order ---');
    const firstCompletedIdx = followups.findIndex(f => f.completed_ts);
    if (firstCompletedIdx > 0) {
      const lastPendingIdx = firstCompletedIdx - 1;
      ctx.assert(!followups[lastPendingIdx].completed_ts,
        'pending follow-ups appear before completed ones');
    }
    // Among completed: most recent should be FIRST (closest to top of completed section).
    const completed = followups.filter(f => f.completed_ts);
    if (completed.length >= 2) {
      const top = completed[0].completed_ts;
      const bottom = completed[completed.length - 1].completed_ts;
      ctx.assert(top >= bottom,
        `most recent completed follow-up at top of completed list (top=${top}, bottom=${bottom})`);
    }

    // ── Fetch summary ──
    ctx.log('--- Fetch follow-up summary ---');
    const sumResp = await ctx.fetch(`/v1/registry-followups/summary?tenant_id=${TENANT_ID}`);
    ctx.assert(sumResp._ok, 'Follow-up summary endpoint responds');
    ctx.assert(sumResp.pending !== undefined, `Summary has pending count (got: ${sumResp.pending})`);
    ctx.assert(sumResp.overdue !== undefined, `Summary has overdue count (got: ${sumResp.overdue})`);
    ctx.log(`Summary: pending=${sumResp.pending}, overdue=${sumResp.overdue}, completed=${sumResp.completed}`);

    // ── Complete a follow-up ──
    ctx.log('--- Complete a follow-up ---');
    // Find a pending follow-up
    const pending = followups.find(f => !f.completed_date && !f.completed_ts);
    if (pending) {
      const patchResp = await ctx.fetch(`/v1/registry-followups/${pending.followup_id}`, {
        method: 'PATCH',
        body: {
          outcome: 'stable',
          notes: 'Test harness: automated follow-up completion',
          tenant_id: TENANT_ID
        }
      });
      ctx.assert(patchResp._ok, `Follow-up ${pending.followup_id} completed successfully`);

      // Verify it shows as completed now
      const verifyResp = await ctx.fetch(`/v1/registry-followups?tenant_id=${TENANT_ID}`);
      if (verifyResp._ok) {
        const updated = (verifyResp.followups || []).find(f => f.followup_id === pending.followup_id);
        if (updated) {
          ctx.assert(updated.outcome === 'stable', `Outcome recorded as stable (got: ${updated.outcome})`);
          ctx.assert(updated.completed_date || updated.completed_ts, 'Completed date/timestamp set');
        }
      }
    } else {
      ctx.log('No pending follow-ups available to test completion');
    }

    // ── Verify overdue detection ──
    ctx.log('--- Verify overdue logic ---');
    const overdueItems = followups.filter(f => f.is_overdue);
    ctx.log(`${overdueItems.length} overdue follow-ups`);
    for (const od of overdueItems.slice(0, 3)) {
      ctx.assert(!od.completed_date, `Overdue item ${od.followup_id} is not completed`);
    }

    // ══════════════════════════════════════════════
    // BROWSER: Verify follow-ups tab on action queue
    // ══════════════════════════════════════════════
    if (!ctx.hasBrowser()) { ctx.log('Skipping browser tests — playwright not available'); return; }

    ctx.log('--- Browser: Follow-ups tab loads ---');
    try {
      const page = await ctx.openPageWithContext(
        '/verticals/workforce_monitoring/action_queue.html',
        { programId: 13, partnerId: 1 }
      );
      await page.waitForTimeout(3000);
      // Click follow-ups tab
      const hasFollowupsTab = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[onclick*="followup"], [data-tab="followups"], button, .tab-btn');
        for (const t of tabs) {
          if (t.textContent.includes('Follow') || t.textContent.includes('follow')) {
            t.click();
            return true;
          }
        }
        return false;
      });
      if (hasFollowupsTab) {
        await page.waitForTimeout(1500);
        const pageText = await page.evaluate(() => document.body.innerText);
        const hasFollowupData = pageText.includes('48h') || pageText.includes('weekly') || pageText.includes('Scheduled') || pageText.includes('Follow');
        ctx.assert(hasFollowupData, 'Browser: Follow-ups tab shows follow-up data');
      } else {
        ctx.log('Browser: Follow-ups tab not found — checking if data shows inline');
      }
      await page.close();
    } catch(e) {
      ctx.assert(false, `Browser: Follow-ups failed — ${e.message.substring(0, 100)}`);
    }
  }
};
