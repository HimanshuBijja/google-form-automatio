# AutoApply - Google Form & Job Application AutoFiller Extension

A Manifest V3 browser extension designed to automate filling and submitting job application forms (Google Forms & web forms) with pre-seeded data across multiple iterations, displaying live in-browser execution with real-time highlighting.

---

## 🌟 Key Features

1. **Google Forms & Web Forms Support**:
   - **Text Inputs**: Full Name, First Name, Last Name, Degree, College, Years of Experience, Current CTC, Expected CTC, Notice Period, Current Company, Role, City, Address, etc.
   - **Email Inputs**: Automatically detects and fills email (including Google Forms top-level response email capture).
   - **Phone Number**: Preserves or formats phone/WhatsApp numbers without triggering numeric validation errors.
   - **Radio Buttons**: Matches options (e.g., Work Authorization `Yes`, Sponsorship `No`, Gender `Prefer not to say`, Relocation `Yes`) and handles the *"Other"* option with dynamic text input.
   - **Checkboxes**: Handles multi-choice skill selections (e.g., `JavaScript, React, Python`) and auto-checks required declarations/agreements.
   - **Dropdowns**: Automatically expands and selects matching options.

2. **Exact Select & Text Rules**:
   - You can define exact rules for specific questions in the **Options Page**:
     - *Keyword*: e.g. `sponsorship` ➔ *Type*: `Radio` ➔ *Exact Value*: `No`
     - *Keyword*: `skills` ➔ *Type*: `Checkbox` ➔ *Exact Value*: `React, Node.js, Python`
     - *Keyword*: `notice period` ➔ *Type*: `Text` ➔ *Exact Value*: `Immediate`

3. **Multi-Iteration Automation**:
   - Set the form link and how many times you want to fill and submit the form.
   - Automatically opens the link in a browser tab.
   - Fills all fields smoothly with visual focus, scrolling, and human-like typing effect.
   - Submits the form and detects confirmation ("*Your response has been recorded*").
   - Automatically opens the next iteration in a fresh tab until the desired count is reached!

4. **Live On-Screen Visual Execution (HUD)**:
   - Displays a floating badge in the top right of the active browser tab showing:
     - `Iteration X of Y`
     - Real-time progress bar
     - Currently filled question name
     - Instant **Stop Automation** button right inside the tab!

---

## 🚀 How to Install & Load the Extension

1. Open **Google Chrome** (or **Brave** / **Edge**).
2. In the address bar, navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select this folder:
   ```
   d:\code\personal_projects\google-form-automatio
   ```
6. The extension **AutoApply - Job Form AutoFiller** will now appear in your browser toolbar! (Click the puzzle piece icon to pin it).

---

## ⚙️ How to Pre-Seed Your Custom Fields (Full-Screen Dashboard)

1. Click the **AutoApply** icon in your browser toolbar.
2. Click **⚙️ Full Screen** (in the top right) or click the **"Fields"** tab and press:
   ```
   🚀 Open Full-Screen Settings Dashboard ↗
   ```
3. This opens a dedicated full-width dashboard tab (`settings/settings.html`) where you can:
   - **Enter Any Question / Keyword**: (e.g. *"Are you willing to relocate?"*, *"Select your gender"*, *"Years of experience"*).
   - **Choose the Question Type from the Dropdown**:
     - ✍️ `Short Text`
     - 📧 `Email Address`
     - 📞 `Phone Number`
     - 📝 `Paragraph (Long Text)`
     - 🔘 `Radio (Select Choice)`
     - ☑️ `Checkbox (Choice / Multi-Select)`
     - 🔽 `Dropdown Selection`
   - **Enter the Pre-seeded Answer**:
     - For text/email/phone: your pre-seeded text or link.
     - For radio/dropdown: the exact option text to click (e.g. `Yes`, `No`, `Immediate`).
     - For checkboxes: single option or comma-separated options (e.g. `React, Node.js, Python`).
   - **Add More Questions**: Click `+ Add New Question` to add as many custom questions as you need.
   - **Delete Questions**: Click `🗑️` on any field.
   - **Search & Filter**: Search your questions with the instant search bar.
   - **Export / Import JSON**: Easily back up or share your custom field profile.
4. Click **💾 Save All Changes**.

---

## ⚡ How to Run the Automation

1. Copy the target **Google Form link** (e.g. `https://docs.google.com/forms/d/e/.../viewform`).
2. Click the **AutoApply** extension icon in your browser.
3. Paste the URL into the **Target Form URL** box (or click **Paste Current** if you already have the form open).
4. Set **How Many Times?** (e.g., `1`, `5`, `10`).
5. Click **▶ Start Auto-Filling**.
6. **Watch your browser**:
   - It opens the form in your browser tab.
   - The on-screen HUD appears showing `Iteration 1 of X`.
   - Fields scroll into view, glow blue, and type your details.
   - Radio buttons and checkboxes are clicked.
   - The form submits, displays confirmation, and opens the next tab automatically!

---

## 🧪 Local Testing

A test form `test-sample-form.html` is included in this repository.
You can test the entire flow locally:
1. Open `test-sample-form.html` in Chrome:
   ```
   file:///d:/code/personal_projects/google-form-automatio/test-sample-form.html
   ```
2. Click the AutoApply extension icon, paste the `file://` link or click **Paste Current**.
3. Set iteration count to `2` or `3`, and click **Start Auto-Filling** to see it run live!
