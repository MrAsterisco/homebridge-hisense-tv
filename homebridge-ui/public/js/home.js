// ─── Screen: Home ─────────────────────────────────────────────────────────────

function renderHome() {
  const devices = state.config.devices || [];
  const cards = devices.length
    ? devices.map((tv, i) => `
        <div class="tv-card">
          <div class="tv-card-info">
            <p class="tv-card-name">${esc(tv.name || 'Unnamed TV')}</p>
            <p class="tv-card-meta">${esc(tv.ipaddress)} &nbsp;·&nbsp; ${esc(tv.macaddress)} &nbsp;·&nbsp; ${renderBadge(tv.tvType)}</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary btn-edit" data-index="${i}">Edit</button>
            <button class="btn btn-sm btn-outline-danger btn-remove" data-index="${i}">Remove</button>
          </div>
        </div>`).join('')
    : '<p class="text-secondary">No TVs configured yet. Click <strong>Add TV</strong> to get started.</p>';

  return `
    <div class="mb-3">
      <label class="form-label fw-semibold">Homebridge Host MAC Address</label>
      <div class="d-flex gap-2">
        <input type="text" class="form-control font-monospace" id="host-mac"
          placeholder="00:00:00:00:00:00" value="${esc(state.config.macaddress || '')}">
        ${state.networkInterfaces.length ? `
        <select class="form-select" id="nic-select" style="max-width:220px" title="Pick a network interface">
          <option value="">Pick interface…</option>
          ${state.networkInterfaces.map(n => `<option value="${esc(n.mac)}">${esc(n.name)} (${esc(n.address)})</option>`).join('')}
        </select>` : ''}
      </div>
      <div class="form-text">The MAC address of the network interface Homebridge uses to talk to your TVs.</div>
    </div>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">Configured TVs</h6>
      <button class="btn btn-sm btn-primary" id="btn-add-tv">+ Add TV</button>
    </div>
    ${cards}
    <div class="mt-4 pt-3 border-top">
      <button class="btn btn-success w-100" id="btn-save-home">Save Configuration</button>
    </div>`;
}

function bindHome() {
  const nicSel = $('#nic-select');
  if (nicSel) {
    nicSel.addEventListener('change', () => {
      if (nicSel.value) $('#host-mac').value = nicSel.value;
    });
  }

  $('#btn-add-tv').addEventListener('click', () => {
    state.editingIndex = null;
    state.tv = {
      id: 'HiSenseTV-' + Date.now(),
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
    };
    state.step = 1;
    state.alreadyAuthorized = false;
    state.tvTypeResult = null;
    state.pictureTestPhase = 'idle';
    state.availableApps = [];
    state.screen = 'wizard';
    render();
  });

  $$('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index);
      state.editingIndex = i;
      const existing = state.config.devices[i];
      state.tv = {
        id: existing.id ?? '',
        name: existing.name ?? '',
        ipaddress: existing.ipaddress ?? '',
        macaddress: existing.macaddress ?? '',
        sslmode: existing.sslmode ?? 'default',
        sslcertificate: existing.sslcertificate ?? '',
        sslprivatekey: existing.sslprivatekey ?? '',
        tvType: existing.tvType ?? 'default',
        pictureSettings: {
          menuId: existing.pictureSettings?.menuId ?? '',
          menuFlag: existing.pictureSettings?.menuFlag ?? '',
        },
        showApps: existing.showApps ?? false,
        apps: [...(existing.apps ?? [])],
        pollingInterval: existing.pollingInterval ?? 4,
        wolInterval: existing.wolInterval ?? 400,
        wolRetries: existing.wolRetries ?? 3,
        broadcast: existing.broadcast ?? '',
      };
      state.step = 1;
      state.alreadyAuthorized = false;
      state.tvTypeResult = null;
      state.pictureTestPhase = 'idle';
      state.availableApps = [];
      state.screen = 'wizard';
      render();
    });
  });

  $$('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index);
      if (confirm(`Remove "${state.config.devices[i]?.name || 'this TV'}"?`)) {
        state.config.devices.splice(i, 1);
        render();
      }
    });
  });

  $('#btn-save-home').addEventListener('click', async () => {
    state.config.macaddress = $('#host-mac').value.trim();
    homebridge.showSpinner();
    try {
      await homebridge.updatePluginConfig([state.config]);
      await homebridge.savePluginConfig();
      homebridge.toast.success('Configuration saved!', 'Saved');
    } catch (e) {
      homebridge.toast.error('Failed to save: ' + e.message, 'Error');
    } finally {
      homebridge.hideSpinner();
    }
  });
}
