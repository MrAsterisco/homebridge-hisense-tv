// ─── Step 1: Basics ───────────────────────────────────────────────────────────

function renderStep1() {
  const tv = state.tv;
  return `
    ${renderWizardSteps(1)}
    <h5>TV Details</h5>
    <p class="text-secondary small">Enter the basic information for your TV.</p>

    <div class="mb-3">
      <label class="form-label">Display Name <span class="text-danger">*</span></label>
      <input type="text" class="form-control" id="tv-name" value="${esc(tv.name)}" placeholder="Living Room TV">
    </div>
    <div class="mb-3">
      <label class="form-label">Device ID <span class="text-danger">*</span></label>
      <input type="text" class="form-control font-monospace" id="tv-id" value="${esc(tv.id)}" placeholder="HiSenseTV">
      <div class="form-text">Unique identifier — changing this requires re-adding the accessory in Home.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">TV IP Address <span class="text-danger">*</span></label>
      <input type="text" class="form-control font-monospace" id="tv-ip" value="${esc(tv.ipaddress)}" placeholder="192.168.1.100">
      <div class="form-text">Set a static DHCP lease for your TV so this address doesn't change.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">TV MAC Address <span class="text-danger">*</span></label>
      <input type="text" class="form-control font-monospace" id="tv-mac" value="${esc(tv.macaddress)}" placeholder="00:11:22:33:44:55">
      <div class="form-text">Used to send Wake-on-LAN packets. Found in TV Settings → About.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">SSL Mode</label>
      <select class="form-select" id="tv-ssl">
        <option value="default" ${tv.sslmode === 'default' ? 'selected' : ''}>Default (recommended)</option>
        <option value="disabled" ${tv.sslmode === 'disabled' ? 'selected' : ''}>Disabled</option>
        <option value="custom" ${tv.sslmode === 'custom' ? 'selected' : ''}>Custom (certificate + key)</option>
      </select>
    </div>
    <div id="ssl-custom-fields" style="display:${tv.sslmode === 'custom' ? 'block' : 'none'}">
      <div class="mb-3">
        <label class="form-label">SSL Certificate path</label>
        <input type="text" class="form-control font-monospace" id="tv-sslcert" value="${esc(tv.sslcertificate)}" placeholder="/path/to/rcm_certchain_pem.cer">
      </div>
      <div class="mb-3">
        <label class="form-label">SSL Private key path</label>
        <input type="text" class="form-control font-monospace" id="tv-sslkey" value="${esc(tv.sslprivatekey)}" placeholder="/path/to/rcm_pem_privkey.pkcs8">
      </div>
    </div>
    ${renderNavButtons({ showBack: true, backLabel: '← TV List', nextLabel: 'Test Connection →' })}`;
}

function bindStep1() {
  $('#tv-ssl').addEventListener('change', (e) => {
    $('#ssl-custom-fields').style.display = e.target.value === 'custom' ? 'block' : 'none';
  });

  $('#btn-back').addEventListener('click', () => {
    homebridge.request('/cleanup').catch(() => {});
    state.screen = 'home';
    render();
  });

  $('#btn-next').addEventListener('click', () => {
    const name = $('#tv-name').value.trim();
    const id = $('#tv-id').value.trim();
    const ip = $('#tv-ip').value.trim();
    const mac = $('#tv-mac').value.trim();
    const ssl = $('#tv-ssl').value;

    if (!name || !id || !ip || !mac) {
      homebridge.toast.error('Please fill in all required fields.', 'Validation');
      return;
    }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      homebridge.toast.error('Invalid IP address.', 'Validation');
      return;
    }
    if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac)) {
      homebridge.toast.error('Invalid MAC address (format: 00:11:22:33:44:55).', 'Validation');
      return;
    }

    state.tv.name = name;
    state.tv.id = id;
    state.tv.ipaddress = ip;
    state.tv.macaddress = mac;
    state.tv.sslmode = ssl;
    state.tv.sslcertificate = $('#tv-sslcert')?.value.trim() || '';
    state.tv.sslprivatekey = $('#tv-sslkey')?.value.trim() || '';

    state.step = 2;
    render();
  });
}
