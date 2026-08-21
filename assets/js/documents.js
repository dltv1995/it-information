import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("documents.js loaded: document-explorer-v7");

const API_URL =
  "https://script.google.com/macros/s/AKfycbyPvAKHa1OYf7lAKYWMdZv7wrqtT80JVWODKci7vVlzgxVgBa8QaAqKDESHS6QMmNK6dw/exec";
const API_VERSION = "meeting-drive-v33";
const VIEW_LEVELS = ["details", "list", "small", "medium", "large"];
const LONG_PRESS_MS = 3000;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_WORKERS = 3;

const elements = {};

let currentUser = null;
let currentFolderId = "";
let breadcrumbs = [{ id: "", name: "จัดเก็บเอกสาร" }];
let items = [];
let selectedIds = new Set();
let uploadQueue = [];
let uploadWorkers = 0;
let selectionMode = false;
let contextItem = null;
let longPressTimer = null;
let pointerMoved = false;
let longPressActivated = false;
let automaticView =
  localStorage.getItem("document-explorer-auto-v6") !== "false";
let viewMode = localStorage.getItem("document-explorer-view-v6") || "details";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}

function mount() {
  const pageContent = document.getElementById("pageContent");
  const template = document.getElementById("documentsTemplate");

  if (!pageContent || !template) {
    window.setTimeout(mount, 80);
    return;
  }

  pageContent.replaceChildren(template.content.cloneNode(true));

  [
    "dropZone",
    "fileInput",
    "chooseFilesBtn",
    "uploadQueue",
    "newFolderBtn",
    "breadcrumbs",
    "docSearch",
    "selectModeBtn",
    "viewZoom",
    "autoViewBtn",
    "refreshBtn",
    "selectionBar",
    "selectionCount",
    "deleteSelectedBtn",
    "clearSelectionBtn",
    "itemCount",
    "viewName",
    "itemsArea",
    "contextMenu",
    "detailsModal",
    "detailIcon",
    "detailsBody",
    "closeDetailsBtn",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  bindPageEvents();
  applyView(viewMode);
  elements.autoViewBtn.classList.toggle("active", automaticView);

  const resizeObserver = new ResizeObserver(() => {
    if (automaticView) applyResponsiveView();
  });
  resizeObserver.observe(elements.itemsArea);

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      loadItems();
    } else {
      window.location.href = "login.html";
    }
  });
}

function bindPageEvents() {
  elements.chooseFilesBtn.addEventListener("click", () =>
    elements.fileInput.click(),
  );

  elements.fileInput.addEventListener("change", (event) => {
    addUploads([...event.target.files]);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragover");
    });
  });

  elements.dropZone.addEventListener("drop", (event) => {
    addUploads([...event.dataTransfer.files]);
  });

  elements.newFolderBtn.addEventListener("click", createFolder);
  elements.refreshBtn.addEventListener("click", loadItems);
  elements.docSearch.addEventListener("input", renderItems);

  elements.selectModeBtn.addEventListener("click", () => {
    selectionMode = !selectionMode;
    renderItems();
    updateSelectionBar();
  });

  elements.clearSelectionBtn.addEventListener("click", clearSelection);
  elements.deleteSelectedBtn.addEventListener("click", deleteSelectedItems);

  elements.viewZoom.addEventListener("input", () => {
    automaticView = false;
    localStorage.setItem("document-explorer-auto-v6", "false");
    elements.autoViewBtn.classList.remove("active");
    applyView(VIEW_LEVELS[Number(elements.viewZoom.value)] || "details");
  });

  elements.autoViewBtn.addEventListener("click", () => {
    automaticView = !automaticView;
    localStorage.setItem("document-explorer-auto-v6", String(automaticView));
    elements.autoViewBtn.classList.toggle("active", automaticView);
    if (automaticView) applyResponsiveView();
  });

  elements.closeDetailsBtn.addEventListener("click", closeDetails);
  elements.detailsModal.addEventListener("click", (event) => {
    if (event.target === elements.detailsModal) closeDetails();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#contextMenu")) hideContextMenu();
  });

  elements.contextMenu.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () =>
      runContextAction(button.dataset.action),
    );
  });
}

async function callApi(payload) {
  if (!currentUser) throw new Error("กรุณาเข้าสู่ระบบ");

  const idToken = await currentUser.getIdToken(true);
  const response = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, idToken }),
  });

  const result = await response.json();

  if (result.apiVersion !== API_VERSION) {
    throw new Error("Apps Script ยังไม่ใช่รุ่น Document Library ล่าสุด");
  }

  if (!result.success) {
    throw new Error(result.message || "ดำเนินการไม่สำเร็จ");
  }

  return result;
}

