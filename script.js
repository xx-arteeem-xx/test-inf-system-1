'use strict';

// ================================================================
// HISTORY MANAGER
// ================================================================
class HistoryManager {
  constructor() {
    this.key = 'calc_history';
    this.max = 50;
  }

  add(type, expression, result) {
    const entries = this.getAll();
    entries.unshift({ type, expression, result, ts: Date.now() });
    if (entries.length > this.max) entries.length = this.max;
    try { localStorage.setItem(this.key, JSON.stringify(entries)); } catch {}
    document.dispatchEvent(new CustomEvent('historyUpdate'));
  }

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; }
  }

  clear() {
    localStorage.removeItem(this.key);
    document.dispatchEvent(new CustomEvent('historyUpdate'));
  }
}

// ================================================================
// BASIC CALCULATOR
// ================================================================
class BasicCalc {
  constructor(panelId, prefix, calcType, historyManager) {
    this.panel = document.getElementById(panelId);
    this.prefix = prefix;
    this.calcType = calcType;
    this.history = historyManager;
    this.displayEl = document.getElementById(`${prefix}-display`);
    this.exprEl = document.getElementById(`${prefix}-expr`);
    this.reset();
    this.bindButtons();
  }

  reset() {
    this.cur = '0';
    this.prev = null;
    this.op = null;
    this.resetNext = false;
    this.exprStr = '';
    this.mem = 0;
  }

  // ---- Display ----
  updateDisplay() {
    let val = this.cur;
    const len = val.replace(/[^0-9]/g, '').length;
    this.displayEl.textContent = val;
    this.displayEl.style.fontSize = len > 15 ? '1rem' : len > 10 ? '1.5rem' : '';
    this.exprEl.textContent = this.exprStr || ' ';
  }

  // ---- Number formatting ----
  fmt(n) {
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    if (isNaN(n)) return 'Ошибка';
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    const s = parseFloat(n.toPrecision(10)).toString();
    return s;
  }

  fmtOp(op) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op;
  }

  // ---- Input handlers ----
  digit(d) {
    if (this.cur === 'Ошибка') { this.cur = d; this.resetNext = false; this.updateDisplay(); return; }
    if (this.resetNext) {
      this.cur = d === '0' ? '0' : d;
      this.resetNext = false;
    } else {
      if (this.cur === '0' && d !== '.') this.cur = d;
      else if (this.cur.replace(/[^0-9]/g, '').length < 16) this.cur += d;
    }
    this.updateDisplay();
  }

  decimal() {
    if (this.resetNext) { this.cur = '0.'; this.resetNext = false; this.updateDisplay(); return; }
    if (!this.cur.includes('.')) { this.cur += '.'; this.updateDisplay(); }
  }

  operator(op) {
    if (this.op && !this.resetNext) this.calculate(false);
    this.prev = this.cur;
    this.op = op;
    this.resetNext = true;
    this.exprStr = `${this.cur} ${this.fmtOp(op)}`;
    this.updateDisplay();
  }

  calculate(save = true) {
    if (!this.op || this.prev === null) return;
    const a = parseFloat(this.prev), b = parseFloat(this.cur);
    const exprStr = `${this.prev} ${this.fmtOp(this.op)} ${this.cur}`;
    let res;
    switch (this.op) {
      case '+': res = a + b; break;
      case '-': res = a - b; break;
      case '*': res = a * b; break;
      case '/':
        if (b === 0) { this.cur = 'Ошибка'; this.op = null; this.prev = null; this.resetNext = true; this.exprStr = ''; this.updateDisplay(); return; }
        res = a / b; break;
      case '^': res = Math.pow(a, b); break;
      case '%mod': res = a % b; break;
      default: return;
    }
    res = parseFloat(res.toPrecision(12));
    if (save) {
      this.history.add(this.calcType, exprStr, this.fmt(res));
    }
    this.exprStr = exprStr + ' =';
    this.cur = this.fmt(res);
    this.op = null;
    this.prev = null;
    this.resetNext = true;
    this.updateDisplay();
  }

  backspace() {
    if (this.resetNext || this.cur === 'Ошибка') { this.cur = '0'; this.resetNext = false; }
    else if (this.cur.length > 1) { this.cur = this.cur.slice(0, -1); if (this.cur === '-') this.cur = '0'; }
    else this.cur = '0';
    this.updateDisplay();
  }

  ce() { this.cur = '0'; this.resetNext = false; this.updateDisplay(); }

  negate() {
    if (this.cur === '0' || this.cur === 'Ошибка') return;
    this.cur = this.cur.startsWith('-') ? this.cur.slice(1) : '-' + this.cur;
    this.updateDisplay();
  }

  percent() {
    const v = parseFloat(this.cur);
    if (isNaN(v)) return;
    if (this.prev !== null) {
      // 50 + 20% → показывает 10 (20% от 50), потом = даст 60
      this.cur = this.fmt(parseFloat(this.prev) * v / 100);
    } else {
      // 50% без предыдущей операции → 0.5
      this.cur = this.fmt(v / 100);
    }
    this.updateDisplay();
  }

  reciprocal() {
    const v = parseFloat(this.cur);
    this.cur = v === 0 ? 'Ошибка' : this.fmt(1 / v);
    this.resetNext = true;
    this.updateDisplay();
  }

  square() { this.cur = this.fmt(Math.pow(parseFloat(this.cur), 2)); this.resetNext = true; this.updateDisplay(); }
  sqrt()   { const v = parseFloat(this.cur); this.cur = v < 0 ? 'Ошибка' : this.fmt(Math.sqrt(v)); this.resetNext = true; this.updateDisplay(); }
  abs()    { this.cur = this.fmt(Math.abs(parseFloat(this.cur))); this.resetNext = true; this.updateDisplay(); }

  memClear()    { this.mem = 0; }
  memRecall()   { this.cur = this.fmt(this.mem); this.resetNext = true; this.updateDisplay(); }
  memAdd()      { this.mem += parseFloat(this.cur) || 0; }
  memSubtract() { this.mem -= parseFloat(this.cur) || 0; }
  memStore()    { this.mem = parseFloat(this.cur) || 0; }
  memView()     { this.cur = this.fmt(this.mem); this.resetNext = true; this.updateDisplay(); }

  handle(action) {
    if (/^\d$/.test(action)) { this.digit(action); return; }
    switch (action) {
      case 'decimal':   this.decimal(); break;
      case 'add':       this.operator('+'); break;
      case 'subtract':  this.operator('-'); break;
      case 'multiply':  this.operator('*'); break;
      case 'divide':    this.operator('/'); break;
      case 'equals':    this.calculate(); break;
      case 'clear':     this.reset(); this.updateDisplay(); break;
      case 'ce':        this.ce(); break;
      case 'backspace': this.backspace(); break;
      case 'negate':    this.negate(); break;
      case 'percent':   this.percent(); break;
      case 'reciprocal':this.reciprocal(); break;
      case 'square':    this.square(); break;
      case 'sqrt':      this.sqrt(); break;
      case 'abs':       this.abs(); break;
      case 'mc':        this.memClear(); break;
      case 'mr':        this.memRecall(); break;
      case 'm+':        this.memAdd(); break;
      case 'm-':        this.memSubtract(); break;
      case 'ms':        this.memStore(); break;
      case 'mv':        this.memView(); break;
    }
  }

  bindButtons() {
    this.panel.querySelectorAll(`[data-target="${this.prefix}"]`).forEach(btn => {
      btn.addEventListener('click', () => this.handle(btn.dataset.action));
    });
    this.panel.querySelectorAll('[data-target]').forEach(btn => {
      if (btn.dataset.target !== this.prefix) return;
      btn.addEventListener('mousedown', e => e.preventDefault());
    });
  }

  activate() { this.updateDisplay(); }
}

