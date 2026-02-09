// =====================
// CONFIG
// =====================

// 👇 Pega aquí tu endpoint real de MockAPI.
// Ejemplo típico: https://698a177bc04d974bc6a15363.mockapi.io/api/v1/dispositivos_IoT
const API_URL = "https://698a177bc04d974bc6a15362.mockapi.io/api/v1/dispositivos_IoT";

// Direcciones permitidas
const DIRECCIONES = {
  1: "Adelante",
  2: "Detener",
  3: "Atrás",
  4: "Vuelta derecha adelante",
  5: "Vuelta izquierda adelante",
  6: "Vuelta derecha atrás",
  7: "Vuelta izquierda atrás",
  8: "Giro 90° derecha",
  9: "Giro 90° izquierda",
};

// =====================
// HELPERS
// =====================

const $ = (sel) => document.querySelector(sel);

function nowLocalDatetimeValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toIsoFromDatetimeLocal(value) {
  // value: "YYYY-MM-DDTHH:MM" (hora local)
  // lo convertimos a Date local y mandamos ISO
  const d = new Date(value);
  return d.toISOString();
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function showAlert(type, msg) {
  $("#alertBox").innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show mt-3" role="alert">
      ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    </div>
  `;
}

function showToast(msg) {
  $("#toastBody").textContent = msg;
  $("#toastTime").textContent = new Date().toLocaleTimeString();
  const toast = bootstrap.Toast.getOrCreateInstance($("#toast"), { delay: 2500 });
  toast.show();
}

function setLoading(isLoading) {
  $("#loading").classList.toggle("d-none", !isLoading);
}

function setEmptyState(show) {
  $("#emptyState").classList.toggle("d-none", !show);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  // Intentar leer error del servidor
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.message ? ` (${data.message})` : "";
    } catch (_) {}
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail}`);
  }

  // 204 no content
  if (res.status === 204) return null;
  return res.json();
}

// =====================
// STATE
// =====================

let allItems = [];
let filteredItems = [];
let modal;

// =====================
// UI: SELECT DIRECCIONES
// =====================

