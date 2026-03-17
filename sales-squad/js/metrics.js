const Metrics = {

  getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
      case 'daily':
        return { start: today, end: today };
      case 'weekly': {
        const day = today.getDay();
        const mon = new Date(today);
        mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { start: mon, end: sun };
      }
      case 'monthly':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
        };
      case 'quarterly': {
        const q = Math.floor(now.getMonth() / 3);
        return {
          start: new Date(now.getFullYear(), q * 3, 1),
          end: new Date(now.getFullYear(), q * 3 + 3, 0)
        };
      }
      case 'annual':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        };
      default:
        return { start: today, end: today };
    }
  },

  filterEntries(entries, period) {
    if (period === 'all') return entries;
    const { start, end } = this.getDateRange(period);
    return entries.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  },

  aggregate(entries) {
    return entries.reduce((acc, e) => ({
      leads: acc.leads + (Number(e.leads) || 0),
      conversations: acc.conversations + (Number(e.conversations) || 0),
      meetings_scheduled: acc.meetings_scheduled + (Number(e.meetings_scheduled) || 0),
      meetings_attended: acc.meetings_attended + (Number(e.meetings_attended) || 0),
      units: acc.units + (Number(e.units) || 0),
      revenue: acc.revenue + (Number(e.revenue) || 0)
    }), { leads: 0, conversations: 0, meetings_scheduled: 0, meetings_attended: 0, units: 0, revenue: 0 });
  },

  rates(totals) {
    return {
      lead_to_prospect: totals.leads > 0 ? (totals.conversations / totals.leads * 100) : 0,
      prospect_to_client: totals.conversations > 0 ? (totals.units / totals.conversations * 100) : 0,
      lead_to_client: totals.leads > 0 ? (totals.units / totals.leads * 100) : 0,
      show_rate: totals.meetings_scheduled > 0 ? (totals.meetings_attended / totals.meetings_scheduled * 100) : 0,
      avg_deal_value: totals.units > 0 ? (totals.revenue / totals.units) : 0
    };
  },

  pipelineMetrics(pipeline) {
    const open = pipeline.filter(d => !['won', 'lost'].includes(d.stage));
    const won = pipeline.filter(d => d.stage === 'won');
    const lost = pipeline.filter(d => d.stage === 'lost');

    const pipelineValue = open.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const weightedForecast = open.reduce((s, d) => s + ((Number(d.value) || 0) * (Number(d.probability) || 0) / 100), 0);
    const wonValue = won.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const winRate = (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length) * 100) : 0;

    const stages = { lead: 0, prospect: 0, meeting: 0, negotiation: 0 };
    open.forEach(d => { if (stages.hasOwnProperty(d.stage)) stages[d.stage]++; });

    const avgLeadTime = this._avgDays(
      pipeline.filter(d => d.lead_date && d.prospect_date), 'lead_date', 'prospect_date'
    );
    const avgProspectTime = this._avgDays(
      pipeline.filter(d => d.prospect_date && d.close_date && d.stage === 'won'), 'prospect_date', 'close_date'
    );

    return {
      pipelineValue, weightedForecast, wonValue,
      wonCount: won.length, lostCount: lost.length,
      winRate, stages,
      avgLeadTime, avgProspectTime,
      totalAcquisitionTime: avgLeadTime + avgProspectTime,
      openCount: open.length, totalDeals: pipeline.length
    };
  },

  _avgDays(deals, startKey, endKey) {
    if (!deals.length) return 0;
    const total = deals.reduce((s, d) => {
      const diff = (new Date(d[endKey]) - new Date(d[startKey])) / 86400000;
      return s + (isNaN(diff) ? 0 : diff);
    }, 0);
    return Math.round(total / deals.length);
  },

  targetVsActual(totals, targets, period) {
    const t = targets[period] || targets.monthly || {};
    const calc = (actual, target) => ({
      actual,
      target: target || 0,
      pct: target > 0 ? Math.min((actual / target * 100), 200) : null,
      onTrack: target > 0 ? actual >= target : null
    });
    return {
      leads: calc(totals.leads, t.leads),
      conversations: calc(totals.conversations, t.conversations),
      meetings: calc(totals.meetings_attended, t.meetings),
      units: calc(totals.units, t.units),
      revenue: calc(totals.revenue, t.revenue)
    };
  },

  forecast(entries, period, targets) {
    const { start, end } = this.getDateRange(period);
    const now = new Date();
    const totalDays = Math.ceil((end - start) / 86400000) + 1;
    const elapsedDays = Math.max(1, Math.ceil((now - start) / 86400000) + 1);
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    const filtered = this.filterEntries(entries, period);
    const totals = this.aggregate(filtered);

    const rate = v => Math.round(v + (v / elapsedDays) * remainingDays);
    return {
      ...totals,
      projected_units: rate(totals.units),
      projected_revenue: rate(totals.revenue),
      projected_leads: rate(totals.leads),
      elapsedDays, totalDays, remainingDays,
      pct_complete: Math.round(elapsedDays / totalDays * 100)
    };
  },

  trendData(entries, granularity) {
    const groups = {};
    entries.forEach(e => {
      const key = this._bucketKey(e.date, granularity);
      if (!groups[key]) groups[key] = { leads: 0, conversations: 0, units: 0, revenue: 0, meetings_attended: 0 };
      groups[key].leads += Number(e.leads) || 0;
      groups[key].conversations += Number(e.conversations) || 0;
      groups[key].units += Number(e.units) || 0;
      groups[key].revenue += Number(e.revenue) || 0;
      groups[key].meetings_attended += Number(e.meetings_attended) || 0;
    });
    const keys = Object.keys(groups).sort();
    return { labels: keys, data: keys.map(k => groups[k]) };
  },

  _bucketKey(dateStr, granularity) {
    const d = new Date(dateStr);
    if (granularity === 'day') return dateStr;
    if (granularity === 'week') {
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return mon.toISOString().split('T')[0];
    }
    if (granularity === 'month') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return dateStr;
  },

  autoGranularity(period) {
    return { daily: 'day', weekly: 'day', monthly: 'week', quarterly: 'month', annual: 'month' }[period] || 'week';
  },

  periodLabel(period) {
    const now = new Date();
    const { start, end } = this.getDateRange(period);
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (period === 'daily') return fmt(now);
    return `${fmt(start)} – ${fmt(end)}`;
  }
};
