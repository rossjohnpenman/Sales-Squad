const SalesData = {
  KEYS: {
    ENTRIES: 'ss_entries',
    PIPELINE: 'ss_pipeline',
    TARGETS: 'ss_targets'
  },

  getEntries() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.ENTRIES) || '[]'); }
    catch { return []; }
  },

  saveEntries(entries) {
    localStorage.setItem(this.KEYS.ENTRIES, JSON.stringify(entries));
  },

  addEntry(entry) {
    const entries = this.getEntries();
    entry.id = Date.now().toString();
    entries.push(entry);
    this.saveEntries(entries);
    return entry;
  },

  updateEntry(id, updates) {
    const entries = this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...updates };
      this.saveEntries(entries);
      return entries[idx];
    }
  },

  deleteEntry(id) {
    this.saveEntries(this.getEntries().filter(e => e.id !== id));
  },

  getPipeline() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.PIPELINE) || '[]'); }
    catch { return []; }
  },

  savePipeline(pipeline) {
    localStorage.setItem(this.KEYS.PIPELINE, JSON.stringify(pipeline));
  },

  addDeal(deal) {
    const pipeline = this.getPipeline();
    deal.id = Date.now().toString();
    pipeline.push(deal);
    this.savePipeline(pipeline);
    return deal;
  },

  updateDeal(id, updates) {
    const pipeline = this.getPipeline();
    const idx = pipeline.findIndex(d => d.id === id);
    if (idx !== -1) {
      pipeline[idx] = { ...pipeline[idx], ...updates };
      this.savePipeline(pipeline);
      return pipeline[idx];
    }
  },

  deleteDeal(id) {
    this.savePipeline(this.getPipeline().filter(d => d.id !== id));
  },

  getTargets() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEYS.TARGETS));
      if (saved) return saved;
    } catch {}
    return this.defaultTargets();
  },

  defaultTargets() {
    const empty = { leads: 0, conversations: 0, meetings: 0, units: 0, revenue: 0 };
    return {
      weekly: { ...empty },
      monthly: { ...empty },
      quarterly: { ...empty },
      annual: { ...empty }
    };
  },

  saveTargets(targets) {
    localStorage.setItem(this.KEYS.TARGETS, JSON.stringify(targets));
  },

  exportActivityCSV() {
    const entries = this.getEntries();
    if (!entries.length) return null;
    const headers = ['Date','Leads','Conversations','Meetings Scheduled','Meetings Attended','Units Sold','Revenue (£)','Notes'];
    const rows = entries
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => [
        e.date, e.leads||0, e.conversations||0,
        e.meetings_scheduled||0, e.meetings_attended||0,
        e.units||0, e.revenue||0,
        (e.notes||'').replace(/"/g,"'")
      ]);
    return [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  },

  exportPipelineCSV() {
    const pipeline = this.getPipeline();
    if (!pipeline.length) return null;
    const headers = ['Name','Stage','Value (£)','Probability (%)','Weighted Value (£)','Lead Date','Prospect Date','Close Date','Notes'];
    const rows = pipeline.map(d => [
      (d.name||'').replace(/"/g,"'"),
      d.stage||'', d.value||0, d.probability||0,
      Math.round((d.value||0)*(d.probability||0)/100),
      d.lead_date||'', d.prospect_date||'', d.close_date||'',
      (d.notes||'').replace(/"/g,"'")
    ]);
    return [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  }
};
