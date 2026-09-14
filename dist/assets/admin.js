import { isSupabaseConfigured, supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const db = { events: [], announcements: [], media: [], careers: [], promotions: [], settings: null };
let authMode = "signin";
let currentUser = null;

function message(text, success = false, target = "global-message") {
  const node = $(target);
  node.textContent = text;
  node.classList.toggle("success", success);
  node.hidden = false;
  if (target === "global-message") setTimeout(() => { node.hidden = true; }, 5000);
}

function errorText(error) {
  const raw = error?.message || String(error || "Error inesperado");
  if (raw.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (raw.includes("Email not confirmed")) return "Confirma tu correo antes de iniciar sesión.";
  if (raw.includes("row-level security")) return "Tu cuenta no tiene permiso para realizar esta acción.";
  return raw;
}

const toLocalInput = (value) => value ? new Date(value).toLocaleString("sv-SE", { timeZone: "America/Monterrey" }).replace(" ", "T").slice(0, 16) : "";
const fromLocalInput = (value) => value ? new Date(value).toISOString() : null;
const slugify = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const formatDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin fecha";

function openDialog(id) { $(id).showModal(); }
function closeDialogs() { document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close()); }

function setView(authenticated) {
  $("auth-view").hidden = authenticated;
  $("dashboard").hidden = !authenticated;
}

async function requireAdmin(user) {
  const { data, error } = await supabase.from("admin_users").select("user_id,email,display_name").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La cuenta existe, pero todavía no ha sido autorizada como administradora.");
  return data;
}

async function bootSession() {
  if (!isSupabaseConfigured) {
    $("auth-submit").disabled = true;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => { button.disabled = true; });
    message("Falta configurar la clave pública de Supabase. El display permanece disponible en modo demostración.", false, "auth-message");
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await enterDashboard(session.user);
}

async function enterDashboard(user) {
  try {
    const admin = await requireAdmin(user);
    currentUser = user;
    $("admin-identity").textContent = admin.display_name || admin.email || user.email;
    setView(true);
    await loadAll();
  } catch (error) {
    await supabase.auth.signOut();
    setView(false);
    message(errorText(error), false, "auth-message");
  }
}

async function loadAll() {
  const [events, announcements, media, careers, promotions, settings] = await Promise.all([
    supabase.from("events").select("*").order("starts_at", { ascending: false }),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("event_media").select("*").order("created_at", { ascending: false }),
    supabase.from("careers").select("*").order("display_order"),
    supabase.from("promotional_content").select("*").order("display_order"),
    supabase.from("display_settings").select("*").eq("id", 1).single(),
  ]);
  const resultMap = { events, announcements, media, careers, promotions, settings };
  const failed = Object.entries(resultMap).find(([, result]) => result.error);
  if (failed) throw failed[1].error;
  db.events = events.data || [];
  db.announcements = announcements.data || [];
  db.media = media.data || [];
  db.careers = careers.data || [];
  db.promotions = promotions.data || [];
  db.settings = settings.data;
  renderAll();
}

function statusLabel(value) {
  return ({ draft: "Borrador", scheduled: "Programado", published: "Publicado", archived: "Archivado" })[value] || value;
}

function dataRow({ title, subtitle, meta, status, onEdit, onDelete }) {
  const row = document.createElement("article");
  row.className = "data-row";
  const main = document.createElement("div");
  const h3 = document.createElement("h3");
  const p = document.createElement("p");
  h3.textContent = title;
  p.textContent = subtitle || "";
  main.append(h3, p);
  const small = document.createElement("small");
  small.textContent = meta || "";
  const badge = document.createElement("span");
  badge.className = "status";
  badge.textContent = status || "";
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (onEdit) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", onEdit);
    actions.append(edit);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "Eliminar";
  remove.addEventListener("click", onDelete);
  actions.append(remove);
  row.append(main, small, badge, actions);
  return row;
}

function renderList(target, items, factory, emptyText) {
  const list = $(target);
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }
  items.forEach((item) => list.append(factory(item)));
}

