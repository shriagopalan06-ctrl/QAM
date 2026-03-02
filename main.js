/* ============================================================
   QAM Virtual Laboratory — main.js
   ============================================================ */

'use strict';

// ============================================================
// THEME (canvas drawing colors)
// ============================================================
const THEME = {
  canvasBg:    '#050a14',
  grid:        'rgba(0,212,255,0.07)',
  axis:        'rgba(0,212,255,0.40)',
  axisText:    '#4a7090',
  noisyPoint:  'rgba(0,212,255,0.55)',
  idealPoint:  '#00ff88'
};

// ============================================================
// APP STATE
// ============================================================
const appState = {
  activeTab: 'aim',
  simulationParams: {
    modulation: '16-qam',
    snrDb: 15,
    amplitude: 1.0
  },
  quizAnswers: {},
  quizScore: null,
  postTestAnswers: {},
  postTestScore: null,
  resultsLog: []
};
let simulationStarted = false;
// ============================================================
// TAB NAVIGATION
// ============================================================
const TabNavigation = {
  init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.querySelector(`[data-content="${tab}"]`);
        if (panel) panel.classList.add('active');
        appState.activeTab = tab;

        // Lazy init simulation canvas when tab becomes visible
        if (tab === 'simulation') {
          SimulationEngine.initializeSimulation();
       
        }
      });
    });
  }
};

// ============================================================
// erfc polyfill (Math.erfc absent in some environments)
// ============================================================
function erfc(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = p * Math.exp(-x * x);
  return x >= 0 ? r : 2 - r;
}

