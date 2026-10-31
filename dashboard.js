const API_BASE = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:8787"
  : "https://api.guardiantalk.com";
const TOKEN_KEY = "guardiantalk_parent_access_key";

const elements = {
  alert: document.querySelector("#dashboard-alert"),
  createPanel: document.querySelector("#create-panel"),
  familyForm: document.querySelector("#family-form"),
  recoveryPanel: document.querySelector("#recovery-panel"),
  recoveryKey: document.querySelector("#recovery-key"),
  copyRecovery: document.querySelector("#copy-recovery"),
  savedKey: document.querySelector("#saved-key"),
  continueDashboard: document.querySelector("#continue-dashboard"),
  dashboard: document.querySelector("#family-dashboard"),
  familyName: document.querySelector("#family-name"),
  pairCode: document.querySelector("#pair-code"),
  pairExpiry: document.querySelector("#pair-expiry"),
  pairCard: document.querySelector("#pair-card"),
  newPairing: document.querySelector("#new-pairing"),
  deviceGrid: document.querySelector("#device-grid"),
  emptyFamily: document.querySelector("#empty-family"),
  forgetKey: document.querySelector("#forget-key"),
};

let parentToken = localStorage.getItem(TOKEN_KEY);

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(parentToken ? { authorization: `Bearer ${parentToken}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "GuardianTalk could not complete that request.");
  return body;
}

function showAlert(message, kind = "error") {
  elements.alert.textContent = message;
  elements.alert.dataset.kind = kind;
  elements.alert.hidden = !message;
}

function setView(view) {
  elements.createPanel.hidden = view !== "create";
  elements.recoveryPanel.hidden = view !== "recovery";
  elements.dashboard.hidden = view !== "dashboard";
  elements.forgetKey.hidden = view === "create";
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderDashboard(data) {
  elements.familyName.textContent = data.household.familyName;
  elements.deviceGrid.replaceChildren();
  elements.emptyFamily.hidden = data.devices.length > 0;
  elements.deviceGrid.hidden = data.devices.length === 0;
  for (const device of data.devices) {
    const card = document.createElement("article");
    card.className = "device-card";
    const head = document.createElement("div");
    head.className = "device-card-head";
    const identity = document.createElement("div");
    identity.append(textElement("span", "device-platform", device.platform === "macos" ? "Mac" : "Windows PC"));
    identity.append(textElement("h3", "", device.name));
    head.append(identity, textElement("small", "device-seen", device.lastSeenAt ? `Updated ${new Date(device.lastSeenAt).toLocaleString()}` : "Waiting for first summary"));
    card.append(head);

    const summary = data.summaries.find((item) => item.deviceId === device.id);
    if (!summary) {
      card.append(textElement("p", "no-summary", "This computer is paired. Its first daily summary will appear after GuardianTalk syncs."));
    } else {
      const metrics = document.createElement("div");
      metrics.className = "device-metrics";
      const active = document.createElement("div");
      active.append(textElement("span", "", "Active time"), textElement("strong", "", formatDuration(summary.payload.totalSeconds)));
      const focus = document.createElement("div");
      focus.append(textElement("span", "", "Focus & creative"), textElement("strong", "", formatDuration(summary.payload.focusSeconds)));
      const date = document.createElement("div");
      date.append(textElement("span", "", "Report date"), textElement("strong", "", summary.day));
      metrics.append(active, focus, date);
      card.append(metrics);

      const columns = document.createElement("div");
      columns.className = "summary-columns";
      columns.append(renderList("Top applications", summary.payload.apps, "name"));
      columns.append(renderList("Top websites", summary.payload.sites, "domain"));
      card.append(columns);
    }
    elements.deviceGrid.append(card);
  }
}

function renderList(title, items, key) {
  const section = document.createElement("div");
  section.className = "summary-list";
  section.append(textElement("strong", "", title));
  const list = document.createElement("ul");
  for (const item of items.slice(0, 5)) {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.append(textElement("b", "", item[key]), textElement("small", "", item.category));
    row.append(label, textElement("em", "", formatDuration(item.seconds)));
    list.append(row);
  }
  if (!items.length) list.append(textElement("li", "muted-row", "No activity in this category"));
  section.append(list);
  return section;
}

async function loadDashboard() {
  if (!parentToken) return setView("create");
  try {
    const data = await api("/v1/dashboard");
    renderDashboard(data);
    setView("dashboard");
    showAlert("");
  } catch (error) {
    setView("create");
    showAlert(`${error.message} If this key was revoked or mistyped, forget it and create a new early-access dashboard.`);
    elements.forgetKey.hidden = false;
  }
}

elements.familyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = elements.familyForm.querySelector("button");
  button.disabled = true;
  showAlert("");
  try {
    const form = new FormData(elements.familyForm);
    const result = await api("/v1/households", {
      method: "POST",
      body: JSON.stringify({ familyName: form.get("familyName"), email: form.get("email") }),
    });
    parentToken = result.parentToken;
    localStorage.setItem(TOKEN_KEY, parentToken);
    elements.recoveryKey.textContent = parentToken;
    elements.pairCode.textContent = result.pairingCode;
    elements.pairExpiry.textContent = `Expires ${new Date(result.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    setView("recovery");
  } catch (error) {
    showAlert(error.message);
  } finally {
    button.disabled = false;
  }
});

elements.copyRecovery.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.recoveryKey.textContent);
  elements.copyRecovery.textContent = "Copied";
});
elements.savedKey.addEventListener("change", () => { elements.continueDashboard.disabled = !elements.savedKey.checked; });
elements.continueDashboard.addEventListener("click", loadDashboard);
elements.newPairing.addEventListener("click", async () => {
  elements.newPairing.disabled = true;
  try {
    const result = await api("/v1/pairings", { method: "POST", body: "{}" });
    elements.pairCode.textContent = result.pairingCode;
    elements.pairExpiry.textContent = `Expires ${new Date(result.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    elements.pairCard.classList.add("pair-active");
    showAlert("A new one-time pairing code is ready.", "success");
  } catch (error) {
    showAlert(error.message);
  } finally {
    elements.newPairing.disabled = false;
  }
});
elements.forgetKey.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  parentToken = null;
  location.reload();
});

loadDashboard();
