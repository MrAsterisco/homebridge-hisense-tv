// ─── Step 6: Advanced ─────────────────────────────────────────────────────────

function renderStep6() {
  const tv = state.tv;
  return `
    ${renderWizardSteps(6)}
    <h5>Advanced Settings</h5>
    <p class="text-secondary small">These settings have sensible defaults. Only change them if you have issues.</p>

    <div class="mb-3">
      <label class="form-label">Polling Interval (seconds)</label>
      <input type="number" class="form-control" id="adv-poll" min="1" max="10" value="${esc(tv.pollingInterval)}">
      <div class="form-text">How often to check TV power state (Default type only). Default: 4.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Wake-on-LAN Retries</label>
      <input type="number" class="form-control" id="adv-wol-retries" min="1" max="10" value="${esc(tv.wolRetries)}">
      <div class="form-text">Number of magic packets sent per wake attempt. Default: 3.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Wake-on-LAN Interval (ms)</label>
      <input type="number" class="form-control" id="adv-wol-interval" min="100" max="1000" value="${esc(tv.wolInterval)}">
      <div class="form-text">Delay between magic packets. Default: 400 ms.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Custom Broadcast Address <span class="text-secondary small">(optional)</span></label>
      <input type="text" class="form-control font-monospace" id="adv-broadcast" value="${esc(tv.broadcast)}" placeholder="192.168.1.255">
      <div class="form-text">Override the broadcast address for WoL packets. Usually not needed.</div>
    </div>
    ${renderNavButtons({ showBack: true, backLabel: '← Back' })}`;
}

function bindStep6() {
  $('#btn-back').addEventListener('click', () => {
    saveStep6();
    state.step = 5;
    render();
  });
  $('#btn-next').addEventListener('click', () => {
    saveStep6();
    state.step = 7;
    render();
  });
}

function saveStep6() {
  state.tv.pollingInterval = parseInt($('#adv-poll')?.value) || 4;
  state.tv.wolRetries = parseInt($('#adv-wol-retries')?.value) || 3;
  state.tv.wolInterval = parseInt($('#adv-wol-interval')?.value) || 400;
  state.tv.broadcast = $('#adv-broadcast')?.value.trim() || '';
}