// ================================================================
// ENGINEERING CALCULATOR
// ================================================================
class EngineeringCalc extends BasicCalc {
  constructor(historyManager) {
    super('panel-engineering', 'eng', 'Инженерный', historyManager);
    this.isDeg = true;
    this.isFE = false;
    this.is2nd = false;
    this.setupExtra();
  }

  toRad(v) { return this.isDeg ? v * Math.PI / 180 : v; }
  fromRad(v) { return this.isDeg ? v * 180 / Math.PI : v; }

  setupExtra() {
    document.getElementById('eng-deg').addEventListener('click', () => {
      this.isDeg = !this.isDeg;
      document.getElementById('eng-deg').textContent = this.isDeg ? 'DEG' : 'RAD';
      document.getElementById('eng-deg').classList.toggle('active', this.isDeg);
    });

    document.getElementById('eng-fe').addEventListener('click', () => {
      this.isFE = !this.isFE;
      document.getElementById('eng-fe').classList.toggle('active', this.isFE);
      this.updateDisplay();
    });

    document.getElementById('eng-2nd').addEventListener('click', () => {
      this.is2nd = !this.is2nd;
      document.getElementById('eng-2nd').classList.toggle('active', this.is2nd);
    });

    // Trig dropdown
    setupDropdown('trig-btn', 'trig-menu', btn => {
      this.applyTrig(btn.dataset.trig);
    });

    // Function dropdown
    setupDropdown('func-btn', 'func-menu', btn => {
      this.applyFunc(btn.dataset.func);
    });
  }

  applyTrig(fn) {
    const v = parseFloat(this.cur);
    const rad = this.toRad(v);
    let r;
    switch (fn) {
      case 'sin':  r = Math.sin(rad); break;
      case 'cos':  r = Math.cos(rad); break;
      case 'tan':  r = Math.tan(rad); break;
      case 'cot':  r = 1 / Math.tan(rad); break;
      case 'asin': r = this.fromRad(Math.asin(v)); break;
      case 'acos': r = this.fromRad(Math.acos(v)); break;
      case 'atan': r = this.fromRad(Math.atan(v)); break;
      case 'acot': r = this.fromRad(Math.PI / 2 - Math.atan(v)); break;
      case 'sinh': r = Math.sinh(v); break;
      case 'cosh': r = Math.cosh(v); break;
      case 'tanh': r = Math.tanh(v); break;
    }
    if (r !== undefined) { this.cur = this.fmt(parseFloat(r.toPrecision(10))); this.resetNext = true; this.updateDisplay(); }
  }

  applyFunc(fn) {
    const v = parseFloat(this.cur);
    let r;
    switch (fn) {
      case 'log':  r = Math.log10(v); break;
      case 'ln':   r = Math.log(v); break;
      case 'sqrt': r = Math.sqrt(v); break;
      case 'cbrt': r = Math.cbrt(v); break;
      case 'factorial':
        if (!Number.isInteger(v) || v < 0 || v > 170) { this.cur = 'Ошибка'; this.updateDisplay(); return; }
        r = factorial(v); break;
      case 'rand': r = Math.random(); break;
    }
    if (r !== undefined) { this.cur = this.fmt(parseFloat(String(r).length > 15 ? r.toPrecision(10) : r)); this.resetNext = true; this.updateDisplay(); }
  }

  updateDisplay() {
    let val = this.cur;
    if (this.isFE && !isNaN(parseFloat(val)) && isFinite(parseFloat(val))) {
      val = parseFloat(val).toExponential(6);
    }
    this.displayEl.textContent = val;
    const len = val.replace(/[^0-9]/g, '').length;
    this.displayEl.style.fontSize = len > 15 ? '0.9rem' : len > 10 ? '1.4rem' : '';
    this.exprEl.textContent = this.exprStr || ' ';
  }

  handle(action) {
    switch (action) {
      case 'pi':         this.cur = String(Math.PI);   this.resetNext = true; this.updateDisplay(); break;
      case 'euler':      this.cur = String(Math.E);    this.resetNext = true; this.updateDisplay(); break;
      case 'exp-e':      this.cur = this.fmt(Math.exp(parseFloat(this.cur))); this.resetNext = true; this.updateDisplay(); break;
      case 'pow10':      this.cur = this.fmt(Math.pow(10, parseFloat(this.cur))); this.resetNext = true; this.updateDisplay(); break;
      case 'power':      this.operator('^'); break;
      case 'mod':        this.operator('%mod'); break;
      case 'log':        this.cur = this.fmt(Math.log10(parseFloat(this.cur))); this.resetNext = true; this.updateDisplay(); break;
      case 'ln':         this.cur = this.fmt(Math.log(parseFloat(this.cur))); this.resetNext = true; this.updateDisplay(); break;
      case 'factorial': {
        const v = parseFloat(this.cur);
        if (!Number.isInteger(v) || v < 0 || v > 170) { this.cur = 'Ошибка'; } else { this.cur = this.fmt(factorial(v)); }
        this.resetNext = true; this.updateDisplay(); break;
      }
      case 'open-paren':  break; // expression mode not implemented, no-op
      case 'close-paren': break;
      case '2nd': break; // handled by toggle UI
      case 'equals':
        // Override to save as 'Инженерный' — handled in calculate()
        this.calculate(); break;
      default: super.handle(action);
    }
  }

