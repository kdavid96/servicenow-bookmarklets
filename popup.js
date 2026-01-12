// ServiceNow Toolkit - Popup Logic

const BOOKMARKLETS = [
  {
    id: 'copy-sys-id',
    name: 'Copy sys_id',
    description: 'Copy current record sys_id to clipboard',
    category: 'clipboard',
    icon: '📋',
    shortcut: 'Alt+1',
    code: `(function() {
      var sysId = null;
      if (typeof g_form !== 'undefined' && g_form.getUniqueValue) {
        sysId = g_form.getUniqueValue();
      }
      if (!sysId) {
        var match = window.location.search.match(/sys_id=([a-f0-9]{32})/i);
        if (match) sysId = match[1];
      }
      if (!sysId) {
        var pathMatch = window.location.pathname.match(/\\/([a-f0-9]{32})(?:\\/|$)/i);
        if (pathMatch) sysId = pathMatch[1];
      }
      if (sysId) {
        navigator.clipboard.writeText(sysId).then(function() {
          alert('sys_id copied: ' + sysId);
        }).catch(function() {
          prompt('Copy sys_id:', sysId);
        });
      } else {
        alert('No sys_id found on this page');
      }
    })();`
  },
  {
    id: 'show-fields',
    name: 'Show Fields',
    description: 'Display all field names on current form',
    category: 'debug',
    icon: '🏷️',
    shortcut: 'Alt+2',
    code: `(function() {
      if (typeof g_form !== 'undefined') {
        var fields = g_form.getTableName() + ' fields:\\n\\n';
        var elements = g_form.elements;
        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          var label = g_form.getLabelOf(el.fieldName) || el.fieldName;
          fields += el.fieldName + ' (' + label + ')\\n';
        }
        console.log(fields);
        alert(fields);
        return;
      }
      var fieldElements = document.querySelectorAll('[data-field-name], [field-name]');
      if (fieldElements.length > 0) {
        var fieldList = 'Fields found:\\n\\n';
        fieldElements.forEach(function(el) {
          var name = el.getAttribute('data-field-name') || el.getAttribute('field-name');
          fieldList += name + '\\n';
        });
        console.log(fieldList);
        alert(fieldList);
        return;
      }
      alert('No form fields found on this page');
    })();`
  },
  {
    id: 'reveal-fields',
    name: 'Reveal All Fields',
    description: 'Show all hidden fields on the form',
    category: 'debug',
    icon: '👁️',
    code: `(function() {
      if (typeof g_form === 'undefined') {
        alert('No ServiceNow form found on this page');
        return;
      }
      var revealed = 0;
      var elements = g_form.elements;
      for (var i = 0; i < elements.length; i++) {
        var fieldName = elements[i].fieldName;
        try {
          var visible = g_form.isVisible(fieldName);
          if (!visible) {
            g_form.setDisplay(fieldName, true);
            g_form.setVisible(fieldName, true);
            revealed++;
          }
        } catch(e) {}
      }
      var sections = document.querySelectorAll('.section-content, .form-group, [id^="section-"]');
      sections.forEach(function(section) {
        if (section.style.display === 'none' || section.classList.contains('hidden')) {
          section.style.display = '';
          section.classList.remove('hidden');
          revealed++;
        }
      });
      var hiddenRows = document.querySelectorAll('tr.hidden, tr[style*="display: none"], .form-field.hidden');
      hiddenRows.forEach(function(row) {
        row.style.display = '';
        row.classList.remove('hidden');
        revealed++;
      });
      var msg = revealed > 0
        ? 'Revealed ' + revealed + ' hidden element(s)'
        : 'No hidden fields found';
      console.log(msg);
      alert(msg);
    })();`
  },
  {
    id: 'toggle-debug',
    name: 'Toggle Debug',
    description: 'Enable/disable ServiceNow debug mode',
    category: 'debug',
    icon: '🐛',
    shortcut: 'Alt+3',
    code: `(function() {
      var currentUrl = new URL(window.location.href);
      var debug = currentUrl.searchParams.get('sysparm_debug');
      if (debug === 'true') {
        currentUrl.searchParams.delete('sysparm_debug');
        alert('Debug mode disabled');
      } else {
        currentUrl.searchParams.set('sysparm_debug', 'true');
        alert('Debug mode enabled - page will reload');
      }
      window.location.href = currentUrl.toString();
    })();`
  },
  {
    id: 'quick-nav',
    name: 'Quick Nav',
    description: 'Focus the navigator search box',
    category: 'navigation',
    icon: '🔍',
    code: `(function() {
      var filter = document.getElementById('filter');
      if (filter) {
        filter.focus();
        filter.select();
        return;
      }
      var globalSearch = document.querySelector('[id*="global-search"] input, .sn-global-typeahead-input');
      if (globalSearch) {
        globalSearch.focus();
        return;
      }
      var workspaceSearch = document.querySelector('input[placeholder*="Search"], .now-input[type="search"]');
      if (workspaceSearch) {
        workspaceSearch.focus();
        return;
      }
      alert('Navigator search not found');
    })();`
  },
  {
    id: 'table-schema',
    name: 'Table Schema',
    description: 'Open table definition for current record',
    category: 'navigation',
    icon: '📊',
    code: `(function() {
      var tableName = null;
      if (typeof g_form !== 'undefined' && g_form.getTableName) {
        tableName = g_form.getTableName();
      }
      if (!tableName) {
        var match = window.location.pathname.match(/\\/([a-z_]+)\\.do/i);
        if (match) tableName = match[1];
      }
      if (!tableName) {
        var params = new URLSearchParams(window.location.search);
        tableName = params.get('sysparm_table') || params.get('table');
      }
      if (tableName) {
        var baseUrl = window.location.origin;
        var schemaUrl = baseUrl + '/sys_db_object.do?sysparm_query=name=' + tableName;
        window.open(schemaUrl, '_blank');
      } else {
        var input = prompt('Enter table name:');
        if (input) {
          var baseUrl = window.location.origin;
          window.open(baseUrl + '/sys_db_object.do?sysparm_query=name=' + input, '_blank');
        }
      }
    })();`
  }
];

