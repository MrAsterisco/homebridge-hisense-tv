// ─── Step 2: Connection Test ──────────────────────────────────────────────────

function renderStep2() {
  return `
    ${renderWizardSteps(2)}
    <h5>Connection Test</h5>
    <p class="text-secondary small">Testing the connection to your TV at <strong>${esc(state.tv.ipaddress)}</strong>…</p>
    <div id="conn-status" class="my-4 text-center">
      <span class="status-spinner"></span>
      <span class="ms-2">Connecting…</span>
    </div>
    ${renderNavButtons({ showBack: true, backLabel: '← Back', nextLabel: 'Next →', nextId: 'btn-next', nextDisabled: true })}`;
}

function bindStep2() {
  $('#btn-back').addEventListener('click', () => {
    homebridge.request('/cleanup').catch(() => {});
    state.step = 1;
    render();
  });

  // Auto-run on arrival
  runConnectionTest();
}

async function runConnectionTest() {
  const statusEl = $('#conn-status');
  try {
    const result = await homebridge.request('/test-connection', {
      ipaddress: state.tv.ipaddress,
      macaddress: state.tv.macaddress,
      sslmode: state.tv.sslmode,
      sslcertificate: state.tv.sslcertificate,
      sslprivatekey: state.tv.sslprivatekey,
    });

    if (!result.success) {
      statusEl.innerHTML = `<div class="alert alert-danger mb-0"><strong>Connection failed</strong><br>${esc(result.error)}</div>`;
      $('#btn-next').disabled = false;
      $('#btn-next').textContent = 'Retry';
      $('#btn-next').addEventListener('click', () => {
        state.step = 2;
        render();
      }, { once: true });
      return;
    }

    state.alreadyAuthorized = result.authorized;

    if (result.authorized) {
      statusEl.innerHTML = `<div class="alert alert-success mb-0">✓ Connected &amp; authorized. Your TV is ready.</div>`;
    } else {
      statusEl.innerHTML = `<div class="alert alert-warning mb-0">⚠ Connected but not yet authorized. The pairing step will follow.</div>`;
    }

    const nextBtn = $('#btn-next');
    nextBtn.disabled = false;
    nextBtn.textContent = 'Next →';
    nextBtn.addEventListener('click', () => {
      state.step = state.alreadyAuthorized ? 4 : 3; // skip pairing if authorized
      render();
    }, { once: true });

  } catch (e) {
    if (statusEl) {
      statusEl.innerHTML = `<div class="alert alert-danger mb-0"><strong>Error:</strong> ${esc(e.message)}</div>`;
    }
  }
}
