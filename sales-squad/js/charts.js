const SalesCharts = {
  instances: {},

  C: {
    red:    '#e63946',
    navy:   '#1d1d2e',
    green:  '#22c55e',
    amber:  '#f59e0b',
    blue:   '#3b82f6',
    purple: '#8b5cf6',
    grey:   '#9ca3af'
  },

  _defaults: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {} }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
      y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', font: { size: 11 } } }
    }
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  create(id, config) {
    this.destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    this.instances[id] = new Chart(canvas, config);
    return this.instances[id];
  },

  revenue(id, trend) {
    if (!trend.labels.length) return this._empty(id, 'No revenue data yet');
    return this.create(id, {
      type: 'line',
      data: {
        labels: trend.labels,
        datasets: [{
          label: 'Revenue (£)',
          data: trend.data.map(d => d.revenue),
          borderColor: this.C.red,
          backgroundColor: this.C.red + '18',
          fill: true, tension: 0.35, pointRadius: 3,
          borderWidth: 2
        }]
      },
      options: {
        ...this._defaults,
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => '£' + ctx.parsed.y.toLocaleString('en-GB', { minimumFractionDigits: 0 }) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: {
            grid: { color: '#f3f4f6' }, ticks: {
              color: '#6b7280', font: { size: 11 },
              callback: v => '£' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
            }
          }
        }
      }
    });
  },

  units(id, trend) {
    if (!trend.labels.length) return this._empty(id, 'No units data yet');
    return this.create(id, {
      type: 'bar',
      data: {
        labels: trend.labels,
        datasets: [{
          label: 'Units',
          data: trend.data.map(d => d.units),
          backgroundColor: this.C.navy + 'cc',
          borderRadius: 4, borderSkipped: false
        }]
      },
      options: {
        ...this._defaults,
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', font: { size: 11 } } }
        }
      }
    });
  },

  funnel(id, totals) {
    const vals = [totals.leads, totals.conversations, totals.meetings_attended, totals.units];
    if (vals.every(v => v === 0)) return this._empty(id, 'No activity data yet');
    return this.create(id, {
      type: 'bar',
      data: {
        labels: ['Leads', 'Conversations', 'Show-ups', 'Sales'],
        datasets: [{
          data: vals,
          backgroundColor: [this.C.blue + 'cc', this.C.amber + 'cc', this.C.red + 'cc', this.C.green + 'cc'],
          borderRadius: 4, borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } }
        }
      }
    });
  },

  conversionTrend(id, trend) {
    if (!trend.labels.length) return this._empty(id, 'No trend data yet');
    const C = this.C;
    return this.create(id, {
      type: 'line',
      data: {
        labels: trend.labels,
        datasets: [
          { label: 'Leads', data: trend.data.map(d => d.leads), borderColor: C.blue, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 },
          { label: 'Conversations', data: trend.data.map(d => d.conversations), borderColor: C.amber, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 },
          { label: 'Sales', data: trend.data.map(d => d.units), borderColor: C.green, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', font: { size: 11 } } }
        }
      }
    });
  },

  targetVsActual(id, tva) {
    const labels = ['Leads', 'Conversations', 'Meetings', 'Units', 'Revenue'];
    const keys = ['leads', 'conversations', 'meetings', 'units', 'revenue'];
    return this.create(id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual',
            data: keys.map(k => tva[k].actual),
            backgroundColor: this.C.red + 'cc',
            borderRadius: 4, borderSkipped: false
          },
          {
            label: 'Target',
            data: keys.map(k => tva[k].target),
            backgroundColor: this.C.grey + '60',
            borderRadius: 4, borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280', font: { size: 11 } } }
        }
      }
    });
  },

  pipelineStages(id, stages) {
    const vals = [stages.lead, stages.prospect, stages.meeting, stages.negotiation];
    if (vals.every(v => v === 0)) return this._empty(id, 'No open pipeline');
    return this.create(id, {
      type: 'doughnut',
      data: {
        labels: ['Lead', 'Prospect', 'Meeting', 'Negotiation'],
        datasets: [{
          data: vals,
          backgroundColor: [this.C.blue, this.C.amber, this.C.red, this.C.purple],
          borderWidth: 0, hoverOffset: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }
        }
      }
    });
  },

  _empty(id, msg) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.style.display = 'none';
    if (!parent.querySelector('.chart-empty')) {
      const el = document.createElement('div');
      el.className = 'chart-empty';
      el.textContent = msg;
      parent.appendChild(el);
    }
  }
};
