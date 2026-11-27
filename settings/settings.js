// AutoApply - Settings Dashboard with Dynamic Generators & CSV Mix-and-Match

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const fieldsContainer = document.getElementById('fields-container');
  const fieldCountBadge = document.getElementById('field-count-badge');
  const poolCountBadge = document.getElementById('pool-count-badge');
  const btnAddField = document.getElementById('btn-add-field');
  const btnLoadDefaults = document.getElementById('btn-load-defaults');
  const btnSaveAll = document.getElementById('btn-save-all');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-input');
  const inputSearch = document.getElementById('input-search');
  const toast = document.getElementById('toast');

  // Name Pool Elements
  const btnUploadCsv = document.getElementById('btn-upload-csv');
  const fileCsvInput = document.getElementById('file-csv-input');
  const textareaFirstNames = document.getElementById('textarea-first-names');
  const textareaLastNames = document.getElementById('textarea-last-names');
  const firstNamesCount = document.getElementById('first-names-count');
  const lastNamesCount = document.getElementById('last-names-count');
  const cfgPhonePrefix = document.getElementById('cfg-phone-prefix');
  const cfgPhoneCounter = document.getElementById('cfg-phone-counter');
  const btnResetCounter = document.getElementById('btn-reset-counter');
  const btnSavePool = document.getElementById('btn-save-pool');
  const sampleEmailPreview = document.getElementById('sample-email-preview');
  const btnShuffleFirst = document.getElementById('btn-shuffle-first');
  const btnShuffleLast = document.getElementById('btn-shuffle-last');

  // Navigation Tabs
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Config elements
  const cfgAutoSubmit = document.getElementById('cfg-autoSubmit');
  const cfgClosePrev = document.getElementById('cfg-closePrev');
  const cfgTypingDelay = document.getElementById('cfg-typingDelay');
  const cfgTypingDelayVal = document.getElementById('cfg-typingDelay-val');
  const cfgFieldPause = document.getElementById('cfg-fieldPause');
  const cfgNextTabDelay = document.getElementById('cfg-nextTabDelay');
  const btnSaveConfig = document.getElementById('btn-save-config');

  let fieldsData = [];
  let settingsData = {};
  let generatorSettings = {};

  // Tab switching
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Load from Storage
  const res = await chrome.storage.local.get(['customFields', 'settings', 'generatorSettings']);
  settingsData = res.settings || getDefaultSettings();
  generatorSettings = res.generatorSettings || getDefaultGeneratorSettings();

  // Populate Fields
  if (res.customFields && Array.isArray(res.customFields) && res.customFields.length > 0) {
    fieldsData = res.customFields;
  } else {
    fieldsData = getDefaultCustomFields();
  }

  // Populate Name Pool & Generator Settings
  textareaFirstNames.value = (generatorSettings.firstNamesPool || []).join('\n');
  textareaLastNames.value = (generatorSettings.lastNamesPool || []).join('\n');
  cfgPhonePrefix.value = generatorSettings.phonePrefix || '92310';
  cfgPhoneCounter.value = generatorSettings.phoneCounter !== undefined ? generatorSettings.phoneCounter : 1234;
  updatePoolCounts();
  updateSampleEmail();

  // Populate config fields
  cfgAutoSubmit.checked = settingsData.autoSubmit !== false;
  cfgClosePrev.checked = settingsData.closePreviousTab !== false;
  cfgTypingDelay.value = settingsData.typingDelayMs !== undefined ? settingsData.typingDelayMs : 25;
  cfgTypingDelayVal.textContent = `${cfgTypingDelay.value} ms`;
  cfgFieldPause.value = settingsData.fieldPauseMs || 350;
  cfgNextTabDelay.value = Math.round((settingsData.nextTabDelayMs || 2000) / 1000);

  cfgTypingDelay.addEventListener('input', (e) => {
    cfgTypingDelayVal.textContent = `${e.target.value} ms`;
  });

  // Render initial list
  renderFields(fieldsData);

  // Search filtering
  inputSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const rows = fieldsContainer.querySelectorAll('.field-card');
    rows.forEach(row => {
      const qText = row.querySelector('.field-question').value.toLowerCase();
      const aText = row.querySelector('.field-answer').value.toLowerCase();
      if (qText.includes(query) || aText.includes(query)) {
        row.style.display = 'grid';
      } else {
        row.style.display = 'none';
      }
    });
  });

  // Add New Question button
  btnAddField.addEventListener('click', () => {
    const newField = {
      id: 'f_' + Date.now(),
      question: '',
      type: 'text',
      answerMode: 'custom',
      answer: ''
    };
    fieldsData.unshift(newField);
    renderFields(fieldsData);
    const firstInput = fieldsContainer.querySelector('.field-question');
    if (firstInput) firstInput.focus();
  });

  // Load Defaults button
  btnLoadDefaults.addEventListener('click', () => {
    if (confirm('Reset fields to standard Job Application defaults with dynamic generators?')) {
      fieldsData = getDefaultCustomFields();
      renderFields(fieldsData);
      showToast('Loaded default job questions and dynamic generator mappings!');
    }
  });

  // --- RENDER FORM FIELDS WITH DYNAMIC ANSWER MODES ---
  function renderFields(list) {
    fieldsContainer.innerHTML = '';
    fieldCountBadge.textContent = list.length;

    if (list.length === 0) {
      fieldsContainer.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius); border:1px solid var(--border);">
          <p style="font-size:16px; margin-bottom:12px;">No fields configured yet.</p>
          <button class="btn btn-accent" id="empty-add-btn">+ Add Your First Question</button>
        </div>
      `;
      document.getElementById('empty-add-btn')?.addEventListener('click', () => {
        btnAddField.click();
      });
      return;
    }

    list.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'field-card';
      card.dataset.id = item.id || 'f_' + index;

      const currentMode = item.answerMode || detectModeFromAnswer(item.answer);

      card.innerHTML = `
        <div class="field-num">#${index + 1}</div>
        
        <div class="field-group">
          <label class="field-label">Question / Keyword</label>
          <input type="text" class="field-input field-question" placeholder="e.g. Full Name or Gender" value="${escapeHtml(item.question || '')}" />
        </div>

        <div class="field-group">
          <label class="field-label">Question Type</label>
          <select class="field-select field-type">
            <option value="text" ${item.type === 'text' ? 'selected' : ''}>✍️ Short Text</option>
            <option value="email" ${item.type === 'email' ? 'selected' : ''}>📧 Email Address</option>
            <option value="phone" ${item.type === 'phone' ? 'selected' : ''}>📞 Phone Number</option>
            <option value="paragraph" ${item.type === 'paragraph' ? 'selected' : ''}>📝 Paragraph (Long)</option>
            <option value="radio" ${item.type === 'radio' ? 'selected' : ''}>🔘 Radio (Select Choice)</option>
            <option value="checkbox" ${item.type === 'checkbox' ? 'selected' : ''}>☑️ Checkbox (Choice / Multi)</option>
            <option value="dropdown" ${item.type === 'dropdown' ? 'selected' : ''}>🔽 Dropdown Selection</option>
          </select>
        </div>

        <div class="field-group">
          <label class="field-label">Pre-seeded Answer / Value</label>
          <div class="answer-box-wrapper">
            <div class="answer-mode-row">
              <select class="answer-mode-select">
                <option value="custom" ${currentMode === 'custom' ? 'selected' : ''}>✏️ Custom Text</option>
                <option value="dynamic_random_15" ${currentMode === 'dynamic_random_15' ? 'selected' : ''}>🎲 Random 15-char (a-zA-Z)</option>
                <option value="dynamic_fullname" ${currentMode === 'dynamic_fullname' ? 'selected' : ''}>👤 Mixed Full Name</option>
                <option value="dynamic_firstname" ${currentMode === 'dynamic_firstname' ? 'selected' : ''}>🔤 First Name only</option>
                <option value="dynamic_lastname" ${currentMode === 'dynamic_lastname' ? 'selected' : ''}>🔤 Last Name only</option>
                <option value="dynamic_email" ${currentMode === 'dynamic_email' ? 'selected' : ''}>📧 Auto Email (name + phone digits)</option>
                <option value="dynamic_phone" ${currentMode === 'dynamic_phone' ? 'selected' : ''}>📞 Auto Phone (92310 + counter)</option>
              </select>
              <input type="text" class="field-input field-answer" placeholder="${getPlaceholderForMode(currentMode, item.type)}" value="${escapeHtml(item.answer || '')}" ${currentMode !== 'custom' ? 'readonly style="background:#131c31; color:#34d399; font-weight:600;"' : ''} />
            </div>
          </div>
        </div>

        <div>
          <button class="btn-delete" title="Delete Question">🗑️</button>
        </div>
      `;

      // Answer Mode dropdown listener
      const modeSelect = card.querySelector('.answer-mode-select');
      const answerInput = card.querySelector('.field-answer');

      modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'custom') {
          answerInput.readOnly = false;
          answerInput.style.background = 'var(--bg-input)';
          answerInput.style.color = 'var(--text-main)';
          answerInput.placeholder = 'Type custom text or option to select...';
          if (answerInput.value.startsWith('{{') && answerInput.value.endsWith('}}')) {
            answerInput.value = '';
          }
        } else {
          answerInput.readOnly = true;
          answerInput.style.background = '#131c31';
          answerInput.style.color = '#34d399';
          answerInput.value = getTokenForMode(mode);
        }
      });

      // Delete listener
      card.querySelector('.btn-delete').addEventListener('click', () => {
        const id = card.dataset.id;
        fieldsData = fieldsData.filter(f => f.id !== id);
        renderFields(fieldsData);
      });

      fieldsContainer.appendChild(card);
    });
  }

  function detectModeFromAnswer(ans) {
    if (ans === '{{RANDOM_TEXT_15}}') return 'dynamic_random_15';
    if (ans === '{{MIXED_FULL_NAME}}') return 'dynamic_fullname';
    if (ans === '{{FIRST_NAME}}') return 'dynamic_firstname';
    if (ans === '{{LAST_NAME}}') return 'dynamic_lastname';
    if (ans === '{{AUTO_EMAIL}}') return 'dynamic_email';
    if (ans === '{{AUTO_PHONE}}') return 'dynamic_phone';
    return 'custom';
  }

  function getTokenForMode(mode) {
    switch (mode) {
      case 'dynamic_random_15': return '{{RANDOM_TEXT_15}}';
      case 'dynamic_fullname': return '{{MIXED_FULL_NAME}}';
      case 'dynamic_firstname': return '{{FIRST_NAME}}';
      case 'dynamic_lastname': return '{{LAST_NAME}}';
      case 'dynamic_email': return '{{AUTO_EMAIL}}';
      case 'dynamic_phone': return '{{AUTO_PHONE}}';
      default: return '';
    }
  }

  function getPlaceholderForMode(mode, type) {
    if (mode === 'dynamic_random_15') return 'Auto-generates random 15-character a-z, A-Z text';
    if (mode === 'dynamic_fullname') return 'Mixes & matches first & last name from CSV pool';
    if (mode === 'dynamic_email') return 'Auto-generated: firstname.lastname + 5 digits';
    if (mode === 'dynamic_phone') return 'Auto-generated: 92310 + 5-digit sequential counter';
    if (type === 'radio') return 'Exact option to select (e.g. Yes / No)';
    if (type === 'checkbox') return 'Option(s) to check (e.g. React, Node.js)';
    return 'Enter custom text...';
  }

  function collectFieldsFromDOM() {
    const rows = fieldsContainer.querySelectorAll('.field-card');
    const collected = [];
    rows.forEach((row, idx) => {
      const q = row.querySelector('.field-question').value.trim();
      const type = row.querySelector('.field-type').value;
      const mode = row.querySelector('.answer-mode-select').value;
      let ans = row.querySelector('.field-answer').value.trim();

      if (mode !== 'custom') {
        ans = getTokenForMode(mode);
      }

      if (q) {
        collected.push({
          id: row.dataset.id || 'f_' + idx,
          question: q,
          type: type,
          answerMode: mode,
          answer: ans
        });
      }
    });
    return collected;
  }

  function collectSettingsFromDOM() {
    return {
      autoSubmit: cfgAutoSubmit.checked,
      closePreviousTab: cfgClosePrev.checked,
      typingDelayMs: parseInt(cfgTypingDelay.value, 10),
      fieldPauseMs: parseInt(cfgFieldPause.value, 10),
      nextTabDelayMs: parseInt(cfgNextTabDelay.value, 10) * 1000
    };
  }

  function collectGeneratorSettings() {
    const firstList = textareaFirstNames.value.split('\n').map(s => s.trim()).filter(Boolean);
    const lastList = textareaLastNames.value.split('\n').map(s => s.trim()).filter(Boolean);
    return {
      phonePrefix: cfgPhonePrefix.value.trim() || '92310',
      phoneCounter: parseInt(cfgPhoneCounter.value, 10) || 1234,
      emailDomain: '@gmail.com',
      randomTextLength: 15,
      firstNamesPool: firstList,
      lastNamesPool: lastList
    };
  }

  // --- CSV UPLOADER ---
  btnUploadCsv.addEventListener('click', () => {
    fileCsvInput.click();
  });

  fileCsvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      parseAndLoadCSV(text);
      fileCsvInput.value = '';
    };
    reader.readAsText(file);
  });

  function parseAndLoadCSV(content) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newFirst = [];
    const newLast = [];

    lines.forEach((line, index) => {
      // Split by comma or semicolon or tab
      const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        // Skip header row if it contains 'first' or 'last'
        if (index === 0 && (parts[0].toLowerCase().includes('first') || parts[1].toLowerCase().includes('last'))) {
          return;
        }
        if (parts[0]) newFirst.push(parts[0]);
        if (parts[1]) newLast.push(parts[1]);
      } else if (parts.length === 1 && parts[0]) {
        // Space separated: e.g. "John Doe"
        const nameParts = parts[0].split(/\s+/);
        if (nameParts.length >= 2) {
          newFirst.push(nameParts[0]);
          newLast.push(nameParts.slice(1).join(' '));
        } else {
          newFirst.push(parts[0]);
        }
      }
    });

    if (newFirst.length > 0) {
      textareaFirstNames.value = newFirst.join('\n');
    }
    if (newLast.length > 0) {
      textareaLastNames.value = newLast.join('\n');
    }

    updatePoolCounts();
    updateSampleEmail();
    showToast(`✓ Loaded ${newFirst.length} First Names & ${newLast.length} Last Names from CSV!`);
  }

  // Pool count updates
  function updatePoolCounts() {
    const fCount = textareaFirstNames.value.split('\n').filter(s => s.trim()).length;
    const lCount = textareaLastNames.value.split('\n').filter(s => s.trim()).length;
    firstNamesCount.textContent = fCount;
    lastNamesCount.textContent = lCount;
    poolCountBadge.textContent = `${fCount} × ${lCount} names (${fCount * lCount} combos)`;
  }

  textareaFirstNames.addEventListener('input', () => { updatePoolCounts(); updateSampleEmail(); });
  textareaLastNames.addEventListener('input', () => { updatePoolCounts(); updateSampleEmail(); });
  cfgPhonePrefix.addEventListener('input', updateSampleEmail);
  cfgPhoneCounter.addEventListener('input', updateSampleEmail);

  function updateSampleEmail() {
    const f = textareaFirstNames.value.split('\n').filter(s => s.trim())[0] || 'john';
    const l = textareaLastNames.value.split('\n').filter(s => s.trim())[0] || 'doe';
    const counter = parseInt(cfgPhoneCounter.value, 10) || 1234;
    const last5 = String(counter).padStart(5, '0');
    sampleEmailPreview.textContent = `${f.toLowerCase()}${l.toLowerCase()}${last5}@gmail.com`;
  }

  // Reset Counter
  btnResetCounter.addEventListener('click', () => {
    cfgPhoneCounter.value = 1234;
    updateSampleEmail();
    showToast('Phone counter reset to 01234!');
  });

  // Shuffle buttons
  btnShuffleFirst.addEventListener('click', () => {
    const list = textareaFirstNames.value.split('\n').filter(s => s.trim());
    list.sort(() => Math.random() - 0.5);
    textareaFirstNames.value = list.join('\n');
    updateSampleEmail();
    showToast('First names shuffled!');
  });

  btnShuffleLast.addEventListener('click', () => {
    const list = textareaLastNames.value.split('\n').filter(s => s.trim());
    list.sort(() => Math.random() - 0.5);
    textareaLastNames.value = list.join('\n');
    updateSampleEmail();
    showToast('Last names shuffled!');
  });

  // Save All Changes (Main Button)
  btnSaveAll.addEventListener('click', async () => {
    fieldsData = collectFieldsFromDOM();
    settingsData = collectSettingsFromDOM();
    generatorSettings = collectGeneratorSettings();

    await chrome.storage.local.set({
      customFields: fieldsData,
      settings: settingsData,
      generatorSettings: generatorSettings
    });

    renderFields(fieldsData);
    updatePoolCounts();
    showToast('🎉 All fields, dynamic generators, and name pool saved!');
  });

  // Save Pool Tab Button
  btnSavePool.addEventListener('click', async () => {
    generatorSettings = collectGeneratorSettings();
    await chrome.storage.local.set({ generatorSettings });
    updatePoolCounts();
    showToast('Name pool and phone generator settings saved!');
  });

  // Save Config Tab Button
  btnSaveConfig.addEventListener('click', async () => {
    settingsData = collectSettingsFromDOM();
    await chrome.storage.local.set({ settings: settingsData });
    showToast('Execution settings saved!');
  });

  // Export JSON
  btnExportJson.addEventListener('click', () => {
    fieldsData = collectFieldsFromDOM();
    const exportPayload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      fields: fieldsData,
      settings: collectSettingsFromDOM(),
      generatorSettings: collectGeneratorSettings()
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoapply-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import JSON
  btnImportJson.addEventListener('click', () => {
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const importedFields = imported.fields || imported.customFields || (Array.isArray(imported) ? imported : null);

        if (Array.isArray(importedFields)) {
          fieldsData = importedFields;
          if (imported.settings) settingsData = imported.settings;
          if (imported.generatorSettings) {
            generatorSettings = imported.generatorSettings;
            textareaFirstNames.value = (generatorSettings.firstNamesPool || []).join('\n');
            textareaLastNames.value = (generatorSettings.lastNamesPool || []).join('\n');
            cfgPhonePrefix.value = generatorSettings.phonePrefix || '92310';
            cfgPhoneCounter.value = generatorSettings.phoneCounter || 1234;
          }

          await chrome.storage.local.set({
            customFields: fieldsData,
            settings: settingsData,
            generatorSettings: generatorSettings
          });

          renderFields(fieldsData);
          updatePoolCounts();
          updateSampleEmail();
          showToast('Imported and saved configuration successfully!');
        } else {
          alert('Invalid format: Could not find fields in JSON file.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    fileImportInput.value = '';
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function escapeHtml(text) {
    return (text || '').replace(/"/g, '&quot;');
  }

  // --- DEFAULT FIELDS & GENERATOR PRESETS ---
  function getDefaultCustomFields() {
    return [
      { id: 'f_1', question: 'Full Name', type: 'text', answerMode: 'dynamic_fullname', answer: '{{MIXED_FULL_NAME}}' },
      { id: 'f_2', question: 'First Name', type: 'text', answerMode: 'dynamic_firstname', answer: '{{FIRST_NAME}}' },
      { id: 'f_3', question: 'Last Name', type: 'text', answerMode: 'dynamic_lastname', answer: '{{LAST_NAME}}' },
      { id: 'f_4', question: 'Email Address', type: 'email', answerMode: 'dynamic_email', answer: '{{AUTO_EMAIL}}' },
      { id: 'f_5', question: 'Phone Number', type: 'phone', answerMode: 'dynamic_phone', answer: '{{AUTO_PHONE}}' },
      { id: 'f_6', question: 'Resume / CV Drive Link', type: 'text', answerMode: 'custom', answer: 'https://drive.google.com/file/d/your-resume-link/view' },
      { id: 'f_7', question: 'LinkedIn Profile URL', type: 'text', answerMode: 'custom', answer: 'https://linkedin.com/in/alexmorgan' },
      { id: 'f_8', question: 'GitHub Profile URL', type: 'text', answerMode: 'custom', answer: 'https://github.com/alexmorgan' },
      { id: 'f_9', question: 'Years of Experience', type: 'text', answerMode: 'custom', answer: '4' },
      { id: 'f_10', question: 'Are you authorized to work in this country?', type: 'radio', answerMode: 'custom', answer: 'Yes' },
      { id: 'f_11', question: 'Will you now or in future require visa sponsorship?', type: 'radio', answerMode: 'custom', answer: 'No' },
      { id: 'f_12', question: 'Gender', type: 'radio', answerMode: 'custom', answer: 'Prefer not to say' },
      { id: 'f_13', question: 'Skills / Technologies', type: 'checkbox', answerMode: 'custom', answer: 'JavaScript, React, Node.js, Python, AWS' },
      { id: 'f_14', question: 'Notice Period', type: 'text', answerMode: 'custom', answer: '30 days' },
      { id: 'f_15', question: 'Additional Notes / Other Info', type: 'text', answerMode: 'dynamic_random_15', answer: '{{RANDOM_TEXT_15}}' }
    ];
  }

  function getDefaultGeneratorSettings() {
    return {
      phonePrefix: '92310',
      phoneCounter: 1234,
      emailDomain: '@gmail.com',
      randomTextLength: 15,
      firstNamesPool: [
        'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
        'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
        'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
        'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
        'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah', 'Timothy', 'Stephanie',
        'Ronald', 'Rebecca', 'Edward', 'Sharon', 'Jason', 'Laura', 'Jeffrey', 'Cynthia', 'Ryan', 'Kathleen',
        'Jacob', 'Amy', 'Gary', 'Shirley', 'Nicholas', 'Angela', 'Eric', 'Helen', 'Jonathan', 'Anna',
        'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Nicole', 'Scott', 'Emma', 'Brandon', 'Samantha',
        'Benjamin', 'Katherine', 'Samuel', 'Christine', 'Gregory', 'Debra', 'Frank', 'Rachel', 'Alexander', 'Catherine',
        'Raymond', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Ruth', 'Dennis', 'Maria', 'Jerry', 'Heather'
      ],
      lastNamesPool: [
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
        'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
        'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
        'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
        'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
        'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
        'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
      ]
    };
  }

  function getDefaultSettings() {
    return {
      typingDelayMs: 25,
      fieldPauseMs: 350,
      autoSubmit: true,
      submitDelayMs: 1000,
      closePreviousTab: true,
      nextTabDelayMs: 1500
    };
  }
});
