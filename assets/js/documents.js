import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

console.log('documents.js loaded: document-library-v3');

const API_URL = 'https://script.google.com/macros/s/AKfycbyPvAKHa1OYf7lAKYWMdZv7wrqtT80JVWODKci7vVlzgxVgBa8QaAqKDESHS6QMmNK6dw/exec';
const API_VERSION = 'meeting-drive-v33';
const UPLOAD_LIMIT = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const E = {};

let user = null;
let currentFolderId = '';
let crumbs = [{ id: '', name: 'จัดเก็บเอกสาร' }];
let items = [];
let queue = [];
let uploadWorkers = 0;
let viewMode = localStorage.getItem('document-library-view') || 'list';
let selectMode = false;
let selectedIds = new Set();
let contextItem = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}

function mount() {
  const page = document.getElementById('pageContent');
  const template = document.getElementById('documentsTemplate');
  if (!page || !template) return setTimeout(mount, 80);

  page.replaceChildren(template.content.cloneNode(true));
  [
    'breadcrumbs', 'docSearch', 'refreshDocsBtn', 'newFolderBtn', 'dropZone',
    'libraryFiles', 'chooseLibraryFilesBtn', 'uploadQueue', 'documentGrid',
    'itemCount', 'listViewBtn', 'gridViewBtn', 'viewLabel', 'selectModeBtn',
    'selectionBar', 'selectionCount', 'deleteSelectedBtn', 'clearSelectionBtn',
    'contextMenu', 'detailsModal', 'detailsBody', 'detailsIcon', 'closeDetailsBtn'
  ].forEach(id => E[id] = document.getElementById(id));

  bind();
  setView(viewMode);
  onAuthStateChanged(auth, account => {
    user = account;
    if (account) loadItems();
    else location.href = 'login.html';
  });
}

function bind() {
  E.chooseLibraryFilesBtn.onclick = () => E.libraryFiles.click();
  E.libraryFiles.onchange = event => {
    addFiles([...event.target.files]);
    event.target.value = '';
  };

  ['dragenter', 'dragover'].forEach(name => E.dropZone.addEventListener(name, event => {
    event.preventDefault();
    E.dropZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(name => E.dropZone.addEventListener(name, event => {
    event.preventDefault();
    E.dropZone.classList.remove('dragover');
  }));
  E.dropZone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));

  E.newFolderBtn.onclick = createFolder;
  E.refreshDocsBtn.onclick = loadItems;
  E.docSearch.oninput = renderItems;
  E.listViewBtn.onclick = () => setView('list');
  E.gridViewBtn.onclick = () => setView('grid');
  E.selectModeBtn.onclick = () => setSelectMode(!selectMode);
  E.clearSelectionBtn.onclick = clearSelection;
  E.deleteSelectedBtn.onclick = deleteSelected;
  E.closeDetailsBtn.onclick = closeDetails;
  E.detailsModal.onclick = event => {
    if (event.target === E.detailsModal) closeDetails();
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('#contextMenu')) hideContextMenu();
  });
  window.addEventListener('blur', hideContextMenu);
  window.addEventListener('scroll', hideContextMenu, true);

  E.contextMenu.querySelectorAll('[data-context-action]').forEach(button => {
    button.onclick = () => runContextAction(button.dataset.contextAction);
  });
}

async function api(payload) {
  if (!user) throw Error('กรุณาเข้าสู่ระบบ');
  const idToken = await user.getIdToken(true);
  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, idToken })
  });
  const data = await response.json();
  if (data.apiVersion !== API_VERSION) throw Error('Apps Script ยังไม่ใช่รุ่นที่รองรับ Document Library');
  if (!data.success) throw Error(data.message || 'ดำเนินการไม่สำเร็จ');
  return data;
}

