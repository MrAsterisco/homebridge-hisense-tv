// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  config: {},           // full plugin config block
  editingIndex: null,   // null = new TV, number = editing existing
  screen: 'home',       // 'home' | 'wizard'
  step: 1,              // current wizard step (1–7)
  networkInterfaces: [],
  alreadyAuthorized: false,
  availableApps: [],
  tvTypeResult: null,   // result from /detect-tv-type
  pictureTestPhase: 'idle', // 'idle' | 'need-off' | 'waiting-off' | 'need-on' | 'waiting-on' | 'done'
  pictureTestDiff: [],
  tv: {
    id: '',
    name: '',
    ipaddress: '',
    macaddress: '',
    sslmode: 'default',
    sslcertificate: '',
    sslprivatekey: '',
    tvType: 'default',
    pictureSettings: { menuId: '', menuFlag: '' },
    showApps: false,
    apps: [],
    pollingInterval: 4,
    wolInterval: 400,
    wolRetries: 3,
    broadcast: '',
  },
};

const STEP_LABELS = ['Basics', 'Test', 'Pairing', 'TV Type', 'Apps', 'Advanced', 'Done'];
const TOTAL_STEPS = 7;

// ─── Utilities ────────────────────────────────────────────────────────────────

const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBadge(tvType) {
  const map = {
    default: ['secondary', 'Default'],
    fakeSleep: ['info', 'Fake Sleep'],
    pictureSettings: ['warning', 'Picture Settings'],
  };
  const [color, label] = map[tvType] || ['secondary', tvType];
  return `<span class="badge text-bg-${color}">${label}</span>`;
}

function renderWizardSteps(currentStep) {
  return `<div class="wizard-steps">${STEP_LABELS.map((label, i) => {
    const num = i + 1;
    const cls = num < currentStep ? 'done' : num === currentStep ? 'active' : '';
    return `<div class="wizard-step ${cls}"><span class="step-num">${num < currentStep ? '✓' : num}</span>${label}</div>`;
  }).join('')}</div>`;
}

function renderNavButtons({ backLabel = 'Back', nextLabel = 'Next', nextId = 'btn-next', backId = 'btn-back', showBack = true, showNext = true, nextDisabled = false } = {}) {
  return `<div class="d-flex justify-content-between mt-4">
    <div>${showBack ? `<button class="btn btn-outline-secondary" id="${backId}">${backLabel}</button>` : ''}</div>
    <div>${showNext ? `<button class="btn btn-primary" id="${nextId}" ${nextDisabled ? 'disabled' : ''}>${nextLabel}</button>` : ''}</div>
  </div>`;
}
