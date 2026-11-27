// AutoApply - Enhanced Content Script Form Filler with Custom Fields Engine
(function () {
  let isAutomationActive = false;
  let currentTask = null;
  let customFields = [];
  let profileData = null;
  let settings = null;
  let hudElement = null;

  // Initialize and check if automation task is active
  chrome.storage.local.get(['task', 'customFields', 'profile', 'settings'], (res) => {
    customFields = res.customFields || [];
    profileData = res.profile || {};
    settings = res.settings || getDefaultSettings();
    currentTask = res.task;

    if (currentTask && currentTask.isRunning) {
      startAutomationProcess();
    }
  });

  // Listen for messages from background script or popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_AUTOMATION') {
      currentTask = message.task;
      customFields = message.customFields || customFields;
      profileData = message.profile || profileData;
      settings = message.settings || settings;
      startAutomationProcess();
      sendResponse({ status: 'started' });
    } else if (message.type === 'STOP_AUTOMATION') {
      stopAutomationProcess();
      sendResponse({ status: 'stopped' });
    }
    return true;
  });

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- FLOATING HUD OVERLAY ---
  function createHUD() {
    if (document.getElementById('autoapply-hud')) {
      hudElement = document.getElementById('autoapply-hud');
      hudElement.classList.remove('hidden');
      return;
    }

    hudElement = document.createElement('div');
    hudElement.id = 'autoapply-hud';
    hudElement.innerHTML = `
      <div class="autoapply-hud-header">
        <span class="autoapply-hud-title">⚡ AutoApply Form Filler</span>
        <span class="autoapply-hud-badge" id="autoapply-hud-iter">Iter: 1/1</span>
      </div>
      <div class="autoapply-hud-status" id="autoapply-hud-msg">Initializing...</div>
      <div class="autoapply-hud-progress">
        <div class="autoapply-hud-progress-bar" id="autoapply-hud-bar"></div>
      </div>
      <div class="autoapply-hud-actions">
        <button class="autoapply-hud-btn autoapply-hud-btn-stop" id="autoapply-hud-stop">Stop Automation</button>
      </div>
    `;

    document.body.appendChild(hudElement);

    document.getElementById('autoapply-hud-stop').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_AUTOMATION' });
      updateHUDStatus('Stopping automation...', 0);
      setTimeout(() => {
        if (hudElement) hudElement.classList.add('hidden');
      }, 1000);
    });
  }

  function updateHUDStatus(message, progressPercent) {
    if (!hudElement) createHUD();
    const msgEl = document.getElementById('autoapply-hud-msg');
    const iterEl = document.getElementById('autoapply-hud-iter');
    const barEl = document.getElementById('autoapply-hud-bar');

    if (msgEl) msgEl.textContent = message;
    if (barEl && progressPercent !== undefined) barEl.style.width = `${progressPercent}%`;
    if (iterEl && currentTask) {
      iterEl.textContent = `Iteration ${currentTask.currentIteration} of ${currentTask.totalIterations}`;
    }
  }

  async function startAutomationProcess() {
    if (isAutomationActive) return;
    isAutomationActive = true;

    // Refresh custom fields from storage in case user edited them in full-screen settings
    const stored = await chrome.storage.local.get(['customFields', 'settings', 'profile']);
    if (stored.customFields && stored.customFields.length > 0) {
      customFields = stored.customFields;
    }
    if (stored.settings) settings = stored.settings;
    if (stored.profile) profileData = stored.profile;

    createHUD();
    updateHUDStatus('Analyzing form fields...', 10);
    await sleep(600);

    // Check if we are already on a Google Forms submission confirmation page
    if (isGoogleFormSubmittedPage()) {
      updateHUDStatus('Form already submitted! Reporting success...', 100);
      await sleep(1000);
      notifySubmitted();
      return;
    }

    try {
      const isGoogleForm = window.location.hostname.includes('docs.google.com') && window.location.pathname.includes('/forms/');
      if (isGoogleForm) {
        await fillGoogleForm();
      } else {
        await fillGenericWebForm();
      }
    } catch (err) {
      console.error('AutoApply Error:', err);
      updateHUDStatus(`Error: ${err.message}`, 0);
      isAutomationActive = false;
    }
  }

  function stopAutomationProcess() {
    isAutomationActive = false;
    if (hudElement) {
      updateHUDStatus('Automation Stopped.', 0);
      setTimeout(() => hudElement.classList.add('hidden'), 1500);
    }
  }

  function notifySubmitted() {
    chrome.runtime.sendMessage({
      type: 'FORM_SUBMITTED',
      currentIteration: currentTask ? currentTask.currentIteration : 1
    });
  }

  // --- GOOGLE FORMS HANDLER ---

  function isGoogleFormSubmittedPage() {
    if (window.location.href.includes('formResponse') ||
        window.location.pathname.includes('/formResponse') ||
        window.location.search.includes('form_confirm')) {
      return true;
    }
    const text = (document.body && document.body.innerText) ? document.body.innerText.toLowerCase() : '';
    if (text.includes('response has been recorded') ||
        text.includes('submit another response') ||
        text.includes('your response') ||
        document.querySelector('.freebirdFormviewerViewResponseConfirmationMessage') ||
        document.querySelector('.vHW8K') ||
        document.querySelector('a[href*="viewform"]')) {
      return true;
    }
    return false;
  }

  async function fillGoogleForm() {
    updateHUDStatus('Scanning Google Form questions...', 20);
    await sleep(500);

    // Check for top-level email record input (Google Form "Record email as included with my response")
    const topEmailInput = document.querySelector('input[type="email"].whsOnd, input[type="email"]');
    if (topEmailInput && (!topEmailInput.value || topEmailInput.value.trim() === '')) {
      const emailField = customFields.find(f => f.type === 'email' || f.question.toLowerCase().includes('email'));
      const emailVal = emailField ? emailField.answer : (profileData ? profileData.email : '');
      if (emailVal) {
        topEmailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await typeIntoInput(topEmailInput, emailVal);
      }
    }

    // Find all question items in Google Forms
    let questions = Array.from(document.querySelectorAll('div[role="listitem"]'));
    if (questions.length === 0) {
      questions = Array.from(document.querySelectorAll('.geS5n, .Qr7Oae'));
    }

    if (questions.length === 0) {
      updateHUDStatus('No standard question items found. Checking generic inputs...', 25);
      await fillGenericWebForm();
      return;
    }

    const total = questions.length;
    let filledCount = 0;

    for (let i = 0; i < total; i++) {
      if (!isAutomationActive) return;

      const q = questions[i];
      const titleEl = q.querySelector('div[role="heading"], .M7eMe, .F9yp7e, .HoXoMd, span');
      const questionText = titleEl ? titleEl.innerText.trim() : '';

      if (!questionText) continue;

      // Highlight current question container
      q.scrollIntoView({ behavior: 'smooth', block: 'center' });
      q.classList.add('autoapply-highlight-active');
      updateHUDStatus(`Question: "${truncate(questionText, 32)}"`, Math.round((i / total) * 75) + 15);
      await sleep(settings ? settings.fieldPauseMs || 300 : 300);

      // Check user-configured custom fields first
      const matchedField = findCustomFieldForQuestion(questionText);
      const answerValue = matchedField ? matchedField.answer : matchFallbackProfileValue(questionText);
      const fieldType = matchedField ? matchedField.type : 'auto';

      let fieldHandled = false;

      // 1. Text / Email / Phone Inputs
      const textInput = q.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="tel"]');
      if (textInput && answerValue && (fieldType === 'text' || fieldType === 'email' || fieldType === 'phone' || fieldType === 'auto')) {
        let valueToType = answerValue;
        if (fieldType === 'phone' || isPhoneQuestion(questionText)) {
          const isNumericOnly = (q.innerText || '').toLowerCase().includes('number') || textInput.getAttribute('data-initial-dir') === 'ltr';
          if (isNumericOnly) {
            valueToType = answerValue.replace(/[^\d+]/g, '');
          }
        }
        await typeIntoInput(textInput, valueToType);
        fieldHandled = true;
      }

      // 2. Paragraph / Long Textarea
      const textarea = q.querySelector('textarea, textarea.KHxj8b');
      if (textarea && answerValue && (fieldType === 'paragraph' || fieldType === 'text' || fieldType === 'auto')) {
        await typeIntoInput(textarea, answerValue);
        fieldHandled = true;
      }

      // 3. Radio Buttons (Multiple Choice)
      const radioContainers = Array.from(q.querySelectorAll('div[role="radio"]'));
      if (radioContainers.length > 0) {
        if (answerValue && (fieldType === 'radio' || fieldType === 'auto')) {
          const handled = await handleGoogleFormRadioButtons(q, radioContainers, answerValue, questionText);
          if (handled) fieldHandled = true;
        }
      }

      // 4. Checkboxes (Multiple Choice & Declarations)
      const checkboxContainers = Array.from(q.querySelectorAll('div[role="checkbox"]'));
      if (checkboxContainers.length > 0) {
        if (fieldType === 'checkbox' || fieldType === 'auto' || isAgreementQuestion(questionText)) {
          const handled = await handleGoogleFormCheckboxes(q, checkboxContainers, answerValue, questionText);
          if (handled) fieldHandled = true;
        }
      }

      // 5. Dropdown Listbox
      const dropdown = q.querySelector('div[role="listbox"]');
      if (dropdown && answerValue) {
        const handled = await handleGoogleFormDropdown(dropdown, answerValue);
        if (handled) fieldHandled = true;
      }

      q.classList.remove('autoapply-highlight-active');
      if (fieldHandled) {
        q.classList.add('autoapply-highlight-done');
        filledCount++;
      }
    }

    updateHUDStatus(`Filled ${filledCount} fields. Preparing to submit...`, 90);
    await sleep(settings ? settings.submitDelayMs || 1000 : 1000);

    // Multi-page "Next" or Final "Submit"
    await handleGoogleFormSubmission();
  }

  // --- CUSTOM FIELDS MATCHER ---
  function findCustomFieldForQuestion(questionText) {
    if (!customFields || !Array.isArray(customFields) || customFields.length === 0) return null;
    const qLower = questionText.toLowerCase().trim();

    // 1. Exact match on question
    for (let f of customFields) {
      if (!f.question || !f.answer) continue;
      const fLower = f.question.toLowerCase().trim();
      if (qLower === fLower) {
        return f;
      }
    }

    // 2. Keyword / Substring match
    for (let f of customFields) {
      if (!f.question || !f.answer) continue;
      const fLower = f.question.toLowerCase().trim();
      if (qLower.includes(fLower) || fLower.includes(qLower)) {
        return f;
      }
    }

    return null;
  }

  // --- GOOGLE FORM RADIO BUTTONS HANDLER ---
  async function handleGoogleFormRadioButtons(questionEl, radioList, targetValue, questionText) {
    if (!targetValue) return false;

    // 1. Match radio option label text
    const match = findBestRadioOrCheckboxOption(radioList, targetValue);
    if (match) {
      await clickGoogleChoiceElement(match);
      return true;
    }

    // 2. Check for "Other" option with text box input
    const otherRadio = radioList.find(r => {
      const parent = r.closest('.docssharedWizToggleLabeledContainer') || r.parentElement;
      return parent && (parent.querySelector('input.Hvn9fb, input.whsOnd') || (parent.innerText || '').toLowerCase().includes('other'));
    });

    if (otherRadio) {
      await clickGoogleChoiceElement(otherRadio);
      const otherInput = questionEl.querySelector('input.Hvn9fb, input.whsOnd');
      if (otherInput) {
        await typeIntoInput(otherInput, targetValue);
      }
      return true;
    }

    return false;
  }

  // --- GOOGLE FORM CHECKBOXES HANDLER ---
  async function handleGoogleFormCheckboxes(questionEl, checkboxList, targetValue, questionText) {
    const qLower = questionText.toLowerCase();

    // 1. Agreement / Declaration question
    if (isAgreementQuestion(qLower)) {
      for (let cb of checkboxList) {
        if (cb.getAttribute('aria-checked') !== 'true') {
          await clickGoogleChoiceElement(cb);
        }
      }
      return true;
    }

    // 2. Comma-separated multi-select (e.g. "React, Node.js, Python")
    if (targetValue && (targetValue.includes(',') || targetValue.includes(';'))) {
      const targets = targetValue.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      let anyChecked = false;
      for (let cb of checkboxList) {
        const label = getOptionLabelText(cb).toLowerCase();
        for (let t of targets) {
          if (label === t || label.includes(t) || t.includes(label)) {
            if (cb.getAttribute('aria-checked') !== 'true') {
              await clickGoogleChoiceElement(cb);
              anyChecked = true;
            }
          }
        }
      }
      if (anyChecked) return true;
    }

    // 3. Single option selection
    if (targetValue) {
      const match = findBestRadioOrCheckboxOption(checkboxList, targetValue);
      if (match) {
        if (match.getAttribute('aria-checked') !== 'true') {
          await clickGoogleChoiceElement(match);
        }
        return true;
      }
    }

    return false;
  }

  function isAgreementQuestion(qText) {
    const q = qText.toLowerCase();
    return q.includes('agree') || q.includes('confirm') || q.includes('certify') ||
           q.includes('declaration') || q.includes('acknowledge') || q.includes('accurate') ||
           q.includes('truthful') || q.includes('terms');
  }

  // Robust click for Google Forms Radio / Checkbox elements
  async function clickGoogleChoiceElement(element) {
    const clickTarget = element.closest('.docssharedWizToggleLabeledContainer') ||
                        element.querySelector('.exportInnerCircle') ||
                        element;

    clickTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(150);

    clickTarget.click();

    await sleep(100);
    if (element.getAttribute('aria-checked') !== 'true') {
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
  }

  function getOptionLabelText(optionEl) {
    const parent = optionEl.closest('.docssharedWizToggleLabeledContainer') || optionEl.parentElement;
    if (parent) {
      const labelSpan = parent.querySelector('.aDTYNe, .snByac, .ulDsOb, span');
      if (labelSpan && labelSpan.innerText) return labelSpan.innerText.trim();
      return (parent.innerText || '').trim();
    }
    return optionEl.getAttribute('data-value') || optionEl.getAttribute('aria-label') || '';
  }

  function findBestRadioOrCheckboxOption(optionsList, targetValue) {
    if (!targetValue) return null;
    const target = targetValue.toLowerCase().trim();

    // Exact or substring match on option label
    for (let opt of optionsList) {
      const label = getOptionLabelText(opt).toLowerCase();
      if (label === target || label.includes(target) || target.includes(label)) {
        return opt;
      }
    }

    // Fallbacks for common Yes / No radio buttons
    if (target === 'yes') {
      return optionsList.find(opt => getOptionLabelText(opt).toLowerCase().startsWith('yes'));
    }
    if (target === 'no') {
      return optionsList.find(opt => getOptionLabelText(opt).toLowerCase().startsWith('no'));
    }

    return null;
  }

  // --- GOOGLE FORM DROPDOWN HANDLER ---
  async function handleGoogleFormDropdown(dropdownEl, targetValue) {
    dropdownEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dropdownEl.click();
    await sleep(400);

    const options = Array.from(document.querySelectorAll('div[role="option"]'));
    const best = findBestRadioOrCheckboxOption(options, targetValue);
    if (best) {
      best.click();
      await sleep(250);
      return true;
    } else {
      dropdownEl.click();
      return false;
    }
  }

  // --- GOOGLE FORM SUBMISSION & MULTI-PAGE NAVIGATION ---
  async function handleGoogleFormSubmission() {
    const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));

    // Check for "Next" button in multi-page Google Forms
    const nextBtn = buttons.find(b => {
      const text = (b.innerText || '').toLowerCase().trim();
      return (text === 'next' || text === 'continue' || text === 'next page') && isElementVisible(b);
    });

    if (nextBtn) {
      updateHUDStatus('Multi-page form: Clicking "Next"...', 92);
      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(600);
      nextBtn.click();
      await sleep(1800);
      await fillGoogleForm();
      return;
    }

    // Check for "Submit" button
    const submitBtn = buttons.find(b => {
      const text = (b.innerText || '').toLowerCase().trim();
      return (text === 'submit' || text === 'send' || text === 'send response') && isElementVisible(b);
    });

    if (submitBtn) {
      if (settings && settings.autoSubmit === false) {
        updateHUDStatus('Form filled! Auto-submit paused for manual review.', 100);
        return;
      }

      updateHUDStatus('Form filled! Submitting now...', 95);
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(settings ? settings.submitDelayMs || 800 : 800);
      submitBtn.click();

      updateHUDStatus('🎉 Form submitted! Opening next tab...', 100);
      await sleep(600);
      notifySubmitted();
    } else {
      updateHUDStatus('All fields filled! Submit button not detected.', 100);
    }
  }

  // --- GENERIC WEB FORMS HANDLER (Fallback for non-Google Forms) ---
  async function fillGenericWebForm() {
    updateHUDStatus('Scanning standard web form inputs...', 30);
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'));
    const visibleInputs = inputs.filter(isElementVisible);

    let filledCount = 0;
    const total = visibleInputs.length;

    for (let i = 0; i < total; i++) {
      if (!isAutomationActive) return;

      const el = visibleInputs[i];
      const labelText = getFieldLabel(el);
      const matchedField = findCustomFieldForQuestion(labelText);
      const answerValue = matchedField ? matchedField.answer : matchFallbackProfileValue(labelText);

      if (answerValue) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('autoapply-highlight-active');
        updateHUDStatus(`Filling: "${truncate(labelText || el.name || 'Field', 28)}"`, Math.round((i / total) * 70) + 20);
        await sleep(settings ? settings.fieldPauseMs || 300 : 300);

        if (el.tagName === 'SELECT') {
          selectOptionByText(el, answerValue);
        } else if (el.type === 'radio') {
          if ((el.value || '').toLowerCase() === answerValue.toLowerCase() || answerValue.toLowerCase().startsWith('yes')) {
            el.click();
          }
        } else if (el.type === 'checkbox') {
          if (!el.checked) el.click();
        } else {
          await typeIntoInput(el, answerValue);
        }

        el.classList.remove('autoapply-highlight-active');
        el.classList.add('autoapply-highlight-done');
        filledCount++;
      }
    }

    updateHUDStatus(`Filled ${filledCount} fields. Submitting...`, 90);
    await sleep(settings ? settings.submitDelayMs || 1000 : 1000);

    if (settings && settings.autoSubmit === false) {
      updateHUDStatus('Form filled! Auto-submit paused for review.', 100);
      return;
    }

    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]') ||
      Array.from(document.querySelectorAll('button, a.btn, div[role="button"]')).find(b => {
        const text = (b.innerText || '').toLowerCase();
        return (text.includes('submit') || text.includes('apply') || text.includes('send')) && isElementVisible(b);
      });

    if (submitBtn) {
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(600);
      submitBtn.click();
      await sleep(1500);
      notifySubmitted();
    }
  }

  function getFieldLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label && label.innerText) return label.innerText;
    }
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.innerText) return parentLabel.innerText;

    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('placeholder') ||
      element.name ||
      element.id ||
      ''
    );
  }

  function selectOptionByText(selectEl, text) {
    const norm = text.toLowerCase();
    for (let opt of selectEl.options) {
      if (opt.text.toLowerCase().includes(norm) || opt.value.toLowerCase().includes(norm)) {
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // --- NATIVE VALUE INJECTION WITH VISUAL TYPING EFFECT ---
  async function typeIntoInput(inputEl, value) {
    inputEl.focus();

    const isTextarea = inputEl.tagName === 'TEXTAREA';
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    const delay = settings ? settings.typingDelayMs || 25 : 25;

    if (delay <= 5 || value.length > 80) {
      if (valueSetter) {
        valueSetter.call(inputEl, value);
      } else {
        inputEl.value = value;
      }
      dispatchInputEvents(inputEl);
    } else {
      let currentVal = '';
      for (let char of value) {
        currentVal += char;
        if (valueSetter) {
          valueSetter.call(inputEl, currentVal);
        } else {
          inputEl.value = currentVal;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(delay);
      }
      dispatchInputEvents(inputEl);
    }

    inputEl.blur();
  }

  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  function isPhoneQuestion(qText) {
    const q = qText.toLowerCase();
    return q.includes('phone') || q.includes('mobile') || q.includes('contact') || q.includes('whatsapp') || q.includes('cell');
  }

  function matchFallbackProfileValue(questionText) {
    if (!profileData || !questionText) return '';
    const q = questionText.toLowerCase().trim();

    if (q.includes('email') || q.includes('e-mail')) return profileData.email || '';
    if (isPhoneQuestion(q)) return profileData.phone || '';
    if (q.includes('name')) return profileData.fullName || '';
    if (q.includes('resume') || q.includes('cv')) return profileData.resumeLink || '';
    if (q.includes('linkedin')) return profileData.linkedin || '';
    if (q.includes('github')) return profileData.github || '';

    return '';
  }

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
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
})();
