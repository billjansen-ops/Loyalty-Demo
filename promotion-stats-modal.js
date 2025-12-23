/**
 * Promotion Stats Modal
 * Shows statistics for a single promotion with period selection
 * Displays: Enrollments, Qualifications, Points Issued
 */
const PromotionStatsModal = {
  currentPromotion: null,
  currentPeriod: 'today',
  currencyLabel: 'Points',

  // Create modal HTML (called once)
  init() {
    if (document.getElementById('promotionStatsModal')) return;

    const modalHtml = `
      <div id="promotionStatsModal" class="promo-stats-overlay" style="display:none;">
        <div class="promo-stats-modal">
          <div class="promo-stats-header">
            <h2 id="promotionStatsTitle">📊 Promotion Statistics</h2>
            <button class="promo-stats-close" onclick="PromotionStatsModal.close()">&times;</button>
          </div>
          <div class="promo-stats-body">
            <div class="promo-stats-period-buttons">
              <button class="promo-period-btn active" data-period="today">Today</button>
              <button class="promo-period-btn" data-period="week">Week</button>
              <button class="promo-period-btn" data-period="month">Month</button>
              <button class="promo-period-btn" data-period="year">Year</button>
              <button class="promo-period-btn" data-period="lifetime">Lifetime</button>
            </div>
            <div class="promo-stats-date-range">
              <input type="date" id="promoStatsFromDate" title="From">
              <span>to</span>
              <input type="date" id="promoStatsToDate" title="To">
              <button class="promo-period-btn" onclick="PromotionStatsModal.applyCustomRange()">Apply</button>
            </div>
            <div id="promotionStatsContent">
              Loading...
            </div>
          </div>
        </div>
      </div>
      <style>
        .promo-stats-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .promo-stats-modal {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
        }
        .promo-stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        .promo-stats-header h2 {
          margin: 0;
          font-size: 18px;
        }
        .promo-stats-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          line-height: 1;
        }
        .promo-stats-close:hover {
          color: #111;
        }
        .promo-stats-body {
          padding: 20px;
        }
        .promo-stats-period-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .promo-stats-period-buttons .promo-period-btn,
        .promo-stats-date-range .promo-period-btn {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .promo-stats-period-buttons .promo-period-btn:hover,
        .promo-stats-date-range .promo-period-btn:hover {
          background: #f3f4f6;
        }
        .promo-stats-period-buttons .promo-period-btn.active {
          background: #7c3aed;
          color: white;
          border-color: #7c3aed;
        }
        .promo-stats-date-range {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
        }
        .promo-stats-date-range input {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
        }
        .promo-stats-date-range span {
          color: #6b7280;
          font-size: 13px;
        }
        #promotionStatsContent {
          text-align: center;
          padding: 10px 0;
        }
        .promo-stats-card {
          display: inline-block;
          margin: 8px;
          padding: 16px 24px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          text-align: center;
          min-width: 120px;
        }
        .promo-stats-card .value {
          font-size: 28px;
          font-weight: 600;
          color: #7c3aed;
        }
        .promo-stats-card .label {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .promo-stats-card.enrolled .value {
          color: #059669;
        }
        .promo-stats-card.qualified .value {
          color: #2563eb;
        }
        .promo-stats-card.points .value {
          color: #7c3aed;
        }
        .promo-stats-period-label {
          font-size: 13px;
          color: #6b7280;
          margin-top: 12px;
        }
      </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup period button clicks (only buttons with data-period)
    document.querySelectorAll('#promotionStatsModal .promo-stats-period-buttons .promo-period-btn[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#promotionStatsModal .promo-stats-period-buttons .promo-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        PromotionStatsModal.currentPeriod = btn.dataset.period;
        PromotionStatsModal.loadStats();
      });
    });
  },

  // Load currency label from tenant
  async loadCurrencyLabel() {
    const tenantId = sessionStorage.getItem('tenant_id') || 1;
    try {
      const response = await fetch(`${window.LP_STATE?.apiBase || 'http://127.0.0.1:4001'}/v1/tenants/${tenantId}/labels`);
      if (response.ok) {
        const data = await response.json();
        if (data.currency_label) {
          this.currencyLabel = data.currency_label;
        }
      }
    } catch (err) {
      console.warn('Could not load currency_label:', err);
    }
  },

  // Open modal for a promotion
  async open(promotionId, promotionCode, promotionStartDate = null) {
    this.init();
    await this.loadCurrencyLabel();
    this.currentPromotion = { id: promotionId, code: promotionCode, startDate: promotionStartDate };
    this.currentPeriod = 'today';
    
    // Reset period buttons
    document.querySelectorAll('#promotionStatsModal .promo-stats-period-buttons .promo-period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#promotionStatsModal .promo-stats-period-buttons .promo-period-btn[data-period="today"]').classList.add('active');
    
    // Clear date inputs
    document.getElementById('promoStatsFromDate').value = '';
    document.getElementById('promoStatsToDate').value = '';
    
    document.getElementById('promotionStatsTitle').textContent = `📊 ${promotionCode} Statistics`;
    document.getElementById('promotionStatsModal').style.display = 'flex';
    this.loadStats();
  },

  close() {
    document.getElementById('promotionStatsModal').style.display = 'none';
  },

  getDateRange(period) {
    const today = new Date();
    let fromDate = null;
    let toDate = this.formatDate(today);

    switch (period) {
      case 'today':
        fromDate = toDate;
        break;
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        fromDate = this.formatDate(startOfWeek);
        break;
      case 'month':
        fromDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      case 'year':
        fromDate = `${today.getFullYear()}-01-01`;
        break;
      case 'lifetime':
        fromDate = null;
        toDate = null;
        break;
      case 'custom':
        // Handled by applyCustomRange
        break;
    }

    return { fromDate, toDate };
  },

  applyCustomRange() {
    const fromDate = document.getElementById('promoStatsFromDate').value;
    const toDate = document.getElementById('promoStatsToDate').value;
    
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }
    
    // Clear active state from preset buttons
    document.querySelectorAll('#promotionStatsModal .promo-stats-period-buttons .promo-period-btn').forEach(b => b.classList.remove('active'));
    
    this.currentPeriod = 'custom';
    this.customFromDate = fromDate;
    this.customToDate = toDate;
    this.loadStats(fromDate, toDate);
  },

  formatDate(date) {
    return date.toISOString().split('T')[0];
  },

  formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  async loadStats(customFrom = null, customTo = null) {
    const content = document.getElementById('promotionStatsContent');
    content.innerHTML = 'Loading...';

    const tenantId = sessionStorage.getItem('tenant_id') || 1;
    
    let fromDate, toDate;
    if (customFrom && customTo) {
      fromDate = customFrom;
      toDate = customTo;
    } else {
      const range = this.getDateRange(this.currentPeriod);
      fromDate = range.fromDate;
      toDate = range.toDate;
    }

    let url = `${window.LP_STATE?.apiBase || 'http://127.0.0.1:4001'}/v1/promotion-stats/${this.currentPromotion.id}?tenant_id=${tenantId}`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      
      // Build period label
      let periodLabel = '';
      if (!fromDate && !toDate) {
        periodLabel = 'All time';
      } else if (fromDate === toDate) {
        periodLabel = this.formatDisplayDate(fromDate);
      } else {
        periodLabel = `${this.formatDisplayDate(fromDate)} — ${this.formatDisplayDate(toDate)}`;
      }

      content.innerHTML = `
        <div class="promo-stats-card enrolled">
          <div class="value">${parseInt(data.enrolled_count).toLocaleString()}</div>
          <div class="label">Enrollments</div>
        </div>
        <div class="promo-stats-card qualified">
          <div class="value">${parseInt(data.qualified_count).toLocaleString()}</div>
          <div class="label">Qualifications</div>
        </div>
        <div class="promo-stats-card points">
          <div class="value">${parseInt(data.points_total).toLocaleString()}</div>
          <div class="label">${this.currencyLabel} Issued</div>
        </div>
        <div class="promo-stats-period-label">${periodLabel}</div>
      `;
    } catch (error) {
      console.error('Error loading promotion stats:', error);
      content.innerHTML = '<div style="color:#dc2626;">Error loading statistics</div>';
    }
  }
};