// ============================================================
// SIMULATION ENGINE — Constellation Diagram
// ============================================================
const SimulationEngine = {
  canvas: null,
  ctx: null,
  constellationData: [],
  initialized: false,

  initializeSimulation() {
    this.canvas = document.querySelector('canvas[data-canvas="constellation"]');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    // Clear canvas initially (blank screen)
this.ctx.fillStyle = THEME.canvasBg;
this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.initialized) {
      this.setupEventListeners();
      this.initialized = true;
    }
    
  },

  setupEventListeners() {
    const modSel  = document.querySelector('select[data-param="modulation"]');
    const snrSl   = document.querySelector('input[data-param="snr"]');
    const ampSl   = document.querySelector('input[data-param="amplitude"]');

    if (modSel) modSel.addEventListener('change', e => {
      appState.simulationParams.modulation = e.target.value;
      if (simulationStarted) {
  this.drawSimulation();
}
    });

    if (snrSl) snrSl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      appState.simulationParams.snrDb = v;
      const disp = document.querySelector('[data-display="snr-value"]');
      if (disp) disp.textContent = `${v} dB`;
      if (simulationStarted) {
  this.drawSimulation();
}
    });

    if (ampSl) ampSl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      appState.simulationParams.amplitude = v;
      const disp = document.querySelector('[data-display="amplitude-value"]');
      if (disp) disp.textContent = v.toFixed(2);
     if (simulationStarted) {
  this.drawSimulation();
}
    });
  },

  gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  },

  symbolCount(mod) {
    return { 'qpsk': 4, '16-qam': 16, '32-qam': 32, '64-qam': 64, '128-qam': 128, '256-qam': 256 }[mod] || 16;
  },

  generateConstellation() {
    const { modulation, amplitude, snrDb } = appState.simulationParams;
    const symbols  = this.symbolCount(modulation);
    const gridSize = Math.sqrt(symbols);
    const noiseStd = Math.sqrt(1 / (2 * Math.pow(10, snrDb / 10)));
    const points   = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const iComp = ((2 * i + 1 - gridSize) / gridSize) * amplitude;
        const qComp = ((2 * j + 1 - gridSize) / gridSize) * amplitude;
        for (let n = 0; n < 5; n++) {
          points.push({
            i: iComp + this.gaussianRandom() * noiseStd,
            q: qComp + this.gaussianRandom() * noiseStd,
            ideal_i: iComp, ideal_q: qComp
          });
        }
      }
    }
    return points;
  },

  drawSimulation() {
    if (!this.canvas || !this.ctx) return;
    this.constellationData = this.generateConstellation();
    this.drawConstellation();
    this.updateSimulationStats();
    this._logResult();
  },

  drawConstellation() {
    const { canvas, ctx } = this;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, scale = 58;

    ctx.fillStyle = THEME.canvasBg;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * scale, 0); ctx.lineTo(cx + i * scale, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + i * scale); ctx.lineTo(W, cy + i * scale); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = THEME.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();

    // Axis labels
    ctx.fillStyle = THEME.axisText;
    ctx.font = '13px Rajdhani, Arial';
    ctx.textAlign = 'right'; ctx.fillText('I (In-phase)', W - 8, cy - 8);
    ctx.textAlign = 'left';  ctx.fillText('Q (Quadrature)', cx + 8, 18);

    // Noisy received points
    this.constellationData.forEach(pt => {
      const x = cx + pt.i * scale, y = cy - pt.q * scale;
      ctx.fillStyle = THEME.noisyPoint;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
    });

    // Ideal constellation points (hollow circles)
    const { modulation, amplitude } = appState.simulationParams;
    const gridSize = Math.sqrt(this.symbolCount(modulation));
    ctx.strokeStyle = THEME.idealPoint;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const iComp = ((2 * i + 1 - gridSize) / gridSize) * amplitude;
        const qComp = ((2 * j + 1 - gridSize) / gridSize) * amplitude;
        const x = cx + iComp * scale, y = cy - qComp * scale;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.stroke();
      }
    }
  },

  updateSimulationStats() {
    const stats = this.calculateStats();
    const container = document.querySelector('[data-display="simulation-stats"]');
    if (!container) return;
    container.innerHTML = `
      <div class="stat-card"><div class="stat-label">Avg Power</div><div class="stat-value">${stats.avgPower.toFixed(3)} W</div></div>
      <div class="stat-card"><div class="stat-label">Symbol Rate</div><div class="stat-value">1000 sym/s</div></div>
      <div class="stat-card"><div class="stat-label">Data Rate</div><div class="stat-value">${stats.dataRate} Mbps</div></div>
      <div class="stat-card"><div class="stat-label">BER (est)</div><div class="stat-value">${stats.ber.toExponential(2)}</div></div>
    `;
  },

  calculateStats() {
    const { modulation, snrDb } = appState.simulationParams;
    const bpsMap = { 'qpsk': 2, '16-qam': 4, '32-qam': 5, '64-qam': 6, '128-qam': 7, '256-qam': 8 };
    const bitsPerSymbol = bpsMap[modulation] || 4;
    const snrLinear = Math.pow(10, snrDb / 10);
    const ber = erfc(Math.sqrt(snrLinear / 2)) / 2;
    const dataRate = (1000 * bitsPerSymbol) / 1e6;

    let totalPower = 0;
    this.constellationData.forEach(pt => { totalPower += pt.i * pt.i + pt.q * pt.q; });
    const avgPower = totalPower / (this.constellationData.length || 1);

    return { avgPower, bitsPerSymbol, dataRate, ber };
  },

  _logResult() {
    const stats = this.calculateStats();
    const { modulation, snrDb } = appState.simulationParams;
    appState.resultsLog.push({
      time: new Date().toLocaleTimeString(),
      modulation: modulation.toUpperCase(),
      snr: snrDb,
      ber: stats.ber,
      dataRate: stats.dataRate,
      bitsPerSymbol: stats.bitsPerSymbol
    });
    // Keep last 20 entries
    if (appState.resultsLog.length > 20) appState.resultsLog.shift();
    // Re-render results table if visible
    if (appState.activeTab === 'results') ResultsPanel.render();
  }
};