function fillDireccionSelect() {
  const sel = $("#direccionCode");
  sel.innerHTML = `<option value="" disabled selected>Selecciona una opción…</option>`;

  for (const [code, texto] of Object.entries(DIRECCIONES)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${code} - ${texto}`;
    sel.appendChild(opt);
  }
}

// =====================
// RENDER TABLE
// =====================

function renderTable(items) {
  const tbody = $("#tbody");
  tbody.innerHTML = "";

  $("#totalCount").textContent = String(items.length);

  if (!items.length) {
    setEmptyState(true);
    return;
  }
  setEmptyState(false);

  for (const item of items) {
    const code = Number(item.direccionCode);
    const texto = item.direccionTexto || DIRECCIONES[code] || "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${item.id ?? "—"}</td>
      <td>
        <div class="fw-semibold">${escapeHtml(item.deviceName ?? "")}</div>
        <div class="text-secondary small">Recurso: <span class="mono">/dispositivos_IoT/${item.id ?? ""}</span></div>
      </td>
      <td class="mono">${escapeHtml(item.ipClient ?? "")}</td>
      <td>
        <span class="badge badge-soft">${escapeHtml(String(code || ""))}</span>
        <span class="ms-2">${escapeHtml(texto)}</span>
      </td>
      <td class="text-secondary">${escapeHtml(formatDate(item.dateTime))}</td>
      <td class="text-end">
        <button class="btn btn-outline-primary btn-sm me-2" data-action="edit" data-id="${item.id}">
          <i class="bi bi-pencil-square me-1"></i>Editar
        </button>
        <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${item.id}">
          <i class="bi bi-trash me-1"></i>Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =====================
// CRUD
// =====================

async function loadItems() {
  if (!API_URL || API_URL.includes("PEGA_AQUI")) {
    showAlert("warning", "Pega tu endpoint real en <strong>API_URL</strong> dentro de <code>app.js</code>.");
    return;
  }

  try {
    setLoading(true);
    $("#alertBox").innerHTML = "";

    const data = await apiFetch(API_URL);
    allItems = Array.isArray(data) ? data : [];
    applyFilter();

    $("#lastSync").textContent = `Última sync: ${new Date().toLocaleString()}`;
  } catch (err) {
    showAlert("danger", `Error al cargar datos: <strong>${escapeHtml(err.message)}</strong>`);
  } finally {
    setLoading(false);
  }
}

async function createItem(payload) {
  const created = await apiFetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return created;
}

async function updateItem(id, payload) {
  const updated = await apiFetch(`${API_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return updated;
}

async function deleteItem(id) {
  await apiFetch(`${API_URL}/${id}`, { method: "DELETE" });
}

// =====================
// FORM / MODAL
// =====================

function openCreateModal() {
  $("#modalTitle").textContent = "Nuevo dispositivo";
  $("#id").value = "";

  $("#deviceName").value = "";
  $("#ipClient").value = "";
  $("#direccionCode").value = "";
  $("#direccionTexto").value = "";
  $("#dateTime").value = nowLocalDatetimeValue();

  $("#deviceForm").classList.remove("was-validated");
  modal.show();
}

function openEditModal(item) {
  $("#modalTitle").textContent = `Editar dispositivo #${item.id}`;
  $("#id").value = item.id ?? "";

  $("#deviceName").value = item.deviceName ?? "";
  $("#ipClient").value = item.ipClient ?? "";

  const code = Number(item.direccionCode || "");
  $("#direccionCode").value = code ? String(code) : "";

  const texto = item.direccionTexto || (code ? DIRECCIONES[code] : "");
  $("#direccionTexto").value = texto ?? "";

  // Si viene ISO, intentamos convertirlo a datetime-local
  const iso = item.dateTime;
  const d = iso ? new Date(iso) : null;
  if (d && !Number.isNaN(d.getTime())) {
    // Pasar a formato local "YYYY-MM-DDTHH:MM"
    const pad = (n) => String(n).padStart(2, "0");
    const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $("#dateTime").value = v;
  } else {
    $("#dateTime").value = nowLocalDatetimeValue();
  }

  $("#deviceForm").classList.remove("was-validated");
  modal.show();
}

function buildPayloadFromForm() {
  const code = Number($("#direccionCode").value);
  const texto = DIRECCIONES[code] || "";

  return {
    deviceName: $("#deviceName").value.trim(),
    ipClient: $("#ipClient").value.trim(),
    direccionCode: code,
    direccionTexto: texto, // lo mandamos siempre consistente
    dateTime: toIsoFromDatetimeLocal($("#dateTime").value),
  };
}

// =====================
// SEARCH/FILTER
// =====================

function applyFilter() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  if (!q) {
    filteredItems = [...allItems];
  } else {
    filteredItems = allItems.filter((it) => {
      const code = Number(it.direccionCode);
      const texto = (it.direccionTexto || DIRECCIONES[code] || "").toLowerCase();
      const name = String(it.deviceName || "").toLowerCase();
      const ip = String(it.ipClient || "").toLowerCase();
      return name.includes(q) || ip.includes(q) || texto.includes(q) || String(code).includes(q);
    });
  }
  renderTable(filteredItems);
}

// =====================
// EVENTS
// =====================

function bindEvents() {
  $("#btnNew").addEventListener("click", openCreateModal);
  $("#btnNewEmpty").addEventListener("click", openCreateModal);
  $("#btnRefresh").addEventListener("click", loadItems);

  $("#searchInput").addEventListener("input", applyFilter);
  $("#btnClearSearch").addEventListener("click", () => {
    $("#searchInput").value = "";
    applyFilter();
  });

  // Direccion select: autocompletar texto
  $("#direccionCode").addEventListener("change", () => {
    const code = Number($("#direccionCode").value);
    $("#direccionTexto").value = DIRECCIONES[code] || "";
  });

  // Delegación de eventos para acciones en tabla
  $("#tbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    const item = allItems.find((x) => String(x.id) === String(id));

    if (action === "edit") {
      if (!item) return showToast("No encontré ese registro en memoria.");
      openEditModal(item);
    }

    if (action === "delete") {
      const ok = confirm(`¿Eliminar el dispositivo #${id}? Esta acción no se puede deshacer.`);
      if (!ok) return;

      try {
        btn.disabled = true;
        await deleteItem(id);
        showToast("Eliminado correctamente ✅");
        await loadItems();
      } catch (err) {
        showAlert("danger", `Error al eliminar: <strong>${escapeHtml(err.message)}</strong>`);
      } finally {
        btn.disabled = false;
      }
    }
  });

  // Submit del formulario
  $("#deviceForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    form.classList.add("was-validated");
    if (!form.checkValidity()) return;

    const id = $("#id").value;
    const payload = buildPayloadFromForm();

    try {
      $("#btnSave").disabled = true;

      if (!id) {
        await createItem(payload);
        showToast("Creado correctamente ✅");
      } else {
        await updateItem(id, payload);
        showToast("Actualizado correctamente ✅");
      }

      modal.hide();
      await loadItems();
    } catch (err) {
      showAlert("danger", `Error al guardar: <strong>${escapeHtml(err.message)}</strong>`);
    } finally {
      $("#btnSave").disabled = false;
    }
  });
}

// =====================
// INIT
// =====================

document.addEventListener("DOMContentLoaded", async () => {
  fillDireccionSelect();
  modal = new bootstrap.Modal($("#deviceModal"));
  $("#dateTime").value = nowLocalDatetimeValue();
  bindEvents();
  await loadItems();
});