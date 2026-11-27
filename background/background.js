// AutoApply - Robust Background Service Worker (Manifest V3)

let isProcessingSubmission = false;

// Initialize storage defaults on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['profile', 'settings', 'task', 'customFields'], (res) => {
    if (!res.customFields) {
      chrome.storage.local.set({ customFields: getDefaultCustomFields() });
    }
    if (!res.profile) {
      chrome.storage.local.set({ profile: getDefaultProfile() });
    }
    if (!res.settings) {
      chrome.storage.local.set({ settings: getDefaultSettings() });
    }
    if (!res.task) {
      chrome.storage.local.set({
        task: {
          isRunning: false,
          targetUrl: '',
          totalIterations: 1,
          currentIteration: 0,
          activeTabId: null
        }
      });
    }
  });
  console.log('[AutoApply] Extension background worker initialized.');
});

// Sleep utility
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Ensure URL is always the clean fillable form URL (not the post-submit formResponse URL)
function getCleanFormUrl(url) {
  if (!url) return '';
  if (url.includes('docs.google.com/forms')) {
    // If it ends in /formResponse or has formResponse in it, convert to /viewform
    let cleaned = url.replace(/\/formResponse(\?.*)?$/, '/viewform$1');
    cleaned = cleaned.replace('/formResponse', '/viewform');
    return cleaned;
  }
  return url;
}

// Message listener from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_AUTOMATION') {
    handleStartAutomation(message.payload);
    sendResponse({ status: 'started' });
  } else if (message.type === 'STOP_AUTOMATION') {
    handleStopAutomation();
    sendResponse({ status: 'stopped' });
  } else if (message.type === 'FORM_SUBMITTED') {
    console.log('[AutoApply] Received FORM_SUBMITTED message from tab:', sender.tab?.id);
    handleFormSubmitted(message);
    sendResponse({ status: 'acknowledged' });
  }
  return true;
});

// Start a new automation task
async function handleStartAutomation({ targetUrl, totalIterations }) {
  const cleanUrl = getCleanFormUrl(targetUrl);
  const newTask = {
    isRunning: true,
    targetUrl: cleanUrl,
    totalIterations: parseInt(totalIterations, 10) || 1,
    currentIteration: 1,
    activeTabId: null,
    startTime: Date.now()
  };

  await chrome.storage.local.set({ task: newTask });
  console.log(`[AutoApply] Starting task: 1 of ${newTask.totalIterations} for ${cleanUrl}`);

  try {
    const tab = await chrome.tabs.create({
      url: cleanUrl,
      active: true
    });
    newTask.activeTabId = tab.id;
    await chrome.storage.local.set({ task: newTask });
    console.log(`[AutoApply] Created initial tab ${tab.id}`);
  } catch (err) {
    console.error('[AutoApply] Failed to open initial tab:', err);
    await handleStopAutomation();
  }
}

// Track tab loading events
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  const data = await chrome.storage.local.get(['task', 'settings', 'customFields', 'profile']);
  const task = data.task;
  if (!task || !task.isRunning) return;

  // Verify this is the active automation tab
  if (tabId === task.activeTabId) {
    console.log(`[AutoApply] Tab ${tabId} loaded (URL: ${tab.url})`);

    // Check if the current tab navigated to Google Forms response confirmation page
    const isResponseUrl = tab.url && (tab.url.includes('/formResponse') || tab.url.includes('form_confirm'));
    if (isResponseUrl) {
      console.log('[AutoApply] Detected /formResponse URL on active tab. Triggering handleFormSubmitted...');
      await handleFormSubmitted({ currentIteration: task.currentIteration });
      return;
    }

    // Normal form page ready for filling
    console.log(`[AutoApply] Form tab ${tabId} ready for iteration ${task.currentIteration}. Waiting 1000ms...`);
    await sleep(1000);

    // Send START_AUTOMATION to content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_AUTOMATION',
        task: task,
        customFields: data.customFields || [],
        profile: data.profile || {},
        settings: data.settings || {}
      });
      console.log(`[AutoApply] Sent START_AUTOMATION to tab ${tabId}`);
    } catch (err) {
      console.log(`[AutoApply] Content script will pick up task directly from storage.`);
    }
  }
});

