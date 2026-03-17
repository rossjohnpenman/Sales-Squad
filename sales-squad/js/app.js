const App = {
  state: {
    section: 'dashboard',
    dashPeriod: 'monthly',
    reportsPeriod: 'monthly',
    reportsGran: 'week',
    pipelineFilter: 'all',
    activityFilter: 'all'
  },

  // ─── FORMAT HELPERS ───────────────────────────────────────────────────────
  fmt: {
    currency(v) { return '£' + Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    pct(v) { return isNaN(v) ? '—' : Number(v).toFixed(1) + '%'; },
    num(v) { return Number(v || 0).toLocaleString('en-GB'); },
    date(str) { return str ? new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; },
    days(n) { return n === 0 ? '—' : n + ' day' + (n !== 1 ? 's' : ''); }
  },

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  navigate(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + section).classList.add('active');
    document.querySelector(`.nav-item[data-section="${section}"]`).classList.add('active');
    this.state.section = section;
    this.renderSection(section);
  },

  renderSection(section) {
    switch (section) {
      case 'dashboard': this.renderDashboard(); break;
      case 'activity':  this.renderActivity(); break;
      case 'pipeline':  this.renderPipeline(); break;
      case 'reports':   this.renderReports(); break;
      case 'settings':  this.renderSettings(); break;
    }
  },

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  renderDashboard() {
    const period = this.state.dashPeriod;
    const entries = SalesData.getEntries();
    const pipeline = SalesData.getPipeline();
    const targets = SalesData.getTargets();

    const filtered = Metrics.filterEntries(entries, period);
    const totals = Metrics.aggregate(filtered);
    const r = Metrics.rates(totals);
    const pm = Metrics.pipelineMetrics(pipeline);
    const tva = Metrics.targetVsActual(totals, targets, period);

    const el = document.getElementById('section-dashboard');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-sub">${Metrics.periodLabel(period)}</p>
        </div>
        <div class="period-tabs">
          ${['daily','weekly','monthly','quarterly','annual'].map(p => `
            <button class="period-btn ${p === period ? 'active' : ''}" onclick="App.setPeriod('${p}')">${{daily:'Today',weekly:'Week',monthly:'Month',quarterly:'Quarter',annual:'Year'}[p]}</button>
          `).join('')}
        </div>
      </div>

      <div class="kpi-grid">
        ${this._kpi('Leads', this.fmt.num(totals.leads), 'Total leads generated', 'blue')}
        ${this._kpi('Meetings Booked', this.fmt.num(totals.meetings_scheduled), 'Scheduled meetings', 'amber')}
        ${this._kpi('Show Rate', this.fmt.pct(r.show_rate), `${totals.meetings_attended} of ${totals.meetings_scheduled} attended`, 'purple')}
        ${this._kpi('Active Prospects', this.fmt.num(totals.conversations), 'Prospects engaged', 'navy')}
        ${this._kpi('Sales (Units)', this.fmt.num(totals.units), 'Closed deals', 'green')}
        ${this._kpi('Sales (Revenue)', this.fmt.currency(totals.revenue), 'Total earned', 'red')}
        ${this._kpi('Lead → Prospect', this.fmt.pct(r.lead_to_prospect), 'Leads converted to prospects', 'blue')}
        ${this._kpi('Prospect → Sale', this.fmt.pct(r.prospect_to_client), 'Prospects converted to sales', 'green')}
      </div>

      <div class="two-col">
        <div class="card">
          <h3 class="card-title">Target vs Actual</h3>
          ${this._tvaRows(tva, period)}
        </div>
        <div class="card">
          <h3 class="card-title">Pipeline</h3>
          <div class="forecast-grid">
            <div class="forecast-item">
              <div class="forecast-label">Active Deals</div>
              <div class="forecast-value">${pm.openCount}</div>
              <div class="forecast-sub">Open pipeline deals</div>
            </div>
            <div class="forecast-item">
              <div class="forecast-label">Pipeline Value</div>
              <div class="forecast-value">${this.fmt.currency(pm.pipelineValue)}</div>
              <div class="forecast-sub">Total potential revenue</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Revenue Trend</h3>
        <div class="chart-wrap chart-tall"><canvas id="chart-revenue-dash"></canvas></div>
      </div>
    `;

    const allTrend = Metrics.trendData(entries, 'month');
    SalesCharts.revenue('chart-revenue-dash', allTrend);
  },

  _kpi(label, value, sub, color) {
    return `<div class="kpi-card kpi-${color}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  },

  _rate(label, value, sub) {
    const pct = isNaN(value) ? 0 : Math.min(value, 100);
    const color = pct >= 50 ? '#22c55e' : pct >= 25 ? '#f59e0b' : '#e63946';
    return `<div class="card rate-card">
      <div class="rate-label">${label}</div>
      <div class="rate-value" style="color:${color}">${this.fmt.pct(value)}</div>
      <div class="rate-bar-bg"><div class="rate-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="rate-sub">${sub}</div>
    </div>`;
  },

  _tvaRows(tva, period) {
    const items = [
      { key: 'leads', label: 'Leads' },
      { key: 'conversations', label: 'Conversations' },
      { key: 'meetings', label: 'Meetings' },
      { key: 'units', label: 'Units' },
      { key: 'revenue', label: 'Revenue', currency: true }
    ];
    const periodName = { daily: 'today', weekly: 'this week', monthly: 'this month', quarterly: 'this quarter', annual: 'this year' }[period];

    if (items.every(i => tva[i.key].target === 0)) {
      return `<p class="empty-state">No targets set for ${periodName}. <button class="link-btn" onclick="App.navigate('settings')">Set targets →</button></p>`;
    }

    return items.map(i => {
      const d = tva[i.key];
      if (d.target === 0) return '';
      const pct = d.pct !== null ? Math.min(d.pct, 100) : 0;
      const color = d.onTrack ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#e63946';
      const actualStr = i.currency ? this.fmt.currency(d.actual) : this.fmt.num(d.actual);
      const targetStr = i.currency ? this.fmt.currency(d.target) : this.fmt.num(d.target);
      return `<div class="tva-row">
        <div class="tva-meta">
          <span class="tva-label">${i.label}</span>
          <span class="tva-nums">${actualStr} <span class="tva-sep">/</span> ${targetStr}</span>
        </div>
        <div class="tva-bar-bg">
          <div class="tva-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="tva-pct" style="color:${color}">${d.pct !== null ? Math.round(d.pct) + '%' : '—'}</span>
      </div>`;
    }).join('');
  },

  _forecastCard(fc, targets, period) {
    const t = targets[period] || {};
    const projRevPct = t.revenue > 0 ? Math.round(fc.projected_revenue / t.revenue * 100) : null;
    const projUnitsPct = t.units > 0 ? Math.round(fc.projected_units / t.units * 100) : null;
    return `
      <div class="forecast-grid">
        <div class="forecast-item">
          <div class="forecast-label">Period Progress</div>
          <div class="forecast-value">${fc.pct_complete}%</div>
          <div class="forecast-sub">${fc.elapsedDays} of ${fc.totalDays} days elapsed</div>
        </div>
        <div class="forecast-item">
          <div class="forecast-label">Projected Revenue</div>
          <div class="forecast-value">${this.fmt.currency(fc.projected_revenue)}</div>
          <div class="forecast-sub">${projRevPct !== null ? projRevPct + '% of target' : 'No target set'}</div>
        </div>
        <div class="forecast-item">
          <div class="forecast-label">Projected Units</div>
          <div class="forecast-value">${this.fmt.num(fc.projected_units)}</div>
          <div class="forecast-sub">${projUnitsPct !== null ? projUnitsPct + '% of target' : 'No target set'}</div>
        </div>
        <div class="forecast-item">
          <div class="forecast-label">Daily Run Rate</div>
          <div class="forecast-value">${this.fmt.currency(Math.round(fc.revenue / fc.elapsedDays))}</div>
          <div class="forecast-sub">${fc.remainingDays} days remaining</div>
        </div>
      </div>`;
  },

  _timeMetrics(pm) {
    return `<div class="time-metrics">
      <div class="time-item">
        <div class="time-label">Avg Lead → Prospect</div>
        <div class="time-value">${this.fmt.days(pm.avgLeadTime)}</div>
      </div>
      <div class="time-item">
        <div class="time-label">Avg Prospect → Client</div>
        <div class="time-value">${this.fmt.days(pm.avgProspectTime)}</div>
      </div>
      <div class="time-item">
        <div class="time-label">Total Acquisition Time</div>
        <div class="time-value">${this.fmt.days(pm.totalAcquisitionTime)}</div>
      </div>
      <div class="time-item">
        <div class="time-label">Win Rate</div>
        <div class="time-value">${this.fmt.pct(pm.winRate)}</div>
      </div>
      <div class="time-item">
        <div class="time-label">Won Deals</div>
        <div class="time-value">${pm.wonCount}</div>
      </div>
      <div class="time-item">
        <div class="time-label">Lost Deals</div>
        <div class="time-value">${pm.lostCount}</div>
      </div>
    </div>`;
  },

  setPeriod(period) {
    this.state.dashPeriod = period;
    this.renderDashboard();
  },

  // ─── ACTIVITY LOG ─────────────────────────────────────────────────────────
  renderActivity() {
    const filter = this.state.activityFilter;
    const entries = SalesData.getEntries();
    const filtered = Metrics.filterEntries(entries, filter).sort((a, b) => b.date.localeCompare(a.date));
    const totals = Metrics.aggregate(filtered);

    const el = document.getElementById('section-activity');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Activity Log</h1>
          <p class="page-sub">${filtered.length} record${filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="header-actions">
          <div class="period-tabs">
            ${['all','daily','weekly','monthly','quarterly','annual'].map(p => `
              <button class="period-btn ${p === filter ? 'active' : ''}" onclick="App.setActivityFilter('${p}')">${{all:'All',daily:'Today',weekly:'Week',monthly:'Month',quarterly:'Quarter',annual:'Year'}[p]}</button>
            `).join('')}
          </div>
          <button class="btn-primary" onclick="App.showAddEntry()">+ Add Activity</button>
        </div>
      </div>

      ${filtered.length === 0 ? `<div class="empty-page">
        <div class="empty-icon">📊</div>
        <h3>No activity recorded</h3>
        <p>Start logging your daily sales activity to track progress.</p>
        <button class="btn-primary" onclick="App.showAddEntry()">Add First Entry</button>
      </div>` : `
      <div class="card table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Leads</th><th>Conversations</th>
              <th>Meetings Sched.</th><th>Meetings Att.</th>
              <th>Units Sold</th><th>Revenue</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(e => `
              <tr>
                <td>${this.fmt.date(e.date)}</td>
                <td>${e.leads || 0}</td>
                <td>${e.conversations || 0}</td>
                <td>${e.meetings_scheduled || 0}</td>
                <td>${e.meetings_attended || 0}</td>
                <td>${e.units || 0}</td>
                <td>${this.fmt.currency(e.revenue)}</td>
                <td class="notes-cell">${e.notes || ''}</td>
                <td class="actions-cell">
                  <button class="icon-btn edit-btn" onclick="App.showEditEntry('${e.id}')" title="Edit">✎</button>
                  <button class="icon-btn del-btn" onclick="App.deleteEntry('${e.id}')" title="Delete">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td><strong>TOTAL</strong></td>
              <td><strong>${totals.leads}</strong></td>
              <td><strong>${totals.conversations}</strong></td>
              <td><strong>${totals.meetings_scheduled}</strong></td>
              <td><strong>${totals.meetings_attended}</strong></td>
              <td><strong>${totals.units}</strong></td>
              <td><strong>${this.fmt.currency(totals.revenue)}</strong></td>
              <td></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>`}
    `;
  },

  setActivityFilter(filter) {
    this.state.activityFilter = filter;
    this.renderActivity();
  },

  showAddEntry() {
    const today = new Date().toISOString().split('T')[0];
    this.openModal('Add Activity Entry', `
      <form id="entry-form" onsubmit="App.saveEntry(event)">
        <div class="form-grid">
          <div class="form-group full">
            <label>Date</label>
            <input type="date" name="date" value="${today}" required>
          </div>
          <div class="form-group">
            <label>Leads</label>
            <input type="number" name="leads" min="0" placeholder="0">
          </div>
          <div class="form-group">
            <label>Conversations</label>
            <input type="number" name="conversations" min="0" placeholder="0">
          </div>
          <div class="form-group">
            <label>Meetings Scheduled</label>
            <input type="number" name="meetings_scheduled" min="0" placeholder="0">
          </div>
          <div class="form-group">
            <label>Meetings Attended</label>
            <input type="number" name="meetings_attended" min="0" placeholder="0">
          </div>
          <div class="form-group">
            <label>Units Sold</label>
            <input type="number" name="units" min="0" placeholder="0">
          </div>
          <div class="form-group">
            <label>Revenue (£)</label>
            <input type="number" name="revenue" min="0" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group full">
            <label>Notes</label>
            <textarea name="notes" rows="2" placeholder="Optional notes..."></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Save Entry</button>
        </div>
      </form>
    `);
  },

  showEditEntry(id) {
    const e = SalesData.getEntries().find(x => x.id === id);
    if (!e) return;
    this.openModal('Edit Activity Entry', `
      <form id="entry-form" onsubmit="App.saveEntry(event, '${id}')">
        <div class="form-grid">
          <div class="form-group full">
            <label>Date</label>
            <input type="date" name="date" value="${e.date}" required>
          </div>
          <div class="form-group">
            <label>Leads</label>
            <input type="number" name="leads" min="0" value="${e.leads || 0}">
          </div>
          <div class="form-group">
            <label>Conversations</label>
            <input type="number" name="conversations" min="0" value="${e.conversations || 0}">
          </div>
          <div class="form-group">
            <label>Meetings Scheduled</label>
            <input type="number" name="meetings_scheduled" min="0" value="${e.meetings_scheduled || 0}">
          </div>
          <div class="form-group">
            <label>Meetings Attended</label>
            <input type="number" name="meetings_attended" min="0" value="${e.meetings_attended || 0}">
          </div>
          <div class="form-group">
            <label>Units Sold</label>
            <input type="number" name="units" min="0" value="${e.units || 0}">
          </div>
          <div class="form-group">
            <label>Revenue (£)</label>
            <input type="number" name="revenue" min="0" step="0.01" value="${e.revenue || 0}">
          </div>
          <div class="form-group full">
            <label>Notes</label>
            <textarea name="notes" rows="2">${e.notes || ''}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    `);
  },

  saveEntry(event, id) {
    event.preventDefault();
    const form = event.target;
    const data = {
      date: form.date.value,
      leads: Number(form.leads.value) || 0,
      conversations: Number(form.conversations.value) || 0,
      meetings_scheduled: Number(form.meetings_scheduled.value) || 0,
      meetings_attended: Number(form.meetings_attended.value) || 0,
      units: Number(form.units.value) || 0,
      revenue: Number(form.revenue.value) || 0,
      notes: form.notes.value.trim()
    };
    if (id) {
      SalesData.updateEntry(id, data);
    } else {
      SalesData.addEntry(data);
    }
    this.closeModal();
    this.renderActivity();
  },

  deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    SalesData.deleteEntry(id);
    this.renderActivity();
  },

  // ─── PIPELINE ─────────────────────────────────────────────────────────────
  renderPipeline() {
    const filter = this.state.pipelineFilter;
    const pipeline = SalesData.getPipeline();
    const pm = Metrics.pipelineMetrics(pipeline);

    const stageLabels = { lead: 'Lead', prospect: 'Prospect', meeting: 'Meeting', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
    const stageBadge = s => `<span class="stage-badge stage-${s}">${stageLabels[s] || s}</span>`;

    let shown = filter === 'all' ? pipeline : pipeline.filter(d => d.stage === filter);
    shown = [...shown].sort((a, b) => (b.value || 0) - (a.value || 0));

    const el = document.getElementById('section-pipeline');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Pipeline</h1>
          <p class="page-sub">${pm.openCount} open · ${pm.totalDeals} total</p>
        </div>
        <button class="btn-primary" onclick="App.showAddDeal()">+ Add Deal</button>
      </div>

      <div class="pipeline-stats">
        <div class="stat-pill">
          <span class="stat-pill-label">Open Pipeline</span>
          <span class="stat-pill-value">${this.fmt.currency(pm.pipelineValue)}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Weighted Forecast</span>
          <span class="stat-pill-value">${this.fmt.currency(pm.weightedForecast)}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Won Value</span>
          <span class="stat-pill-value green">${this.fmt.currency(pm.wonValue)}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Win Rate</span>
          <span class="stat-pill-value">${this.fmt.pct(pm.winRate)}</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Avg Acquisition</span>
          <span class="stat-pill-value">${this.fmt.days(pm.totalAcquisitionTime)}</span>
        </div>
      </div>

      <div class="stage-filters">
        ${['all','lead','prospect','meeting','negotiation','won','lost'].map(s => `
          <button class="stage-filter-btn ${filter === s ? 'active' : ''}" onclick="App.setPipelineFilter('${s}')">
            ${s === 'all' ? 'All' : stageLabels[s]}
            <span class="filter-count">${s === 'all' ? pipeline.length : pipeline.filter(d => d.stage === s).length}</span>
          </button>
        `).join('')}
      </div>

      ${shown.length === 0 ? `<div class="empty-page">
        <div class="empty-icon">🎯</div>
        <h3>No deals in pipeline</h3>
        <p>Add your first deal to start tracking your pipeline.</p>
        <button class="btn-primary" onclick="App.showAddDeal()">Add First Deal</button>
      </div>` : `
      <div class="card table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Stage</th><th>Value</th><th>Probability</th>
              <th>Weighted</th><th>Lead Date</th><th>Prospect Date</th>
              <th>Close Date</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${shown.map(d => `
              <tr>
                <td><strong>${d.name || '—'}</strong></td>
                <td>${stageBadge(d.stage)}</td>
                <td>${this.fmt.currency(d.value)}</td>
                <td>${d.probability || 0}%</td>
                <td>${this.fmt.currency(Math.round((d.value || 0) * (d.probability || 0) / 100))}</td>
                <td>${this.fmt.date(d.lead_date)}</td>
                <td>${this.fmt.date(d.prospect_date)}</td>
                <td>${this.fmt.date(d.close_date)}</td>
                <td class="notes-cell">${d.notes || ''}</td>
                <td class="actions-cell">
                  <button class="icon-btn edit-btn" onclick="App.showEditDeal('${d.id}')" title="Edit">✎</button>
                  <button class="icon-btn del-btn" onclick="App.deleteDeal('${d.id}')" title="Delete">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  },

  setPipelineFilter(f) {
    this.state.pipelineFilter = f;
    this.renderPipeline();
  },

  _dealForm(d) {
    const today = new Date().toISOString().split('T')[0];
    const stageProbability = { lead: 10, prospect: 25, meeting: 50, negotiation: 75, won: 100, lost: 0 };
    const stageOpts = ['lead','prospect','meeting','negotiation','won','lost']
      .map(s => `<option value="${s}" ${d && d.stage === s ? 'selected' : ''}>${{lead:'Lead',prospect:'Prospect',meeting:'Meeting',negotiation:'Negotiation',won:'Won',lost:'Lost'}[s]}</option>`)
      .join('');
    return `
      <div class="form-grid">
        <div class="form-group full">
          <label>Deal / Client Name</label>
          <input type="text" name="name" value="${d ? (d.name || '') : ''}" required placeholder="e.g. Acme Corp">
        </div>
        <div class="form-group">
          <label>Stage</label>
          <select name="stage" id="deal-stage" onchange="App.updateProbability()">${stageOpts}</select>
        </div>
        <div class="form-group">
          <label>Probability (%)</label>
          <input type="number" name="probability" id="deal-prob" min="0" max="100" value="${d ? (d.probability || 0) : 10}">
        </div>
        <div class="form-group">
          <label>Value (£)</label>
          <input type="number" name="value" min="0" step="0.01" value="${d ? (d.value || '') : ''}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Lead Date</label>
          <input type="date" name="lead_date" value="${d ? (d.lead_date || today) : today}">
        </div>
        <div class="form-group">
          <label>Prospect Date</label>
          <input type="date" name="prospect_date" value="${d ? (d.prospect_date || '') : ''}">
        </div>
        <div class="form-group">
          <label>Close Date (Actual/Expected)</label>
          <input type="date" name="close_date" value="${d ? (d.close_date || '') : ''}">
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea name="notes" rows="2" placeholder="Optional notes...">${d ? (d.notes || '') : ''}</textarea>
        </div>
      </div>`;
  },

  updateProbability() {
    const stageEl = document.getElementById('deal-stage');
    const probEl = document.getElementById('deal-prob');
    if (!stageEl || !probEl) return;
    const map = { lead: 10, prospect: 25, meeting: 50, negotiation: 75, won: 100, lost: 0 };
    probEl.value = map[stageEl.value] || 0;
  },

  showAddDeal() {
    this.openModal('Add Deal', `
      <form id="deal-form" onsubmit="App.saveDeal(event)">
        ${this._dealForm(null)}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Add Deal</button>
        </div>
      </form>
    `);
  },

  showEditDeal(id) {
    const d = SalesData.getPipeline().find(x => x.id === id);
    if (!d) return;
    this.openModal('Edit Deal', `
      <form id="deal-form" onsubmit="App.saveDeal(event, '${id}')">
        ${this._dealForm(d)}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    `);
  },

  saveDeal(event, id) {
    event.preventDefault();
    const form = event.target;
    const data = {
      name: form.name.value.trim(),
      stage: form.stage.value,
      probability: Number(form.probability.value) || 0,
      value: Number(form.value.value) || 0,
      lead_date: form.lead_date.value,
      prospect_date: form.prospect_date.value,
      close_date: form.close_date.value,
      notes: form.notes.value.trim()
    };
    if (id) {
      SalesData.updateDeal(id, data);
    } else {
      SalesData.addDeal(data);
    }
    this.closeModal();
    this.renderPipeline();
  },

  deleteDeal(id) {
    if (!confirm('Delete this deal?')) return;
    SalesData.deleteDeal(id);
    this.renderPipeline();
  },

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  renderReports() {
    const period = this.state.reportsPeriod;
    const gran = this.state.reportsGran;
    const entries = SalesData.getEntries();
    const pipeline = SalesData.getPipeline();
    const targets = SalesData.getTargets();

    const filtered = Metrics.filterEntries(entries, period);
    const totals = Metrics.aggregate(filtered);
    const r = Metrics.rates(totals);
    const pm = Metrics.pipelineMetrics(pipeline);
    const tva = Metrics.targetVsActual(totals, targets, period);
    const trend = Metrics.trendData(filtered, gran);

    const el = document.getElementById('section-reports');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Reports</h1>
          <p class="page-sub">${Metrics.periodLabel(period)}</p>
        </div>
        <div class="header-actions">
          <div class="period-tabs">
            ${['daily','weekly','monthly','quarterly','annual'].map(p => `
              <button class="period-btn ${p === period ? 'active' : ''}" onclick="App.setReportsPeriod('${p}')">${{daily:'Today',weekly:'Week',monthly:'Month',quarterly:'Quarter',annual:'Year'}[p]}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="report-controls">
        <span class="control-label">Granularity:</span>
        ${['day','week','month'].map(g => `
          <button class="gran-btn ${g === gran ? 'active' : ''}" onclick="App.setGranularity('${g}')">${g.charAt(0).toUpperCase() + g.slice(1)}</button>
        `).join('')}
        <div class="export-btns">
          <button class="btn-secondary" onclick="App.exportActivityCSV()">Export Activity CSV</button>
          <button class="btn-secondary" onclick="App.exportPipelineCSV()">Export Pipeline CSV</button>
          <button class="btn-secondary" onclick="App.printReport()">Print Report</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 class="card-title">Revenue Trend</h3>
        <div class="chart-wrap chart-tall"><canvas id="chart-revenue-rep"></canvas></div>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 class="card-title">Conversion Activity Trend</h3>
        <div class="chart-wrap chart-tall"><canvas id="chart-conversion-rep"></canvas></div>
      </div>

      <div class="two-col">
        <div class="card">
          <h3 class="card-title">Conversion Funnel</h3>
          <div class="chart-wrap"><canvas id="chart-funnel-rep"></canvas></div>
        </div>
        <div class="card">
          <h3 class="card-title">Pipeline by Stage</h3>
          <div class="chart-wrap"><canvas id="chart-pipeline-rep"></canvas></div>
        </div>
      </div>

      <div class="card" style="margin-top:1rem">
        <h3 class="card-title">Target vs Actual</h3>
        <div class="chart-wrap"><canvas id="chart-tva-rep"></canvas></div>
      </div>

      <div class="two-col" style="margin-top:1rem">
        <div class="card">
          <h3 class="card-title">Period Summary</h3>
          <div class="summary-grid">
            <div class="sum-item"><span>Leads</span><strong>${this.fmt.num(totals.leads)}</strong></div>
            <div class="sum-item"><span>Conversations</span><strong>${this.fmt.num(totals.conversations)}</strong></div>
            <div class="sum-item"><span>Meetings Scheduled</span><strong>${this.fmt.num(totals.meetings_scheduled)}</strong></div>
            <div class="sum-item"><span>Meetings Attended</span><strong>${this.fmt.num(totals.meetings_attended)}</strong></div>
            <div class="sum-item"><span>Units Sold</span><strong>${this.fmt.num(totals.units)}</strong></div>
            <div class="sum-item"><span>Revenue</span><strong>${this.fmt.currency(totals.revenue)}</strong></div>
            <div class="sum-item"><span>Avg Deal Value</span><strong>${this.fmt.currency(r.avg_deal_value)}</strong></div>
            <div class="sum-item"><span>Lead → Client Rate</span><strong>${this.fmt.pct(r.lead_to_client)}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3 class="card-title">Pipeline Summary</h3>
          <div class="summary-grid">
            <div class="sum-item"><span>Open Deals</span><strong>${pm.openCount}</strong></div>
            <div class="sum-item"><span>Pipeline Value</span><strong>${this.fmt.currency(pm.pipelineValue)}</strong></div>
            <div class="sum-item"><span>Weighted Forecast</span><strong>${this.fmt.currency(pm.weightedForecast)}</strong></div>
            <div class="sum-item"><span>Won Deals</span><strong>${pm.wonCount}</strong></div>
            <div class="sum-item"><span>Won Value</span><strong>${this.fmt.currency(pm.wonValue)}</strong></div>
            <div class="sum-item"><span>Win Rate</span><strong>${this.fmt.pct(pm.winRate)}</strong></div>
            <div class="sum-item"><span>Avg Lead Time</span><strong>${this.fmt.days(pm.avgLeadTime)}</strong></div>
            <div class="sum-item"><span>Avg Acq. Time</span><strong>${this.fmt.days(pm.totalAcquisitionTime)}</strong></div>
          </div>
        </div>
      </div>
    `;

    SalesCharts.revenue('chart-revenue-rep', trend);
    SalesCharts.conversionTrend('chart-conversion-rep', trend);
    SalesCharts.funnel('chart-funnel-rep', totals);
    SalesCharts.pipelineStages('chart-pipeline-rep', pm.stages);
    SalesCharts.targetVsActual('chart-tva-rep', tva);
  },

  setReportsPeriod(period) {
    this.state.reportsPeriod = period;
    this.state.reportsGran = Metrics.autoGranularity(period);
    this.renderReports();
  },

  setGranularity(gran) {
    this.state.reportsGran = gran;
    this.renderReports();
  },

  exportActivityCSV() {
    const csv = SalesData.exportActivityCSV();
    if (!csv) return alert('No activity data to export.');
    this._downloadCSV(csv, 'sales-squad-activity.csv');
  },

  exportPipelineCSV() {
    const csv = SalesData.exportPipelineCSV();
    if (!csv) return alert('No pipeline data to export.');
    this._downloadCSV(csv, 'sales-squad-pipeline.csv');
  },

  _downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  printReport() {
    window.print();
  },

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  renderSettings() {
    const targets = SalesData.getTargets();
    const el = document.getElementById('section-settings');
    const periods = ['weekly','monthly','quarterly','annual'];
    const labels = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' };

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-sub">Configure your sales targets</p>
        </div>
      </div>

      <div class="settings-tabs">
        ${periods.map((p, i) => `
          <button class="settings-tab ${i === 0 ? 'active' : ''}" onclick="App.switchSettingsTab('${p}')" id="stab-${p}">${labels[p]}</button>
        `).join('')}
      </div>

      ${periods.map((p, i) => `
        <div id="settings-panel-${p}" class="settings-panel ${i === 0 ? 'active' : ''}">
          <div class="card">
            <h3 class="card-title">${labels[p]} Targets</h3>
            <form id="targets-form-${p}" onsubmit="App.saveTargets(event, '${p}')">
              <div class="form-grid">
                <div class="form-group">
                  <label>Leads</label>
                  <input type="number" name="leads" min="0" value="${targets[p]?.leads || 0}" placeholder="0">
                </div>
                <div class="form-group">
                  <label>Conversations</label>
                  <input type="number" name="conversations" min="0" value="${targets[p]?.conversations || 0}" placeholder="0">
                </div>
                <div class="form-group">
                  <label>Meetings Attended</label>
                  <input type="number" name="meetings" min="0" value="${targets[p]?.meetings || 0}" placeholder="0">
                </div>
                <div class="form-group">
                  <label>Units Sold</label>
                  <input type="number" name="units" min="0" value="${targets[p]?.units || 0}" placeholder="0">
                </div>
                <div class="form-group">
                  <label>Revenue (£)</label>
                  <input type="number" name="revenue" min="0" step="0.01" value="${targets[p]?.revenue || 0}" placeholder="0.00">
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Save ${labels[p]} Targets</button>
              </div>
            </form>
          </div>
        </div>
      `).join('')}

      <div class="card danger-zone">
        <h3 class="card-title danger-title">Data Management</h3>
        <p>Export all data or reset the application. These actions cannot be undone.</p>
        <div class="form-actions">
          <button class="btn-secondary" onclick="App.exportActivityCSV()">Export Activity CSV</button>
          <button class="btn-secondary" onclick="App.exportPipelineCSV()">Export Pipeline CSV</button>
          <button class="btn-danger" onclick="App.resetData()">Reset All Data</button>
        </div>
      </div>
    `;
  },

  switchSettingsTab(period) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('stab-' + period).classList.add('active');
    document.getElementById('settings-panel-' + period).classList.add('active');
  },

  saveTargets(event, period) {
    event.preventDefault();
    const form = event.target;
    const targets = SalesData.getTargets();
    targets[period] = {
      leads: Number(form.leads.value) || 0,
      conversations: Number(form.conversations.value) || 0,
      meetings: Number(form.meetings.value) || 0,
      units: Number(form.units.value) || 0,
      revenue: Number(form.revenue.value) || 0
    };
    SalesData.saveTargets(targets);
    this._toast('Targets saved');
  },

  resetData() {
    if (!confirm('This will permanently delete ALL activity and pipeline data. This cannot be undone.\n\nAre you sure?')) return;
    localStorage.removeItem('ss_entries');
    localStorage.removeItem('ss_pipeline');
    this._toast('All data cleared');
    this.renderSettings();
  },

  // ─── MODAL ────────────────────────────────────────────────────────────────
  openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
  },

  // ─── TOAST ────────────────────────────────────────────────────────────────
  _toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
  },

  // ─── INIT ─────────────────────────────────────────────────────────────────
  init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.section));
    });
    document.getElementById('modal').addEventListener('click', e => {
      if (e.target === document.getElementById('modal')) this.closeModal();
    });
    this.renderDashboard();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
