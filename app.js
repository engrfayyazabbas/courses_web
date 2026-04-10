/* ═══════════════════════════════════════════════════════════════════════
   Course Library — app.js
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const DATA_URL      = 'data.json';
const STORAGE_KEY   = 'courselib_progress';
const LAST_PATH_KEY = 'courselib_last_path';
const SIDEBAR_KEY   = 'courselib_sidebar';
const PINS_KEY      = 'courselib_pins';

// ── State ────────────────────────────────────────────────────────────────────
let TREE        = null;
let TOTAL_FILES = 0;
let allFiles    = [];
let nodeMap     = {};
let currentNode = null;
let progress    = {};
let pins        = new Set();

// ── Boot ─────────────────────────────────────────────────────────────────────
(async function boot() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    TREE        = data.tree;
    TOTAL_FILES = data.total_files;

    document.title = `📚 ${data.root_name} — Course Library`;
    document.querySelector('.logo').innerHTML =
      `📚 ${escHtml(data.root_name)}<span>Lib</span>`;
    document.getElementById('totalFiles').textContent   = data.total_files;
    document.getElementById('totalFolders').textContent = data.total_folders;
    if (data.scanned_at) {
      document.getElementById('scanDate').textContent = `🕐 scanned ${data.scanned_at}`;
    }

    progress = loadProgress();
    pins     = loadPins();

    buildNodeMap(TREE);
    indexFiles(TREE, []);
    buildSidebar();

    document.getElementById('loading-msg').remove();

    const sidebarClosed = localStorage.getItem(SIDEBAR_KEY) === 'closed';
    if (sidebarClosed) document.getElementById('layout').classList.add('sidebar-hidden');

    const lastPath = localStorage.getItem(LAST_PATH_KEY);
    const lastNode = lastPath ? nodeMap[lastPath] : null;
    if (lastNode && lastNode.path !== TREE.path) {
      document.getElementById('resumeFolderName').textContent = lastNode.name;
      document.getElementById('resumeBanner').style.display = 'flex';
    }

    showNode(TREE);
    refreshAllProgress();

  } catch (err) {
    showLoadError(err);
  }
})();

// ── Progress storage ──────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function isCompleted(fileId) { return !!progress[fileId]; }

function toggleComplete(fileId, fileName) {
  if (progress[fileId]) {
    delete progress[fileId];
    showToast('↩ Marked incomplete: ' + fileName);
  } else {
    progress[fileId] = Date.now();
    showToast('✅ Completed: ' + fileName);
  }
  saveProgress();
  refreshAllProgress();
  const btn = document.querySelector(`[data-fid="${fileId}"]`);
  if (btn) renderBtn(btn, fileId);
  const row = document.querySelector(`tr[data-row="${fileId}"]`);
  if (row) row.classList.toggle('completed', isCompleted(fileId));
}

function renderBtn(btn, fileId) {
  if (isCompleted(fileId)) {
    btn.className   = 'btn-complete done';
    btn.innerHTML   = '<span>✅ Completed</span>';
  } else {
    btn.className   = 'btn-complete undone';
    btn.textContent = '○ Mark Done';
  }
}

// ── Pins storage ──────────────────────────────────────────────────────────────
function loadPins() {
  try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]')); }
  catch { return new Set(); }
}
function savePins() {
  localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
}
function isPinned(path) { return pins.has(path); }

function togglePin(path, name) {
  if (pins.has(path)) {
    pins.delete(path);
    showToast('📍 Unpinned: ' + name);
  } else {
    pins.add(path);
    showToast('📌 Pinned: ' + name);
  }
  savePins();
  renderPinnedSection();

  // Refresh all pin buttons that match this path
  document.querySelectorAll('[data-pin-path]').forEach(btn => {
    if (btn.dataset.pinPath === path) {
      const p         = isPinned(path);
      btn.classList.toggle('pinned', p);
      btn.title       = p ? 'Unpin folder' : 'Pin folder';
      btn.textContent = p ? '📌' : '📍';
    }
  });
}

// ── Node helpers ──────────────────────────────────────────────────────────────
function buildNodeMap(node) {
  nodeMap[node.path] = node;
  for (const c of node.children) buildNodeMap(c);
}
function getNodeByPath(path) { return nodeMap[path] || TREE; }

function countNode(node) {
  let total = node.files.length, done = 0;
  for (const f of node.files) if (isCompleted(f.id)) done++;
  for (const c of node.children) {
    const r = countNode(c);
    total += r.total;
    done  += r.done;
  }
  return { total, done };
}

// ── Flat file index ───────────────────────────────────────────────────────────
function indexFiles(node, pathParts) {
  const parts = [...pathParts, node.name];
  for (const f of node.files) allFiles.push({ ...f, folderPath: parts.join(' / ') });
  for (const c of node.children) indexFiles(c, parts);
}

// ── Refresh all progress indicators ──────────────────────────────────────────
function refreshAllProgress() {
  const { total, done } = countNode(TREE);
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('overallFill').style.width    = pct + '%';
  document.getElementById('overallPct').textContent     = pct + '%';
  document.getElementById('completedCount').textContent = done;

  document.querySelectorAll('[data-folder-path]').forEach(card => {
    const node = nodeMap[card.dataset.folderPath];
    if (!node) return;
    const r = countNode(node);
    const p = r.total ? Math.round(r.done / r.total * 100) : 0;
    const fill = card.querySelector('.fc-prog-fill');
    const lbl  = card.querySelector('.fc-prog-pct');
    const cnt  = card.querySelector('.fc-prog-cnt');
    if (fill) fill.style.width = p + '%';
    if (lbl)  lbl.textContent  = p + '%';
    if (cnt)  cnt.textContent  = `${r.done}/${r.total}`;
  });

  if (currentNode) {
    const r = countNode(currentNode);
    const p = r.total ? Math.round(r.done / r.total * 100) : 0;
    const fpFill = document.getElementById('fp-fill');
    const fpPct  = document.getElementById('fp-pct');
    const fpDone = document.getElementById('fp-done');
    const fpTot  = document.getElementById('fp-tot');
    const fpRing = document.getElementById('fp-ring-fill');
    if (fpFill) fpFill.style.width       = p + '%';
    if (fpPct)  fpPct.textContent        = p + '%';
    if (fpDone) fpDone.textContent       = r.done;
    if (fpTot)  fpTot.textContent        = r.total;
    if (fpRing) {
      const circ = 2 * Math.PI * 28;
      fpRing.style.strokeDasharray  = circ;
      fpRing.style.strokeDashoffset = circ * (1 - p / 100);
    }
  }

  document.querySelectorAll('[data-mini-path]').forEach(el => {
    const node = nodeMap[el.dataset.miniPath];
    if (!node) return;
    const r = countNode(node);
    el.style.width = (r.total ? Math.round(r.done / r.total * 100) : 0) + '%';
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  // Pinned section container
  const pinnedSection = document.createElement('div');
  pinnedSection.id = 'pinned-section';
  sidebar.appendChild(pinnedSection);
  renderPinnedSection();

  // Divider
  const divider = document.createElement('div');
  divider.className = 'sidebar-divider';
  sidebar.appendChild(divider);

  // Browse label
  const browseLabel = document.createElement('div');
  browseLabel.className = 'sidebar-section-label';
  browseLabel.textContent = '📁 All Folders';
  sidebar.appendChild(browseLabel);

  // Root item
  const rootItem = document.createElement('div');
  rootItem.className = 'tree-item active open';
  rootItem.style.paddingLeft = '14px';
  rootItem.innerHTML = `
    <span class="arrow">▶</span>
    <span>🏠</span>
    <span class="label" style="font-weight:500;color:var(--accent)">${escHtml(TREE.name)}</span>`;

  const rootChildren = document.createElement('div');
  rootChildren.className = 'tree-children open';

  rootItem.addEventListener('click', () => {
    setActiveSidebarItem(rootItem);
    showNode(TREE);
    clearSearch();
  });

  sidebar.appendChild(rootItem);
  sidebar.appendChild(rootChildren);

  for (const child of TREE.children) {
    buildTreeItem(child, rootChildren, 1);
  }
}

function renderPinnedSection() {
  const section = document.getElementById('pinned-section');
  if (!section) return;
  section.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'sidebar-section-label';
  header.innerHTML = pins.size > 0
    ? `📌 Pinned <span class="badge">${pins.size}</span>`
    : `📌 Pinned`;
  section.appendChild(header);

  if (pins.size === 0) {
    const hint = document.createElement('div');
    hint.className = 'pinned-empty';
    hint.textContent = 'Click 📍 on any folder to pin it here';
    section.appendChild(hint);
    return;
  }

  for (const path of pins) {
    const node = nodeMap[path];
    if (!node) continue;
    const item = document.createElement('div');
    item.className = 'tree-item pinned-item';
    item.style.paddingLeft = '14px';
    item.innerHTML = `
      <span style="font-size:0.8rem;flex-shrink:0">📌</span>
      <span class="label" title="${escHtml(node.name)}">${escHtml(node.name)}</span>
      <button class="unpin-btn" title="Unpin"
        onclick="event.stopPropagation();togglePin('${escAttr(path)}','${escAttr(node.name)}')">✕</button>`;
    item.addEventListener('click', () => navigateToFolder(path));
    section.appendChild(item);
  }
}

function buildTreeItem(node, container, depth) {
  const item = document.createElement('div');
  item.className = 'tree-item';
  item.style.paddingLeft = (14 + depth * 13) + 'px';
  item.dataset.nodeId = node.path;

  const pinned = isPinned(node.path);
  item.innerHTML = `
    <span class="arrow">▶</span>
    <span>📁</span>
    <span class="label" title="${escHtml(node.name)}">${escHtml(node.name)}</span>
    <button class="pin-btn${pinned ? ' pinned' : ''}"
      data-pin-path="${escAttr(node.path)}"
      title="${pinned ? 'Unpin folder' : 'Pin folder'}"
      onclick="event.stopPropagation();togglePin('${escAttr(node.path)}','${escAttr(node.name)}')"
    >${pinned ? '📌' : '📍'}</button>
    <div class="tree-mini-bar">
      <div class="tree-mini-fill" data-mini-path="${escAttr(node.path)}" style="width:0%"></div>
    </div>`;

  const childWrap = document.createElement('div');
  childWrap.className = 'tree-children';

  item.addEventListener('click', e => {
    e.stopPropagation();
    const open = childWrap.classList.toggle('open');
    item.classList.toggle('open', open);
    setActiveSidebarItem(item);
    showNode(node);
    clearSearch();
  });

  container.appendChild(item);
  container.appendChild(childWrap);

  for (const child of node.children) {
    buildTreeItem(child, childWrap, depth + 1);
  }
}

function setActiveSidebarItem(el) {
  document.querySelectorAll('.tree-item.active').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function buildBreadcrumb(node) {
  function findPath(n, target, acc) {
    acc = [...acc, n];
    if (n.path === target.path) return acc;
    for (const c of n.children) {
      const r = findPath(c, target, acc);
      if (r) return r;
    }
    return null;
  }
  const chain = findPath(TREE, node, []) || [TREE];
  return chain.map((n, i) => {
    if (i === chain.length - 1)
      return `<span style="color:var(--text)">${escHtml(n.name)}</span>`;
    return `<span onclick="navigateToFolder('${escAttr(n.path)}')">${escHtml(n.name)}</span>`;
  }).join('<span class="sep"> / </span>');
}

// ── Show node ─────────────────────────────────────────────────────────────────
function showNode(node) {
  currentNode = node;
  localStorage.setItem(LAST_PATH_KEY, node.path);
  const view   = document.getElementById('normal-view');
  const r      = countNode(node);
  const pct    = r.total ? Math.round(r.done / r.total * 100) : 0;
  const circ   = 2 * Math.PI * 28;
  const offset = circ * (1 - pct / 100);

  let html = `<div class="breadcrumb">${buildBreadcrumb(node)}</div>`;

  html += `
  <div class="folder-progress-block">
    <div class="fp-ring">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle class="ring-bg"   cx="34" cy="34" r="28"/>
        <circle class="ring-fill" id="fp-ring-fill" cx="34" cy="34" r="28"
          style="stroke-dasharray:${circ};stroke-dashoffset:${offset}"/>
      </svg>
      <div class="ring-text" id="fp-pct">${pct}%</div>
    </div>
    <div class="fp-info">
      <h2>${escHtml(node.name)}</h2>
      <div class="fp-bar-track">
        <div class="fp-bar-fill" id="fp-fill" style="width:${pct}%"></div>
      </div>
      <div class="fp-counts">
        <b id="fp-done">${r.done}</b> of <b id="fp-tot">${r.total}</b> files completed
      </div>
    </div>
  </div>`;

  if (node.children.length > 0) {
    html += `<div class="section-title">Folders <span class="badge">${node.children.length}</span></div>`;
    html += '<div class="folders-grid">';
    for (const c of node.children) {
      const cr     = countNode(c);
      const cp     = cr.total ? Math.round(cr.done / cr.total * 100) : 0;
      const pinned = isPinned(c.path);
      html += `
        <div class="folder-card" data-folder-path="${escAttr(c.path)}"
             onclick="navigateToFolder('${escAttr(c.path)}')">
          <div class="fc-top-row">
            <div class="fi">📁</div>
            <button class="card-pin-btn${pinned ? ' pinned' : ''}"
              data-pin-path="${escAttr(c.path)}"
              title="${pinned ? 'Unpin folder' : 'Pin folder'}"
              onclick="event.stopPropagation();togglePin('${escAttr(c.path)}','${escAttr(c.name)}')"
            >${pinned ? '📌' : '📍'}</button>
          </div>
          <div class="fn">${escHtml(c.name)}</div>
          <div class="fm">
            ${c.files.length} file${c.files.length !== 1 ? 's' : ''} ·
            ${c.children.length} subfolder${c.children.length !== 1 ? 's' : ''}
          </div>
          <div class="fc-prog-label">
            <span><b class="fc-prog-cnt">${cr.done}/${cr.total}</b> done</span>
            <span class="fc-prog-pct">${cp}%</span>
          </div>
          <div class="fc-prog-track">
            <div class="fc-prog-fill" style="width:${cp}%"></div>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  if (node.files.length > 0) {
    html += `<div class="section-title">Files <span class="badge">${node.files.length}</span></div>`;
    html += `
      <table class="files-table">
        <thead>
          <tr>
            <th style="width:50%">Name</th><th>Type</th>
            <th>Size</th><th>Modified</th><th>Progress</th>
          </tr>
        </thead>
        <tbody>${node.files.map(f => fileRow(f, false)).join('')}</tbody>
      </table>`;
  }

  if (node.children.length === 0 && node.files.length === 0) {
    html += `<div class="empty"><div class="ei">📭</div><p>This folder is empty.</p></div>`;
  }

  view.innerHTML = html;
}

// ── Navigate to a folder ──────────────────────────────────────────────────────
function navigateToFolder(path) {
  const node = getNodeByPath(path);
  if (!node) return;
  showNode(node);
  clearSearch();
  document.querySelectorAll('.tree-item.active').forEach(i => i.classList.remove('active'));
  const el = document.querySelector(`[data-node-id="${CSS.escape(path)}"]`);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── File row HTML ─────────────────────────────────────────────────────────────
function fileRow(f, showPath) {
  const done     = isCompleted(f.id);
  const btnLabel = done ? '<span>✅ Completed</span>' : '○ Mark Done';
  const btnClass = done ? 'btn-complete done' : 'btn-complete undone';
  const rowClass = done ? 'completed' : '';
  const pathHtml = showPath
    ? `<div class="search-result-path">${escHtml(f.folderPath || '')}</div>` : '';
  const dateCell = showPath ? '' : `<td class="date-cell">${f.modified}</td>`;

  return `
    <tr class="${rowClass}" data-row="${escAttr(f.id)}">
      <td>
        <div class="file-name-cell">
          <span class="file-icon">${f.icon}</span>
          <div>
            <a class="file-link" href="/${f.url}" target="_blank"
               title="${escHtml(f.name)}">${escHtml(f.name)}</a>
            ${pathHtml}
          </div>
        </div>
      </td>
      <td><span class="type-badge tb-${f.type}">${f.type}</span></td>
      <td class="size-cell">${f.size}</td>
      ${dateCell}
      <td>
        <button class="${btnClass}" data-fid="${escAttr(f.id)}"
          onclick="toggleComplete('${escAttr(f.id)}','${escAttr(f.name)}')">
          ${btnLabel}
        </button>
      </td>
    </tr>`;
}

// ── Search ────────────────────────────────────────────────────────────────────
let searchTimer;
function handleSearch(q) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(q.trim()), 180);
}

function doSearch(q) {
  if (!q) { showNormalView(); return; }
  document.getElementById('normal-view').style.display = 'none';
  document.getElementById('search-view').style.display = 'block';

  const lower   = q.toLowerCase();
  const results = allFiles.filter(f => f.name.toLowerCase().includes(lower));
  const tbody   = document.getElementById('search-tbody');
  const empty   = document.getElementById('search-empty');
  const table   = document.getElementById('search-table');

  document.getElementById('sr-count').textContent =
    `${results.length} file${results.length !== 1 ? 's' : ''}`;

  if (results.length === 0) {
    tbody.innerHTML     = '';
    empty.style.display = 'block';
    table.style.display = 'none';
  } else {
    empty.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML     = results.slice(0, 300).map(f => fileRow(f, true)).join('');
  }
}

function showNormalView() {
  document.getElementById('normal-view').style.display = 'block';
  document.getElementById('search-view').style.display = 'none';
}
function clearSearch() {
  document.getElementById('searchInput').value = '';
  showNormalView();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Error display ─────────────────────────────────────────────────────────────
function showLoadError(err) {
  document.getElementById('normal-view').innerHTML = `
    <div class="error-box">
      <h3>⚠️ Could not load course data</h3>
      <p>Make sure you have run the scanner first:</p><br/>
      <code>python scanner.py /path/to/your/courses</code><br/><br/>
      <p>Then serve this folder with a local web server:</p><br/>
      <code>python -m http.server 8080</code><br/><br/>
      <p style="opacity:.6;font-size:.75rem">Error: ${escHtml(String(err))}</p>
    </div>`;
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
  const layout = document.getElementById('layout');
  const hidden = layout.classList.toggle('sidebar-hidden');
  localStorage.setItem(SIDEBAR_KEY, hidden ? 'closed' : 'open');
}

// ── Resume last folder ────────────────────────────────────────────────────────
function resumeLastFolder() {
  const lastPath = localStorage.getItem(LAST_PATH_KEY);
  const lastNode = lastPath ? nodeMap[lastPath] : null;
  if (!lastNode) return;
  showNode(lastNode);
  clearSearch();
  dismissResume();
  document.querySelectorAll('.tree-item.active').forEach(i => i.classList.remove('active'));
  const el = document.querySelector(`[data-node-id="${CSS.escape(lastNode.path)}"]`);
  if (el) {
    el.classList.add('active');
    let parent = el.parentElement;
    while (parent && parent.id !== 'sidebar') {
      if (parent.classList.contains('tree-children')) parent.classList.add('open');
      const prev = parent.previousElementSibling;
      if (prev && prev.classList.contains('tree-item')) prev.classList.add('open');
      parent = parent.parentElement;
    }
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

function dismissResume() {
  document.getElementById('resumeBanner').style.display = 'none';
}

// ── Escape helpers ────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s) {
  return String(s)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}
