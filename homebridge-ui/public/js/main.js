// ─── Main render ─────────────────────────────────────────────────────────────

function render() {
  const app = $('#app');
  homebridge.disableSaveButton();

  if (state.screen === 'home') {
    app.innerHTML = renderHome();
    bindHome();
    homebridge.enableSaveButton();
    return;
  }

  // Wizard
  const renderers = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];
  const binders = [null, bindStep1, bindStep2, bindStep3, bindStep4, bindStep5, bindStep6, bindStep7];

  const step = state.step;
  app.innerHTML = renderers[step]?.() ?? '';
  binders[step]?.();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

(async () => {
  try {
    const configs = await homebridge.getPluginConfig();
    state.config = configs[0] || { macaddress: '', devices: [] };
    if (!state.config.devices) state.config.devices = [];
  } catch (_) {
    state.config = { macaddress: '', devices: [] };
  }

  try {
    const result = await homebridge.request('/get-network-interfaces');
    state.networkInterfaces = result.interfaces || [];
    // Pre-fill host MAC if not set and only one interface
    if (!state.config.macaddress && state.networkInterfaces.length === 1) {
      state.config.macaddress = state.networkInterfaces[0].mac;
    }
  } catch (_) {
    state.networkInterfaces = [];
  }

  render();
})();
