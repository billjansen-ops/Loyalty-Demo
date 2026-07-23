/**
 * Test C10: Follow-up Scheduling + Outcome Tracking
 *
 * Verifies:
 *   A: Follow-ups exist for registry items with dominant drivers
 *   B: Follow-up summary endpoint returns correct counts
 *   C: Completing a follow-up with outcome works
 *   D: The "No longer needed" outcome (not_needed, v127) completes a check,
 *      drops it from the pending count, and NEVER rings the F1 escalation
 *      (positive-controlled against a declining outcome on the same item)
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

    // Session 152 (Bill's ruling): the summary counts the SAME population the
    // worklist shows — follow-ups outlive their registry item's resolution
    // (after-care), so no status filter may quietly shrink the chips/badge.
    // The two endpoints must agree exactly.
    const listPending = followups.filter(f => !f.completed_ts).length;
    const listCompleted = followups.filter(f => f.completed_ts).length;
    ctx.assertEqual(Number(sumResp.pending), listPending,
      'summary pending equals the worklist pending count (chips match the queue)');
    ctx.assertEqual(Number(sumResp.completed), listCompleted,
      'summary completed equals the worklist completed count');

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

    // ══════════════════════════════════════════════
    // D: "No longer needed" (not_needed, v127) — completes a check,
    //    drops it from the pending count, rings NOTHING.
    // ══════════════════════════════════════════════
    ctx.log('--- The "No longer needed" outcome (not_needed) ---');
    // Everything below goes through the platform's own doors: people are
    // addressed by membership_number, a member's registry items are read from
    // the member endpoint, the escalation job is fired via the scheduled-jobs
    // API. No raw links, no direct table access.
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });

    // Find the F1 intervention-failure escalation job by its code.
    const jobs = await ctx.fetch(`/v1/scheduled/jobs?tenant_id=${TENANT_ID}`);
    const f1Job = (Array.isArray(jobs) ? jobs : []).find(j => j.job_code === 'F1_T5');
    ctx.assert(!!f1Job, `F1_T5 escalation job exists (id ${f1Job && f1Job.scheduled_job_id})`);
    const f1JobId = f1Job && f1Job.scheduled_job_id;
    const runF1 = () => ctx.fetch(`/v1/scheduled/jobs/${f1JobId}/run?tenant_id=${TENANT_ID}`, { method: 'POST' });

    // Count a member's open F1 escalation cards — read through the member's
    // registry endpoint, keyed on membership_number (no link handling).
    const openF1ForMember = async (membershipNumber) => {
      const reg = await ctx.fetch(`/v1/stability-registry/member/${membershipNumber}?tenant_id=${TENANT_ID}`);
      return (reg.items || []).filter(i => i.extended_card === 'F1' && i.status !== 'R').length;
    };

    // A CLEAN subject: a pending follow-up on an OPEN registry item whose member
    // has no open F1 card AND no other completed declining/escalated check on an
    // open item (either would ring F1 independently). Both facts come from the
    // follow-ups list + the member endpoint, so the only thing that can ring F1
    // is the outcome we choose — the assertions stay deterministic.
    const dList = (await ctx.fetch(`/v1/registry-followups?tenant_id=${TENANT_ID}`)).followups || [];
    const wouldRingFor = mnum => dList.some(f =>
      String(f.membership_number) === String(mnum) && f.completed_ts &&
      ['declining', 'escalated'].includes(f.outcome) && f.registry_status === 'O');
    const pickClean = async (excludeMnum) => {
      for (const f of dList) {
        if (f.completed_ts || f.registry_status !== 'O') continue;
        if (excludeMnum && String(f.membership_number) === String(excludeMnum)) continue;
        if (wouldRingFor(f.membership_number)) continue;
        if (await openF1ForMember(f.membership_number) !== 0) continue;
        return f;
      }
      return null;
    };

    const nnFollowup = await pickClean(null);
    if (!nnFollowup) {
      ctx.log('No clean pending follow-up on an open item available — skipping the not_needed escalation test');
    } else {
      const pendingBefore = Number((await ctx.fetch(`/v1/registry-followups/summary?tenant_id=${TENANT_ID}`)).pending);

      // Complete the check as "No longer needed".
      const patchNN = await ctx.fetch(`/v1/registry-followups/${nnFollowup.followup_id}`, {
        method: 'PATCH',
        body: { outcome: 'not_needed', notes: 'Test: after-care check no longer applies', tenant_id: TENANT_ID }
      });
      ctx.assert(patchNN._ok, `Follow-up completed as not_needed (${patchNN._status}${patchNN.error ? ': ' + patchNN.error : ''})`);

      // It reads back completed with the new outcome and leaves the pending count.
      const listAfter = await ctx.fetch(`/v1/registry-followups?tenant_id=${TENANT_ID}`);
      const nnRow = (listAfter.followups || []).find(x => x.followup_id === nnFollowup.followup_id);
      ctx.assert(nnRow && nnRow.outcome === 'not_needed', `Outcome recorded as not_needed (got: ${nnRow && nnRow.outcome})`);
      ctx.assert(nnRow && (nnRow.completed_ts || nnRow.completed_date), 'not_needed check is completed');
      ctx.assert(!(listAfter.followups || []).some(x => x.followup_id === nnFollowup.followup_id && !x.completed_ts),
        'the not_needed follow-up no longer appears as pending');
      const pendingAfter = Number((await ctx.fetch(`/v1/registry-followups/summary?tenant_id=${TENANT_ID}`)).pending);
      ctx.assertEqual(pendingAfter, pendingBefore - 1, 'not_needed drops the check from the pending count (down exactly one)');

      // Fire the escalation job: not_needed must create NOTHING for this member.
      const runNN = await runF1();
      ctx.assert(runNN._ok, `F1_T5 job ran after the not_needed check (${runNN._status})`);
      ctx.assertEqual(await openF1ForMember(nnFollowup.membership_number), 0,
        'not_needed rang NOTHING — no F1 escalation card created');

      // Positive control: a DIFFERENT clean person, completed 'declining', MUST
      // ring an F1 when the same job runs — proving the silence above is a real
      // gate, not a dead job.
      const declFollowup = await pickClean(nnFollowup.membership_number);
      if (declFollowup) {
        const declBefore = await openF1ForMember(declFollowup.membership_number);
        const patchDecl = await ctx.fetch(`/v1/registry-followups/${declFollowup.followup_id}`, {
          method: 'PATCH',
          body: { outcome: 'declining', notes: 'Test: positive control', tenant_id: TENANT_ID }
        });
        ctx.assert(patchDecl._ok, `Control follow-up completed as declining (${patchDecl._status})`);
        const runDecl = await runF1();
        ctx.assert(runDecl._ok, `F1_T5 job ran after the declining check (${runDecl._status})`);
        ctx.assert(await openF1ForMember(declFollowup.membership_number) > declBefore,
          `positive control: declining DID create an F1 (before=${declBefore}) — not_needed's silence is real, not a dead job`);
      } else {
        ctx.log('No second clean subject for the declining positive control — skipping (the negative proof still holds)');
      }
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
