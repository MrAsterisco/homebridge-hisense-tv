// ─── Step 5: Apps ─────────────────────────────────────────────────────────────

function renderStep5() {
  const tv = state.tv;
  const hasApps = state.availableApps.length > 0;

  let appsHtml = '';
  if (tv.showApps) {
    if (hasApps) {
      const selectedSet = new Set(tv.apps);
      const noneSelected = tv.apps.length === 0;
      appsHtml = `
        <p class="small text-secondary mb-1">
          ${noneSelected ? 'All apps will be shown (no filter). Check apps below to show only specific ones.' : 'Only checked apps will appear as inputs.'}
        </p>
        <div class="mb-2">
          <input type="search" class="form-control form-control-sm" id="app-search" placeholder="Search apps…">
        </div>
        <div class="app-list-container" id="app-list">
          ${state.availableApps.map(app => `
            <label>
              <input type="checkbox" class="form-check-input app-check" value="${esc(app.name)}"
                ${selectedSet.has(app.name) ? 'checked' : ''}>
              ${esc(app.name)}
            </label>`).join('')}
        </div>
        <div class="form-text">Uncheck all to show every installed app.</div>`;
    } else {
      // Fallback: text area
      appsHtml = `
        <label class="form-label small">App names (comma-separated, leave blank for all):</label>
        <textarea class="form-control font-monospace" id="apps-manual" rows="4"
          placeholder="YouTube,Netflix,Prime Video">${esc(tv.apps.join(','))}</textarea>`;
    }
  }

  return `
    ${renderWizardSteps(5)}
    <h5>Apps</h5>
    <p class="text-secondary small">Configure which installed apps appear as input sources in Home.</p>
    <div class="form-check form-switch mb-3">
      <input class="form-check-input" type="checkbox" id="show-apps" ${tv.showApps ? 'checked' : ''}>
      <label class="form-check-label" for="show-apps">Show installed apps as input sources</label>
    </div>
    <div id="apps-section" style="display:${tv.showApps ? 'block' : 'none'}">
      <div id="apps-loading" class="my-3" style="display:${tv.showApps && !hasApps ? 'block' : 'none'}">
        <span class="status-spinner"></span> Fetching app list from TV…
      </div>
      ${appsHtml}
    </div>
    ${renderNavButtons({ showBack: true, backLabel: '← Back' })}`;
}

function bindStep5() {
  const showAppsChk = $('#show-apps');
  const appsSection = $('#apps-section');

  showAppsChk.addEventListener('change', async () => {
    state.tv.showApps = showAppsChk.checked;
    appsSection.style.display = showAppsChk.checked ? 'block' : 'none';
    if (showAppsChk.checked && state.availableApps.length === 0) {
      await fetchApps();
    }
  });

  if (state.tv.showApps && state.availableApps.length === 0) {
    fetchApps();
  }

  const appSearch = $('#app-search');
  if (appSearch) {
    appSearch.addEventListener('input', () => {
      const q = appSearch.value.toLowerCase();
      $$('#app-list label').forEach(label => {
        label.style.display = label.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  $('#btn-back').addEventListener('click', () => {
    saveStep5();
    state.step = 4;
    render();
  });

  $('#btn-next').addEventListener('click', () => {
    saveStep5();
    state.step = 6;
    render();
  });
}

async function fetchApps() {
  const loadingEl = $('#apps-loading');
  if (loadingEl) loadingEl.style.display = 'block';
  try {
    const result = await homebridge.request('/get-app-list', {
      ipaddress: state.tv.ipaddress,
      macaddress: state.tv.macaddress,
      sslmode: state.tv.sslmode,
      sslcertificate: state.tv.sslcertificate,
      sslprivatekey: state.tv.sslprivatekey,
    });
    state.availableApps = result.apps || [];
  } catch (_) {
    state.availableApps = [];
  }
  // Re-render the apps section
  render();
}

function saveStep5() {
  if (!state.tv.showApps) {
    state.tv.apps = [];
    return;
  }
  const checks = $$('.app-check');
  if (checks.length > 0) {
    state.tv.apps = checks.filter(c => c.checked).map(c => c.value);
  } else {
    const manual = $('#apps-manual');
    if (manual) {
      state.tv.apps = manual.value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
}