  fmtOp(op) {
    if (op === '^') return 'xʸ';
    if (op === '%mod') return 'mod';
    return super.fmtOp(op);
  }
}

// ================================================================
// PROGRAMMER CALCULATOR
// ================================================================
class ProgrammerCalc {
  constructor(historyManager) {
    this.panel = document.getElementById('panel-programmer');
    this.history = historyManager;
    this.base = 'dec';
    this.wordSize = 'qword';
    this.inputStr = '0';
    this.prevVal = 0;
    this.op = null;
    this.resetNext = false;
    this.mem = 0;
    this.bindAll();
  }

  getWordMask() {
    switch (this.wordSize) {
      case 'byte':  return 0xFF;
      case 'word':  return 0xFFFF;
      case 'dword': return 0xFFFFFFFF;
      default:      return 0x1FFFFFFFFFFFFF; // safe integer
    }
  }

  maskVal(n) { return Math.trunc(n) & this.getWordMask(); }

  parseInput() {
    const bases = { hex: 16, dec: 10, oct: 8, bin: 2 };
    return parseInt(this.inputStr || '0', bases[this.base]) || 0;
  }

  valToBase(n, base) {
    const bases = { hex: 16, dec: 10, oct: 8, bin: 2 };
    const s = Math.abs(n).toString(bases[base]).toUpperCase();
    return n < 0 ? '-' + s : s;
  }

  updateDisplay() {
    const n = this.parseInput();
    document.getElementById('prog-hex').textContent = this.valToBase(n, 'hex') || '0';
    document.getElementById('prog-dec').textContent = this.valToBase(n, 'dec') || '0';
    document.getElementById('prog-oct').textContent = this.valToBase(n, 'oct') || '0';
    document.getElementById('prog-bin').textContent = this.valToBase(n, 'bin') || '0';
    this.updateButtonStates();
  }

  updateButtonStates() {
    const valid = { hex: '0123456789ABCDEF', dec: '0123456789', oct: '01234567', bin: '01' };
    const allowed = valid[this.base];
    this.panel.querySelectorAll('[data-action]').forEach(btn => {
      const a = btn.dataset.action;
      if (/^[0-9A-F]$/.test(a)) btn.disabled = !allowed.includes(a);
    });
  }

  setBase(base) {
    const n = this.parseInput();
    this.base = base;
    const bases = { hex: 16, dec: 10, oct: 8, bin: 2 };
    this.inputStr = Math.abs(n).toString(bases[base]).toUpperCase();
    this.updateDisplay();
    this.panel.querySelectorAll('.prog-row').forEach(r => {
      r.classList.toggle('active', r.dataset.base === base);
    });
  }

  digit(d) {
    if (this.resetNext) { this.inputStr = d; this.resetNext = false; }
    else { this.inputStr = this.inputStr === '0' ? d : this.inputStr + d; }
    this.updateDisplay();
  }

  operator(op) {
    if (this.op && !this.resetNext) this.calculate(false);
    this.prevVal = this.parseInput();
    this.op = op;
    this.resetNext = true;
  }

  calculate(save = true) {
    if (!this.op) return;
    const a = this.prevVal, b = this.parseInput();
    let res;
    switch (this.op) {
      case '+':    res = a + b; break;
      case '-':    res = a - b; break;
      case '*':    res = a * b; break;
      case '/':    if (b === 0) { this.resetNext = true; return; } res = Math.trunc(a / b); break;
      case '%':    res = a % b; break;
      case 'AND':  res = (a & b) >>> 0; break;
      case 'OR':   res = (a | b) >>> 0; break;
      case 'XOR':  res = (a ^ b) >>> 0; break;
      case 'NAND': res = (~(a & b)) >>> 0; break;
      case 'NOR':  res = (~(a | b)) >>> 0; break;
      case 'LSH':  res = (a << b) >>> 0; break;
      case 'RSH':  res = (a >>> b); break;
      default: return;
    }
    res = this.maskVal(res);
    const bases = { hex: 16, dec: 10, oct: 8, bin: 2 };
    const expr = `${Math.abs(a).toString(bases[this.base]).toUpperCase()} ${this.op} ${Math.abs(b).toString(bases[this.base]).toUpperCase()}`;
    const resStr = Math.abs(res).toString(bases[this.base]).toUpperCase();
    if (save) this.history.add('Программист', expr + ` (${this.base.toUpperCase()})`, resStr);
    this.inputStr = resStr || '0';
    this.op = null;
    this.prevVal = 0;
    this.resetNext = true;
    this.updateDisplay();
  }

  applyNOT() {
    const n = this.parseInput();
    const res = this.maskVal(~n);
    this.inputStr = Math.abs(res).toString(this.base === 'hex' ? 16 : this.base === 'oct' ? 8 : this.base === 'bin' ? 2 : 10).toUpperCase() || '0';
    this.updateDisplay();
  }

  handle(action) {
    // Hex digits
    if (/^[0-9A-F]$/.test(action)) { this.digit(action); return; }
    switch (action) {
      case 'clear':     this.inputStr = '0'; this.op = null; this.prevVal = 0; this.resetNext = false; this.updateDisplay(); break;
      case 'backspace':
        if (this.resetNext) { this.inputStr = '0'; this.resetNext = false; }
        else { this.inputStr = this.inputStr.length > 1 ? this.inputStr.slice(0, -1) : '0'; }
        this.updateDisplay(); break;
      case 'negate':
        if (this.inputStr !== '0') this.inputStr = this.inputStr.startsWith('-') ? this.inputStr.slice(1) : '-' + this.inputStr;
        this.updateDisplay(); break;
      case 'add':    this.operator('+'); break;
      case 'subtract': this.operator('-'); break;
      case 'multiply': this.operator('*'); break;
      case 'divide':   this.operator('/'); break;
      case 'percent':  this.operator('%'); break;
      case 'lshift':   this.operator('LSH'); break;
      case 'rshift':   this.operator('RSH'); break;
      case 'equals':   this.calculate(); break;
      case 'ms': this.mem = this.parseInput(); break;
      case 'mv': {
        const bases = { hex: 16, dec: 10, oct: 8, bin: 2 };
        this.inputStr = Math.abs(this.mem).toString(bases[this.base]).toUpperCase() || '0';
        this.updateDisplay(); break;
      }
      case 'open-paren': break;
      case 'close-paren': break;
    }
  }

