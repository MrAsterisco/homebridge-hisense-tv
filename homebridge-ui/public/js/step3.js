// ─── Step 3: Pairing ──────────────────────────────────────────────────────────

function renderStep3() {
  return `
    ${renderWizardSteps(3)}
    <h5>Pair with TV</h5>
    <p class="text-secondary small">Your TV should be displaying a 4-digit code on screen. Enter it below to authorize this Homebridge instance.</p>
    <div class="mb-3">
      <label class="form-label">4-Digit Code</label>
      <input type="text" class="form-control font-monospace text-center fs-4 w-50 mx-auto"
        id="pair-code" maxlength="4" placeholder="----" inputmode="numeric" autocomplete="off">
    </div>
    <div id="pair-status"></div>
    ${renderNavButtons({ showBack: true, backLabel: '← Back', nextLabel: 'Submit Code' })}`;
}

function bindStep3() {
  // Trigger TV to show the pairing code
  homebridge.request('/start-pairing', {
    ipaddress: state.tv.ipaddress,
    macaddress: state.tv.macaddress,
    sslmode: state.tv.sslmode,
    sslcertificate: state.tv.sslcertificate,
    sslprivatekey: state.tv.sslprivatekey,
  }).catch((e) => {
    const el = $('#pair-status');
    if (el) el.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
  });

  $('#btn-back').addEventListener('click', () => {
    state.step = 1;
    render();
  });

  $('#btn-next').addEventListener('click', async () => {
    const code = $('#pair-code').value.trim();
    if (!/^\d{4}$/.test(code)) {
      homebridge.toast.error('Please enter the 4-digit code shown on your TV.', 'Validation');
      return;
    }

    const statusEl = $('#pair-status');
    statusEl.innerHTML = '<span class="status-spinner"></span> Sending code…';
    $('#btn-next').disabled = true;

    try {
      const result = await homebridge.request('/send-auth-code', {
        code,
        macaddress: state.tv.macaddress,
      });

      if (result.success) {
        statusEl.innerHTML = '<div class="alert alert-success">✓ Paired successfully!</div>';
        setTimeout(() => {
          state.step = 4;
          render();
        }, 800);
      } else {
        statusEl.innerHTML = `<div class="alert alert-danger">${esc(result.error)}</div>`;
        $('#btn-next').disabled = false;
      }
    } catch (e) {
      statusEl.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
      $('#btn-next').disabled = false;
    }
  });
}