function renderEvents() {
  renderList("events-list", db.events, (event) => dataRow({
    title: `${event.is_featured ? "★ " : ""}${event.title}`,
    subtitle: event.summary || event.location,
    meta: `${formatDate(event.starts_at)} · ${event.location || "Sin ubicación"}`,
    status: statusLabel(event.status),
    onEdit: () => editEvent(event),
    onDelete: () => removeRecord("events", event.id, event.title),
  }), "Aún no hay eventos.");
  const select = $("media-event");
  select.replaceChildren();
  db.events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = event.title;
    select.append(option);
  });
}

function renderAnnouncements() {
  renderList("announcements-list", db.announcements, (item) => dataRow({
    title: item.title,
    subtitle: item.body,
    meta: `${formatDate(item.starts_at)}${item.ends_at ? ` — ${formatDate(item.ends_at)}` : ""}`,
    status: item.is_active ? item.priority : "Inactivo",
    onEdit: () => editAnnouncement(item),
    onDelete: () => removeRecord("announcements", item.id, item.title),
  }), "Aún no hay avisos.");
}

function renderCareers() {
  renderList("careers-list", db.careers, (item) => dataRow({
    title: `${item.icon || "◆"} ${item.name}`,
    subtitle: item.description,
    meta: `Orden ${item.display_order}`,
    status: item.is_active ? "Visible" : "Oculta",
    onEdit: () => editCareer(item),
    onDelete: () => removeRecord("careers", item.id, item.name),
  }), "Aún no hay carreras.");
}

function renderPromotions() {
  renderList("promotions-list", db.promotions, (item) => dataRow({
    title: item.title,
    subtitle: item.body,
    meta: item.cta_label || "Sin enlace",
    status: item.is_active ? "Visible" : "Oculta",
    onEdit: () => editPromotion(item),
    onDelete: () => removeRecord("promotional_content", item.id, item.title),
  }), "Aún no hay promociones.");
}

function renderMedia() {
  const list = $("media-list");
  list.replaceChildren();
  if (!db.media.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Sube fotografías o videos para documentar los eventos.";
    list.append(empty);
    return;
  }
  db.media.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";
    const visual = document.createElement(item.media_type === "video" ? "video" : "img");
    visual.src = item.public_url;
    if (item.media_type === "video") visual.controls = true;
    else visual.alt = item.caption || "Evidencia DCE";
    const footer = document.createElement("div");
    const caption = document.createElement("p");
    caption.textContent = item.caption || db.events.find((event) => event.id === item.event_id)?.title || "Evidencia DCE";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => removeMedia(item));
    footer.append(caption, remove);
    card.append(visual, footer);
    list.append(card);
  });
}

function renderSettings() {
  const item = db.settings;
  if (!item) return;
  $("settings-footer").value = item.footer_message || "";
  $("settings-recruitment-title").value = item.recruitment_title || "";
  $("settings-recruitment-body").value = item.recruitment_body || "";
  $("settings-recruitment-cta").value = item.recruitment_cta || "";
  $("settings-recruitment-url").value = item.recruitment_url || "";
  $("settings-rotation").value = item.rotation_seconds;
  $("settings-refresh").value = item.refresh_seconds;
  $("settings-weather").checked = item.show_weather;
}

function renderAll() {
  renderEvents();
  renderAnnouncements();
  renderMedia();
  renderCareers();
  renderPromotions();
  renderSettings();
  $("metrics").replaceChildren(...[
    [db.events.filter((item) => item.status === "published").length, "eventos públicos"],
    [db.announcements.filter((item) => item.is_active).length, "avisos activos"],
    [db.media.length, "evidencias"],
  ].map(([value, label]) => {
    const node = document.createElement("div");
    node.className = "metric";
    const strong = document.createElement("strong"); strong.textContent = value;
    const span = document.createElement("span"); span.textContent = label;
    node.append(strong, span); return node;
  }));
}

function editEvent(item = null) {
  $("event-form").reset();
  $("event-id").value = item?.id || "";
  $("event-dialog-title").textContent = item ? "Editar evento" : "Nuevo evento";
  $("event-title").value = item?.title || "";
  $("event-summary").value = item?.summary || "";
  $("event-start").value = toLocalInput(item?.starts_at || new Date(Date.now() + 86400000));
  $("event-end").value = toLocalInput(item?.ends_at);
  $("event-location").value = item?.location || "";
  $("event-audience").value = item?.audience || "todos";
  $("event-status").value = item?.status || "draft";
  $("event-order").value = item?.display_order || 0;
  $("event-featured").checked = Boolean(item?.is_featured);
  $("event-cta-label").value = item?.cta_label || "";
  $("event-cta-url").value = item?.cta_url || "";
  openDialog("event-dialog");
}