// ============================================================
// CRO ENGINE — Waveform Oscilloscope
// ============================================================
let croView = {
  start: 0,      // 0 → 1 (normalized)
  end: 1,
  selecting: false,
  selStartPx: 0,
  selEndPx: 0
};

let _ch1Data = null;
let _ch2Data = null;
let _iqData  = null;

function getGridSize(mod) {
  return { 'qpsk': 2, '16-qam': 4, '64-qam': 8, '256-qam': 16 }[mod] || 4;
}

function generateQAMSymbols(mod, numSymbols) {
  const g = getGridSize(mod);
  const levels = Array.from({ length: g }, (_, i) => (2 * i + 1 - g) / g);
  const I = [], Q = [];
  for (let n = 0; n < numSymbols; n++) {
    I.push(levels[Math.floor(Math.random() * g)]);
    Q.push(levels[Math.floor(Math.random() * g)]);
  }
  return { I, Q };
}

function makeTimeAxis(fs, duration) {
  const N = Math.floor(fs * duration);
  const t = new Float64Array(N);
  for (let i = 0; i < N; i++) t[i] = i / fs;
  return t;
}

function upsample(arr, sps) {
  const out = new Float64Array(arr.length * sps);
  for (let s = 0; s < arr.length; s++)
    for (let k = 0; k < sps; k++) out[s * sps + k] = arr[s];
  return out;
}

function generateQAMWave(I, Q, fc, symbolRate) {
  const fs  = Math.max(20 * fc, 2000);
  const sps = Math.max(1, Math.floor(fs / symbolRate));
  const dur = I.length / symbolRate;
  const t   = makeTimeAxis(fs, dur);
  const Iw  = upsample(I, sps);
  const Qw  = upsample(Q, sps);
  const sig = new Float64Array(t.length);
  const TWO_PI_FC = 2 * Math.PI * fc;
  for (let i = 0; i < t.length; i++)
    sig[i] = Iw[i] * Math.cos(TWO_PI_FC * t[i]) - Qw[i] * Math.sin(TWO_PI_FC * t[i]);
  return { t, signal: sig };
}

function generateCH1Wave(freq, amp, phase, duration) {
  const fs  = Math.max(20 * freq, 2000);
  const t   = makeTimeAxis(fs, duration);
  const phR = phase * Math.PI / 180;
  const sig = new Float64Array(t.length);
  const TWO_PI_F = 2 * Math.PI * freq;
  for (let i = 0; i < t.length; i++) sig[i] = amp * Math.cos(TWO_PI_F * t[i] + phR);
  return { t, signal: sig };
}

function downsample(signal, maxPts) {
  if (signal.length <= maxPts) return signal;
  const step = signal.length / maxPts;
  const out  = new Float64Array(maxPts);
  for (let i = 0; i < maxPts; i++) out[i] = signal[Math.floor(i * step)];
  return out;
}
// ===============================
// CRO VIEW STATE (ADD THIS ONCE)
// ===============================
function runCRO() {
  if (!_ch1Data || !_ch2Data || !_iqData) {
  generateCROData();   // create fresh data
}
  const mod        = (document.getElementById('croModulation')?.value)   || '16-qam';
  const fc         = parseFloat(document.getElementById('carrierFreq')?.value)  || 100;
  const symbolRate = parseFloat(document.getElementById('symbolRate')?.value)   || 10;
  // --- Enforce Nyquist condition: fc >= 5 * symbolRate ---
let adjustedSymbolRate = symbolRate;

const maxAllowedSymbolRate = Math.floor(fc / 5);

if (symbolRate > maxAllowedSymbolRate) {
    adjustedSymbolRate = maxAllowedSymbolRate;

    // Update slider visually
    const symbolSlider = document.getElementById('symbolRate');
    const symbolVal = document.getElementById('symbolRateVal');

    if (symbolSlider) symbolSlider.value = adjustedSymbolRate;
    if (symbolVal) symbolVal.textContent = adjustedSymbolRate;
}
  const numSymbols = parseInt(document.getElementById('numSymbols')?.value)     || 8;
  const ch1Freq    = parseFloat(document.getElementById('ch1Freq')?.value)      || fc;
  const ch1Amp     = parseFloat(document.getElementById('ch1Amp')?.value)       || 1;
  const ch1Phase   = parseFloat(document.getElementById('ch1Phase')?.value)     || 0;

  const { I, Q } = generateQAMSymbols(mod, numSymbols);
  const duration = numSymbols / adjustedSymbolRate;

  ch2Data = generateQAMWave(I, Q, fc, adjustedSymbolRate);
  _ch1Data = generateCH1Wave(ch1Freq, ch1Amp, ch1Phase, duration);
  _iqData  = { I, Q };

  drawCRO();
  drawIQ();
  autoScaleView(symbolRate, ch1Freq, numSymbols);

  const t1 = document.getElementById('ch1Toggle');
  const t2 = document.getElementById('ch2Toggle');
  if (t1) t1.onchange = drawCRO;
  if (t2) t2.onchange = drawCRO;
}

