'use strict';

// ── Elements ──────────────────────────────────────────────────────────────────
const analyzeBtn     = document.getElementById('analyzeBtn');
const uploadSection  = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const errorToast     = document.getElementById('errorToast');
const errorMessage   = document.getElementById('errorMessage');
const closeError     = document.getElementById('closeError');
const scanAgainBtn   = document.getElementById('scanAgainBtn');
const productNameInput = document.getElementById('productName');
const productImageInput = document.getElementById('productImage');
const imagePreview   = document.getElementById('imagePreview');
const previewImg     = document.getElementById('previewImg');
const removeImgBtn   = document.getElementById('removeImgBtn');
const uploadLabel    = document.getElementById('uploadLabel');

let productName = '';
let productImage = null;

function clearImage() {
  productImage = null;
  productImageInput.value = '';
  imagePreview.style.display = 'none';
  if (uploadLabel) { uploadLabel.textContent = 'Upload ingredient label image…'; uploadLabel.classList.remove('has-file'); }
  updateAnalyzeButtonState();
}

// ── Remove Image ─────────────────────────────────────────────────────────────
if (removeImgBtn) {
  removeImgBtn.addEventListener('click', clearImage);
}

// ── Image Upload ─────────────────────────────────────────────────────────────
productImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showError('Image file size must be less than 5MB.');
      productImageInput.value = '';
      return;
    }
    productImage = file;
    if (uploadLabel) { uploadLabel.textContent = file.name; uploadLabel.classList.add('has-file'); }
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    clearImage();
  }
  updateAnalyzeButtonState();
});

// Update button enabled state based on input
function updateAnalyzeButtonState() {
  analyzeBtn.disabled = !(productName || productImage);
}

// ── Product Name Input ────────────────────────────────────────────────────────
if (productNameInput) {
  productNameInput.addEventListener('change', (e) => {
    productName = e.target.value.trim();
    updateAnalyzeButtonState();
  });

  productNameInput.addEventListener('input', (e) => {
    productName = e.target.value.trim();
    updateAnalyzeButtonState();
  });

  productNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !analyzeBtn.disabled) analyzeBtn.click();
  });
}

// ── Loading Steps Animation ───────────────────────────────────────────────────
const steps = ['step1', 'step2', 'step3', 'step4'];
let stepTimer = null;

function startLoadingAnimation() {
  let current = 0;
  steps.forEach(id => {
    document.getElementById(id).className = 'step';
  });
  document.getElementById(steps[0]).classList.add('active');

  stepTimer = setInterval(() => {
    document.getElementById(steps[current]).classList.remove('active');
    document.getElementById(steps[current]).classList.add('done');
    current++;
    if (current < steps.length) {
      document.getElementById(steps[current]).classList.add('active');
    } else {
      clearInterval(stepTimer);
    }
  }, 2500);
}

function stopLoadingAnimation() {
  if (stepTimer) clearInterval(stepTimer);
  steps.forEach(id => {
    document.getElementById(id).classList.remove('active');
    document.getElementById(id).classList.add('done');
  });
}

// ── Analyze ───────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  if (!productName && !productImage) {
    showError('Please enter a product name or upload an image to analyze.');
    return;
  }

  const mode = productImage ? 'image' : 'text';

  uploadSection.style.display = 'none';
  loadingSection.style.display = 'flex';
  resultsSection.style.display = 'none';
  startLoadingAnimation();

  const loadingMessage = document.getElementById('loadingMessage');
  if (mode === 'text') {
    loadingMessage.textContent = 'Using product name to evaluate safety...';
  } else {
    loadingMessage.textContent = 'Analyzing product image for brand and ingredients...';
  }

  try {
    let res;
    if (mode === 'text') {
      res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName })
      });
    } else {
      const formData = new FormData();
      formData.append('productImage', productImage);
      res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });
    }

    const data = await res.json();

    stopLoadingAnimation();

    if (!res.ok) {
      loadingSection.style.display = 'none';
      uploadSection.style.display = 'flex';
      showError(data.error || 'Analysis failed. Please try again.');
      return;
    }

    loadingSection.style.display = 'none';
    renderResults(data);
    resultsSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    stopLoadingAnimation();
    loadingSection.style.display = 'none';
    uploadSection.style.display = 'flex';
    showError('Network error. Make sure the server is running and try again.');
  }
});

