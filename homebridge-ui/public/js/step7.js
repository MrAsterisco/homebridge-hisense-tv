// ─── Step 7: Done ─────────────────────────────────────────────────────────────

function renderStep7() {
  const tv = state.tv;
  const typeLabels = { default: 'Default', fakeSleep: 'Fake Sleep', pictureSettings: 'Picture Settings' };

  return `
    ${renderWizardSteps(7)}
    <div class="step-icon text-center">✅</div>
    <h5 class="text-center">Ready to Save</h5>
    <p class="text-secondary small text-center">Review the summary and click Save to add this TV to your config.</p>

    <div class="card mb-3">
      <div class="card-body">
        <table class="table table-sm mb-0">
          <tbody>
            <tr><th>Name</th><td>${esc(tv.name)}</td></tr>
            <tr><th>IP Address</th><td class="font-monospace">${esc(tv.ipaddress)}</td></tr>
            <tr><th>MAC Address</th><td class="font-monospace">${esc(tv.macaddress)}</td></tr>
            <tr><th>SSL Mode</th><td>${esc(tv.sslmode)}</td></tr>
            <tr><th>TV Type</th><td>${renderBadge(tv.tvType)}</td></tr>
            ${tv.tvType === 'pictureSettings' ? `<tr><th>menuId / menuFlag</th><td class="font-monospace">${esc(tv.pictureSettings.menuId)} / ${esc(tv.pictureSettings.menuFlag)}</td></tr>` : ''}
            <tr><th>Show Apps</th><td>${tv.showApps ? 'Yes' : 'No'}${tv.showApps && tv.apps.length ? ` (${tv.apps.length} filtered)` : ''}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="d-flex justify-content-between mt-3">
      <button class="btn btn-outline-secondary" id="btn-back">← Back</button>
      <button class="btn btn-success" id="btn-save">Save TV</button>
    </div>`;
}

function bindStep7() {
  $('#btn-back').addEventListener('click', () => {
    state.step = 6;
    render();
  });

  $('#btn-save').addEventListener('click', async () => {
    const tv = state.tv;

    // Build the device config object
    const deviceConfig = {
      id: tv.id,
      name: tv.name,
      ipaddress: tv.ipaddress,
      macaddress: tv.macaddress,
      sslmode: tv.sslmode,
      tvType: tv.tvType,
      showApps: tv.showApps,
      pollingInterval: tv.pollingInterval,
      wolRetries: tv.wolRetries,
      wolInterval: tv.wolInterval,
    };

    if (tv.sslmode === 'custom') {
      deviceConfig.sslcertificate = tv.sslcertificate;
      deviceConfig.sslprivatekey = tv.sslprivatekey;
    }

    if (tv.tvType === 'pictureSettings') {
      deviceConfig.pictureSettings = {
        menuId: parseInt(tv.pictureSettings.menuId) || 0,
        menuFlag: parseInt(tv.pictureSettings.menuFlag) || 0,
      };
    }

    if (tv.showApps && tv.apps.length > 0) {
      deviceConfig.apps = tv.apps;
    }

    if (tv.broadcast) {
      deviceConfig.broadcast = tv.broadcast;
    }

    // Insert into config
    if (!state.config.devices) state.config.devices = [];
    if (state.editingIndex !== null) {
      state.config.devices[state.editingIndex] = deviceConfig;
    } else {
      state.config.devices.push(deviceConfig);
    }

    homebridge.showSpinner();
    try {
      await homebridge.updatePluginConfig([state.config]);
      await homebridge.savePluginConfig();
      homebridge.toast.success(`"${tv.name}" saved!`, 'Saved');
    } catch (e) {
      homebridge.toast.error('Failed to save: ' + e.message, 'Error');
      homebridge.hideSpinner();
      return;
    }

    homebridge.request('/cleanup').catch(() => {});
    homebridge.hideSpinner();
    state.screen = 'home';
    state.editingIndex = null;
    state.pictureTestPhase = 'idle';
    render();
  });
}
