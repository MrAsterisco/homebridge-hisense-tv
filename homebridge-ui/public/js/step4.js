// ─── Step 4: TV Type Detection ────────────────────────────────────────────────

function renderStep4() {
  const phase = state.pictureTestPhase;

  let body = '';
  if (phase === 'idle') {
    body = `<div class="my-4 text-center"><span class="status-spinner"></span> <span class="ms-2">Detecting TV type…</span></div>`;
  } else if (phase === 'need-off') {
    body = `
      <div class="alert alert-info">
        <strong>Picture Settings Test</strong><br>
        Turn your TV <strong>OFF</strong> now, then press Continue.
      </div>
      <button class="btn btn-primary" id="btn-snap-off">Continue</button>`;
  } else if (phase === 'waiting-off') {
    body = `<div class="my-3"><span class="status-spinner"></span> Capturing OFF snapshot…</div>`;
  } else if (phase === 'need-on') {
    body = `
      <div class="alert alert-info">
        <strong>Picture Settings Test</strong><br>
        Now turn your TV <strong>ON</strong> and wait for it to fully boot, then press Continue.
      </div>
      <button class="btn btn-primary" id="btn-snap-on">Continue</button>`;
  } else if (phase === 'waiting-on') {
    body = `<div class="my-3"><span class="status-spinner"></span> Capturing ON snapshot…</div>`;
  } else if (phase === 'done') {
    const diff = state.pictureTestDiff;
    if (state.tv.tvType === 'pictureSettings' && diff.length > 0) {
      body = `
        <div class="alert alert-success">
          ✓ Picture Settings mode detected.<br>
          Using <strong>${esc(diff[0].name)}</strong> (menuId: ${esc(diff[0].menuId)}, menuFlag when OFF: ${esc(diff[0].menuFlag)})
        </div>`;
    } else if (state.tv.tvType === 'pictureSettings' && diff.length === 0) {
      body = `
        <div class="alert alert-warning">
          No picture settings difference found. Please select the TV type manually:
        </div>
        <div class="mb-3">
          <select class="form-select" id="tv-type-manual">
            <option value="default" ${state.tv.tvType === 'default' ? 'selected' : ''}>Default (not always-on)</option>
            <option value="fakeSleep" ${state.tv.tvType === 'fakeSleep' ? 'selected' : ''}>Fake Sleep (always-on)</option>
            <option value="pictureSettings" ${state.tv.tvType === 'pictureSettings' ? 'selected' : ''}>Picture Settings (always-on)</option>
          </select>
        </div>`;
    } else {
      const labels = { default: 'Default (not always-on)', fakeSleep: 'Fake Sleep (always-on)', pictureSettings: 'Picture Settings (always-on)' };
      body = `<div class="alert alert-success">✓ TV type detected: <strong>${labels[state.tv.tvType] || state.tv.tvType}</strong></div>`;
    }
  }

  return `
    ${renderWizardSteps(4)}
    <h5>Always-On Detection</h5>
    <p class="text-secondary small">Determines how your TV signals its power state.</p>
    ${body}
    ${phase === 'done' ? renderNavButtons({ showBack: true, backLabel: '← Back' }) : ''}`;
}

function bindStep4() {
  if (state.pictureTestPhase === 'idle') {
    runTvTypeDetection();
  } else if (state.pictureTestPhase === 'need-off') {
    $('#btn-snap-off')?.addEventListener('click', runOffSnapshot);
  } else if (state.pictureTestPhase === 'need-on') {
    $('#btn-snap-on')?.addEventListener('click', runOnSnapshot);
  } else if (state.pictureTestPhase === 'done') {
    $('#btn-back')?.addEventListener('click', () => {
      state.step = 3;
      state.pictureTestPhase = 'idle';
      render();
    });
    $('#btn-next')?.addEventListener('click', () => {
      const manual = $('#tv-type-manual');
      if (manual) state.tv.tvType = manual.value;
      state.step = 5;
      render();
    });

    const manual = $('#tv-type-manual');
    if (manual) {
      manual.addEventListener('change', (e) => { state.tv.tvType = e.target.value; });
    }
  }
}

async function runTvTypeDetection() {
  try {
    const result = await homebridge.request('/detect-tv-type', {
      ipaddress: state.tv.ipaddress,
      macaddress: state.tv.macaddress,
      sslmode: state.tv.sslmode,
      sslcertificate: state.tv.sslcertificate,
      sslprivatekey: state.tv.sslprivatekey,
    });

    state.tv.tvType = result.tvType || 'default';

    if (result.needsPictureTest) {
      state.pictureTestPhase = 'need-off';
    } else {
      state.pictureTestPhase = 'done';
      if (result.menuId !== undefined) {
        state.tv.pictureSettings.menuId = result.menuId;
        state.tv.pictureSettings.menuFlag = result.menuFlag;
      }
    }
    render();
  } catch (e) {
    state.tv.tvType = 'default';
    state.pictureTestPhase = 'done';
    homebridge.toast.error('Detection failed, defaulting to Standard. ' + e.message, 'Warning');
    render();
  }
}

async function runOffSnapshot() {
  state.pictureTestPhase = 'waiting-off';
  render();
  try {
    const r = await homebridge.request('/picture-settings-snapshot', { stage: 'off' });
    if (r.success) {
      state.pictureTestPhase = 'need-on';
    } else {
      homebridge.toast.error(r.error || 'Failed to capture snapshot.', 'Error');
      state.pictureTestPhase = 'need-off';
    }
  } catch (e) {
    homebridge.toast.error(e.message, 'Error');
    state.pictureTestPhase = 'need-off';
  }
  render();
}

async function runOnSnapshot() {
  state.pictureTestPhase = 'waiting-on';
  render();
  try {
    const r = await homebridge.request('/picture-settings-snapshot', { stage: 'on' });
    if (r.success) {
      state.pictureTestDiff = r.diff || [];
      if (state.pictureTestDiff.length > 0) {
        state.tv.tvType = 'pictureSettings';
        state.tv.pictureSettings.menuId = state.pictureTestDiff[0].menuId;
        state.tv.pictureSettings.menuFlag = state.pictureTestDiff[0].menuFlag;
      }
      state.pictureTestPhase = 'done';
    } else {
      homebridge.toast.error(r.error || 'Failed to capture ON snapshot.', 'Error');
      state.pictureTestPhase = 'need-on';
    }
  } catch (e) {
    homebridge.toast.error(e.message, 'Error');
    state.pictureTestPhase = 'need-on';
  }
  render();
}
