/**
 * Bonus Stats Modal
 * Shows statistics for a single bonus with period selection
 */
const BonusStatsModal = {
  currentBonus: null,
  currentPeriod: 'today',

  // Create modal HTML (called once)
  init() {
    if (document.getElementById('bonusStatsModal')) return;

    const modalHtml = `
      <div id="bonusStatsModal" class="bonus-stats-overlay" style="display:none;">
        <div class="bonus-stats-modal">
          <div class="bonus-stats-header">
            <h2 id="bonusStatsTitle">📊 Bonus Statistics</h2>
            <button class="bonus-stats-close" onclick="BonusStatsModal.close()">&times;</button>
          </div>
          <div class="bonus-stats-body">
            <div class="stats-period-buttons">
              <button class="period-btn active" data-period="today">Today</button>
              <button class="period-btn" data-period="week">Week</button>
              <button class="period-btn" data-period="month">Month</button>
              <button class="period-btn" data-period="year">Year</button>
              <button class="period-btn" data-period="lifetime">Lifetime</button>
            </div>
            <div class="stats-date-range">
              <input type="date" id="statsFromDate" title="From">
              <span>to</span>
              <input type="date" id="statsToDate" title="To">
              <button class="period-btn" onclick="BonusStatsModal.applyCustomRange()">Apply</button>
            </div>
            <div id="bonusStatsContent">
              Loading...
            </div>
          </div>
        </div>
      </div>
      <style>
        .bonus-stats-overlay {
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
        .bonus-stats-modal {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 520px;
          width: 90%;
        }
        .bonus-stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        .bonus-stats-header h2 {
          margin: 0;
          font-size: 18px;
        }
        .bonus-stats-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          line-height: 1;
        }
        .bonus-stats-close:hover {
          color: #111;
        }
        .bonus-stats-body {
          padding: 20px;
        }
        .stats-period-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .stats-period-buttons .period-btn,
        .stats-date-range .period-btn {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .stats-period-buttons .period-btn:hover,
        .stats-date-range .period-btn:hover {
          background: #f3f4f6;
        }
        .stats-period-buttons .period-btn.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .stats-date-range {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
        }
        .stats-date-range input {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
        }
        .stats-date-range span {
          color: #6b7280;
          font-size: 13px;
        }
        #bonusStatsContent {
          text-align: center;
          padding: 10px 0;
        }
        .stats-card {
          display: inline-block;
          margin: 10px;
          padding: 20px 30px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          text-align: center;
        }
        .stats-card .value {
          font-size: 32px;
          font-weight: 600;
          color: #2563eb;
        }
        .stats-card .label {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .stats-period-label {
          font-size: 13px;
          color: #6b7280;
          margin-top: 12px;
        }
      </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup period button clicks (only buttons with data-period)
    document.querySelectorAll('#bonusStatsModal .stats-period-buttons .period-btn[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#bonusStatsModal .stats-period-buttons .period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        BonusStatsModal.currentPeriod = btn.dataset.period;
        BonusStatsModal.loadStats();
      });
    });
  },

  // Open modal for a bonus
  open(bonusId, bonusCode, bonusStartDate = null) {
    this.init();
    this.currentBonus = { id: bonusId, code: bonusCode, startDate: bonusStartDate };
    this.currentPeriod = 'today';
    
    // Reset period buttons
    document.querySelectorAll('#bonusStatsModal .stats-period-buttons .period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#bonusStatsModal .stats-period-buttons .period-btn[data-period="today"]').classList.add('active');
    
    // Clear date inputs
    document.getElementById('statsFromDate').value = '';
    document.getElementById('statsToDate').value = '';
    
    document.getElementById('bonusStatsTitle').textContent = `📊 ${bonusCode} Statistics`;
    document.getElementById('bonusStatsModal').style.display = 'flex';
    this.loadStats();
  },

  close() {
    document.getElementById('bonusStatsModal').style.display = 'none';
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
    const fromDate = document.getElementById('statsFromDate').value;
    const toDate = document.getElementById('statsToDate').value;
    
    if (!fromDate || !toDate) {
      alert('Please select both from and to dates');
      return;
    }
    
    // Clear active state from preset buttons
    document.querySelectorAll('#bonusStatsModal .stats-period-buttons .period-btn').forEach(b => b.classList.remove('active'));
    
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
    const content = document.getElementById('bonusStatsContent');
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

    let url = `${window.LP_STATE?.apiBase || 'http://127.0.0.1:4001'}/v1/bonus-stats/${this.currentBonus.id}?tenant_id=${tenantId}`;
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
        <div class="stats-card">
          <div class="value">${parseInt(data.issued_count).toLocaleString()}</div>
          <div class="label">Times Issued</div>
        </div>
        <div class="stats-card">
          <div class="value">${parseInt(data.points_total).toLocaleString()}</div>
          <div class="label">Points Awarded</div>
        </div>
        <div class="stats-period-label">${periodLabel}</div>
      `;
    } catch (error) {
      console.error('Error loading bonus stats:', error);
      content.innerHTML = '<div style="color:#dc2626;">Error loading statistics</div>';
    }
  }
};