async function loadItems() {
  elements.itemsArea.innerHTML = '<div class="empty">กำลังโหลด...</div>';

  try {
    const result = await callApi({
      action: "libraryListV1",
      folderId: currentFolderId,
    });

    items = result.items || [];
    selectedIds = new Set(
      [...selectedIds].filter((id) => items.some((item) => item.id === id)),
    );

    renderBreadcrumbs();
    renderItems();
    updateSelectionBar();
  } catch (error) {
    elements.itemsArea.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderBreadcrumbs() {
  elements.breadcrumbs.innerHTML = breadcrumbs
    .map(
      (crumb, index) => `
        ${index ? '<i class="fa-solid fa-chevron-right"></i>' : ""}
        <button
          class="crumb"
          type="button"
          data-index="${index}"
          data-folder-id="${escapeHtml(crumb.id)}"
        >${escapeHtml(crumb.name)}</button>
      `,
    )
    .join("");

  elements.breadcrumbs.querySelectorAll(".crumb").forEach((button) => {
    button.addEventListener("click", () =>
      openBreadcrumb(Number(button.dataset.index)),
    );

    button.addEventListener("dragover", (event) => {
      if (!hasInternalDrag(event)) return;
      event.preventDefault();
      button.classList.add("folder-target");
    });

    button.addEventListener("dragleave", () => {
      button.classList.remove("folder-target");
    });

    button.addEventListener("drop", (event) => {
      const ids = readDraggedIds(event);
      button.classList.remove("folder-target");
      if (ids.length) {
        moveItems(ids, button.dataset.folderId, button.textContent.trim());
      }
    });
  });
}

function openBreadcrumb(index) {
  breadcrumbs = breadcrumbs.slice(0, index + 1);
  currentFolderId = breadcrumbs[index].id;
  clearSelection();
  loadItems();
}

function renderItems() {
  const searchQuery = (elements.docSearch.value || "").trim().toLowerCase();
  const visibleItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery),
  );

  elements.itemCount.textContent = `${visibleItems.length} รายการ`;
  elements.itemsArea.dataset.view = viewMode;

  if (!visibleItems.length) {
    elements.itemsArea.innerHTML =
      '<div class="empty">ยังไม่มีไฟล์หรือโฟลเดอร์</div>';
    return;
  }

  elements.itemsArea.innerHTML = visibleItems
    .map((item) => {
      const selected = selectedIds.has(item.id);
      const iconClass =
        item.type === "folder" ? "fa-folder" : getFileIcon(item);

      return `
        <article
          class="doc-entry ${selected ? "selected" : ""}"
          data-id="${escapeHtml(item.id)}"
          draggable="true"
        >
          <input
            class="doc-entry-check ${selectionMode || selected ? "" : "hidden"}"
            type="checkbox"
            ${selected ? "checked" : ""}
            aria-label="เลือก ${escapeHtml(item.name)}"
          >
          <div class="doc-entry-main">
            <i class="doc-entry-icon fa-solid ${iconClass}"></i>
            <span class="doc-entry-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          </div>
          <span class="doc-entry-meta">${item.type === "folder" ? "โฟลเดอร์" : formatSize(item.size)}</span>
          <span class="doc-entry-meta">${item.updatedAt ? new Date(item.updatedAt).toLocaleString("th-TH") : "-"}</span>
          <button class="doc-entry-menu" type="button" aria-label="เมนู ${escapeHtml(item.name)}">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </article>
      `;
    })
    .join("");

  elements.itemsArea.querySelectorAll(".doc-entry").forEach(bindItemEvents);
}

