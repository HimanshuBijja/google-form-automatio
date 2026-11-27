// AutoApply - Settings Dashboard with CSV Dataset (Row-by-Row Runner)

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const fieldsContainer = document.getElementById('fields-container');
  const fieldCountBadge = document.getElementById('field-count-badge');
  const csvStatusBadge = document.getElementById('csv-status-badge');
  const btnAddField = document.getElementById('btn-add-field');
  const btnLoadDefaults = document.getElementById('btn-load-defaults');
  const btnSaveAll = document.getElementById('btn-save-all');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-input');
  const inputSearch = document.getElementById('input-search');
  const toast = document.getElementById('toast');

  // CSV Dataset Elements
  const btnUploadDatasetCsv = document.getElementById('btn-upload-dataset-csv');
  const fileDatasetCsvInput = document.getElementById('file-dataset-csv-input');
  const btnClearCsv = document.getElementById('btn-clear-csv');
  const csvFilenameLabel = document.getElementById('csv-filename-label');
  const csvSummaryLabel = document.getElementById('csv-summary-label');
  const csvLastSubmittedText = document.getElementById('csv-last-submitted-text');
  const csvNextRowText = document.getElementById('csv-next-row-text');
  const inputJumpRow = document.getElementById('input-jump-row');
  const btnSetRow = document.getElementById('btn-set-row');
  const btnStepPrev = document.getElementById('btn-step-prev');
  const btnStepNext = document.getElementById('btn-step-next');
  const csvRemainingHint = document.getElementById('csv-remaining-hint');
  const btnResetCsvPointer = document.getElementById('btn-reset-csv-pointer');
  const csvColumnsPillContainer = document.getElementById('csv-columns-pill-container');
  const csvPreviewTable = document.getElementById('csv-preview-table');
  const btnSaveCsvTab = document.getElementById('btn-save-csv-tab');

  // Name Pool Elements
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
  let datasetCsv = {
    fileName: '',
    headers: [],
    rows: [],
    currentRowIndex: 0,
    totalRows: 0
  };

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
  const res = await chrome.storage.local.get(['customFields', 'settings', 'generatorSettings', 'datasetCsv']);
  settingsData = res.settings || getDefaultSettings();
  generatorSettings = res.generatorSettings || getDefaultGeneratorSettings();
  if (res.datasetCsv) {
    datasetCsv = res.datasetCsv;
  }

  // Populate Fields
  if (res.customFields && Array.isArray(res.customFields) && res.customFields.length > 0) {
    fieldsData = res.customFields;
  } else {
    fieldsData = getDefaultCustomFields();
  }

  // Populate CSV Dataset UI
  updateDatasetCsvUI();

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

  // Render initial fields list
  renderFields(fieldsData);

  // Search filtering
  inputSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const rows = fieldsContainer.querySelectorAll('.field-card');
    rows.forEach(row => {
      const qText = row.querySelector('.field-question').value.toLowerCase();
      const aText = (row.querySelector('.field-answer')?.value || '').toLowerCase();
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
      csvColIndex: 0,
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
      const csvColIdx = item.csvColIndex !== undefined ? item.csvColIndex : parseCsvColIndexFromToken(item.answer);

      // Build options for CSV column dropdown
      let csvColOptionsHtml = '';
      if (datasetCsv.headers && datasetCsv.headers.length > 0) {
        datasetCsv.headers.forEach((h, colI) => {
          csvColOptionsHtml += `<option value="${colI}" ${csvColIdx === colI ? 'selected' : ''}>Col ${colI + 1}: ${escapeHtml(h)}</option>`;
        });
      } else {
        csvColOptionsHtml = `<option value="0">Col 1 (Upload CSV first)</option>`;
      }

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
                <option value="csv_col" ${currentMode === 'csv_col' ? 'selected' : ''}>📊 From CSV (Row by Row)</option>
                <option value="dynamic_random_15" ${currentMode === 'dynamic_random_15' ? 'selected' : ''}>🎲 Random 15-char (a-zA-Z)</option>
                <option value="dynamic_fullname" ${currentMode === 'dynamic_fullname' ? 'selected' : ''}>👤 Mixed Full Name</option>
                <option value="dynamic_firstname" ${currentMode === 'dynamic_firstname' ? 'selected' : ''}>🔤 First Name only</option>
                <option value="dynamic_lastname" ${currentMode === 'dynamic_lastname' ? 'selected' : ''}>🔤 Last Name only</option>
                <option value="dynamic_email" ${currentMode === 'dynamic_email' ? 'selected' : ''}>📧 Auto Email (name + phone digits)</option>
                <option value="dynamic_phone" ${currentMode === 'dynamic_phone' ? 'selected' : ''}>📞 Auto Phone (92310 + counter)</option>
              </select>

              <select class="csv-col-select ${currentMode === 'csv_col' ? '' : 'hidden'}">
                ${csvColOptionsHtml}
              </select>

              <input type="text" class="field-input field-answer ${currentMode === 'csv_col' ? 'hidden' : ''}" placeholder="${getPlaceholderForMode(currentMode, item.type)}" value="${escapeHtml(item.answer || '')}" ${currentMode !== 'custom' ? 'readonly style="background:#131c31; color:#34d399; font-weight:600;"' : ''} />
            </div>
          </div>
        </div>

        <div>
          <button class="btn-delete" title="Delete Question">🗑️</button>
        </div>
      `;

      // Answer Mode dropdown listener
      const modeSelect = card.querySelector('.answer-mode-select');
      const csvColSelect = card.querySelector('.csv-col-select');
      const answerInput = card.querySelector('.field-answer');

      modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'custom') {
          csvColSelect.classList.add('hidden');
          answerInput.classList.remove('hidden');
          answerInput.readOnly = false;
          answerInput.style.background = 'var(--bg-input)';
          answerInput.style.color = 'var(--text-main)';
          answerInput.placeholder = 'Type custom text or option to select...';
          if (answerInput.value.startsWith('{{') && answerInput.value.endsWith('}}')) {
            answerInput.value = '';
          }
        } else if (mode === 'csv_col') {
          csvColSelect.classList.remove('hidden');
          answerInput.classList.add('hidden');
          answerInput.value = `{{CSV:${csvColSelect.value}}}`;
        } else {
          csvColSelect.classList.add('hidden');
          answerInput.classList.remove('hidden');
          answerInput.readOnly = true;
          answerInput.style.background = '#131c31';
          answerInput.style.color = '#34d399';
          answerInput.value = getTokenForMode(mode);
        }
      });

      // CSV Column dropdown listener
      csvColSelect.addEventListener('change', (e) => {
        answerInput.value = `{{CSV:${e.target.value}}}`;
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
    if (!ans) return 'custom';
    if (ans.startsWith('{{CSV:') && ans.endsWith('}}')) return 'csv_col';
    if (ans === '{{RANDOM_TEXT_15}}') return 'dynamic_random_15';
    if (ans === '{{MIXED_FULL_NAME}}') return 'dynamic_fullname';
    if (ans === '{{FIRST_NAME}}') return 'dynamic_firstname';
    if (ans === '{{LAST_NAME}}') return 'dynamic_lastname';
    if (ans === '{{AUTO_EMAIL}}') return 'dynamic_email';
    if (ans === '{{AUTO_PHONE}}') return 'dynamic_phone';
    return 'custom';
  }

  function parseCsvColIndexFromToken(ans) {
    if (ans && ans.startsWith('{{CSV:') && ans.endsWith('}}')) {
      const inside = ans.slice(6, -2);
      const parsed = parseInt(inside, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
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
      const csvColSelect = row.querySelector('.csv-col-select');
      let ans = row.querySelector('.field-answer').value.trim();
      let colIdx = 0;

      if (mode === 'csv_col') {
        colIdx = parseInt(csvColSelect.value, 10) || 0;
        ans = `{{CSV:${colIdx}}}`;
      } else if (mode !== 'custom') {
        ans = getTokenForMode(mode);
      }

      if (q) {
        collected.push({
          id: row.dataset.id || 'f_' + idx,
          question: q,
          type: type,
          answerMode: mode,
          csvColIndex: colIdx,
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

  // --- CSV DATASET UPLOADER & ROW-BY-ROW LOGIC ---

  btnUploadDatasetCsv.addEventListener('click', () => {
    fileDatasetCsvInput.click();
  });

  fileDatasetCsvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      parseDatasetCSV(file.name, text);
      fileDatasetCsvInput.value = '';
    };
    reader.readAsText(file);
  });

  function parseDatasetCSV(fileName, rawText) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('CSV file is empty!');
      return;
    }

    // Robust CSV line parser supporting quoted values
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const parsedRows = lines.map(parseCSVLine);
    let headers = [];
    let dataRows = [];

    // First line as headers
    if (parsedRows.length > 0) {
      headers = parsedRows[0];
      dataRows = parsedRows.slice(1);
    }

    // If only 1 line in file or no explicit headers
    if (dataRows.length === 0 && parsedRows.length > 0) {
      headers = parsedRows[0].map((_, i) => `Column ${i + 1}`);
      dataRows = parsedRows;
    }

    datasetCsv = {
      fileName: fileName,
      headers: headers,
      rows: dataRows,
      currentRowIndex: 0,
      totalRows: dataRows.length
    };

    chrome.storage.local.set({ datasetCsv });
    updateDatasetCsvUI();
    renderFields(fieldsData); // Re-render to update CSV column dropdowns
    showToast(`✓ Uploaded ${fileName}: ${dataRows.length} rows and ${headers.length} columns loaded!`);
  }

  function updateDatasetCsvUI() {
    if (datasetCsv && datasetCsv.totalRows > 0) {
      csvStatusBadge.textContent = `${datasetCsv.totalRows} rows`;
      csvStatusBadge.style.color = '#34d399';
      csvFilenameLabel.textContent = `Active CSV: ${datasetCsv.fileName || 'dataset.csv'}`;
      csvSummaryLabel.textContent = `Total ${datasetCsv.totalRows} rows loaded. Columns: ${datasetCsv.headers.join(', ')}`;
      btnClearCsv.classList.remove('hidden');

      const nextRow = (datasetCsv.currentRowIndex || 0) + 1;
      const lastRow = (datasetCsv.lastSubmittedRowIndex !== undefined && datasetCsv.lastSubmittedRowIndex !== null)
        ? (datasetCsv.lastSubmittedRowIndex + 1)
        : null;

      if (csvLastSubmittedText) {
        csvLastSubmittedText.textContent = lastRow ? `Row #${lastRow}` : 'None (Starting fresh)';
      }
      if (csvNextRowText) {
        csvNextRowText.textContent = nextRow > datasetCsv.totalRows
          ? `Row #${datasetCsv.totalRows} (All ${datasetCsv.totalRows} rows consumed!)`
          : `Row #${nextRow} of ${datasetCsv.totalRows}`;
      }
      if (inputJumpRow) {
        inputJumpRow.max = datasetCsv.totalRows;
        inputJumpRow.value = Math.min(nextRow, datasetCsv.totalRows);
      }

      const remaining = Math.max(0, datasetCsv.totalRows - (datasetCsv.currentRowIndex || 0));
      csvRemainingHint.textContent = `${remaining} rows remaining. Next run starts at Row #${Math.min(nextRow, datasetCsv.totalRows)}. AutoApply saves your exact place, so you can stop now and resume tomorrow seamlessly!`;

      // Render columns pills
      csvColumnsPillContainer.innerHTML = '';
      datasetCsv.headers.forEach((h, i) => {
        const pill = document.createElement('span');
        pill.className = 'col-pill';
        pill.textContent = `Col ${i + 1}: ${h}`;
        csvColumnsPillContainer.appendChild(pill);
      });

      // Render Preview Table (centered around current row to verify data!)
      let tableHtml = '<thead><tr><th>Row #</th>';
      datasetCsv.headers.forEach(h => {
        tableHtml += `<th>${escapeHtml(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      const currIdx = datasetCsv.currentRowIndex || 0;
      const startIdx = Math.max(0, currIdx - 1);
      const endIdx = Math.min(datasetCsv.totalRows, startIdx + 8);
      const previewRows = datasetCsv.rows.slice(startIdx, endIdx);

      if (startIdx > 0) {
        tableHtml += `<tr><td colspan="${datasetCsv.headers.length + 1}" style="text-align:center; color:var(--text-muted); font-size:11px; padding:4px;">... ${startIdx} earlier rows ...</td></tr>`;
      }

      previewRows.forEach((r, offset) => {
        const actualIdx = startIdx + offset;
        const isCurrent = actualIdx === currIdx;
        const isLastSubmitted = actualIdx === datasetCsv.lastSubmittedRowIndex;

        let rowStyle = '';
        let badge = '';
        if (isCurrent) {
          rowStyle = 'background: rgba(16, 185, 129, 0.2); font-weight: 700; color: #fff;';
          badge = ' <span style="background:#10b981; color:#0b1120; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">👉 NEXT TO FILL</span>';
        } else if (isLastSubmitted) {
          rowStyle = 'background: rgba(59, 130, 246, 0.12); color: #94a3b8;';
          badge = ' <span style="background:#3b82f6; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">✓ SUBMITTED</span>';
        }

        tableHtml += `<tr style="${rowStyle}">`;
        tableHtml += `<td><strong>#${actualIdx + 1}</strong>${badge}</td>`;
        datasetCsv.headers.forEach((_, cIdx) => {
          tableHtml += `<td>${escapeHtml(r[cIdx] || '')}</td>`;
        });
        tableHtml += '</tr>';
      });

      if (endIdx < datasetCsv.totalRows) {
        tableHtml += `<tr><td colspan="${datasetCsv.headers.length + 1}" style="text-align:center; color:var(--text-muted); font-size:11px; padding:4px;">... ${datasetCsv.totalRows - endIdx} remaining rows ...</td></tr>`;
      }
      tableHtml += '</tbody>';
      csvPreviewTable.innerHTML = tableHtml;
    } else {
      csvStatusBadge.textContent = 'No CSV';
      csvStatusBadge.style.color = 'var(--text-muted)';
      csvFilenameLabel.textContent = 'Upload Your CSV Dataset';
      csvSummaryLabel.textContent = 'Upload a CSV with multiple rows and columns (e.g., Name, Email, Custom Answers).';
      btnClearCsv.classList.add('hidden');
      if (csvLastSubmittedText) csvLastSubmittedText.textContent = 'None';
      if (csvNextRowText) csvNextRowText.textContent = 'Row 0 of 0';
      if (inputJumpRow) inputJumpRow.value = 1;
      csvRemainingHint.textContent = '0 rows in dataset. Upload a CSV file to start consuming row-by-row.';
      csvColumnsPillContainer.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">No CSV loaded yet. Upload a CSV to see columns.</span>`;
      csvPreviewTable.innerHTML = `<thead><tr><th>Status</th></tr></thead><tbody><tr><td>No data loaded</td></tr></tbody>`;
    }
  }

  // Set / Jump to specific Row
  btnSetRow?.addEventListener('click', async () => {
    if (!datasetCsv || datasetCsv.totalRows === 0) {
      alert('Please upload a CSV dataset first!');
      return;
    }
    const entered = parseInt(inputJumpRow.value, 10);
    if (isNaN(entered) || entered < 1 || entered > datasetCsv.totalRows) {
      alert(`Please enter a valid row number between 1 and ${datasetCsv.totalRows}`);
      return;
    }

    datasetCsv.currentRowIndex = entered - 1;
    await chrome.storage.local.set({ datasetCsv });
    updateDatasetCsvUI();
    showToast(`✓ Next row successfully set to Row #${entered}!`);
  });

  // Step -1
  btnStepPrev?.addEventListener('click', async () => {
    if (!datasetCsv || datasetCsv.totalRows === 0) return;
    const curr = datasetCsv.currentRowIndex || 0;
    if (curr > 0) {
      datasetCsv.currentRowIndex = curr - 1;
      await chrome.storage.local.set({ datasetCsv });
      updateDatasetCsvUI();
      showToast(`Moved back to Row #${datasetCsv.currentRowIndex + 1}`);
    }
  });

  // Step +1
  btnStepNext?.addEventListener('click', async () => {
    if (!datasetCsv || datasetCsv.totalRows === 0) return;
    const curr = datasetCsv.currentRowIndex || 0;
    if (curr < datasetCsv.totalRows - 1) {
      datasetCsv.currentRowIndex = curr + 1;
      await chrome.storage.local.set({ datasetCsv });
      updateDatasetCsvUI();
      showToast(`Advanced to Row #${datasetCsv.currentRowIndex + 1}`);
    }
  });

  // Reset Row Pointer to Row 1
  btnResetCsvPointer.addEventListener('click', async () => {
    if (datasetCsv) {
      datasetCsv.currentRowIndex = 0;
      await chrome.storage.local.set({ datasetCsv });
      updateDatasetCsvUI();
      showToast('Row pointer reset to Row 1!');
    }
  });

  // Clear CSV
  btnClearCsv.addEventListener('click', async () => {
    if (confirm('Clear current CSV dataset?')) {
      datasetCsv = { fileName: '', headers: [], rows: [], currentRowIndex: 0, totalRows: 0 };
      await chrome.storage.local.set({ datasetCsv });
      updateDatasetCsvUI();
      renderFields(fieldsData);
      showToast('CSV dataset cleared.');
    }
  });

  // Save CSV Tab Button
  btnSaveCsvTab.addEventListener('click', async () => {
    await chrome.storage.local.set({ datasetCsv });
    showToast('CSV Dataset settings saved!');
  });

  // --- NAME POOL & COUNTERS ---
  function updatePoolCounts() {
    const fCount = textareaFirstNames.value.split('\n').filter(s => s.trim()).length;
    const lCount = textareaLastNames.value.split('\n').filter(s => s.trim()).length;
    firstNamesCount.textContent = fCount;
    lastNamesCount.textContent = lCount;
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
      generatorSettings: generatorSettings,
      datasetCsv: datasetCsv
    });

    renderFields(fieldsData);
    updateDatasetCsvUI();
    updatePoolCounts();
    showToast('🎉 All fields, CSV dataset mappings, and settings saved!');
  });

  // Save Pool Tab Button
  btnSavePool.addEventListener('click', async () => {
    generatorSettings = collectGeneratorSettings();
    await chrome.storage.local.set({ generatorSettings });
    updatePoolCounts();
    showToast('Name pool saved!');
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
      version: '3.0',
      exportedAt: new Date().toISOString(),
      fields: fieldsData,
      settings: collectSettingsFromDOM(),
      generatorSettings: collectGeneratorSettings(),
      datasetCsv: datasetCsv
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
          if (imported.generatorSettings) generatorSettings = imported.generatorSettings;
          if (imported.datasetCsv) datasetCsv = imported.datasetCsv;

          await chrome.storage.local.set({
            customFields: fieldsData,
            settings: settingsData,
            generatorSettings: generatorSettings,
            datasetCsv: datasetCsv
          });

          renderFields(fieldsData);
          updateDatasetCsvUI();
          updatePoolCounts();
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
      { id: 'f_15', question: 'Additional Notes / Unique Code', type: 'text', answerMode: 'dynamic_random_15', answer: '{{RANDOM_TEXT_15}}' }
    ];
  }

  function getDefaultGeneratorSettings() {
    return {
      phonePrefix: '92310',
      phoneCounter: 1234,
      emailDomain: '@gmail.com',
      randomTextLength: 15,
      firstNamesPool: ['Alex', 'John', 'Michael', 'Sarah', 'David', 'James', 'Emily', 'Daniel', 'Matthew', 'Jessica'],
      lastNamesPool: ['Morgan', 'Doe', 'Smith', 'Johnson', 'Brown', 'Williams', 'Miller', 'Davis', 'Wilson', 'Taylor']
    };
  }

  function getDefaultSettings() {
    return {
      typingDelayMs: 25,
      fieldPauseMs: 350,
      autoSubmit: true,
      submitDelayMs: 800,
      closePreviousTab: true,
      nextTabDelayMs: 1500
    };
  }
});
