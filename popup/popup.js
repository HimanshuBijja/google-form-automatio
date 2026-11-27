// AutoApply - Popup Script with Full-Screen Settings Integration

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  // Elements
  const inputUrl = document.getElementById('input-url');
  const inputIterations = document.getElementById('input-iterations');
  const btnUseCurrent = document.getElementById('btn-use-current');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const statusMode = document.getElementById('status-mode');

  const progressBox = document.getElementById('progress-box');
  const progressIter = document.getElementById('progress-iter');
  const progressBar = document.getElementById('progress-bar');
  const progressStatusMsg = document.getElementById('progress-status-msg');

  // Fullscreen Buttons
  const btnOpenFullscreen = document.getElementById('btn-open-fullscreen');
  const btnLaunchFullscreen = document.getElementById('btn-launch-fullscreen');
  const popFieldsList = document.getElementById('pop-fields-list');
  const popFieldCount = document.getElementById('pop-field-count');

  // Settings
  const setAutoSubmit = document.getElementById('set-autoSubmit');
  const setClosePrev = document.getElementById('set-closePrev');
  const setTypingDelay = document.getElementById('set-typingDelay');
  const labelTypingDelay = document.getElementById('label-typingDelay');
  const setNextTabDelay = document.getElementById('set-nextTabDelay');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Tab switching logic
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Open Full-Screen Settings in a real browser tab
  const openFullscreenSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  };
  btnOpenFullscreen.addEventListener('click', openFullscreenSettings);
  btnLaunchFullscreen.addEventListener('click', openFullscreenSettings);

  // Load existing data from storage
  const data = await chrome.storage.local.get(['customFields', 'settings', 'task']);
  const fields = data.customFields || [];
  const settings = data.settings || {};
  const task = data.task || {};

  // Render quick fields list
  renderPopupFields(fields);

  // Populate settings fields
  setAutoSubmit.checked = settings.autoSubmit !== false;
  setClosePrev.checked = settings.closePreviousTab !== false;
  setTypingDelay.value = settings.typingDelayMs !== undefined ? settings.typingDelayMs : 25;
  updateTypingLabel(setTypingDelay.value);
  setNextTabDelay.value = Math.round((settings.nextTabDelayMs || 2000) / 1000);

  // Populate task / URL fields
  if (task.targetUrl) {
    inputUrl.value = task.targetUrl;
  }
  if (task.totalIterations) {
    inputIterations.value = task.totalIterations;
  }

  updateTaskUI(task);

  // Paste Current Tab URL handler
  btnUseCurrent.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && !tab.url.startsWith('chrome://')) {
        inputUrl.value = tab.url;
      }
    } catch (err) {
      console.warn('Could not retrieve active tab URL:', err);
    }
  });

  // Typing slider label update
  setTypingDelay.addEventListener('input', (e) => {
    updateTypingLabel(e.target.value);
  });

  function updateTypingLabel(val) {
    if (val == 0) labelTypingDelay.textContent = 'Instant';
    else labelTypingDelay.textContent = `${val}ms (Visual)`;
  }

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const existing = (await chrome.storage.local.get('settings')).settings || {};
    existing.autoSubmit = setAutoSubmit.checked;
    existing.closePreviousTab = setClosePrev.checked;
    existing.typingDelayMs = parseInt(setTypingDelay.value, 10);
    existing.nextTabDelayMs = parseInt(setNextTabDelay.value, 10) * 1000;

    await chrome.storage.local.set({ settings: existing });
    btnSaveSettings.textContent = '✓ Saved!';
    setTimeout(() => { btnSaveSettings.textContent = '💾 Save Settings'; }, 1500);
  });

  // Start Automation
  btnStart.addEventListener('click', async () => {
    const url = inputUrl.value.trim();
    const iters = parseInt(inputIterations.value, 10) || 1;

    if (!url) {
      alert('Please enter or paste the target Form URL first!');
      inputUrl.focus();
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('Please enter a valid URL starting with http:// or https://');
      inputUrl.focus();
      return;
    }

    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');

    chrome.runtime.sendMessage({
      type: 'START_AUTOMATION',
      payload: {
        targetUrl: url,
        totalIterations: iters
      }
    });
  });

  // Stop Automation
  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_AUTOMATION' });
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
  });

  // Storage change listener
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.task) updateTaskUI(changes.task.newValue);
      if (changes.customFields) renderPopupFields(changes.customFields.newValue || []);
    }
  });

  function renderPopupFields(list) {
    popFieldsList.innerHTML = '';
    popFieldCount.textContent = list.length;

    if (list.length === 0) {
      popFieldsList.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; color:#94a3b8;">No fields configured yet. Click the button above to add questions!</div>`;
      return;
    }

    list.slice(0, 15).forEach(item => {
      const div = document.createElement('div');
      div.className = 'pop-field-item';
      div.innerHTML = `
        <div class="pop-field-header">
          <span class="pop-field-q">${escapeHtml(item.question)}</span>
          <span class="pop-field-tag">${escapeHtml(item.type)}</span>
        </div>
        <div class="pop-field-a">${escapeHtml(item.answer || '(empty)')}</div>
      `;
      popFieldsList.appendChild(div);
    });

    if (list.length > 15) {
      const more = document.createElement('div');
      more.style.textAlign = 'center';
      more.style.padding = '6px';
      more.style.fontSize = '11px';
      more.style.color = '#60a5fa';
      more.textContent = `+ ${list.length - 15} more fields (open full settings to view all)`;
      popFieldsList.appendChild(more);
    }
  }

  function updateTaskUI(currentTask) {
    if (!currentTask) return;

    if (currentTask.isRunning) {
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
      progressBox.classList.remove('hidden');
      statusMode.textContent = 'Running';
      statusMode.className = 'status-pill status-active';

      progressIter.textContent = `Iteration ${currentTask.currentIteration} of ${currentTask.totalIterations}`;
      const percent = Math.round((currentTask.currentIteration / currentTask.totalIterations) * 100);
      progressBar.style.width = `${percent}%`;
      progressStatusMsg.textContent = `Processing form in browser tab #${currentTask.activeTabId || ''}...`;
    } else {
      btnStart.classList.remove('hidden');
      btnStop.classList.add('hidden');
      statusMode.textContent = 'Ready';
      statusMode.className = 'status-pill status-ready';

      if (currentTask.currentIteration > 0 && currentTask.currentIteration >= currentTask.totalIterations) {
        progressBox.classList.remove('hidden');
        progressIter.textContent = `Done (${currentTask.totalIterations}/${currentTask.totalIterations})`;
        progressBar.style.width = '100%';
        progressStatusMsg.textContent = '🎉 All iterations completed successfully!';
      } else {
        progressBox.classList.add('hidden');
      }
    }
  }

  function escapeHtml(text) {
    return (text || '').replace(/"/g, '&quot;');
  }
});