function editAnnouncement(item = null) {
  $("announcement-form").reset();
  $("announcement-id").value = item?.id || "";
  $("announcement-dialog-title").textContent = item ? "Editar aviso" : "Nuevo aviso";
  $("announcement-title").value = item?.title || "";
  $("announcement-body").value = item?.body || "";
  $("announcement-priority").value = item?.priority || "normal";
  $("announcement-start").value = toLocalInput(item?.starts_at || new Date());
  $("announcement-end").value = toLocalInput(item?.ends_at);
  $("announcement-order").value = item?.display_order || 0;
  $("announcement-active").checked = item ? item.is_active : true;
  openDialog("announcement-dialog");
}

function editCareer(item = null) {
  $("career-form").reset();
  $("career-id").value = item?.id || "";
  $("career-name").value = item?.name || "";
  $("career-short").value = item?.short_name || "";
  $("career-description").value = item?.description || "";
  $("career-icon").value = item?.icon || "";
  $("career-accent").value = item?.accent || "#ff5a1f";
  $("career-order").value = item?.display_order || 0;
  $("career-active").checked = item ? item.is_active : true;
  openDialog("career-dialog");
}

function editPromotion(item = null) {
  $("promotion-form").reset();
  $("promotion-id").value = item?.id || "";
  $("promotion-title").value = item?.title || "";
  $("promotion-body").value = item?.body || "";
  $("promotion-cta-label").value = item?.cta_label || "";
  $("promotion-cta-url").value = item?.cta_url || "";
  $("promotion-order").value = item?.display_order || 0;
  $("promotion-active").checked = item ? item.is_active : true;
  openDialog("promotion-dialog");
}

async function upsert(table, payload, id) {
  const query = id ? supabase.from(table).update(payload).eq("id", id) : supabase.from(table).insert(payload);
  const { error } = await query;
  if (error) throw error;
  closeDialogs();
  await loadAll();
  message("Cambios guardados.", true);
}

async function removeRecord(table, id, label) {
  if (!confirm(`¿Eliminar “${label}”? Esta acción no se puede deshacer.`)) return;
  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    await loadAll();
    message("Elemento eliminado.", true);
  } catch (error) { message(errorText(error)); }
}

async function removeMedia(item) {
  if (!confirm("¿Eliminar esta evidencia y su archivo?")) return;
  try {
    const { error: storageError } = await supabase.storage.from("event-media").remove([item.file_path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from("event_media").delete().eq("id", item.id);
    if (error) throw error;
    await loadAll();
    message("Evidencia eliminada.", true);
  } catch (error) { message(errorText(error)); }
}

document.querySelectorAll(".tabs button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
}));
document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => {
  const type = button.dataset.open;
  if (type === "event-dialog") editEvent();
  if (type === "announcement-dialog") editAnnouncement();
  if (type === "career-dialog") editCareer();
  if (type === "promotion-dialog") editPromotion();
}));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeDialogs));

document.querySelectorAll("[data-auth-mode]").forEach((modeButton) => modeButton.addEventListener("click", () => {
  authMode = modeButton.dataset.authMode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button === modeButton;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("auth-title").textContent = authMode === "signin" ? "Contenido del display" : "Crea tu cuenta";
  $("auth-description").textContent = authMode === "signin"
    ? "Inicia sesión con una cuenta autorizada para publicar avisos, eventos y evidencias."
    : "Registra tu correo institucional. Después habilitaremos tu acceso administrativo.";
  $("auth-submit").textContent = authMode === "signin" ? "Iniciar sesión" : "Crear cuenta";
  $("auth-note").textContent = authMode === "signin" ? "El acceso al panel requiere autorización administrativa." : "Después de registrarte, un administrador debe habilitar tu cuenta.";
  $("auth-message").hidden = true;
  $("auth-email").focus();
}));

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("auth-submit");
  button.disabled = true;
  try {
    const credentials = { email: $("auth-email").value.trim(), password: $("auth-password").value };
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) throw error;
      if (data.session) await enterDashboard(data.user);
      else message("Cuenta creada. Revisa tu correo para confirmarla y después solicita autorización.", true, "auth-message");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      await enterDashboard(data.user);
    }
  } catch (error) { message(errorText(error), false, "auth-message"); }
  finally { button.disabled = false; }
});

