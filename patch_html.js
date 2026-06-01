const fs = require('fs');

let html = fs.readFileSync('dealwise.html', 'utf8');

// 1. Make target optional in validateForm
html = html.replace(
  /const targetMessage = Number\.isFinite\(target\) && target > 0 \? \"\" : \"Enter a target above \$0\.\";/,
  `const targetMessage = els.targetPrice.value ? (Number.isFinite(target) && target > 0 ? "" : "Enter a target above $0.") : "";`
);

// 2. Return target or 0
html = html.replace(
  /return \{ name, target: Math\.round\(target\) \};/,
  `return { name, target: Math.round(target) || 0 };`
);

// 3. Change addForm submit logic
const oldSubmit = `els.addForm.addEventListener("submit", async event => {
      event.preventDefault();
      const valid = validateForm();

      if (!valid) {
        return;
      }

      if (!selectedSuggestion && !isKnownProduct(valid.name)) {
        const suggestions = await fetchSuggestions(valid.name);
        renderSuggestions(suggestions);
        showToast("Pick a matching product or press Track it again to keep your typed item");
        selectedSuggestion = { allowManual: true };
        return;
      }

      const suggestion = selectedSuggestion?.allowManual ? null : selectedSuggestion;
      const item = simulateItem(valid.name, valid.target, els.store.value, suggestion);
      items.unshift(item);
      els.addForm.reset();
      clearFormErrors();
      hideSuggestions();
      renderApp();
      showToast(\`Tracking \${item.name}\`);
      els.itemName.focus();
    });`;

const newSubmit = `els.addForm.addEventListener("submit", async event => {
      event.preventDefault();
      const valid = validateForm();

      if (!valid) {
        return;
      }

      showToast("Running multiple security checks & fetching from trustworthy sites...");
      
      // Setup loading state on button
      const submitBtn = els.addForm.querySelector('button[type="submit"]');
      const oldText = submitBtn.textContent;
      submitBtn.textContent = "Checking...";
      submitBtn.disabled = true;

      try {
        const params = new URLSearchParams({ q: valid.name, target: valid.target });
        const response = await fetch('/api/track?' + params.toString());
        if (!response.ok) throw new Error("Track failed");
        
        const data = await response.json();
        
        items.unshift(data.item);
        
        // Update coupons if returned
        if (data.coupons && data.coupons.length > 0) {
          coupons.length = 0;
          coupons.push(...data.coupons);
          renderCoupons();
        }
        
        // Update alerts if returned
        if (data.alerts && data.alerts.length > 0) {
          alerts.length = 0;
          alerts.push(...data.alerts);
          renderAlerts();
        }
        
        // Add to product details so Fallback and details work properly
        productDetails[data.item.name] = {
           category: data.item.category,
           image: data.item.image,
           description: data.item.description,
           specs: data.item.specs,
           bestFor: data.item.bestFor,
           watchFor: data.item.watchFor,
           learnedFacts: []
        };
        
        els.addForm.reset();
        clearFormErrors();
        hideSuggestions();
        renderApp();
        showToast("Tracking " + data.item.name);
        els.itemName.focus();
      } catch (err) {
        showToast("Tracking failed, please try again.");
      } finally {
        submitBtn.textContent = oldText;
        submitBtn.disabled = false;
      }
    });`;

html = html.replace(oldSubmit, newSubmit);

// Write changes
fs.writeFileSync('dealwise.html', html);
console.log('dealwise.html patched');
