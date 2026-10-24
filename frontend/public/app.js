const statusEl = document.getElementById("status");
const statusTextEl = document.getElementById("status-text");
const servedByEl = document.getElementById("served-by");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("form");
const textEl = document.getElementById("text");
const authorEl = document.getElementById("author");
const countEl = document.getElementById("count");
const toastsEl = document.getElementById("toasts");

const ICONS = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  inbox:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.6 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.4A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.6z"/></svg>',
};

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#ef4444", "#14b8a6",
];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function initials(name) {
  const parts = String(name || "anon").trim().split(/\s+/);
  const a = parts[0] ? parts[0][0] : "a";
  const b = parts[1] ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

function colorFor(name) {
  let h = 0;
  const s = String(name || "anon");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function relativeTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return d.toLocaleDateString();
}

function toast(message, kind) {
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  el.innerHTML = (kind === "ok" ? ICONS.ok : kind === "err" ? ICONS.err : "") + "<span>" + escapeHtml(message) + "</span>";
  toastsEl.appendChild(el);
  setTimeout(function () {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(function () { el.remove(); }, 250);
  }, 2600);
}

function setStatus(online, pod) {
  statusTextEl.textContent = online ? "backend online" : "backend offline";
  statusEl.className = "badge " + (online ? "badge-on" : "badge-off");
  servedByEl.textContent = online && pod ? "served by " + pod : "";
}

function renderMessages(items) {
  if (!items.length) {
    messagesEl.innerHTML = '<div class="empty">' + ICONS.inbox + "<p>No messages yet. Be the first to sign!</p></div>";
    return;
  }
  messagesEl.innerHTML = items
    .map(function (m) {
      return (
        '<div class="message">' +
        '<div class="avatar" style="background:' + colorFor(m.author) + '">' + escapeHtml(initials(m.author)) + "</div>" +
        '<div class="message-body">' +
        '<div class="message-meta">' +
        '<span class="message-author">' + escapeHtml(m.author) + "</span>" +
        '<span class="message-time">' + relativeTime(m.created_at) + "</span>" +
        "</div>" +
        '<div class="message-text">' + escapeHtml(m.text) + "</div>" +
        "</div></div>"
      );
    })
    .join("");
}

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    setStatus(true, data.pod);
  } catch (err) {
    setStatus(false);
  }
}

let firstLoad = true;
async function loadMessages() {
  try {
    const res = await fetch("/api/messages");
    if (!res.ok) throw new Error("bad response");
    const items = await res.json();
    renderMessages(items);
    firstLoad = false;
  } catch (err) {
    if (firstLoad) {
      messagesEl.innerHTML = '<div class="empty">' + ICONS.err + "<p>Can't reach the backend yet.</p></div>";
    }
  }
}

textEl.addEventListener("input", function () {
  countEl.textContent = textEl.value.length + " / 280";
});

formEl.addEventListener("submit", async function (e) {
  e.preventDefault();
  const text = textEl.value.trim();
  const author = authorEl.value.trim();
  if (!text) {
    toast("Write a message first.", "err");
    return;
  }
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: author, text: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(function () { return {}; });
      throw new Error(data.error || "could not post");
    }
    textEl.value = "";
    countEl.textContent = "0 / 280";
    toast("Message posted!", "ok");
    loadMessages();
  } catch (err) {
    toast(err.message, "err");
  }
});

messagesEl.innerHTML =
  '<div class="skeleton"><div class="sk-avatar"></div><div class="sk-lines"><div class="sk-line" style="width:40%"></div><div class="sk-line" style="width:85%;margin-bottom:0"></div></div></div>';

loadHealth();
loadMessages();
setInterval(loadHealth, 5000);
setInterval(loadMessages, 5000);