  bindAll() {
    this.panel.querySelectorAll('[data-target="prog"]').forEach(btn => {
      btn.addEventListener('click', () => this.handle(btn.dataset.action));
    });

    // Base switching by clicking display row
    this.panel.querySelectorAll('.prog-row').forEach(row => {
      row.addEventListener('click', () => this.setBase(row.dataset.base));
    });

    // Word size buttons
    this.panel.querySelectorAll('.word-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.wordSize = btn.dataset.size;
        this.panel.querySelectorAll('.word-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.inputStr = String(this.maskVal(this.parseInput())) || '0';
        this.updateDisplay();
      });
    });

    // Bit operations dropdown
    setupDropdown('bitops-btn', 'bitops-menu', btn => {
      const op = btn.dataset.bitop;
      if (op === 'NOT') this.applyNOT();
      else this.operator(op);
    });

    // Shift dropdown
    setupDropdown('shift-btn', 'shift-menu', btn => {
      this.operator(btn.dataset.shift === 'lsh' ? 'LSH' : 'RSH');
    });
  }

  activate() { this.updateDisplay(); }
}

// ================================================================
// DATE CALCULATOR
// ================================================================
class DateCalc {
  constructor() {
    this.mode = 'diff';
    this.op = '+';
    this.init();
  }

  init() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-from').value = today;
    document.getElementById('date-to').value = today;
    document.getElementById('date-base').value = today;

    document.getElementById('date-mode').addEventListener('change', e => {
      this.mode = e.target.value;
      document.getElementById('date-diff-section').classList.toggle('hidden', this.mode !== 'diff');
      document.getElementById('date-add-section').classList.toggle('hidden', this.mode !== 'add');
      this.calculate();
    });

    document.getElementById('date-from').addEventListener('change', () => this.calculate());
    document.getElementById('date-to').addEventListener('change', () => this.calculate());
    document.getElementById('date-base').addEventListener('change', () => this.calculate());
    document.getElementById('date-days').addEventListener('input', () => this.calculate());

    document.getElementById('date-add-op').addEventListener('click', () => {
      this.op = '+';
      document.getElementById('date-add-op').classList.add('active');
      document.getElementById('date-sub-op').classList.remove('active');
      this.calculate();
    });
    document.getElementById('date-sub-op').addEventListener('click', () => {
      this.op = '-';
      document.getElementById('date-sub-op').classList.add('active');
      document.getElementById('date-add-op').classList.remove('active');
      this.calculate();
    });