function drawCRO() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!canvas._zoomInit) {

  canvas.addEventListener("mousedown", e => {
    croView.selecting = true;
    croView.selStartPx = e.offsetX;
  });

  canvas.addEventListener("mousemove", e => {
    if (!croView.selecting) return;
    croView.selEndPx = e.offsetX;
    drawCRO();
  });

  canvas.addEventListener("mouseup", e => {

    croView.selecting = false;
    croView.selEndPx = e.offsetX;

    const minPx = Math.min(croView.selStartPx, croView.selEndPx);
    const maxPx = Math.max(croView.selStartPx, croView.selEndPx);

    const range = croView.end - croView.start;

    const newStart = croView.start + (minPx / canvas.width) * range;
    const newEnd   = croView.start + (maxPx / canvas.width) * range;

    croView.start = Math.max(0, newStart);
    croView.end   = Math.min(1, newEnd);

    drawCRO();
  });

  canvas._zoomInit = true;
}
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = THEME.canvasBg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath(); ctx.moveTo(i * W / 10, 0); ctx.lineTo(i * W / 10, H); ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke();
  }

  // Center dividers
  ctx.strokeStyle = 'rgba(0,212,255,0.18)';
  ctx.lineWidth = 1;
  const m1 = H * 0.25, m2 = H * 0.75;
  ctx.beginPath(); ctx.moveTo(0, m1); ctx.lineTo(W, m1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, m2); ctx.lineTo(W, m2); ctx.stroke();

  // Channel labels
  ctx.font = '11px Share Tech Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00ff88';
  ctx.fillText('CH1 — INPUT', 10, 16);
  ctx.fillStyle = '#00eaff';
  ctx.fillText('CH2 — QAM OUTPUT', 10, H / 2 + 16);
const drawSig = (signal, color, midY, halfH) => {

  const totalSamples = signal.length;

  // Zoom window
  const startIndex = Math.floor(totalSamples * croView.start);
  const endIndex   = Math.floor(totalSamples * croView.end);

  const visibleLength = Math.max(1, endIndex - startIndex);

  // DO NOT downsample full signal
  // Downsample only visible window
  const step = Math.max(1, Math.floor(visibleLength / W));

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  let maxVal = 0;

  // First pass: compute max for scaling
  for (let i = startIndex; i < endIndex; i += step) {
    maxVal = Math.max(maxVal, Math.abs(signal[i]));
  }
  maxVal = Math.max(maxVal, 0.001);

  let xIndex = 0;

  for (let i = startIndex; i < endIndex; i += step) {

    const x = (xIndex / (visibleLength / step)) * W;
    const y = midY - (signal[i] / maxVal) * halfH * 0.82;

    if (xIndex === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    xIndex++;
  }

  ctx.stroke();
};

  const ch1On = document.getElementById('ch1Toggle')?.checked !== false;
  const ch2On = document.getElementById('ch2Toggle')?.checked !== false;
  if (ch1On && _ch1Data) drawSig(_ch1Data.signal, '#00ff88', H * 0.25, H * 0.22);
  if (ch2On && _ch2Data) drawSig(_ch2Data.signal, '#00eaff', H * 0.75, H * 0.22);
  // ===========================
// DRAW SELECTION BOX HERE
// ===========================
if (croView.selecting) {
  ctx.fillStyle = "rgba(0,255,255,0.12)";
  const x = Math.min(croView.selStartPx, croView.selEndPx);
  const w = Math.abs(croView.selEndPx - croView.selStartPx);
  ctx.fillRect(x, 0, w, H);
}

}