$("sign-out").addEventListener("click", async () => { await supabase.auth.signOut(); currentUser = null; setView(false); });

$("event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("event-id").value;
  const title = $("event-title").value.trim();
  const payload = {
    title,
    slug: id ? db.events.find((item) => item.id === id).slug : `${slugify(title)}-${Date.now().toString(36)}`,
    summary: $("event-summary").value.trim() || null,
    starts_at: fromLocalInput($("event-start").value),
    ends_at: fromLocalInput($("event-end").value),
    location: $("event-location").value.trim() || null,
    audience: $("event-audience").value,
    status: $("event-status").value,
    is_featured: $("event-featured").checked,
    display_order: Number($("event-order").value || 0),
    cta_label: $("event-cta-label").value.trim() || null,
    cta_url: $("event-cta-url").value.trim() || null,
    created_by: currentUser.id,
  };
  try { await upsert("events", payload, id); } catch (error) { message(errorText(error)); }
});

$("announcement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("announcement-id").value;
  const payload = {
    title: $("announcement-title").value.trim(), body: $("announcement-body").value.trim(),
    priority: $("announcement-priority").value, starts_at: fromLocalInput($("announcement-start").value),
    ends_at: fromLocalInput($("announcement-end").value), display_order: Number($("announcement-order").value || 0),
    is_active: $("announcement-active").checked, created_by: currentUser.id,
  };
  try { await upsert("announcements", payload, id); } catch (error) { message(errorText(error)); }
});

$("career-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("career-id").value;
  const payload = { name: $("career-name").value.trim(), short_name: $("career-short").value.trim() || null, description: $("career-description").value.trim() || null, icon: $("career-icon").value.trim() || null, accent: $("career-accent").value, display_order: Number($("career-order").value || 0), is_active: $("career-active").checked };
  try { await upsert("careers", payload, id); } catch (error) { message(errorText(error)); }
});

$("promotion-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("promotion-id").value;
  const payload = { title: $("promotion-title").value.trim(), body: $("promotion-body").value.trim() || null, cta_label: $("promotion-cta-label").value.trim() || null, cta_url: $("promotion-cta-url").value.trim() || null, audience: "preparatoria", display_order: Number($("promotion-order").value || 0), is_active: $("promotion-active").checked };
  try { await upsert("promotional_content", payload, id); } catch (error) { message(errorText(error)); }
});

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = { footer_message: $("settings-footer").value.trim(), recruitment_title: $("settings-recruitment-title").value.trim(), recruitment_body: $("settings-recruitment-body").value.trim(), recruitment_cta: $("settings-recruitment-cta").value.trim(), recruitment_url: $("settings-recruitment-url").value.trim() || null, rotation_seconds: Number($("settings-rotation").value), refresh_seconds: Number($("settings-refresh").value), show_weather: $("settings-weather").checked };
  try { await upsert("display_settings", payload, 1); } catch (error) { message(errorText(error)); }
});

$("media-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = $("media-file").files[0];
  const eventId = $("media-event").value;
  if (!file || !eventId) return;
  if (file.size > 52428800) return message("El archivo supera el límite de 50 MB.");
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Subiendo…";
  const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${eventId}/${Date.now()}-${safeName}`;
  try {
    const { error: uploadError } = await supabase.storage.from("event-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const { error } = await supabase.from("event_media").insert({ event_id: eventId, media_type: mediaType, file_path: path, public_url: publicData.publicUrl, caption: $("media-caption").value.trim() || null });
    if (error) { await supabase.storage.from("event-media").remove([path]); throw error; }
    $("media-form").reset();
    await loadAll();
    message("Evidencia publicada.", true);
  } catch (error) { message(errorText(error)); }
  finally { button.disabled = false; button.textContent = "Subir evidencia"; }
});

bootSession();
