// AutoApply - Options Page Logic with Exact Select & Text Rules

document.addEventListener('DOMContentLoaded', async () => {
  const fields = [
    'fullName', 'firstName', 'lastName', 'email', 'phone',
    'city', 'country', 'degree', 'resumeLink', 'linkedin',
    'github', 'portfolio', 'currentCompany', 'currentRole',
    'experienceYears', 'noticePeriod', 'currentCtc', 'expectedCtc',
    'skills', 'summary'
  ];

  const customRulesContainer = document.getElementById('custom-rules-list');
  const btnAddCustom = document.getElementById('btn-add-custom');
  const btnSave = document.getElementById('btn-save');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');
  const toast = document.getElementById('toast');

  let currentProfile = {};

  // Load profile from storage
  const res = await chrome.storage.local.get('profile');
  currentProfile = res.profile || {};

  // Populate basic fields
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = currentProfile[field] || '';
  });

  // Populate exact answer rules (supports both exactRules and legacy customAnswers)
  let exactRules = currentProfile.exactRules;
  if (!exactRules && currentProfile.customAnswers) {
    exactRules = currentProfile.customAnswers.map(c => ({
      questionKeyword: c.questionKeyword,
      actionType: 'radio',
      exactValue: c.answer
    }));
  }

  if (!exactRules || exactRules.length === 0) {
    exactRules = [
      { questionKeyword: 'authorized to work', actionType: 'radio', exactValue: 'Yes' },
      { questionKeyword: 'visa sponsorship', actionType: 'radio', exactValue: 'No' },
      { questionKeyword: 'gender', actionType: 'radio', exactValue: 'Prefer not to say' },
      { questionKeyword: 'relocate', actionType: 'radio', exactValue: 'Yes' },
      { questionKeyword: 'notice period', actionType: 'text', exactValue: '30 days' },
      { questionKeyword: 'skills', actionType: 'checkbox', exactValue: 'JavaScript, React, Node.js, Python' }
    ];
  }

  renderExactRules(exactRules);

  // Add rule button
  btnAddCustom.addEventListener('click', () => {
    addRuleRow('', 'radio', '');
  });

  function renderExactRules(rules) {
    customRulesContainer.innerHTML = '';
    rules.forEach(rule => {
      addRuleRow(rule.questionKeyword, rule.actionType || 'radio', rule.exactValue || rule.answer || '');
    });
  }

  function addRuleRow(keyword = '', actionType = 'radio', exactValue = '') {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.innerHTML = `
      <input type="text" class="rule-input rule-kw" placeholder="Question Keyword (e.g. sponsorship)" value="${escapeHtml(keyword)}" style="flex: 1.2;" />
      <select class="rule-type" style="background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:6px; padding:8px; font-size:12px; outline:none;">
        <option value="radio" ${actionType === 'radio' ? 'selected' : ''}>🔘 Radio (Select)</option>
        <option value="checkbox" ${actionType === 'checkbox' ? 'selected' : ''}>☑️ Checkbox</option>
        <option value="text" ${actionType === 'text' ? 'selected' : ''}>✍️ Text (Type)</option>
        <option value="dropdown" ${actionType === 'dropdown' ? 'selected' : ''}>🔽 Dropdown</option>
      </select>
      <input type="text" class="rule-input rule-val" placeholder="Exact Text or Option (e.g. Yes / React, Node)" value="${escapeHtml(exactValue)}" style="flex: 1.2;" />
      <button class="rule-delete" title="Delete Rule">✕</button>
    `;

    row.querySelector('.rule-delete').addEventListener('click', () => {
      row.remove();
    });

    customRulesContainer.appendChild(row);
  }

  function escapeHtml(text) {
    return (text || '').replace(/"/g, '&quot;');
  }

  // Save All Changes
  btnSave.addEventListener('click', async () => {
    const updated = {};

    fields.forEach(field => {
      const el = document.getElementById(field);
      if (el) updated[field] = el.value.trim();
    });

    // Collect exact rules
    const rules = [];
    document.querySelectorAll('.rule-row').forEach(row => {
      const kw = row.querySelector('.rule-kw').value.trim();
      const type = row.querySelector('.rule-type').value;
      const val = row.querySelector('.rule-val').value.trim();
      if (kw) {
        rules.push({ questionKeyword: kw, actionType: type, exactValue: val });
      }
    });

    updated.exactRules = rules;
    updated.customAnswers = rules.map(r => ({ questionKeyword: r.questionKeyword, answer: r.exactValue }));

    await chrome.storage.local.set({ profile: updated });
    currentProfile = updated;
    showToast('All profile data & exact rules saved successfully!');
  });

  // Export JSON
  btnExport.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentProfile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoapply-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import JSON trigger
  btnImport.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        fields.forEach(field => {
          const el = document.getElementById(field);
          if (el && imported[field] !== undefined) {
            el.value = imported[field];
          }
        });

        const importedRules = imported.exactRules || imported.customAnswers || [];
        renderExactRules(importedRules);

        await chrome.storage.local.set({ profile: imported });
        currentProfile = imported;
        showToast('Profile imported and saved successfully!');
      } catch (err) {
        alert('Invalid JSON file format!');
      }
    };
    reader.readAsText(file);
    fileImport.value = '';
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
});