function drawIQ() {
  const canvas = document.getElementById('iqCanvas');
  if (!canvas || !_iqData) return;
  const ctx = canvas.getContext('2d');
  
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = THEME.canvasBg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath(); ctx.moveTo(i * W / 10, 0); ctx.lineTo(i * W / 10, H); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  const { I, Q } = _iqData;
  const maxVal = Math.max(...I.map(Math.abs), ...Q.map(Math.abs), 0.001);

  const drawBand = (syms, color, label, labelY) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < syms.length; i++) {
      const x1 = i * W / syms.length;
      const x2 = (i + 1) * W / syms.length;
      const y  = H / 2 - (syms[i] / maxVal) * (H * 0.42);
      i === 0 ? ctx.moveTo(x1, y) : ctx.lineTo(x1, y);
      ctx.lineTo(x2, y);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '11px Share Tech Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, 8, labelY);
  };

  drawBand(I, '#00ff88', 'I (In-phase)',     15);
  drawBand(Q, '#00eaff', 'Q (Quadrature)',   H - 6);
}

function autoScaleView(symbolRate, ch1Freq, numSymbols) {
  const tpd = (numSymbols / symbolRate) / 10;
  const ms  = tpd * 1000;
  const el  = document.getElementById('timePerDiv');
  const ef  = document.getElementById('ch1FreqDisplay');
  const es  = document.getElementById('symbolCountDisplay');
  if (el) el.textContent   = ms < 1 ? (tpd * 1e6).toFixed(1) + ' μs/div' : ms.toFixed(2) + ' ms/div';
  if (ef) ef.textContent   = ch1Freq + ' Hz';
  if (es) es.textContent   = numSymbols;
}

