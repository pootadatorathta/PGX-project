/* ============================================================
   📊 DASHBOARD SCRIPT
   ------------------------------------------------------------
   ▶️ Dashboard visualization and metrics with real database data
============================================================ */
let chartInstances = {};
let dashboardData = null;
let currentTimeFilter = 'week'; // Changed from 'today' to 'week' to show existing data
let lastFetchTime = null;
const CACHE_DURATION = 60000; // Cache for 1 minute

/* ============================================================
   📥 FETCH DASHBOARD DATA FROM DATABASE
   ------------------------------------------------------------
   ▶️ Get real data from test_request table with caching
============================================================ */
async function fetchDashboardData(timeFilter = 'today', forceRefresh = false) {
  try {
    // Check if we can use cached data
    const now = Date.now();
    if (!forceRefresh && dashboardData && lastFetchTime && 
        (now - lastFetchTime < CACHE_DURATION) && 
        currentTimeFilter === timeFilter) {
      console.log('� Using cached dashboard data');
      return dashboardData;
    }
    
    console.log('�📊 Fetching dashboard data for:', timeFilter);
    const result = await window.electronAPI.getDashboardSummary(timeFilter);
    
    console.log('📊 Dashboard result:', result);
    
    if (result.success && result.data) {
      dashboardData = result.data;
      currentTimeFilter = timeFilter;
      lastFetchTime = now;
      console.log('✅ Dashboard data loaded:', dashboardData);
      return dashboardData;
    } else {
      console.error('❌ Failed to fetch dashboard data:', result.error);
      return null;
    }
  } catch (err) {
    console.error('❌ Error fetching dashboard data:', err);
    return null;
  }
}

/* ============================================================
   📱 NAVIGATION HANDLERS
   ------------------------------------------------------------
   ▶️ Navigation between pages
============================================================ */

/* ============================================================
   👥 USER MENU & PROFILE
   ------------------------------------------------------------
   ▶️ เปิด/ปิดเมนูผู้ใช้ (Profile / Setting / Logout)
============================================================ */


const patientPageBtn = document.getElementById('patient-btn');
patientPageBtn?.addEventListener('click', () => {
  window.electronAPI.navigate('patient');
});



/* ============================================================
   7️⃣ MOCK DATA & DASHBOARD WIDGETS (ยังคงสไตล์เดิม)
   ------------------------------------------------------------
   ▶️ ข้อมูลจำลอง + วาดกราฟ 3 แบบ: Line, Donut TAT, Gauge KPI
============================================================ */


// ฟังก์ชันอัปเดตสีกราฟ
function updateChartsForTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#f1f5f9' : '#111827';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const bgCard = isDark ? '#2f2f40' : '#ffffff';

  Object.values(chartInstances).forEach(chart => {

    // ✅ 1. ตรวจสอบก่อนว่ากราฟมีแกน (scales) หรือไม่
    if (chart.options.scales && chart.options.scales.x && chart.options.scales.y) {
      // ✅ 2. ถ้ามี ค่อยเข้าไปเปลี่ยนสีของแกน
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.y.grid.color = gridColor;
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.y.ticks.color = textColor;
    }

    // ✅ 3. เปลี่ยนสีของ Legend (ถ้ามี)
    if (chart.options.plugins && chart.options.plugins.legend) {
      chart.options.plugins.legend.labels.color = textColor;
    }

    

  });

  

  // เปลี่ยนพื้นหลังการ์ด (กรณีใช้ canvas อยู่บน card)
  document.querySelectorAll('.stat-card, .metric-card').forEach(el => {
    el.style.background = bgCard;
  });

  
  
  // อัปเดต TAT Donut
  if (chartInstances.tatChart) {
    chartInstances.tatChart.update();
  }
  
  // อัปเดต Gauge
  if (chartInstances.gaugeChart) {
    chartInstances.gaugeChart.data.datasets[0].backgroundColor[1] = isDark ? '#3b3b4a' : '#e9eef6';
    chartInstances.gaugeChart.update();
  }

  // อัปเดต Error Rate Chart
  if (chartInstances.errorRateChart) {
    chartInstances.errorRateChart.update();
  }

  // อัปเดต Top Rejects Chart
  if (chartInstances.topRejectsChart) {
    chartInstances.topRejectsChart.update();
  }

  // อัปเดต Top DNA Chart
  if (chartInstances.topDnaChart) {
    chartInstances.topDnaChart.update();
  }

  // อัปเดต Top Hospitals Chart
  if (chartInstances.topHospitalsChart) {
    chartInstances.topHospitalsChart.update();
  }

  Object.values(chartInstances).forEach(chart => {
    chart.update();
  });
}