const CATEGORY_CONFIG = {
  clipboard: { label: 'Clipboard', order: 1 },
  debug: { label: 'Debug Tools', order: 2 },
  navigation: { label: 'Navigation', order: 3 },
  custom: { label: 'Custom Tools', order: 4 }
};

// DOM Elements
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const addBtn = document.getElementById('addBtn');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const customNameEl = document.getElementById('customName');
const customDescEl = document.getElementById('customDesc');
const customCodeEl = document.getElementById('customCode');

let allBookmarklets = [...BOOKMARKLETS];
let customBookmarklets = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadCustomBookmarklets();
  render();
  setupListeners();
  searchEl.focus();
});

// Load custom bookmarklets from storage
async function loadCustomBookmarklets() {
  try {
    const result = await chrome.storage.local.get('customBookmarklets');
    customBookmarklets = result.customBookmarklets || [];
    allBookmarklets = [...BOOKMARKLETS, ...customBookmarklets];
  } catch (e) {
    console.error('Failed to load custom bookmarklets:', e);
  }
}

// Save custom bookmarklets to storage
async function saveCustomBookmarklets() {
  try {
    await chrome.storage.local.set({ customBookmarklets });
  } catch (e) {
    console.error('Failed to save custom bookmarklets:', e);
  }
}

// Setup event listeners
function setupListeners() {
  // Search
  searchEl.addEventListener('input', () => {
    const query = searchEl.value.toLowerCase().trim();
    const filtered = allBookmarklets.filter(b =>
      b.name.toLowerCase().includes(query) ||
      b.description.toLowerCase().includes(query)
    );
    render(filtered);
  });

  // Modal controls
  addBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', saveCustom);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// Open modal
function openModal() {
  modal.classList.add('active');
  customNameEl.focus();
}

// Close modal
function closeModal() {
  modal.classList.remove('active');
  customNameEl.value = '';
  customDescEl.value = '';
  customCodeEl.value = '';
}

// Save custom bookmarklet
async function saveCustom() {
  const name = customNameEl.value.trim();
  const desc = customDescEl.value.trim();
  const code = customCodeEl.value.trim();

  if (!name || !code) {
    alert('Please enter a name and code');
    return;
  }

  const newBookmarklet = {
    id: 'custom-' + Date.now(),
    name,
    description: desc || 'Custom tool',
    category: 'custom',
    icon: '⚡',
    code
  };

  customBookmarklets.push(newBookmarklet);
  allBookmarklets = [...BOOKMARKLETS, ...customBookmarklets];
  await saveCustomBookmarklets();

  closeModal();
  render();
}

// Delete custom bookmarklet
async function deleteCustom(id) {
  customBookmarklets = customBookmarklets.filter(b => b.id !== id);
  allBookmarklets = [...BOOKMARKLETS, ...customBookmarklets];
  await saveCustomBookmarklets();
  render();
}

// Execute bookmarklet
async function execute(id) {
  const bookmarklet = allBookmarklets.find(b => b.id === id);
  if (!bookmarklet) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (code) => {
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();
      },
      args: [bookmarklet.code],
      world: 'MAIN'
    });

    window.close();
  } catch (e) {
    console.error('Failed to execute:', e);
    alert('Failed to execute: ' + e.message);
  }
}

// Render bookmarklets
function render(bookmarklets = allBookmarklets) {
  if (bookmarklets.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div>No tools found</div>
      </div>
    `;
    return;
  }

  // Group by category
  const grouped = {};
  bookmarklets.forEach(b => {
    const cat = b.category || 'custom';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(b);
  });

  // Sort categories
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const orderA = CATEGORY_CONFIG[a]?.order || 99;
    const orderB = CATEGORY_CONFIG[b]?.order || 99;
    return orderA - orderB;
  });

  let html = '';
  sortedCategories.forEach(cat => {
    const items = grouped[cat];
    const config = CATEGORY_CONFIG[cat] || { label: cat };

    html += `
      <div class="category">
        <div class="category-header">
          <span class="category-label">${config.label}</span>
          <div class="category-line"></div>
          <span class="category-count">${items.length}</span>
        </div>
        ${items.map(b => renderItem(b)).join('')}
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Attach click handlers
  listEl.querySelectorAll('.item').forEach(item => {
    const id = item.dataset.id;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-delete')) return;
      execute(id);
    });
  });

  // Attach delete handlers
  listEl.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustom(btn.dataset.id);
    });
  });
}

// Render single item
function renderItem(b) {
  const shortcutHtml = b.shortcut
    ? `<span class="item-shortcut">${b.shortcut}</span>`
    : '';

  const deleteHtml = b.category === 'custom'
    ? `<button class="item-delete" data-id="${b.id}">&times;</button>`
    : '';

  return `
    <div class="item" data-id="${b.id}">
      <div class="item-icon">${b.icon}</div>
      <div class="item-content">
        <div class="item-name">${escapeHtml(b.name)}</div>
        <div class="item-desc">${escapeHtml(b.description)}</div>
      </div>
      ${shortcutHtml}
      ${deleteHtml}
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
