// AutoApply - Full-Screen Field Customizer & Settings Logic

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const fieldsContainer = document.getElementById('fields-container');
  const fieldCountBadge = document.getElementById('field-count-badge');
  const btnAddField = document.getElementById('btn-add-field');
  const btnLoadDefaults = document.getElementById('btn-load-defaults');
  const btnSaveAll = document.getElementById('btn-save-all');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-input');
  const inputSearch = document.getElementById('input-search');
  const toast = document.getElementById('toast');

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
  const res = await chrome.storage.local.get(['customFields', 'settings', 'profile']);
  settingsData = res.settings || getDefaultSettings();

  if (res.customFields && Array.isArray(res.customFields) && res.customFields.length > 0) {
    fieldsData = res.customFields;
  } else if (res.profile) {
    // Migrate existing profile into customFields schema
    fieldsData = convertProfileToCustomFields(res.profile);
  } else {
    fieldsData = getDefaultCustomFields();
  }

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
      answer: ''
    };
    fieldsData.unshift(newField);
    renderFields(fieldsData);
    const firstInput = fieldsContainer.querySelector('.field-question');
    if (firstInput) firstInput.focus();
  });

  // Load Defaults button
  btnLoadDefaults.addEventListener('click', () => {
    if (confirm('Replace current fields with standard Job Application defaults?')) {
      fieldsData = getDefaultCustomFields();
      renderFields(fieldsData);
      showToast('Loaded job application default fields!');
    }
  });

  // Render Fields Function
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

      card.innerHTML = `
        <div class="field-num">#${index + 1}</div>
        
        <div class="field-group">
          <label class="field-label">Question / Keyword</label>
          <input type="text" class="field-input field-question" placeholder="e.g. Email Address or Sponsorship" value="${escapeHtml(item.question || '')}" />
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
          <input type="text" class="field-input field-answer" placeholder="${getPlaceholderForType(item.type)}" value="${escapeHtml(item.answer || '')}" />
        </div>

        <div>
          <button class="btn-delete" title="Delete Question">🗑️</button>
        </div>
      `;

      // Event listener for type change to update placeholder
      const typeSelect = card.querySelector('.field-type');
      const answerInput = card.querySelector('.field-answer');
      typeSelect.addEventListener('change', (e) => {
        answerInput.placeholder = getPlaceholderForType(e.target.value);
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

  function getPlaceholderForType(type) {
    switch (type) {
      case 'email': return 'e.g. your.email@gmail.com';
      case 'phone': return 'e.g. +1 555-0199 or 9876543210';
      case 'radio': return 'Exact option text to select (e.g. Yes / No / Male)';
      case 'checkbox': return 'Option to check (e.g. Python, React for multiple)';
      case 'dropdown': return 'Option name to select from list';
      case 'paragraph': return 'Long answer, cover letter, or summary...';
      default: return 'Text to fill into field...';
    }
  }

  function collectFieldsFromDOM() {
    const rows = fieldsContainer.querySelectorAll('.field-card');
    const collected = [];
    rows.forEach((row, idx) => {
      const q = row.querySelector('.field-question').value.trim();
      const type = row.querySelector('.field-type').value;
      const ans = row.querySelector('.field-answer').value.trim();
      if (q) {
        collected.push({
          id: row.dataset.id || 'f_' + idx,
          question: q,
          type: type,
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

  // Save All Changes
  btnSaveAll.addEventListener('click', async () => {
    fieldsData = collectFieldsFromDOM();
    settingsData = collectSettingsFromDOM();

    await chrome.storage.local.set({
      customFields: fieldsData,
      settings: settingsData
    });

    renderFields(fieldsData);
    showToast('🎉 All fields and settings saved successfully!');
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
      version: '1.0',
      exportedAt: new Date().toISOString(),
      fields: fieldsData,
      settings: collectSettingsFromDOM()
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoapply-fields-${new Date().toISOString().slice(0, 10)}.json`;
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
          if (imported.settings) {
            settingsData = imported.settings;
            cfgAutoSubmit.checked = settingsData.autoSubmit !== false;
            cfgClosePrev.checked = settingsData.closePreviousTab !== false;
            cfgTypingDelay.value = settingsData.typingDelayMs || 25;
            cfgTypingDelayVal.textContent = `${cfgTypingDelay.value} ms`;
            cfgFieldPause.value = settingsData.fieldPauseMs || 350;
            cfgNextTabDelay.value = Math.round((settingsData.nextTabDelayMs || 2000) / 1000);
          }

          await chrome.storage.local.set({
            customFields: fieldsData,
            settings: settingsData
          });

          renderFields(fieldsData);
          showToast('Imported and saved custom fields successfully!');
        } else {
          alert('Invalid format: Could not find fields array in JSON file.');
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

  // Default Template
  function getDefaultCustomFields() {
    return [
      { id: 'f_1', question: 'Full Name', type: 'text', answer: 'Alex Morgan' },
      { id: 'f_2', question: 'Email Address', type: 'email', answer: 'alex.morgan.dev@gmail.com' },
      { id: 'f_3', question: 'Phone Number', type: 'phone', answer: '+1 555-0199' },
      { id: 'f_4', question: 'Resume / CV Drive Link', type: 'text', answer: 'https://drive.google.com/file/d/your-resume-link/view' },
      { id: 'f_5', question: 'LinkedIn Profile URL', type: 'text', answer: 'https://linkedin.com/in/alexmorgan' },
      { id: 'f_6', question: 'GitHub Profile URL', type: 'text', answer: 'https://github.com/alexmorgan' },
      { id: 'f_7', question: 'Years of Experience', type: 'text', answer: '4' },
      { id: 'f_8', question: 'Are you authorized to work in this country?', type: 'radio', answer: 'Yes' },
      { id: 'f_9', question: 'Will you now or in future require visa sponsorship?', type: 'radio', answer: 'No' },
      { id: 'f_10', question: 'Gender', type: 'radio', answer: 'Prefer not to say' },
      { id: 'f_11', question: 'Skills / Technologies', type: 'checkbox', answer: 'JavaScript, React, Node.js, Python, AWS' },
      { id: 'f_12', question: 'Notice Period', type: 'text', answer: '30 days' },
      { id: 'f_13', question: 'Current CTC / Salary', type: 'text', answer: '$90,000' },
      { id: 'f_14', question: 'Expected CTC / Salary', type: 'text', answer: '$110,000' },
      { id: 'f_15', question: 'Current Company / Employer', type: 'text', answer: 'Tech Innovations Inc.' },
      { id: 'f_16', question: 'Current Role / Title', type: 'text', answer: 'Senior Software Engineer' },
      { id: 'f_17', question: 'Degree / College', type: 'text', answer: 'B.S. in Computer Science' },
      { id: 'f_18', question: 'Current Location / City', type: 'text', answer: 'San Francisco, CA' },
      { id: 'f_19', question: 'Cover Letter / Summary', type: 'paragraph', answer: 'Experienced software engineer specializing in scalable full stack web applications and cloud architectures.' }
    ];
  }

  function convertProfileToCustomFields(profile) {
    const list = [];
    if (profile.fullName) list.push({ id: 'f_1', question: 'Full Name', type: 'text', answer: profile.fullName });
    if (profile.email) list.push({ id: 'f_2', question: 'Email Address', type: 'email', answer: profile.email });
    if (profile.phone) list.push({ id: 'f_3', question: 'Phone Number', type: 'phone', answer: profile.phone });
    if (profile.resumeLink) list.push({ id: 'f_4', question: 'Resume / CV Drive Link', type: 'text', answer: profile.resumeLink });
    if (profile.linkedin) list.push({ id: 'f_5', question: 'LinkedIn Profile URL', type: 'text', answer: profile.linkedin });
    if (profile.github) list.push({ id: 'f_6', question: 'GitHub Profile URL', type: 'text', answer: profile.github });
    if (profile.experienceYears) list.push({ id: 'f_7', question: 'Years of Experience', type: 'text', answer: profile.experienceYears });
    if (profile.currentCtc) list.push({ id: 'f_8', question: 'Current CTC', type: 'text', answer: profile.currentCtc });
    if (profile.expectedCtc) list.push({ id: 'f_9', question: 'Expected CTC', type: 'text', answer: profile.expectedCtc });
    if (profile.noticePeriod) list.push({ id: 'f_10', question: 'Notice Period', type: 'text', answer: profile.noticePeriod });

    if (profile.exactRules && Array.isArray(profile.exactRules)) {
      profile.exactRules.forEach((r, idx) => {
        list.push({
          id: 'f_r_' + idx,
          question: r.questionKeyword,
          type: r.actionType || 'radio',
          answer: r.exactValue
        });
      });
    }

    return list.length > 0 ? list : getDefaultCustomFields();
  }

  function getDefaultSettings() {
    return {
      typingDelayMs: 25,
      fieldPauseMs: 350,
      autoSubmit: true,
      submitDelayMs: 1200,
      closePreviousTab: true,
      nextTabDelayMs: 2000
    };
  }
});