async function loadItems() {
  E.documentGrid.innerHTML = '<div class="docs-empty">กำลังโหลด...</div>';
  try {
    const result = await api({ action: 'libraryListV1', folderId: currentFolderId });
    items = result.items || [];
    selectedIds = new Set([...selectedIds].filter(id => items.some(item => item.id === id)));
    renderCrumbs();
    renderItems();
    updateSelectionBar();
  } catch (error) {
    E.documentGrid.innerHTML = `<div class="docs-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderCrumbs() {
  E.breadcrumbs.innerHTML = crumbs.map((crumb, index) =>
    `${index ? '<i class="fa-solid fa-chevron-right"></i>' : ''}<button class="crumb" data-crumb="${index}">${escapeHtml(crumb.name)}</button>`
  ).join('');
  E.breadcrumbs.querySelectorAll('[data-crumb]').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.crumb);
      crumbs = crumbs.slice(0, index + 1);
      currentFolderId = crumbs[index].id;
      clearSelection();
      loadItems();
    };
  });
}

function renderItems() {
  const query = E.docSearch.value.trim().toLowerCase();
  const filtered = items.filter(item => item.name.toLowerCase().includes(query));
  E.itemCount.textContent = `${filtered.length} รายการ`;
  E.documentGrid.className = `document-grid ${viewMode}-view`;

  if (!filtered.length) {
    E.documentGrid.innerHTML = '<div class="docs-empty">ยังไม่มีไฟล์หรือโฟลเดอร์</div>';
    return;
  }

  E.documentGrid.innerHTML = filtered.map(item => {
    const selected = selectedIds.has(item.id);
    const icon = item.type === 'folder' ? 'fa-folder' : fileIcon(item.mimeType, item.name);
    return `<article class="doc-item ${selected ? 'selected' : ''}" data-id="${item.id}" data-type="${item.type}" draggable="true">
      <input class="doc-check ${selectMode || selected ? '' : 'hidden'}" type="checkbox" ${selected ? 'checked' : ''} aria-label="เลือก ${escapeHtml(item.name)}">
      <div class="doc-main">
        <i class="doc-icon fa-solid ${icon}"></i>
        <span class="doc-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      </div>
      <div class="doc-meta">${item.type === 'folder' ? 'โฟลเดอร์' : formatSize(item.size)}</div>
      <div class="doc-meta">${item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-'}</div>
      <button class="doc-menu" type="button" title="เมนู"><i class="fa-solid fa-ellipsis-vertical"></i></button>
    </article>`;
  }).join('');

  E.documentGrid.querySelectorAll('.doc-item').forEach(row => bindItem(row));
}

function bindItem(row) {
  const item = items.find(value => value.id === row.dataset.id);
  const checkbox = row.querySelector('.doc-check');
  const menu = row.querySelector('.doc-menu');

  checkbox.onclick = event => {
    event.stopPropagation();
    toggleSelection(item.id, checkbox.checked);
  };
  row.onclick = event => {
    if (event.target.closest('button,input')) return;
    if (selectMode || event.ctrlKey || event.metaKey) toggleSelection(item.id, !selectedIds.has(item.id));
    else if (item.type === 'folder') openFolder(item);
    else window.open(item.viewUrl, '_blank', 'noopener');
  };
  row.ondblclick = event => {
    if (event.target.closest('button,input')) return;
    if (item.type === 'folder') openFolder(item);
    else window.open(item.viewUrl, '_blank', 'noopener');
  };
  menu.onclick = event => {
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY, item);
  };
  row.oncontextmenu = event => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, item);
  };
  row.ondragstart = event => {
    if (!selectedIds.has(item.id)) {
      if (!event.ctrlKey && !event.metaKey) selectedIds.clear();
      selectedIds.add(item.id);
      renderItems();
      updateSelectionBar();
    }
    row.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-library-items', JSON.stringify([...selectedIds]));
  };
  row.ondragend = () => row.classList.remove('dragging');

  if (item.type === 'folder') {
    row.ondragover = event => {
      if (!event.dataTransfer.types.includes('application/x-library-items')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      row.classList.add('folder-drop');
    };
    row.ondragleave = () => row.classList.remove('folder-drop');
    row.ondrop = async event => {
      const raw = event.dataTransfer.getData('application/x-library-items');
      if (!raw) return;
      event.preventDefault();
      row.classList.remove('folder-drop');
      const ids = JSON.parse(raw).filter(id => id !== item.id);
      if (ids.length) await moveItems(ids, item.id, item.name);
    };
  }
}

function setView(mode) {
  viewMode = mode;
  localStorage.setItem('document-library-view', mode);
  E.listViewBtn.classList.toggle('active', mode === 'list');
  E.gridViewBtn.classList.toggle('active', mode === 'grid');
  E.viewLabel.innerHTML = mode === 'list' ? '<i class="fa-solid fa-list"></i> รายการ' : '<i class="fa-solid fa-grip"></i> ไอคอนใหญ่';
  if (E.documentGrid) renderItems();
}

function setSelectMode(enabled) {
  selectMode = enabled;
  E.selectModeBtn.classList.toggle('active', enabled);
  if (!enabled && !selectedIds.size) E.selectionBar.classList.add('hidden');
  renderItems();
  updateSelectionBar();
}

function toggleSelection(id, selected) {
  if (selected) selectedIds.add(id); else selectedIds.delete(id);
  renderItems();
  updateSelectionBar();
}

function clearSelection() {
  selectedIds.clear();
  selectMode = false;
  if (E.selectModeBtn) E.selectModeBtn.classList.remove('active');
  if (E.documentGrid) renderItems();
  updateSelectionBar();
}

function updateSelectionBar() {
  const count = selectedIds.size;
  E.selectionCount.textContent = `เลือกแล้ว ${count} รายการ`;
  E.selectionBar.classList.toggle('hidden', count === 0);
}

async function moveItems(ids, targetFolderId, targetName) {
  try {
    await api({ action: 'libraryMoveItemsV1', ids, targetFolderId });
    clearSelection();
    await loadItems();
    showToast(`ย้าย ${ids.length} รายการไปยัง “${targetName}” แล้ว`);
  } catch (error) {
    alert(error.message);
  }
}

async function createFolder() {
  const name = prompt('ชื่อโฟลเดอร์ใหม่');
  if (!name?.trim()) return;
  try {
    await api({ action: 'libraryCreateFolderV1', parentFolderId: currentFolderId, name: name.trim() });
    loadItems();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteSelected() {
  const chosen = items.filter(item => selectedIds.has(item.id));
  if (!chosen.length || !confirm(`ลบ ${chosen.length} รายการที่เลือกหรือไม่?`)) return;
  try {
    await api({ action: 'libraryDeleteItemsV1', items: chosen.map(item => ({ id: item.id, type: item.type })) });
    clearSelection();
    loadItems();
  } catch (error) {
    alert(error.message);
  }
}

async function removeItem(item) {
  if (!confirm(`ต้องการลบ${item.type === 'folder' ? 'โฟลเดอร์' : 'ไฟล์'} “${item.name}” หรือไม่?`)) return;
  try {
    await api({ action: item.type === 'folder' ? 'libraryDeleteFolderV1' : 'libraryDeleteFileV1', id: item.id });
    selectedIds.delete(item.id);
    loadItems();
  } catch (error) {
    alert(error.message);
  }
}

function openFolder(item) {
  currentFolderId = item.id;
  crumbs.push({ id: item.id, name: item.name });
  clearSelection();
  loadItems();
}

function showContextMenu(x, y, item) {
  contextItem = item;
  const openButton = E.contextMenu.querySelector('[data-context-action="open"]');
  openButton.innerHTML = item.type === 'folder' ? '<i class="fa-solid fa-folder-open"></i> เปิดโฟลเดอร์' : '<i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดไฟล์';
  E.contextMenu.classList.remove('hidden');
  const width = 210, height = 176;
  E.contextMenu.style.left = `${Math.min(x, innerWidth - width - 8)}px`;
  E.contextMenu.style.top = `${Math.min(y, innerHeight - height - 8)}px`;
}

function hideContextMenu() {
  E.contextMenu?.classList.add('hidden');
}

function runContextAction(action) {
  const item = contextItem;
  hideContextMenu();
  if (!item) return;
  if (action === 'open') item.type === 'folder' ? openFolder(item) : window.open(item.viewUrl, '_blank', 'noopener');
  if (action === 'details') showDetails(item);
  if (action === 'select') toggleSelection(item.id, true);
  if (action === 'delete') removeItem(item);
}

function showDetails(item) {
  E.detailsIcon.className = `fa-solid ${item.type === 'folder' ? 'fa-folder' : fileIcon(item.mimeType, item.name)}`;
  const rows = [
    ['ชื่อ', item.name],
    ['ประเภท', item.type === 'folder' ? 'โฟลเดอร์' : (item.mimeType || 'ไฟล์')],
    ['ขนาด', item.type === 'folder' ? '-' : formatSize(item.size)],
    ['แก้ไขล่าสุด', item.updatedAt ? new Date(item.updatedAt).toLocaleString('th-TH') : '-'],
    ['รหัส Google Drive', item.id]
  ];
  E.detailsBody.innerHTML = rows.map(([label, value]) => `<div class="detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  E.detailsModal.classList.remove('hidden');
}

function closeDetails() {
  E.detailsModal.classList.add('hidden');
}

function addFiles(fileList) {
  for (const file of fileList) {
    if (file.size > MAX_FILE_SIZE) {
      alert(`${file.name} เกิน 10 MB`);
      continue;
    }
    queue.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, file, status: 'queued', error: '' });
  }
  renderQueue();
  runQueue();
}