// ============================================================
// QUIZ SYSTEM (Pre-Test)
// ============================================================
const QuizSystem = {
  questions: [
    { id:1, question: 'What does QAM stand for?',
      options: ['Quadrature Amplitude Modulation','Quantum Amplitude Measurement','Quick Analog Modulation','Quadratic Amplitude Module'],
      correct: 0, explanation: 'QAM stands for Quadrature Amplitude Modulation — a modulation technique using two carriers 90° apart.' },
    { id:2, question: 'How many symbols are in 16-QAM?',
      options: ['8','16','32','64'], correct: 1,
      explanation: '16-QAM has 16 distinct symbols arranged in a 4×4 constellation grid.' },
    { id:3, question: 'What is the primary advantage of QAM?',
      options: ['Lower cost','Higher spectral efficiency','Simpler implementation','Better coverage'],
      correct: 1, explanation: 'QAM provides higher spectral efficiency by encoding multiple bits per symbol.' },
    { id:4, question: 'In QAM, what do I and Q represent?',
      options: ['Input and Quality','In-phase and Quadrature','Impedance and Quantum','Integer and Quantum'],
      correct: 1, explanation: 'I (In-phase) and Q (Quadrature) are two orthogonal carriers 90° apart.' },
    { id:5, question: 'How many bits does 64-QAM encode per symbol?',
      options: ['4','6','8','10'], correct: 1,
      explanation: '64-QAM encodes 6 bits per symbol because 2⁶ = 64.' },
    { id:6, question: 'What effect does increased SNR have on QAM performance?',
      options: ['Decreased data rate','Improved symbol detection accuracy','Reduced modulation depth','Increased constellation size'],
      correct: 1, explanation: 'Higher SNR improves the ability to accurately detect symbols.' },
    { id:7, question: 'Which has the highest spectral efficiency?',
      options: ['BPSK','16-QAM','256-QAM','FSK'], correct: 2,
      explanation: '256-QAM encodes 8 bits per symbol, giving the highest spectral efficiency.' },
    { id:8, question: 'Main drawback of higher-order QAM (e.g. 256-QAM)?',
      options: ['Higher complexity','Greater sensitivity to noise','Lower data rates','Increased bandwidth'],
      correct: 1, explanation: 'Higher-order QAM is more sensitive to channel noise and distortion.' }
  ],

  render(containerSelector, stateKey, scoreKey, label) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    let html = '<div class="quiz-container">';
    if (appState[scoreKey] !== null) html += this._renderResults(stateKey, scoreKey);

    this.questions.forEach((q, idx) => {
      html += `<div class="quiz-question">
        <h3>${label} — Question ${idx + 1} of ${this.questions.length}</h3>
        <p class="question-text">${q.question}</p>
        <div class="question-options">`;
      q.options.forEach((opt, oi) => {
        const sel = appState[stateKey][q.id] === oi;
        html += `<label class="option-label ${sel ? 'selected' : ''}">
          <input type="radio" name="${stateKey}_q${q.id}" value="${oi}" ${sel ? 'checked' : ''}
            onchange="QuizSystem.selectAnswer('${stateKey}', ${q.id}, ${oi})">
          <span>${opt}</span></label>`;
      });
      html += `</div></div>`;
    });

    html += `<div class="quiz-actions">
      <button class="btn btn-primary" onclick="QuizSystem.submit('${stateKey}','${scoreKey}','${containerSelector}','${label}')">Submit</button>
      <button class="btn btn-secondary" onclick="QuizSystem.reset('${stateKey}','${scoreKey}','${containerSelector}','${label}')">Reset</button>
    </div></div>`;

    container.innerHTML = html;
  },

  selectAnswer(stateKey, qId, oi) {
    appState[stateKey][qId] = oi;
  },

  submit(stateKey, scoreKey, sel, label) {
    if (Object.keys(appState[stateKey]).length !== this.questions.length) {
      alert('Please answer all questions before submitting.'); return;
    }
    let correct = 0;
    this.questions.forEach(q => { if (appState[stateKey][q.id] === q.correct) correct++; });
    appState[scoreKey] = { correct, total: this.questions.length, percentage: Math.round(correct / this.questions.length * 100) };
    this.render(sel, stateKey, scoreKey, label);
  },

  reset(stateKey, scoreKey, sel, label) {
    appState[stateKey] = {};
    appState[scoreKey] = null;
    this.render(sel, stateKey, scoreKey, label);
  },

  _renderResults(stateKey, scoreKey) {
    const { correct, total, percentage } = appState[scoreKey];
    const msg = percentage >= 80 ? 'Excellent! Strong understanding of QAM concepts.'
      : percentage >= 60 ? 'Good! Review the explanations for any missed questions.'
      : percentage >= 40 ? 'Fair. Study the QAM concepts more carefully and retry.'
      : 'Keep practicing! Review the fundamental QAM concepts and try again.';

    let html = `<div class="quiz-results">
      <h2>RESULTS</h2>
      <div class="score-display">
        <div class="score-number">${correct}/${total}</div>
        <div class="score-percentage">${percentage}%</div>
      </div>
      <p style="color:var(--text-muted);margin-bottom:16px">${msg}</p>
      <div class="answer-review">`;

    this.questions.forEach((q, idx) => {
      const ua = appState[stateKey][q.id];
      const ok = ua === q.correct;
      html += `<div class="answer-item ${ok ? 'answer-correct' : 'answer-incorrect'}">
        <h4>Q${idx + 1}: ${q.question}</h4>
        <p><strong>Your answer:</strong> ${q.options[ua]}</p>
        ${!ok ? `<p><strong>Correct:</strong> ${q.options[q.correct]}</p>` : ''}
        <p><strong>Explanation:</strong> ${q.explanation}</p>
      </div>`;
    });

    html += '</div></div>';
    return html;
  }
};

