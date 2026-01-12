// ServiceNow Toolkit - Background Service Worker

const BOOKMARKLETS = {
  'copy-sys-id': {
    name: 'Copy sys_id',
    icon: '📋',
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
  'show-fields': {
    name: 'Show Fields',
    icon: '🏷️',
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
  'reveal-fields': {
    name: 'Reveal All Fields',
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
  'toggle-debug': {
    name: 'Toggle Debug',
    icon: '🐛',
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
  'quick-nav': {
    name: 'Quick Nav',
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
  'table-schema': {
    name: 'Table Schema',
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
};

// Shortcut mappings
const SHORTCUT_MAP = {
  'run-bookmarklet-1': 'copy-sys-id',
  'run-bookmarklet-2': 'show-fields',
  'run-bookmarklet-3': 'toggle-debug'
};

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: 'sn-toolkit',
    title: '⚡ ServiceNow Toolkit',
    contexts: ['page']
  });

  // Separator styling via title
  chrome.contextMenus.create({
    id: 'sn-clipboard',
    parentId: 'sn-toolkit',
    title: '── Clipboard ──',
    contexts: ['page'],
    enabled: false
  });

  chrome.contextMenus.create({
    id: 'menu-copy-sys-id',
    parentId: 'sn-toolkit',
    title: '📋 Copy sys_id',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'sn-debug',
    parentId: 'sn-toolkit',
    title: '── Debug ──',
    contexts: ['page'],
    enabled: false
  });

  chrome.contextMenus.create({
    id: 'menu-show-fields',
    parentId: 'sn-toolkit',
    title: '🏷️ Show Fields',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'menu-reveal-fields',
    parentId: 'sn-toolkit',
    title: '👁️ Reveal All Fields',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'menu-toggle-debug',
    parentId: 'sn-toolkit',
    title: '🐛 Toggle Debug',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'sn-nav',
    parentId: 'sn-toolkit',
    title: '── Navigation ──',
    contexts: ['page'],
    enabled: false
  });

  chrome.contextMenus.create({
    id: 'menu-quick-nav',
    parentId: 'sn-toolkit',
    title: '🔍 Quick Nav',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'menu-table-schema',
    parentId: 'sn-toolkit',
    title: '📊 Table Schema',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const menuId = info.menuItemId.toString();
  if (menuId.startsWith('menu-')) {
    const bookmarkletId = menuId.replace('menu-', '');
    await executeBookmarklet(bookmarkletId, tab.id);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const bookmarkletId = SHORTCUT_MAP[command];
  if (!bookmarkletId) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await executeBookmarklet(bookmarkletId, tab.id);
  }
});

// Execute a bookmarklet
async function executeBookmarklet(id, tabId) {
  // Check built-in bookmarklets
  let bookmarklet = BOOKMARKLETS[id];

  // Check custom bookmarklets
  if (!bookmarklet) {
    try {
      const result = await chrome.storage.local.get('customBookmarklets');
      const custom = result.customBookmarklets || [];
      const found = custom.find(b => b.id === id);
      if (found) bookmarklet = found;
    } catch (e) {
      console.error('Failed to load custom bookmarklets:', e);
    }
  }

  if (!bookmarklet) {
    console.error('Bookmarklet not found:', id);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (code) => {
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();
      },
      args: [bookmarklet.code],
      world: 'MAIN'
    });
  } catch (e) {
    console.error('Failed to execute bookmarklet:', e);
  }
}