    this.calculate();
  }

  calculate() {
    if (this.mode === 'diff') {
      const from = new Date(document.getElementById('date-from').value);
      const to   = new Date(document.getElementById('date-to').value);
      if (isNaN(from) || isNaN(to)) { document.getElementById('date-diff-value').textContent = '—'; return; }

      const diffMs = to - from;
      const sign = diffMs < 0 ? '−' : '';
      const absDiff = Math.abs(diffMs);
      const totalDays = Math.floor(absDiff / 86400000);

      if (totalDays === 0) { document.getElementById('date-diff-value').textContent = 'Одинаковые даты'; return; }

      const years  = Math.floor(totalDays / 365);
      const months = Math.floor((totalDays % 365) / 30);
      const days   = totalDays % 30;

      let parts = [];
      if (years)  parts.push(`${years} ${plural(years, 'год', 'года', 'лет')}`);
      if (months) parts.push(`${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`);
      if (days || parts.length === 0) parts.push(`${days} ${plural(days, 'день', 'дня', 'дней')}`);

      document.getElementById('date-diff-value').textContent = sign + parts.join(', ');
    } else {
      const base = new Date(document.getElementById('date-base').value);
      const days = parseInt(document.getElementById('date-days').value) || 0;
      if (isNaN(base)) { document.getElementById('date-add-value').textContent = '—'; return; }
      const result = new Date(base);
      result.setDate(result.getDate() + (this.op === '+' ? days : -days));
      document.getElementById('date-add-value').textContent = result.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  activate() { this.calculate(); }
}

// ================================================================
// CURRENCY CALCULATOR
// ================================================================
class CurrencyCalc {
  constructor() {
    this.rates = {}; // charCode -> rate in RUB
    this.lastUpdate = null;
    this.active1 = true; // which field is being edited
    this.init();
  }

  async init() {
    await this.loadRates();
    this.bindEvents();
    this.convert(1);
  }

  async loadRates(force = false) {
    const CACHE_KEY = 'cbr_rates';
    const CACHE_TTL = 3600000; // 1 hour

    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          this.rates = cached.rates;
          this.lastUpdate = cached.date;
          this.populateSelects();
          return;
        }
      } catch {}
    }

    try {
      const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
      const data = await res.json();
      this.lastUpdate = data.Date ? data.Date.split('T')[0] : '—';
      this.rates = { RUB: 1 };
      for (const [code, info] of Object.entries(data.Valute)) {
        this.rates[code] = info.Value / info.Nominal;
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: this.rates, date: this.lastUpdate, ts: Date.now() }));
    } catch {
      this.rates = { RUB: 1, USD: 82.5, EUR: 89.3, CNY: 11.3 };
      this.lastUpdate = 'офлайн';
    }
    this.populateSelects();
  }

  populateSelects() {
    const from = document.getElementById('cur-from');
    const to   = document.getElementById('cur-to');
    const names = { RUB: 'Российский рубль', USD: 'Доллар США', EUR: 'Евро', GBP: 'Фунт стерлингов', CNY: 'Китайский юань', JPY: 'Японская иена', CHF: 'Швейцарский франк', KZT: 'Казахстанский тенге', BYN: 'Белорусский рубль', AUD: 'Австралийский доллар', CAD: 'Канадский доллар', HKD: 'Гонконгский доллар', SGD: 'Сингапурский доллар', TRY: 'Турецкая лира', AED: 'Дирхам ОАЭ', AMD: 'Армянский драм', AZN: 'Азербайджанский манат', GEL: 'Грузинский лари', UZS: 'Узбекский сум' };
    const codes = Object.keys(this.rates).sort();
    [from, to].forEach((sel, i) => {
      const cur = i === 0 ? 'USD' : 'RUB';
      sel.innerHTML = codes.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c} — ${names[c] || c}</option>`).join('');
    });
    this.updateRateInfo();
  }

  updateRateInfo() {
    const from = document.getElementById('cur-from').value;
    const to   = document.getElementById('cur-to').value;
    const rFrom = this.rates[from] || 1;
    const rTo   = this.rates[to]   || 1;
    const rate = (rFrom / rTo).toPrecision(6);
    const info = document.getElementById('cur-rate-info');
    info.textContent = `1 ${from} = ${rate} ${to}  ·  Обновлено: ${this.lastUpdate || '—'}`;
  }

  convertCalc(amount, from, to) {
    const rFrom = this.rates[from] || 1;
    const rTo   = this.rates[to]   || 1;
    return amount * rFrom / rTo;
  }

  convert(source) {
    const from = document.getElementById('cur-from').value;
    const to   = document.getElementById('cur-to').value;
    if (source === 1) {
      const a = parseFloat(document.getElementById('cur-amount1').value) || 0;
      document.getElementById('cur-amount2').value = parseFloat(this.convertCalc(a, from, to).toPrecision(8));
    } else {
      const a = parseFloat(document.getElementById('cur-amount2').value) || 0;
      document.getElementById('cur-amount1').value = parseFloat(this.convertCalc(a, to, from).toPrecision(8));
    }
    this.updateRateInfo();
  }

  bindEvents() {
    document.getElementById('cur-amount1').addEventListener('input', () => this.convert(1));
    document.getElementById('cur-amount2').addEventListener('input', () => this.convert(2));
    document.getElementById('cur-from').addEventListener('change', () => this.convert(1));
    document.getElementById('cur-to').addEventListener('change', () => this.convert(1));
    document.getElementById('cur-refresh').addEventListener('click', async () => {
      document.getElementById('cur-rate-info').textContent = 'Обновление...';
      await this.loadRates(true);
      this.convert(1);
    });
  }

  activate() { this.updateRateInfo(); }
}

// ================================================================
// UNIT CONVERTER BASE
// ================================================================
class UnitConverter {
  constructor(units, fromId, toId, amount1Id, amount2Id) {
    this.units = units;
    this.fromId = fromId;
    this.toId = toId;
    this.a1Id = amount1Id;
    this.a2Id = amount2Id;
    this.init();
  }

  init() {
    const [from, to] = [document.getElementById(this.fromId), document.getElementById(this.toId)];
    const firstKey = Object.keys(this.units)[0];
    const secondKey = Object.keys(this.units)[1] || firstKey;
    const html = Object.entries(this.units).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    from.innerHTML = html;
    to.innerHTML = html;
    from.value = firstKey;
    to.value = secondKey;

    document.getElementById(this.a1Id).addEventListener('input', () => this.convert(1));
    document.getElementById(this.a2Id).addEventListener('input', () => this.convert(2));
    from.addEventListener('change', () => this.convert(1));
    to.addEventListener('change', () => this.convert(1));
  }

  convert(source) {
    const fromKey = document.getElementById(this.fromId).value;
    const toKey   = document.getElementById(this.toId).value;
    const fromFactor = this.units[fromKey]?.factor || 1;
    const toFactor   = this.units[toKey]?.factor   || 1;
    if (source === 1) {
      const v = parseFloat(document.getElementById(this.a1Id).value) || 0;
      const base = v * fromFactor;
      document.getElementById(this.a2Id).value = parseFloat((base / toFactor).toPrecision(10));
    } else {
      const v = parseFloat(document.getElementById(this.a2Id).value) || 0;
      const base = v * toFactor;
      document.getElementById(this.a1Id).value = parseFloat((base / fromFactor).toPrecision(10));
    }
  }

  activate() {}
}

// ================================================================
// VOLUME CALCULATOR
// ================================================================
const VOLUME_UNITS = {
  ml:   { label: 'Миллилитры (мл)',           factor: 1 },
  l:    { label: 'Литры (л)',                  factor: 1000 },
  m3:   { label: 'Кубические метры (м³)',      factor: 1e6 },
  tsp:  { label: 'Чайная ложка (США)',         factor: 4.92892 },
  tbsp: { label: 'Столовая ложка (США)',       factor: 14.7868 },
  floz: { label: 'Жидкая унция (США)',         factor: 29.5735 },
  cup:  { label: 'Чашка (США)',                factor: 236.588 },
  pt:   { label: 'Пинта (США)',                factor: 473.176 },
  qt:   { label: 'Кварта (США)',               factor: 946.353 },
  gal:  { label: 'Галлон (США)',               factor: 3785.41 },
  in3:  { label: 'Кубический дюйм (дюйм³)',    factor: 16.3871 },
  ft3:  { label: 'Кубический фут (фут³)',      factor: 28316.8 },
};

// ================================================================
// LENGTH CALCULATOR
// ================================================================
const LENGTH_UNITS = {
  nm:  { label: 'Нанометры (нм)',    factor: 1e-9 },
  um:  { label: 'Микрометры (мкм)',  factor: 1e-6 },
  mm:  { label: 'Миллиметры (мм)',   factor: 0.001 },
  cm:  { label: 'Сантиметры (см)',   factor: 0.01 },
  m:   { label: 'Метры (м)',         factor: 1 },
  km:  { label: 'Километры (км)',    factor: 1000 },
  in:  { label: 'Дюймы (дюйм)',      factor: 0.0254 },
  ft:  { label: 'Футы (фут)',        factor: 0.3048 },
  yd:  { label: 'Ярды (ярд)',        factor: 0.9144 },
  mi:  { label: 'Мили (миля)',       factor: 1609.344 },
  nmi: { label: 'Морские мили',      factor: 1852 },
};

// ================================================================
// MATRIX MATH HELPERS
// ================================================================
function matMinor(m, row, col) {
  return m.filter((_, r) => r !== row).map(r => r.filter((_, c) => c !== col));
}
function matDet(m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let d = 0;
  for (let c = 0; c < n; c++) d += (c % 2 === 0 ? 1 : -1) * m[0][c] * matDet(matMinor(m, 0, c));
  return d;
}
function matTranspose(m) { return m[0].map((_, c) => m.map(row => row[c])); }
function matInverse(m) {
  const n = m.length;
  const aug = m.map((row, i) => { const id = Array(n).fill(0); id[i] = 1; return [...row, ...id]; });
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return null;
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}
function matRank(m) {
  const mat = m.map(row => row.slice()), rows = mat.length, cols = mat[0].length;
  let rank = 0, rowIdx = 0;
  for (let col = 0; col < cols && rowIdx < rows; col++) {
    let maxRow = rowIdx;
    for (let r = rowIdx + 1; r < rows; r++) if (Math.abs(mat[r][col]) > Math.abs(mat[maxRow][col])) maxRow = r;
    if (Math.abs(mat[maxRow][col]) < 1e-10) continue;
    [mat[rowIdx], mat[maxRow]] = [mat[maxRow], mat[rowIdx]];
    const pivot = mat[rowIdx][col];
    for (let j = col; j < cols; j++) mat[rowIdx][j] /= pivot;
    for (let r = 0; r < rows; r++) {
      if (r === rowIdx) continue;
      const f = mat[r][col];
      for (let j = col; j < cols; j++) mat[r][j] -= f * mat[rowIdx][j];
    }
    rank++; rowIdx++;
  }
  return rank;
}
function matAdd(a, b) { return a.map((row, i) => row.map((v, j) => v + b[i][j])); }
function matSub(a, b) { return a.map((row, i) => row.map((v, j) => v - b[i][j])); }
function matMul(a, b) {
  return Array.from({ length: a.length }, (_, i) =>
    Array.from({ length: b[0].length }, (_, j) =>
      a[i].reduce((s, _, k) => s + a[i][k] * b[k][j], 0)
    )
  );
}
function matSolve(a, b) {
  const n = a.length, bCols = b[0].length;
  const aug = a.map((row, i) => [...row, ...b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return null;
    for (let j = 0; j < n + bCols; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      for (let j = 0; j < n + bCols; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}
function fmtNum(n) {
  if (!isFinite(n)) return isNaN(n) ? 'NaN' : (n > 0 ? '∞' : '-∞');
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return parseFloat(n.toFixed(4)).toString();
}

// ================================================================
// MATRIX CALCULATOR
// ================================================================
class MatrixCalc {
  constructor() {
    this.showB = false;
    this.rowsA = 3; this.colsA = 3;
    this.rowsB = 3; this.colsB = 3;
    this.init();
  }

  init() {
    this.buildGrid('a');
    this.buildGrid('b');
    this.bindEvents();
    this.updateOperationList();
  }

  buildGrid(which) {
    const rows = which === 'a' ? this.rowsA : this.rowsB;
    const cols = which === 'a' ? this.colsA : this.colsB;
    const grid = document.getElementById(`mat-${which}-grid`);
    grid.style.gridTemplateColumns = `repeat(${cols}, 44px)`;
    grid.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'decimal';
        inp.className = 'matrix-cell';
        inp.value = '0';
        inp.dataset.r = r;
        inp.dataset.c = c;
        grid.appendChild(inp);
      }
    }
  }

  getMatrix(which) {
    const rows = which === 'a' ? this.rowsA : this.rowsB;
    const cols = which === 'a' ? this.colsA : this.colsB;
    const grid = document.getElementById(`mat-${which}-grid`);
    const m = Array.from({ length: rows }, () => Array(cols).fill(0));
    grid.querySelectorAll('.matrix-cell').forEach(inp => {
      m[parseInt(inp.dataset.r)][parseInt(inp.dataset.c)] = parseFloat(inp.value) || 0;
    });
    return m;
  }

  updateOperationList() {
    const sel = document.getElementById('mat-operation');
    const ops = this.showB
      ? [['add', 'A + B'], ['subtract', 'A − B'], ['multiply', 'A × B'], ['solve', 'AX = B']]
      : [['det', 'Определитель det(A)'], ['transpose', 'Транспонирование Aᵀ'], ['inverse', 'Обратная A⁻¹'], ['rank', 'Ранг rank(A)']];
    sel.innerHTML = ops.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  }

  calculate() {
    const op = document.getElementById('mat-operation').value;
    const A = this.getMatrix('a');
    try {
      if (!this.showB) {
        if (['det', 'inverse', 'rank'].includes(op) && A[0].length !== A.length) {
          this.showError('Матрица должна быть квадратной'); return;
        }
        switch (op) {
          case 'det':       this.showScalar('det(A)', fmtNum(matDet(A))); break;
          case 'transpose': this.showMatrix('Aᵀ', matTranspose(A)); break;
          case 'inverse': {
            const inv = matInverse(A);
            if (!inv) { this.showError('Матрица вырождена (det = 0)'); return; }
            this.showMatrix('A⁻¹', inv); break;
          }
          case 'rank': this.showScalar('rank(A)', String(matRank(A))); break;
        }
      } else {
        const B = this.getMatrix('b');
        switch (op) {
          case 'add':
          case 'subtract':
            if (A.length !== B.length || A[0].length !== B[0].length) {
              this.showError('Матрицы должны быть одного размера'); return;
            }
            this.showMatrix(op === 'add' ? 'A + B' : 'A − B', op === 'add' ? matAdd(A, B) : matSub(A, B));
            break;
          case 'multiply':
            if (A[0].length !== B.length) {
              this.showError('Число столбцов A должно равняться числу строк B'); return;
            }
            this.showMatrix('A × B', matMul(A, B)); break;
          case 'solve':
            if (A.length !== A[0].length) { this.showError('Матрица A должна быть квадратной'); return; }
            if (A.length !== B.length) { this.showError('Число строк A должно равняться числу строк B'); return; }
            { const X = matSolve(A, B); if (!X) { this.showError('Система не имеет единственного решения'); return; } this.showMatrix('X', X); }
            break;
        }
      }
    } catch { this.showError('Ошибка вычисления'); }
  }

  showScalar(label, value) {
    document.getElementById('mat-result-label').textContent = label;
    document.getElementById('mat-result-value').innerHTML = `<div class="mat-result-scalar">${esc(String(value))}</div>`;
    document.getElementById('mat-result-box').classList.remove('hidden');
  }

  showMatrix(label, matrix) {
    const cols = matrix[0].length;
    const grid = document.createElement('div');
    grid.className = 'mat-result-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    matrix.forEach(row => row.forEach(v => {
      const cell = document.createElement('div');
      cell.className = 'mat-result-cell';
      cell.textContent = fmtNum(v);
      grid.appendChild(cell);
    }));
    document.getElementById('mat-result-label').textContent = label;
    const valEl = document.getElementById('mat-result-value');
    valEl.innerHTML = '';
    valEl.appendChild(grid);
    document.getElementById('mat-result-box').classList.remove('hidden');
  }

  showError(msg) {
    document.getElementById('mat-result-label').textContent = 'Ошибка';
    document.getElementById('mat-result-value').innerHTML = `<div class="mat-result-error">${esc(msg)}</div>`;
    document.getElementById('mat-result-box').classList.remove('hidden');
  }

  bindEvents() {
    document.getElementById('mat-mode-a').addEventListener('click', () => {
      this.showB = false;
      document.getElementById('mat-mode-a').classList.add('active');
      document.getElementById('mat-mode-ab').classList.remove('active');
      document.getElementById('mat-b-section').classList.add('hidden');
      this.updateOperationList();
    });
    document.getElementById('mat-mode-ab').addEventListener('click', () => {
      this.showB = true;
      document.getElementById('mat-mode-ab').classList.add('active');
      document.getElementById('mat-mode-a').classList.remove('active');
      document.getElementById('mat-b-section').classList.remove('hidden');
      this.updateOperationList();
    });
    document.getElementById('mat-a-rows').addEventListener('change', e => { this.rowsA = parseInt(e.target.value); this.buildGrid('a'); });
    document.getElementById('mat-a-cols').addEventListener('change', e => { this.colsA = parseInt(e.target.value); this.buildGrid('a'); });
    document.getElementById('mat-b-rows').addEventListener('change', e => { this.rowsB = parseInt(e.target.value); this.buildGrid('b'); });
    document.getElementById('mat-b-cols').addEventListener('change', e => { this.colsB = parseInt(e.target.value); this.buildGrid('b'); });
    document.getElementById('mat-calculate').addEventListener('click', () => this.calculate());
  }

  activate() {}
}

// ================================================================
// BIQUADRATIC EQUATION CALCULATOR
// ================================================================
class BiquadraticCalc {
  constructor() { this.init(); }

  init() { this.bindEvents(); }

  getCoeffs() {
    return {
      a: parseFloat(document.getElementById('biq-a').value) || 0,
      b: parseFloat(document.getElementById('biq-b').value) || 0,
      c: parseFloat(document.getElementById('biq-c').value) || 0,
    };
  }

  // Returns array of {re, im} root objects, deduped
  solve() {
    const { a, b, c } = this.getCoeffs();
    const roots = [];

    if (Math.abs(a) < 1e-12) {
      // Treat as bx² + c = 0
      if (Math.abs(b) < 1e-12) {
        if (Math.abs(c) < 1e-12) {
          this.showMessage('Вырожденный случай: любое x является решением'); return;
        } else {
          this.showMessage('Нет решений'); return;
        }
      }
      const t = -c / b;
      if (Math.abs(t) < 1e-12) {
        roots.push({ re: 0, im: 0 });
      } else if (t > 0) {
        const s = Math.sqrt(t);
        roots.push({ re: s, im: 0 }, { re: -s, im: 0 });
      } else {
        const s = Math.sqrt(-t);
        roots.push({ re: 0, im: s }, { re: 0, im: -s });
      }
      this.showRoots(roots); return;
    }

    const D = b * b - 4 * a * c;

    if (D >= 0) {
      const sqrtD = Math.sqrt(D);
      const t1 = (-b + sqrtD) / (2 * a);
      const t2 = (-b - sqrtD) / (2 * a);
      for (const t of [t1, t2]) {
        if (Math.abs(t) < 1e-10) {
          roots.push({ re: 0, im: 0 });
        } else if (t > 0) {
          const s = Math.sqrt(t);
          roots.push({ re: s, im: 0 }, { re: -s, im: 0 });
        } else {
          const s = Math.sqrt(-t);
          roots.push({ re: 0, im: s }, { re: 0, im: -s });
        }
      }
    } else {
      // D < 0: t1,t2 are complex conjugates → 4 complex roots
      const p = -b / (2 * a);
      const q = Math.sqrt(-D) / (2 * a); // q > 0
      const r = Math.sqrt(c / a);        // |t|, guaranteed real since D<0 → ac>0
      const alpha = Math.sqrt((r + p) / 2);
      const beta  = Math.sqrt((r - p) / 2);
      roots.push(
        { re:  alpha, im:  beta },
        { re:  alpha, im: -beta },
        { re: -alpha, im:  beta },
        { re: -alpha, im: -beta }
      );
    }

    // Deduplicate roots (same re and im within tolerance)
    const unique = [];
    for (const root of roots) {
      const dup = unique.some(u =>
        Math.abs(u.re - root.re) < 1e-9 && Math.abs(u.im - root.im) < 1e-9
      );
      if (!dup) unique.push(root);
    }

    this.showRoots(unique);
  }

  fmtRoot(root) {
    const { re, im } = root;
    const reZero = Math.abs(re) < 1e-9;
    const imZero = Math.abs(im) < 1e-9;
    if (imZero) return fmtNum(re);
    if (reZero) return (im < 0 ? '−' : '') + fmtNum(Math.abs(im)) + 'i';
    const sign = im < 0 ? ' − ' : ' + ';
    return fmtNum(re) + sign + fmtNum(Math.abs(im)) + 'i';
  }

  isComplex(root) {
    return Math.abs(root.im) > 1e-9;
  }

  showRoots(roots) {
    const box = document.getElementById('biq-result-box');
    document.getElementById('biq-result-label').textContent = 'Корни';
    const grid = document.getElementById('biq-result-value');
    grid.className = 'eq-roots-grid';
    const labels = ['x₁', 'x₂', 'x₃', 'x₄'];
    grid.innerHTML = roots.map((r, i) => {
      const complex = this.isComplex(r);
      return `<div class="eq-root-item">
        <span class="eq-root-label">${labels[i] || `x${i+1}`} =</span>
        <span class="${complex ? 'eq-root-complex' : ''}">${esc(this.fmtRoot(r))}</span>
      </div>`;
    }).join('');
    box.classList.remove('hidden');
  }

  showMessage(msg) {
    const box = document.getElementById('biq-result-box');
    document.getElementById('biq-result-label').textContent = 'Результат';
    document.getElementById('biq-result-value').className = '';
    document.getElementById('biq-result-value').innerHTML = `<div class="eq-error">${esc(msg)}</div>`;
    box.classList.remove('hidden');
  }

  bindEvents() {
    document.getElementById('biq-solve').addEventListener('click', () => this.solve());
  }

  activate() {}
}

// ================================================================
// LINEAR SYSTEM CALCULATOR (2×2)
// ================================================================
class LinearSystemCalc {
  constructor() { this.init(); }

  init() { this.bindEvents(); }

  getCoeffs() {
    const g = id => parseFloat(document.getElementById(id).value) || 0;
    return {
      A: g('lin-a'), B: g('lin-b'), C: g('lin-c'),
      D: g('lin-d'), E: g('lin-e'), F: g('lin-f'),
    };
  }

  solve() {
    const { A, B, C, D, E, F } = this.getCoeffs();
    // System: Ax + By = -C
    //         Dx + Ey = -F
    const delta  = A * E - B * D;
    const deltaX = B * F - C * E;   // (-C)*E - B*(-F) = BF - CE
    const deltaY = C * D - A * F;   // A*(-F) - (-C)*D = CD - AF

    if (Math.abs(delta) < 1e-12) {
      if (Math.abs(deltaX) < 1e-12 && Math.abs(deltaY) < 1e-12) {
        this.showError('Бесконечно много решений (прямые совпадают)');
      } else {
        this.showError('Нет решений (прямые параллельны)');
      }
      return;
    }

    const x = deltaX / delta;
    const y = deltaY / delta;
    this.showResult(x, y);
  }

  showResult(x, y) {
    const box = document.getElementById('lin-result-box');
    document.getElementById('lin-result-value').innerHTML = `
      <div class="eq-xy-result">
        <div class="eq-xy-line">
          <span class="eq-xy-var">x =</span>
          <span class="eq-xy-val">${esc(fmtNum(x))}</span>
        </div>
        <div class="eq-xy-line">
          <span class="eq-xy-var">y =</span>
          <span class="eq-xy-val">${esc(fmtNum(y))}</span>
        </div>
      </div>`;
    box.classList.remove('hidden');
  }

  showError(msg) {
    const box = document.getElementById('lin-result-box');
    document.getElementById('lin-result-value').innerHTML = `<div class="eq-error">${esc(msg)}</div>`;
    box.classList.remove('hidden');
  }

  bindEvents() {
    document.getElementById('lin-solve').addEventListener('click', () => this.solve());
  }

  activate() {}
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 19) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function setupDropdown(btnId, menuId, callback) {
  const btn  = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  menu.querySelectorAll('button').forEach(item => {
    item.addEventListener('click', () => { callback(item); menu.classList.remove('open'); });
  });
}

// Close all dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

// ================================================================
// UI CONTROLLER
// ================================================================
class UIController {
  constructor() {
    this.sidebar      = document.getElementById('sidebar');
    this.historyPanel = document.getElementById('historyPanel');
    this.overlay      = document.getElementById('overlay');
    this.historyEl    = document.getElementById('historyList');
    this.currentType  = 'basic';

    this.historyMgr = new HistoryManager();

    // Init all calculators
    this.calcs = {
      basic:       new BasicCalc('panel-basic', 'basic', 'Обычный', this.historyMgr),
      engineering: new EngineeringCalc(this.historyMgr),
      programmer:  new ProgrammerCalc(this.historyMgr),
      date:        new DateCalc(),
      currency:    new CurrencyCalc(),
      volume:      new UnitConverter(VOLUME_UNITS, 'vol-from', 'vol-to', 'vol-amount1', 'vol-amount2'),
      length:      new UnitConverter(LENGTH_UNITS, 'len-from', 'len-to', 'len-amount1', 'len-amount2'),
      matrix:      new MatrixCalc(),
      biquadratic: new BiquadraticCalc(),
      linear:      new LinearSystemCalc(),
    };

    this.bindNavigation();
    this.bindPanels();
    this.bindHistory();
    this.bindKeyboard();
    this.renderHistory();
  }

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.switchCalc(type);
        if (window.innerWidth < 900) this.closeSidebar();
      });
    });
  }

  switchCalc(type) {
    document.querySelector('.nav-item.active')?.classList.remove('active');
    document.querySelector(`.nav-item[data-type="${type}"]`)?.classList.add('active');
    document.querySelector('.calc-panel:not(.hidden)')?.classList.add('hidden');
    document.getElementById(`panel-${type}`)?.classList.remove('hidden');
    this.currentType = type;
    this.calcs[type]?.activate?.();
  }

  bindPanels() {
    // Mobile open
    document.getElementById('menuBtn').addEventListener('click', () => this.openSidebar());
    document.getElementById('historyBtn').addEventListener('click', () => this.openHistory());

    // Close buttons
    document.getElementById('sidebarClose').addEventListener('click', () => this.closeSidebar());
    document.getElementById('historyClose').addEventListener('click', () => this.closeHistory());

    // Overlay click
    this.overlay.addEventListener('click', () => { this.closeSidebar(); this.closeHistory(); });
  }

  openSidebar()  { this.sidebar.classList.add('open'); this.overlay.classList.add('active'); }
  closeSidebar() { this.sidebar.classList.remove('open'); if (!this.historyPanel.classList.contains('open')) this.overlay.classList.remove('active'); }
  openHistory()  { this.historyPanel.classList.add('open'); this.overlay.classList.add('active'); }
  closeHistory() { this.historyPanel.classList.remove('open'); if (!this.sidebar.classList.contains('open')) this.overlay.classList.remove('active'); }

  bindHistory() {
    document.addEventListener('historyUpdate', () => this.renderHistory());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      this.historyMgr.clear();
    });
  }

  renderHistory() {
    const entries = this.historyMgr.getAll();
    if (!entries.length) {
      this.historyEl.innerHTML = '<div class="history-empty">История пуста</div>';
      return;
    }
    this.historyEl.innerHTML = entries.map(e => {
      const time = new Date(e.ts);
      const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `<div class="history-item">
        <div class="history-item-expr">${esc(e.expression)}</div>
        <div class="history-item-result">${esc(e.result)}</div>
        <div class="history-item-meta"><span>${esc(e.type)}</span><span>${timeStr}</span></div>
      </div>`;
    }).join('');
  }

  bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (['basic', 'engineering'].includes(this.currentType)) {
        this.handleKeyboard(e);
      }
    });
  }

  handleKeyboard(e) {
    const calc = this.calcs[this.currentType];
    if (!calc) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '+':'add', '-':'subtract', '*':'multiply', '/':'divide',
      'Enter':'equals', '=':'equals',
      'Backspace':'backspace', 'Delete':'clear', 'Escape':'clear',
      '.':'decimal', ',':'decimal',
      '%':'percent',
    };
    const action = map[e.key];
    if (action) { e.preventDefault(); calc.handle(action); }
  }
}

// Escape HTML helper
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  window.uiCtrl = new UIController();
});