// ใช้เฉพาะในหน้า Dashboard เท่านั้น (กัน error ถ้า element ไม่มี)
const hasDashboard = !!document.getElementById('usageChart') || !!document.getElementById('tatDonut') || !!document.getElementById('kpiGauge');

// ── 2) กล่องตัวเลขด้านบน (ใช้ข้อมูลจริง) ────────────────────────────────
async function renderMetrics() {
  console.log('📊 renderMetrics called, dashboardData:', dashboardData);
  
  if (!dashboardData) {
    console.log('⚠️ No dashboard data, fetching...');
    await fetchDashboardData(currentTimeFilter);
  }
  
  if (!dashboardData) {
    console.error('❌ Still no dashboard data after fetch');
    return;
  }
  
  const elTotal = document.getElementById('m-total');
  const elProg  = document.getElementById('m-progress');
  const elDone  = document.getElementById('m-done');
  const elErr   = document.getElementById('m-error');
  
  const elPercentTotal = document.getElementById('percent-total');
  const elPercentProg  = document.getElementById('percent-progress');
  const elPercentDone  = document.getElementById('percent-done');
  const elPercentErr   = document.getElementById('percent-error');
  
  const { stats } = dashboardData;
  const total = stats?.total || 0;
  const progress = stats?.inProgress || 0;
  const done = stats?.done || 0;
  const error = stats?.error || 0;
  
  console.log('📊 Stats:', { total, progress, done, error });
  
  if (elTotal) elTotal.textContent = total;
  if (elProg)  elProg.textContent  = progress;
  if (elDone)  elDone.textContent  = done;
  if (elErr)   elErr.textContent   = error;
  
  // คำนวณและแสดงเปอร์เซ็นต์
  if (elPercentTotal) elPercentTotal.textContent = total > 0 ? '100.00%' : '0.00%';
  if (elPercentProg)  elPercentProg.textContent  = total > 0 ? ((progress / total) * 100).toFixed(2) + '%' : '0.00%';
  if (elPercentDone)  elPercentDone.textContent  = total > 0 ? ((done / total) * 100).toFixed(2) + '%' : '0.00%';
  if (elPercentErr)   elPercentErr.textContent   = total > 0 ? ((error / total) * 100).toFixed(2) + '%' : '0.00%';
}

  // ── 3) กราฟเส้น Usage (รายวัน/รายสัปดาห์) - ใช้ข้อมูลจริง ───────────────
  async function renderUsageChart() {
    const usageCanvas = document.getElementById('usageChart');
    if (!usageCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const ctx = usageCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances.usageChart) {
      chartInstances.usageChart.destroy();
    }

    chartInstances.usageChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dashboardData.timeSeries.labels,
        datasets: [{
          label: 'จำนวนเคส',
          data: dashboardData.timeSeries.values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          tension: 0.3,
          fill: true,
          pointRadius: 3
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // ปุ่มสลับกรอบเวลา
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const group = btn.closest('.toggle-group');
        group?.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const range = btn.dataset.range;
        if (!range) return;
        
        // Fetch new data
        const timeSeriesData = await window.electronAPI.getUsageTimeSeries(range, currentTimeFilter);
        if (timeSeriesData) {
          chartInstances.usageChart.data.labels = timeSeriesData.labels;
          chartInstances.usageChart.data.datasets[0].data = timeSeriesData.values;
          chartInstances.usageChart.update();
          const subtitle = document.getElementById('usage-subtitle');
          if (subtitle) subtitle.textContent = `สรุป: ราย${range === 'daily' ? 'วัน' : 'สัปดาห์'}`;
        }
      });
    });
  }

  // ── 4) Donut ติดตาม TAT (ใช้ข้อมูลจริง) ─────────────────────────────────
  async function renderTATChart() {
    const tatCanvas = document.getElementById('tatDonut');
    if (!tatCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const { tatStats } = dashboardData;
    const total = tatStats.inSLA + tatStats.inProgress + tatStats.overSLA;
    
    // Plugin แสดงตัวเลขตรงกลาง
    const tatCenterText = {
      id: 'tatCenterText',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || meta.data.length === 0) return;
        
        const {ctx, chartArea} = chart;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        
        const isDark = document.documentElement.classList.contains('dark');
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // ตัวเลขใหญ่
        ctx.font = 'bold 28px "Noto Sans Thai", sans-serif';
        ctx.fillStyle = isDark ? '#ecf0f1' : '#333';
        ctx.fillText(total, centerX, centerY - 8);
        
        // ข้อความเล็ก
        ctx.font = '13px "Noto Sans Thai", sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#666';
        ctx.fillText('เคสทั้งหมด', centerX, centerY + 14);
        
        ctx.restore();
      }
    };

    const ctx = tatCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances.tatChart) {
      chartInstances.tatChart.destroy();
    }

    chartInstances.tatChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['ปกติ (ใน SLA)', 'กำลังดำเนินการ', 'เสี่ยงเกิน SLA'],
        datasets: [{
          data: [tatStats.inSLA, tatStats.inProgress, tatStats.overSLA],
          backgroundColor: ['#16a34a', '#2563eb', '#dc2626'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed}` } }
        }
      },
      plugins: [tatCenterText]
    });
  }

  // ── 5) Gauge KPI (Semi Donut) - ใช้ข้อมูลจริง ────────────────────────────
  async function renderGaugeChart() {
    const gaugeCanvas = document.getElementById('kpiGauge');
    if (!gaugeCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const rate = dashboardData.rejectionRate; // 0-100
    const rateText = document.getElementById('rejectionRateText');
    if (rateText) rateText.textContent = rate + '%';

    const centerText = {
      id: 'centerText',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const arc = meta?.data?.[0];
        if (!arc) return;
        
        const isDark = document.documentElement.classList.contains('dark');
        const {ctx} = chart;
        
        ctx.save();
        ctx.font = 'bold 24px "Noto Sans Thai", sans-serif';
        ctx.fillStyle = isDark ? '#ecf0f1' : '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${rate}%`, arc.x, arc.y + 5);
        ctx.restore();
      }
    };

    const isDark = document.documentElement.classList.contains('dark');
    const ctx = gaugeCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances.gaugeChart) {
      chartInstances.gaugeChart.destroy();
    }

    chartInstances.gaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['อัตราปฏิเสธ', 'ส่วนที่เหลือ'],
        datasets: [{
          data: [rate, 100 - rate],
          backgroundColor: ['#dc2626', isDark ? '#3b3b4a' : '#e9eef6'],
          borderWidth: 0
        }]
      },
      options: {
        circumference: 180,
        rotation: -90,
        cutout: '70%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      },
      plugins: [centerText]
    });
  }

  // ── 6) Error Rate Line Chart (ใช้ข้อมูลจริง) ──
  async function renderErrorRateChart() {
    const errorCanvas = document.getElementById('errorRateChart');
    if (!errorCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const ctx = errorCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstances.errorRateChart) {
      chartInstances.errorRateChart.destroy();
    }

    chartInstances.errorRateChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dashboardData.errorRateSeries.labels,
        datasets: [{
          label: 'อัตราการปฏิเสธ (%)',
          data: dashboardData.errorRateSeries.values,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#dc2626'
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { 
          y: { 
            beginAtZero: true,
            ticks: {
              callback: function(value) { return value + '%'; }
            }
          } 
        }
      }
    });

    // ปุ่มสลับช่วงเวลา
    document.querySelectorAll('[data-error-range]').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('[data-error-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const range = btn.dataset.errorRange;
        
        // Fetch new data
        const errorData = await window.electronAPI.getErrorRateSeries(range);
        if (errorData) {
          chartInstances.errorRateChart.data.labels = errorData.labels;
          chartInstances.errorRateChart.data.datasets[0].data = errorData.values;
          chartInstances.errorRateChart.update();
          const subtitle = document.getElementById('error-subtitle');
          if (subtitle) subtitle.textContent = `สรุป: ${range === 'week' ? '7 วันล่าสุด' : '30 วันล่าสุด'}`;
        }
      });
    });
  }

  // ── 7) Top 5 Rejected Specimens (ใช้ข้อมูลจริง) ────────
  async function renderTopRejectsChart() {
    const topRejectsCanvas = document.getElementById('topRejectsChart');
    if (!topRejectsCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const { rejectedSpecimens } = dashboardData;
    const ctx = topRejectsCanvas.getContext('2d');
    const colors = rejectedSpecimens.values.map(() => 'rgba(220, 38, 38, 0.9)');
    const bgColors = rejectedSpecimens.values.map(() => 'rgba(220, 38, 38, 0.18)');

    // Destroy existing chart if it exists
    if (chartInstances.topRejectsChart) {
      chartInstances.topRejectsChart.destroy();
    }

    chartInstances.topRejectsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rejectedSpecimens.labels,
        datasets: [{
          label: 'จำนวนที่ถูกปฏิเสธ',
          data: rejectedSpecimens.values,
          backgroundColor: bgColors,
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} เคส`
            }
          }
        },
        scales: {
          x: { beginAtZero: true },
          y: { ticks: { font: { weight: '600' } } }
        }
      }
    });

    // Update subtitle
    const subtitle = document.getElementById('top-rejects-subtitle');
    if (subtitle) subtitle.textContent = `ข้อมูลจากฐานข้อมูล (ช่วงเวลา: ${currentTimeFilter === 'today' ? 'วันนี้' : currentTimeFilter === 'week' ? '7 วัน' : '30 วัน'})`;
  }

  // ── 8) Top 5 DNA Most Found (ใช้ข้อมูลจริง) ────────────
  async function renderTopDNAChart() {
    const topDnaCanvas = document.getElementById('topDnaChart');
    if (!topDnaCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const { topDNA } = dashboardData;
    const ctx = topDnaCanvas.getContext('2d');
    const colors = topDNA.values.map(() => 'rgba(34, 197, 94, 0.9)');
    const bgColors = topDNA.values.map(() => 'rgba(34, 197, 94, 0.18)');

    // Destroy existing chart if it exists
    if (chartInstances.topDnaChart) {
      chartInstances.topDnaChart.destroy();
    }

    chartInstances.topDnaChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topDNA.labels,
        datasets: [{
          label: 'จำนวนครั้งที่พบ',
          data: topDNA.values,
          backgroundColor: bgColors,
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} ครั้ง`
            }
          }
        },
        scales: {
          x: { beginAtZero: true },
          y: { ticks: { font: { weight: '600' } } }
        }
      }
    });

    // Update subtitle
    const subtitle = document.getElementById('top-dna-subtitle');
    if (subtitle) subtitle.textContent = `ข้อมูลจากฐานข้อมูล (ช่วงเวลา: ${currentTimeFilter === 'today' ? 'วันนี้' : currentTimeFilter === 'week' ? '7 วัน' : '30 วัน'})`;
  }

  // ── 9) Top 5 Hospitals by Submissions (ใช้ข้อมูลจริง) ─
  async function renderTopHospitalsChart() {
    const topHospitalsCanvas = document.getElementById('topHospitalsChart');
    if (!topHospitalsCanvas || !window.Chart) return;

    if (!dashboardData) {
      await fetchDashboardData(currentTimeFilter);
    }
    
    if (!dashboardData) return;

    const { topSpecimens } = dashboardData;
    const ctx = topHospitalsCanvas.getContext('2d');
    const colors = topSpecimens.values.map(() => 'rgba(37, 99, 235, 0.9)');
    const bgColors = topSpecimens.values.map(() => 'rgba(37, 99, 235, 0.18)');

    // Destroy existing chart if it exists
    if (chartInstances.topHospitalsChart) {
      chartInstances.topHospitalsChart.destroy();
    }

    chartInstances.topHospitalsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topSpecimens.labels,
        datasets: [{
          label: 'จำนวนส่งตรวจ',
          data: topSpecimens.values,
          backgroundColor: bgColors,
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} เคส`
            }
          }
        },
        scales: {
          x: { beginAtZero: true },
          y: { ticks: { font: { weight: '600' } } }
        }
      }
    });

    // Update subtitle
    const subtitle = document.getElementById('top-hospitals-subtitle');
    if (subtitle) subtitle.textContent = `ข้อมูลจากฐานข้อมูล (ช่วงเวลา: ${currentTimeFilter === 'today' ? 'วันนี้' : currentTimeFilter === 'week' ? '7 วัน' : '30 วัน'})`;
  }

// Initialize all charts
async function initDashboard() {
  console.log('🚀 Initializing dashboard...');
  
  try {
    // Fetch initial data
    await fetchDashboardData(currentTimeFilter);
    
    if (!dashboardData) {
      console.error('❌ Failed to load dashboard data');
      return;
    }
    
    console.log('📊 Rendering components in parallel...');
    
    // Render all components in parallel for faster loading
    await Promise.all([
      renderMetrics(),
      renderUsageChart(),
      renderTATChart(),
      renderGaugeChart(),
      renderErrorRateChart(),
      renderTopRejectsChart(),
      renderTopDNAChart(),
      renderTopHospitalsChart()
    ]);
    
    // Initialize time filter buttons
    initializeTimeFilters();
    
    console.log('✅ Dashboard initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing dashboard:', err);
  }
}

/* ============================================================
   ⏱️ TIME FILTER HANDLERS
   ------------------------------------------------------------
   ▶️ Handle time period filter buttons (today/week/month)
============================================================ */
function initializeTimeFilters() {
  const filterButtons = document.querySelectorAll('.time-filter-btn');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      // Remove active class from all buttons
      filterButtons.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      btn.classList.add('active');
      
      // Get selected time filter
      const timeFilter = btn.dataset.time;
      if (!timeFilter) return;
      
      console.log('⏱️ Switching to time filter:', timeFilter);
      
      // Update current filter
      currentTimeFilter = timeFilter;
      
      // Fetch new data and re-render
      await fetchDashboardData(timeFilter);
      
      if (dashboardData) {
        await renderMetrics();
        await renderUsageChart();
        await renderTATChart();
        await renderGaugeChart();
        await renderErrorRateChart();
        await renderTopRejectsChart();
        await renderTopDNAChart();
        await renderTopHospitalsChart();
      }
    });
  });
  
  // Set initial active state based on currentTimeFilter
  const activeBtn = document.querySelector(`.time-filter-btn[data-time="${currentTimeFilter}"]`);
  if (activeBtn) {
    filterButtons.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }
}

/* ============================================================
   🔄 PAGE INITIALIZATION
   ------------------------------------------------------------
   ▶️ Initialize page when DOM is loaded
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user profile (from userProfile.js)
  if (!initializeUserProfile()) {
    return; // Stop execution if not authenticated
  }

  // Initialize dashboard charts and data
  if (hasDashboard) {
    await initDashboard();
  }
});
