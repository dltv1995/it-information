// assets/js/session-timeout.js
// Auto logout after 30 minutes of inactivity
// Version: session-timeout-v1

import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 60 * 1000;       // show warning 1 minute before logout
const LAST_ACTIVITY_KEY = 'itOfficeLastActivityAt';
const LOGOUT_REASON_KEY = 'itOfficeLogoutReason';

let timeoutTimer = null;
let warningTimer = null;
let warningBox = null;

const activityEvents = [
  'click',
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'wheel'
];

initSessionTimeout();

function initSessionTimeout() {
  if (isLoginPage()) return;

  updateLastActivity();
  bindActivityEvents();
  setupCrossTabSync();
  scheduleTimers();
}

function bindActivityEvents() {
  activityEvents.forEach(eventName => {
    window.addEventListener(eventName, handleUserActivity, {
      passive: true,
      capture: true
    });
  });
}

function handleUserActivity() {
  updateLastActivity();
  hideWarningBox();
  scheduleTimers();
}

function updateLastActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

function getLastActivity() {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
}

function scheduleTimers() {
  clearTimers();

  const elapsed = Date.now() - getLastActivity();
  const remaining = SESSION_TIMEOUT_MS - elapsed;

  if (remaining <= 0) {
    logoutByTimeout();
    return;
  }

  const warningDelay = Math.max(remaining - WARNING_BEFORE_MS, 0);

  warningTimer = window.setTimeout(() => {
    showWarningBox();
  }, warningDelay);

  timeoutTimer = window.setTimeout(() => {
    logoutByTimeout();
  }, remaining);
}

function clearTimers() {
  if (timeoutTimer) window.clearTimeout(timeoutTimer);
  if (warningTimer) window.clearTimeout(warningTimer);
  timeoutTimer = null;
  warningTimer = null;
}

async function logoutByTimeout() {
  clearTimers();
  hideWarningBox();

  localStorage.setItem(LOGOUT_REASON_KEY, 'timeout');
  localStorage.removeItem('mockUser');
  localStorage.removeItem(LAST_ACTIVITY_KEY);

  try {
    if (auth?.currentUser) {
      await signOut(auth);
    }
  } catch (error) {
    console.warn('Auto logout signOut error:', error);
  } finally {
    window.location.href = 'login.html?reason=timeout';
  }
}

function showWarningBox() {
  if (warningBox) return;

  warningBox = document.createElement('div');
  warningBox.id = 'sessionTimeoutWarning';
  warningBox.style.cssText = `
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 9999;
    max-width: 360px;
    padding: 16px 18px;
    border-radius: 18px;
    color: #92400e;
    background: rgba(255, 251, 235, .96);
    border: 1px solid rgba(245, 158, 11, .45);
    box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
    font-family: inherit;
  `;

  warningBox.innerHTML = `
    <div style="font-weight:800; margin-bottom:4px;">ใกล้หมดเวลาใช้งาน</div>
    <div style="font-size:13px; line-height:1.5;">
      ระบบจะออกจากระบบอัตโนมัติ หากไม่มีการใช้งานต่อเนื่องครบ 30 นาที<br>
      ขยับเมาส์ คลิก หรือกดปุ่มใด ๆ เพื่อใช้งานต่อ
    </div>
  `;

  document.body.appendChild(warningBox);
}

function hideWarningBox() {
  if (warningBox) {
    warningBox.remove();
    warningBox = null;
  }
}

function setupCrossTabSync() {
  window.addEventListener('storage', event => {
    if (event.key === LAST_ACTIVITY_KEY) {
      hideWarningBox();
      scheduleTimers();
    }
  });
}

function isLoginPage() {
  return /login\.html$/i.test(window.location.pathname) || window.location.pathname.endsWith('/login');
}