function bindItemEvents(itemElement) {
  const item = items.find((value) => value.id === itemElement.dataset.id);
  const checkbox = itemElement.querySelector(".doc-entry-check");
  const menuButton = itemElement.querySelector(".doc-entry-menu");

  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSelection(item.id, checkbox.checked);
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY, item);
  });

  itemElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, item);
  });

  itemElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button,input")) return;

    pointerMoved = false;
    longPressActivated = false;
    longPressTimer = window.setTimeout(() => {
      longPressActivated = true;
      selectionMode = true;
      selectedIds.add(item.id);
      renderItems();
      updateSelectionBar();
      navigator.vibrate?.(40);
    }, LONG_PRESS_MS);
  });

  itemElement.addEventListener("pointermove", () => {
    pointerMoved = true;
    window.clearTimeout(longPressTimer);
  });

  itemElement.addEventListener("pointerup", () =>
    window.clearTimeout(longPressTimer),
  );
  itemElement.addEventListener("pointercancel", () =>
    window.clearTimeout(longPressTimer),
  );

  itemElement.addEventListener("click", (event) => {
    if (event.target.closest("button,input") || pointerMoved) return;
    if (longPressActivated) {
      longPressActivated = false;
      return;
    }

    if (selectionMode || event.ctrlKey || event.metaKey) {
      toggleSelection(item.id, !selectedIds.has(item.id));
      return;
    }

    if (item.type === "folder") {
      openFolder(item);
    } else {
      window.open(item.viewUrl, "_blank", "noopener");
    }
  });

  itemElement.addEventListener("dragstart", (event) => {
    window.clearTimeout(longPressTimer);

    const draggedIds =
      selectionMode && selectedIds.has(item.id) ? [...selectedIds] : [item.id];

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-document-library-items",
      JSON.stringify(draggedIds),
    );
    itemElement.classList.add("dragging");
  });

  itemElement.addEventListener("dragend", () =>
    itemElement.classList.remove("dragging"),
  );

  if (item.type === "folder") {
    itemElement.addEventListener("dragover", (event) => {
      if (!hasInternalDrag(event)) return;
      event.preventDefault();
      itemElement.classList.add("folder-target");
    });

    itemElement.addEventListener("dragleave", () => {
      itemElement.classList.remove("folder-target");
    });

    itemElement.addEventListener("drop", (event) => {
      const ids = readDraggedIds(event).filter((id) => id !== item.id);
      itemElement.classList.remove("folder-target");
      if (ids.length) moveItems(ids, item.id, item.name);
    });
  }
}

function hasInternalDrag(event) {
  return [...event.dataTransfer.types].includes(
    "application/x-document-library-items",
  );
}

function readDraggedIds(event) {
  const raw = event.dataTransfer.getData(
    "application/x-document-library-items",
  );
  if (!raw) return [];
  event.preventDefault();

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function moveItems(ids, targetFolderId, targetName) {
  try {
    await callApi({
      action: "libraryMoveItemsV1",
      ids,
      targetFolderId,
    });

    clearSelection();
    await loadItems();
    showToast(`ย้าย ${ids.length} รายการไปยัง “${targetName}” แล้ว`);
  } catch (error) {
    window.alert(error.message);
  }
}

function openFolder(item) {
  currentFolderId = item.id;
  breadcrumbs.push({ id: item.id, name: item.name });
  clearSelection();
  loadItems();
}

function toggleSelection(id, enabled) {
  if (enabled) selectedIds.add(id);
  else selectedIds.delete(id);

  renderItems();
  updateSelectionBar();
}

function clearSelection() {
  selectedIds.clear();
  selectionMode = false;
  if (elements.itemsArea) renderItems();
  updateSelectionBar();
}

function updateSelectionBar() {
  const count = selectedIds.size;
  if (!elements.selectionBar) return;

  elements.selectionCount.textContent = `เลือกแล้ว ${count} รายการ`;
  elements.selectionBar.classList.toggle("hidden", count === 0);
  elements.selectModeBtn.classList.toggle("active", selectionMode);
}

async function deleteSelectedItems() {
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  if (!selectedItems.length) return;
  if (!window.confirm(`ลบ ${selectedItems.length} รายการหรือไม่?`)) return;

  try {
    await callApi({
      action: "libraryDeleteItemsV1",
      items: selectedItems.map((item) => ({ id: item.id, type: item.type })),
    });

    clearSelection();
    loadItems();
  } catch (error) {
    window.alert(error.message);
  }
}

async function createFolder() {
  const name = window.prompt("ชื่อโฟลเดอร์ใหม่");
  if (!name?.trim()) return;

  try {
    await callApi({
      action: "libraryCreateFolderV1",
      parentFolderId: currentFolderId,
      name: name.trim(),
    });
    loadItems();
  } catch (error) {
    window.alert(error.message);
  }
}

function showContextMenu(x, y, item) {
  contextItem = item;
  elements.contextMenu.classList.remove("hidden");
  elements.contextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  elements.contextMenu.style.top = `${Math.min(y, window.innerHeight - 185)}px`;
}

function hideContextMenu() {
  elements.contextMenu?.classList.add("hidden");
}

function runContextAction(action) {
  const item = contextItem;
  hideContextMenu();
  if (!item) return;

  if (action === "open") {
    item.type === "folder"
      ? openFolder(item)
      : window.open(item.viewUrl, "_blank", "noopener");
  }
  if (action === "select") {
    selectionMode = true;
    toggleSelection(item.id, true);
  }
  if (action === "details") showDetails(item);
  if (action === "delete") deleteSingleItem(item);
}

function showDetails(item) {
  elements.detailIcon.className = `fa-solid ${item.type === "folder" ? "fa-folder" : getFileIcon(item)}`;

  const rows = [
    ["ชื่อ", item.name],
    ["ประเภท", item.type === "folder" ? "โฟลเดอร์" : item.mimeType || "ไฟล์"],
    ["ขนาด", item.type === "folder" ? "-" : formatSize(item.size)],
    [
      "แก้ไขล่าสุด",
      item.updatedAt ? new Date(item.updatedAt).toLocaleString("th-TH") : "-",
    ],
    ["Google Drive ID", item.id],
  ];

  elements.detailsBody.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="detail">
          <span>${label}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");

  elements.detailsModal.classList.remove("hidden");
}

function closeDetails() {
  elements.detailsModal.classList.add("hidden");
}

async function deleteSingleItem(item) {
  if (!window.confirm(`ลบ “${item.name}” หรือไม่?`)) return;

  try {
    await callApi({
      action:
        item.type === "folder"
          ? "libraryDeleteFolderV1"
          : "libraryDeleteFileV1",
      id: item.id,
    });
    loadItems();
  } catch (error) {
    window.alert(error.message);
  }
}

function applyView(nextView) {
  viewMode = VIEW_LEVELS.includes(nextView) ? nextView : "details";
  localStorage.setItem("document-explorer-view-v6", viewMode);

  if (elements.viewZoom) {
    elements.viewZoom.value = String(VIEW_LEVELS.indexOf(viewMode));
  }

  const labels = {
    details: "รายละเอียด",
    list: "รายการ",
    small: "ไอคอนเล็ก",
    medium: "ไอคอนกลาง",
    large: "ไอคอนใหญ่",
  };

  if (elements.viewName) elements.viewName.textContent = labels[viewMode];
  if (elements.itemsArea) {
    elements.itemsArea.dataset.view = viewMode;
    renderItems();
  }
}

function applyResponsiveView() {
  const width = elements.itemsArea.getBoundingClientRect().width;
  if (width >= 1100) applyView("details");
  else if (width >= 820) applyView("list");
  else if (width >= 610) applyView("small");
  else if (width >= 400) applyView("medium");
  else applyView("large");
}

function addUploads(files) {
  files.forEach((file) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      window.alert(`${file.name} เกิน 10 MB`);
      return;
    }
    uploadQueue.push({ file, status: "queued", error: "" });
  });

  renderUploads();
  runUploads();
}