// ── Render Results ────────────────────────────────────────────────────────────
function renderResults(data) {
  const ingredients = data.ingredients || [];

  // Product type
  document.getElementById('productType').textContent =
    (data.product_type || 'Product') + ' Analysis';

  // Risk overview cards
  const counts = { high: 0, medium: 0, low: 0, safe: 0 };
  ingredients.forEach(ing => {
    const r = (ing.risk_level || 'safe').toLowerCase();
    if (counts[r] !== undefined) counts[r]++;
  });

  // If overall risk is high/medium but no ingredients match, add a synthetic entry
  const overallRisk = (data.overall_risk || 'safe').toLowerCase();
  if ((overallRisk === 'high' && counts.high === 0) ||
      (overallRisk === 'medium' && counts.medium === 0 && counts.high === 0)) {
    ingredients.push({
      name: 'Product-level Safety Concerns',
      risk_level: overallRisk,
      concerns: ['Based on regulatory alerts, brand history, or contamination patterns'],
      categories: ['Regulatory Risk'],
      iarc_class: 'Not applicable',
      why_concerning: data.summary || 'See product analysis summary for details',
      regulatory_status: 'Requires monitoring',
      safer_alternative: 'Choose certified organic or different brand'
    });
    counts[overallRisk]++;
  }

  const overallClass = data.overall_risk || 'safe';
  const overallEmoji = { high: '🚨', medium: '⚠️', low: '⚡', safe: '✅' }[overallClass] || '✅';

  document.getElementById('riskOverview').innerHTML = `
    <div class="risk-card overall ${overallClass}">
      <div class="risk-num">${overallEmoji}</div>
      <div class="risk-label">Overall: ${capitalize(overallClass)}</div>
    </div>
    <div class="risk-card high">
      <div class="risk-num">${counts.high}</div>
      <div class="risk-label">High Risk</div>
    </div>
    <div class="risk-card medium">
      <div class="risk-num">${counts.medium}</div>
      <div class="risk-label">Medium Risk</div>
    </div>
    <div class="risk-card low">
      <div class="risk-num">${counts.low}</div>
      <div class="risk-label">Low Risk</div>
    </div>
    <div class="risk-card safe">
      <div class="risk-num">${counts.safe}</div>
      <div class="risk-label">Safe</div>
    </div>
    <div class="risk-card" style="border-color:var(--border)">
      <div class="risk-num" style="font-size:1.5rem;color:var(--text)">${ingredients.length}</div>
      <div class="risk-label">Total Ingredients</div>
    </div>
  `;

  // Summary
  document.getElementById('summaryBox').textContent = data.summary || '';

  // Recommendation
  const recBox = document.getElementById('recommendationBox');
  if (data.recommendation) {
    recBox.textContent = data.recommendation;
    recBox.style.display = 'block';
  } else {
    recBox.style.display = 'none';
  }

  // Raw extracted text
  document.getElementById('rawIngredientsText').textContent =
    data.extracted_ingredients_raw || 'Not available';

  // Table
  const tbody = document.getElementById('ingredientsBody');
  tbody.innerHTML = '';

  ingredients.forEach(ing => {
    const risk = (ing.risk_level || 'safe').toLowerCase();
    const tr = document.createElement('tr');
    tr.dataset.risk = risk;

    const categories = (ing.categories || []).map(cat => {
      const isDanger = /carcino|toxic|neurotoxin|endocrine/i.test(cat);
      const isWarn   = /allergen|irritant|sensitiz/i.test(cat);
      const cls = isDanger ? 'danger' : isWarn ? 'warn' : '';
      return `<span class="tag ${cls}">${escapeHtml(cat)}</span>`;
    }).join('');

    const iarcClass = ing.iarc_class || 'Not classified';
    const iarcCss = iarcClassToCss(iarcClass);

    tr.innerHTML = `
      <td>
        <div class="ing-name">${escapeHtml(ing.name || '')}</div>
        ${ing.scientific_name && ing.scientific_name !== ing.name
          ? `<div class="ing-sci">${escapeHtml(ing.scientific_name)}</div>` : ''}
      </td>
      <td><span class="risk-badge ${risk}">${capitalize(risk)}</span></td>
      <td>${categories || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="${iarcCss}">${escapeHtml(iarcClass)}</span></td>
      <td class="evidence-text">${escapeHtml(ing.why_concerning || ing.evidence_summary || '—')}</td>
      <td class="evidence-text">${escapeHtml(ing.regulatory_status || '—')}</td>
      <td class="evidence-text">${escapeHtml(ing.safer_alternative || '—')}</td>
    `;
    tbody.appendChild(tr);
  });

  // Activate filter buttons
  activateFilters();
}

// ── Table Filters ─────────────────────────────────────────────────────────────
function activateFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      document.querySelectorAll('#ingredientsBody tr').forEach(row => {
        if (filter === 'all' || row.dataset.risk === filter) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    });
  });
}

// ── Scan Again ────────────────────────────────────────────────────────────────
scanAgainBtn.addEventListener('click', () => {
  resultsSection.style.display = 'none';
  uploadSection.style.display = 'flex';
  productName = '';
  if (productNameInput) productNameInput.value = '';
  clearImage();
  updateAnalyzeButtonState();
  document.querySelectorAll('.filter-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
});

// ── Error Toast ───────────────────────────────────────────────────────────────
function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.style.display = 'flex';
  setTimeout(() => { errorToast.style.display = 'none'; }, 6000);
}
closeError.addEventListener('click', () => { errorToast.style.display = 'none'; });

// ── Initialize Button State ───────────────────────────────────────────────────
// Initialize the analyze button state when page loads
updateAnalyzeButtonState();

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function iarcClassToCss(cls) {
  if (!cls) return 'iarc-nc';
  const c = cls.toLowerCase();
  if (c.includes('group 1'))  return 'iarc-1';
  if (c.includes('group 2a')) return 'iarc-2a';
  if (c.includes('group 2b')) return 'iarc-2b';
  if (c.includes('group 3'))  return 'iarc-3';
  return 'iarc-nc';
}