// ============================================================
// RESULTS PANEL
// ============================================================
const ResultsPanel = {
  render() {
    const container = document.querySelector('[data-content="results"]');
    if (!container) return;

    const log = appState.resultsLog;

    let html = `<div class="content-card">
      <div class="section-heading"><h2>Simulation Results</h2></div>
      <p>The table below logs each simulation run. Click Run Simulation to add entries.</p>`;

    if (log.length === 0) {
      html += `<p style="color:var(--text-muted);margin-top:16px;">No simulation data yet. Run a simulation first.</p>`;
    } else {
      html += `<table class="results-table">
        <thead><tr>
          <th>Time</th><th>Modulation</th><th>SNR (dB)</th>
          <th>Bits/Symbol</th><th>Data Rate</th><th>BER</th>
        </tr></thead><tbody>`;

      [...log].reverse().forEach(r => {
        const berClass = r.ber < 1e-4 ? 'val-good' : r.ber < 1e-2 ? 'val-warn' : 'val-bad';
        html += `<tr>
          <td>${r.time}</td>
          <td>${r.modulation}</td>
          <td>${r.snr}</td>
          <td>${r.bitsPerSymbol}</td>
          <td>${r.dataRate} Mbps</td>
          <td class="${berClass}">${r.ber.toExponential(2)}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
    }

    html += `<div style="margin-top:18px">
      <button class="btn btn-secondary" onclick="ResultsPanel.clear()">Clear Log</button>
    </div></div>`;

    container.innerHTML = html;
  },

  clear() {
    appState.resultsLog = [];
    this.render();
  }
};

// ============================================================
// HELP PANEL
// ============================================================
const HelpPanel = {
  init() {
    const btn       = document.getElementById('helpBtn');
    const overlay   = document.getElementById('helpOverlay');
    const closeBtn  = document.getElementById('closeHelp');

    if (btn && overlay) {
      btn.addEventListener('click', () => overlay.classList.remove('hidden'));
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    }
    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    }
  }
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  TabNavigation.init();

  // Pre-test quiz
  QuizSystem.render('[data-content="pre-test"]', 'quizAnswers', 'quizScore', 'PRE-TEST');

  // Post-test quiz (same questions, separate state)
  QuizSystem.render('[data-content="post-test"]', 'postTestAnswers', 'postTestScore', 'POST-TEST');

  // Results panel
  ResultsPanel.render();

  // Help
  HelpPanel.init();

  // Start on simulation tab so canvas initialises
  const simBtn = document.querySelector('.tab-btn[data-tab="simulation"]');
  if (simBtn) {
    // Don't auto-click, let AIM show on load as per screenshot
  }

  // Run simulation immediately if sim panel is visible
// ============================================================
// MASTER RUN FUNCTION (STEP 4)
// ============================================================
function runFullSimulation() {

  simulationStarted = true;

  // 1️⃣ Constellation
  SimulationEngine.drawSimulation();

  // 2️⃣ CRO
  if (typeof runCRO === "function") {
    runCRO();
  }

  // 3️⃣ Eye
  if (typeof drawEyeDiagram === "function") {
    drawEyeDiagram();
  }

}

});
// UNIVERSAL RANGE SLIDER FILL FIX
// ============================================