function runUploads() {
  while (uploadWorkers < MAX_UPLOAD_WORKERS) {
    const item = uploadQueue.find((value) => value.status === "queued");
    if (!item) break;

    uploadWorkers += 1;
    uploadFile(item).finally(() => {
      uploadWorkers -= 1;
      runUploads();
    });
  }
}

async function uploadFile(item) {
  try {
    item.status = "uploading";
    renderUploads();
    const file = await fileToBase64(item.file);

    await callApi({
      action: "libraryUploadV1",
      parentFolderId: currentFolderId,
      file,
    });

    item.status = "success";
    loadItems();
  } catch (error) {
    item.status = "error";
    item.error = error.message;
  } finally {
    renderUploads();
  }
}

function renderUploads() {
  elements.uploadQueue.innerHTML = uploadQueue
    .map(
      (item, index) => `
        <div class="upload-item upload-${item.status}">
          <i class="fa-solid fa-file-arrow-up"></i>
          <div>
            <strong>${escapeHtml(item.file.name)}</strong>
            <small>${formatSize(item.file.size)}</small>
            <span class="upload-state">
              ${item.status === "queued" ? "รอคิว" : ""}
              ${item.status === "uploading" ? "กำลังอัปโหลด..." : ""}
              ${item.status === "success" ? "อัปโหลดสำเร็จ" : ""}
              ${item.status === "error" ? `ผิดพลาด: ${escapeHtml(item.error)}` : ""}
            </span>
            ${item.status === "uploading" ? '<div class="upload-progress"><i></i></div>' : ""}
          </div>
          ${item.status === "error" ? `<button class="btn" data-retry="${index}">ลองใหม่</button>` : ""}
          ${["success", "error"].includes(item.status) ? `<button class="upload-close" data-close="${index}" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>` : ""}
        </div>
      `,
    )
    .join("");

  elements.uploadQueue.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      uploadQueue[Number(button.dataset.retry)].status = "queued";
      renderUploads();
      runUploads();
    });
  });

  elements.uploadQueue.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      uploadQueue.splice(Number(button.dataset.close), 1);
      renderUploads();
    });
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        base64: String(reader.result).split(",")[1] || "",
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFileIcon(item) {
  const value = `${item.mimeType || ""} ${item.name}`.toLowerCase();
  if (value.includes("pdf")) return "fa-file-pdf";
  if (/xlsx?|csv|spreadsheet/.test(value)) return "fa-file-excel";
  if (/docx?|word/.test(value)) return "fa-file-word";
  if (/pptx?|presentation/.test(value)) return "fa-file-powerpoint";
  if (value.includes("image")) return "fa-file-image";
  return "fa-file";
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "app-toast";
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2200);
}