// Handle form submission completion and open next tab
async function handleFormSubmitted(info) {
  if (isProcessingSubmission) {
    console.log('[AutoApply] Already processing submission transition, skipping duplicate call.');
    return;
  }
  isProcessingSubmission = true;

  try {
    const data = await chrome.storage.local.get(['task', 'settings']);
    const task = data.task;
    const settings = data.settings || {};

    if (!task || !task.isRunning) {
      console.log('[AutoApply] handleFormSubmitted: No active running task in storage.');
      return;
    }

    const currentIter = task.currentIteration || 1;
    const totalIters = task.totalIterations || 1;
    const prevTabId = task.activeTabId;

    console.log(`[AutoApply] Completed Iteration ${currentIter} of ${totalIters}`);

    // Advance CSV row pointer and record last submitted row so no row is ever used twice
    try {
      const { datasetCsv } = await chrome.storage.local.get('datasetCsv');
      if (datasetCsv && datasetCsv.rows && datasetCsv.rows.length > 0) {
        const finishedRowIdx = datasetCsv.currentRowIndex || 0;
        datasetCsv.lastSubmittedRowIndex = finishedRowIdx;
        datasetCsv.currentRowIndex = finishedRowIdx + 1;
        await chrome.storage.local.set({ datasetCsv });
        console.log(`[AutoApply] Completed CSV row #${finishedRowIdx + 1}. Next row is #${datasetCsv.currentRowIndex + 1} of ${datasetCsv.totalRows}`);
      }
    } catch (e) {
      console.warn('[AutoApply] Could not update datasetCsv pointer:', e);
    }

    if (currentIter < totalIters) {
      // Advance to next iteration
      task.currentIteration = currentIter + 1;
      await chrome.storage.local.set({ task: task });

      const delay = settings.nextTabDelayMs !== undefined ? settings.nextTabDelayMs : 1500;
      console.log(`[AutoApply] Waiting ${delay}ms before opening iteration ${task.currentIteration}...`);
      await sleep(delay);

      // Open new tab with the clean form targetUrl
      const cleanUrl = getCleanFormUrl(task.targetUrl);
      console.log(`[AutoApply] Opening next tab for iteration ${task.currentIteration}: ${cleanUrl}`);

      const newTab = await chrome.tabs.create({
        url: cleanUrl,
        active: true
      });

      task.activeTabId = newTab.id;
      await chrome.storage.local.set({ task: task });
      console.log(`[AutoApply] Successfully opened tab ${newTab.id} for iteration ${task.currentIteration}`);

      // Close previous tab if user enabled closing
      const closePrev = settings.closePreviousTab !== false;
      if (closePrev && prevTabId) {
        try {
          await chrome.tabs.remove(prevTabId);
          console.log(`[AutoApply] Closed previous tab ${prevTabId}`);
        } catch (e) {
          console.warn('[AutoApply] Could not close previous tab:', e);
        }
      }
    } else {
      // Completed all iterations
      console.log(`[AutoApply] 🎉 All ${totalIters} iterations completed successfully!`);
      task.isRunning = false;
      await chrome.storage.local.set({ task: task });
    }
  } catch (err) {
    console.error('[AutoApply] Error in handleFormSubmitted:', err);
  } finally {
    // Release processing lock after short debounce
    await sleep(1000);
    isProcessingSubmission = false;
  }
}

// Stop current automation
async function handleStopAutomation() {
  const data = await chrome.storage.local.get('task');
  const task = data.task;
  if (task) {
    if (task.activeTabId) {
      try {
        chrome.tabs.sendMessage(task.activeTabId, { type: 'STOP_AUTOMATION' });
      } catch (e) {}
    }
    task.isRunning = false;
    await chrome.storage.local.set({ task: task });
  }
  console.log('[AutoApply] Automation stopped.');
}

// Defaults
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
    { id: 'f_14', question: 'Expected CTC / Salary', type: 'text', answer: '$110,000' }
  ];
}

function getDefaultProfile() {
  return {
    fullName: 'Alex Morgan',
    email: 'alex.morgan.dev@gmail.com',
    phone: '+1 555-0199'
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
