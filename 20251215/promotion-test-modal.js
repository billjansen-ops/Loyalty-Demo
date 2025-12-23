// promotion-test-modal.js
// Test Promotion modal logic
// Sends BOTH membership_number and member_id (same value) in the payload
// so the backend can accept either field name during the transition period.

function openPromotionTestModal(promotionCode, membership_number) {
  const modal = document.getElementById('promotionTestModal');
  if (!modal) {
    console.error('promotionTestModal element not found');
    return;
  }

  modal.style.display = 'block';

  const promoInput = document.getElementById('promotionCodeInput');
  const memberInput = document.getElementById('membershipNumberInput');

  if (promoInput) promoInput.value = promotionCode || '';
  if (memberInput) memberInput.value = membership_number || '';
}

async function runPromotionTest() {
  const promoInput = document.getElementById('promotionCodeInput');
  const memberInput = document.getElementById('membershipNumberInput');
  const resultEl   = document.getElementById('promotionTestResult');

  const promotionCode = promoInput ? promoInput.value.trim() : '';
  const membership_number = memberInput ? memberInput.value.trim() : '';

  if (!promotionCode) {
    if (resultEl) resultEl.innerText = 'Error: promotion code is required.';
    return;
  }

  if (!membership_number) {
    if (resultEl) resultEl.innerText = 'Error: membership number is required.';
    return;
  }

  // For now, molecules are empty here; the server-side test-promotion-rule
  // endpoint will use the supplied activity/molecules structure if needed.
  const payload = {
    // New contract: prefer membership_number, but also send member_id
    // for backwards compatibility with existing server logic.
    membership_number: membership_number,
    member_id: membership_number,
    molecules: []
  };

  try {
    const res = await fetch(`/v1/test-promotion-rule/${encodeURIComponent(promotionCode)}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (resultEl) {
      resultEl.innerText = JSON.stringify(data, null, 2);
    } else {
      console.log('Promotion test result:', data);
    }
  } catch (err) {
    console.error('Error calling test-promotion-rule:', err);
    if (resultEl) {
      resultEl.innerText = 'Error calling test-promotion-rule endpoint. See console for details.';
    }
  }
}