function runQueue() {
  while (uploadWorkers < UPLOAD_LIMIT) {
    const item = queue.find(value => value.status === 'queued');
    if (!item) break;
    uploadWorkers++;
    upload(item).finally(() => {
      uploadWorkers--;
      runQueue();
    });
  }
}

async function upload(item) {
  try {
    item.status = 'uploading';
    renderQueue();
    const file = await toBase64(item.file);
    await api({ action: 'libraryUploadV1', parentFolderId: currentFolderId, file });
    item.status = 'success';
    loadItems();
  } catch (error) {
    item.status = 'error';
    item.error = error.message;
  } finally {
    renderQueue();
  }
}

function renderQueue() {
  E.uploadQueue.innerHTML = queue.map((item, index) => `<div class="upload-row upload-${item.status}">
    <i class="fa-solid fa-file-arrow-up"></i>
    <div>
      <strong>${escapeHtml(item.file.name)}</strong>
      <small>${formatSize(item.file.size)}</small>
      <div class="upload-state">${item.status === 'queued' ? 'รอคิว' : item.status === 'uploading' ? 'กำลังอัปโหลด...' : item.status === 'success' ? 'อัปโหลดสำเร็จ' : `ผิดพลาด: ${escapeHtml(item.error)}`}</div>
      ${item.status === 'uploading' ? '<div class="upload-bar"><i></i></div>' : ''}
    </div>
    ${item.status === 'error' ? `<button class="secondary-btn" data-retry="${index}">ลองใหม่</button>` : ''}
    ${['success', 'error'].includes(item.status) ? `<button class="upload-close" data-close="${index}" title="ปิด"><i class="fa-solid fa-xmark"></i></button>` : ''}
  </div>`).join('');

  E.uploadQueue.querySelectorAll('[data-retry]').forEach(button => {
    button.onclick = () => {
      const item = queue[Number(button.dataset.retry)];
      item.status = 'queued';
      item.error = '';
      renderQueue();
      runQueue();
    };
  });
  E.uploadQueue.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => {
      queue.splice(Number(button.dataset.close), 1);
      renderQueue();
    };
  });
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      base64: String(reader.result).split(',')[1] || ''
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileIcon(mime = '', name = '') {
  const value = `${mime} ${name}`.toLowerCase();
  if (value.includes('pdf')) return 'fa-file-pdf';
  if (value.includes('spreadsheet') || /\.(xlsx?|csv)$/.test(value)) return 'fa-file-excel';
  if (value.includes('presentation') || /\.(pptx?)$/.test(value)) return 'fa-file-powerpoint';
  if (value.includes('word') || /\.(docx?)$/.test(value)) return 'fa-file-word';
  if (value.includes('image')) return 'fa-file-image';
  return 'fa-file';
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, { position: 'fixed', right: '22px', bottom: '22px', zIndex: 1200, background: '#0f172a', color: '#fff', padding: '11px 16px', borderRadius: '12px', boxShadow: '0 16px 40px rgba(15,23,42,.25)' });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}
