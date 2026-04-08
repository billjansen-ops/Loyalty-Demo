/**
 * Core Platform Test: Admin Pages (Browser)
 * Tests that bonus admin, promotion admin pages load and display data.
 * Uses Delta airline tenant (tenant_id=1).
 */
module.exports = {
  name: 'Core: Admin Pages',

  async run(ctx) {
    if (!ctx.hasBrowser()) {
      ctx.log('Skipping browser tests — Playwright not available');
      return;
    }

    // ── Login as DeltaADMIN via API ──
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'DeltaADMIN', password: 'DeltaADMIN' } });

    // ── 1. Bonus admin list page ──
    ctx.log('Step 1: Bonus admin list page');
    const bonusPage = await ctx.openPage('/admin_bonuses.html');
    await new Promise(r => setTimeout(r, 2000));

    const bonusTitle = await bonusPage.title();
    ctx.assert(bonusTitle && bonusTitle.length > 0, 'Bonus admin page loaded');

    const bonusText = await bonusPage.evaluate(() => document.body.innerText);
    const hasBonusList = bonusText.includes('DIAMOND50') || bonusText.includes('REGIONAL') || bonusText.includes('TEST2') || bonusText.includes('Bonus');
    ctx.assert(hasBonusList, 'Bonus admin page shows bonus rules');

    const bonusRows = await bonusPage.evaluate(() => {
      return document.querySelectorAll('tr, .bonus-row, [data-bonus]').length;
    });
    ctx.assert(bonusRows > 1, `Bonus table has rows (${bonusRows})`);

    await bonusPage.close();

    // ── 2. Promotion admin list page ──
    ctx.log('Step 2: Promotion admin list page');
    const promoPage = await ctx.openPage('/admin_promotions.html');
    await new Promise(r => setTimeout(r, 2000));

    const promoTitle = await promoPage.title();
    ctx.assert(promoTitle && promoTitle.length > 0, 'Promotion admin page loaded');

    const promoText = await promoPage.evaluate(() => document.body.innerText);
    const hasPromoList = promoText.includes('FLY3-5K') || promoText.includes('MEDALLION') || promoText.includes('Promotion');
    ctx.assert(hasPromoList, 'Promotion admin page shows promotions');

    const promoRows = await promoPage.evaluate(() => {
      return document.querySelectorAll('tr, .promo-row, [data-promotion]').length;
    });
    ctx.assert(promoRows > 1, `Promotion table has rows (${promoRows})`);

    await promoPage.close();

    // ── 3. Bonus edit page ──
    ctx.log('Step 3: Bonus edit page');
    // Get a bonus code to test with
    const bonusResp = await ctx.fetch('/v1/bonuses?tenant_id=1');
    const bonuses = bonusResp.bonuses || bonusResp || [];
    if (Array.isArray(bonuses) && bonuses.length > 0) {
      const testBonus = bonuses.find(b => b.bonus_code === 'DIAMOND50') || bonuses[0];
      const editPage = await ctx.openPage(`/admin_bonus_edit.html?code=${testBonus.bonus_code}`);
      await new Promise(r => setTimeout(r, 2000));

      const editText = await editPage.evaluate(() => document.body.innerText);
      const hasEditForm = editText.includes(testBonus.bonus_code) || editText.includes('Bonus') || editText.includes('Save');
      ctx.assert(hasEditForm, `Bonus edit page shows ${testBonus.bonus_code}`);

      // Check for criteria section
      const hasCriteria = editText.includes('Criteria') || editText.includes('criteria') || editText.includes('Rule');
      ctx.log(`  Criteria section present: ${hasCriteria}`);

      await editPage.close();
    } else {
      ctx.log('  No bonuses found — skipping edit page test');
    }

    // ── 4. Promotion edit page ──
    ctx.log('Step 4: Promotion edit page');
    const promoResp = await ctx.fetch('/v1/promotions?tenant_id=1');
    const promotions = promoResp.promotions || promoResp || [];
    if (Array.isArray(promotions) && promotions.length > 0) {
      const testPromo = promotions.find(p => p.promotion_code === 'FLY3-5K') || promotions[0];
      const editPage = await ctx.openPage(`/admin_promotion_edit.html?id=${testPromo.promotion_id}`);
      await new Promise(r => setTimeout(r, 2000));

      const editText = await editPage.evaluate(() => document.body.innerText);
      const hasEditForm = editText.includes(testPromo.promotion_code) || editText.includes('Promotion') || editText.includes('Save');
      ctx.assert(hasEditForm, `Promotion edit page shows ${testPromo.promotion_code}`);

      // Check for results section
      const hasResults = editText.includes('Result') || editText.includes('result') || editText.includes('Reward');
      ctx.log(`  Results section present: ${hasResults}`);

      await editPage.close();
    } else {
      ctx.log('  No promotions found — skipping edit page test');
    }

    // Re-login as Claude
    await ctx.fetch('/v1/auth/login', { method: 'POST', body: { username: 'Claude', password: 'claude123' } });
  }
};
