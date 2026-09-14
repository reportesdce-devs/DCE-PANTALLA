import { isSupabaseConfigured, supabase } from "./supabase.js";

const locale = "es-MX";
const fallback = {
  settings: {
    rotation_seconds: 10,
    refresh_seconds: 60,
    show_weather: true,
    weather_locations: ["Tampico", "Altamira", "Ciudad Madero"],
    footer_message: "La ingeniería convierte ideas en oportunidades.",
    recruitment_title: "Tu futuro también se diseña",
    recruitment_body: "Conoce nuestras ingenierías y transforma tus ideas en soluciones.",
    recruitment_cta: "Conoce la DCE",
    recruitment_url: null,
  },
  announcements: [{ title: "Comunidad DCE", body: "Consulta aquí los próximos eventos, avisos y experiencias de Ingeniería.", priority: "normal" }],
  careers: [
    { name: "Ingeniería en Sistemas y Negocios Digitales", short_name: "Sistemas y Negocios Digitales", description: "Diseña productos y negocios impulsados por tecnología.", icon: "⌘", accent: "#ff5a1f" },
    { name: "Ingeniería Industrial", short_name: "Industrial", description: "Optimiza procesos y organizaciones.", icon: "⚙", accent: "#f0b323" },
    { name: "Ingeniería Mecatrónica", short_name: "Mecatrónica", description: "Integra mecánica, electrónica y automatización.", icon: "◇", accent: "#9b6cff" },
    { name: "Ingeniería Química", short_name: "Química", description: "Transforma materiales para crear soluciones sostenibles.", icon: "⚗", accent: "#24c47e" },
  ],
  events: [
    { id: "demo-1", title: "Conferencia: IA en la Industria", summary: "Retos y oportunidades de la inteligencia artificial aplicada.", starts_at: "2026-09-16T17:00:00Z", location: "Auditorio David Gómez Fuentes", status: "published", is_featured: true },
    { id: "demo-2", title: "Feria de Prácticas Profesionales", summary: "Conecta con empresas y descubre oportunidades.", starts_at: "2026-09-23T16:00:00Z", location: "Explanada Central", status: "published", is_featured: false },
  ],
  promotions: [],
  media: [],
};

const state = structuredClone(fallback);
const el = (id) => document.getElementById(id);
let announcementTimer;
let refreshTimer;

function showConnection(message, timeout = 8000) {
  const node = el("connection-state");
  node.textContent = message;
  node.hidden = false;
  if (timeout) setTimeout(() => { node.hidden = true; }, timeout);
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

function renderFeatured() {
  const now = Date.now();
  const upcoming = state.events
    .filter((event) => event.status === "published" && new Date(event.starts_at).getTime() >= now - 86400000)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || new Date(a.starts_at) - new Date(b.starts_at));
  const event = upcoming[0] || state.events.find((item) => item.status === "archived") || fallback.events[0];
  const date = new Date(event.starts_at);
  el("featured-title").textContent = event.title;
  el("featured-summary").textContent = event.summary || event.description || "Una experiencia creada por la comunidad DCE.";
  el("featured-date").textContent = formatDate(date, { day: "numeric", month: "long" });
  el("featured-time").textContent = `${formatDate(date, { hour: "2-digit", minute: "2-digit" })} h`;
  el("featured-location").textContent = event.location || "IEST Anáhuac";

  const cta = el("featured-cta");
  cta.hidden = !event.cta_url;
  if (event.cta_url) {
    cta.href = event.cta_url;
    cta.firstChild.textContent = `${event.cta_label || "Conoce más"} `;
  }

  const media = state.media.find((item) => item.event_id === event.id) || (event.cover_url ? { media_type: "image", public_url: event.cover_url } : null);
  const holder = el("featured-media");
  holder.replaceChildren();
  holder.style.backgroundImage = "";
  if (media?.media_type === "video") {
    const video = document.createElement("video");
    video.src = media.public_url;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    holder.append(video);
  } else if (media?.public_url) {
    holder.style.backgroundImage = `url("${media.public_url.replaceAll('"', '%22')}")`;
  }

  const diff = date.getTime() - now;
  const countdown = el("featured-countdown");
  if (diff > 0) {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    countdown.textContent = days ? `Faltan ${days} días` : `Faltan ${Math.max(1, hours)} horas`;
  } else {
    countdown.textContent = "Evento DCE";
  }
}

function renderEvents() {
  const list = el("event-list");
  list.replaceChildren();
  const events = state.events
    .filter((event) => event.status === "published" && new Date(event.starts_at).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 4);
  el("event-count").textContent = `${events.length} ${events.length === 1 ? "evento" : "eventos"}`;
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Pronto publicaremos nuevas actividades.";
    list.append(empty);
    return;
  }
  events.forEach((event) => {
    const fragment = el("event-template").content.cloneNode(true);
    const date = new Date(event.starts_at);
    fragment.querySelector(".month").textContent = formatDate(date, { month: "short" }).replace(".", "");
    fragment.querySelector(".day").textContent = formatDate(date, { day: "2-digit" });
    fragment.querySelector("h3").textContent = event.title;
    fragment.querySelector("p").textContent = event.summary || event.location || "Actividad DCE";
    fragment.querySelector("small").textContent = `${formatDate(date, { hour: "2-digit", minute: "2-digit" })} · ${event.location || "IEST Anáhuac"}`;
    list.append(fragment);
  });
}

function renderAnnouncements() {
  clearInterval(announcementTimer);
  const bar = el("announcement-bar");
  if (!state.announcements.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  let index = 0;
  const show = () => {
    const item = state.announcements[index % state.announcements.length];
    el("announcement-label").textContent = item.priority === "urgent" ? "Urgente" : item.priority === "important" ? "Importante" : (item.title || "Aviso");
    el("announcement-text").textContent = item.body;
    const progress = el("announcement-progress");
    progress.classList.remove("running");
    void progress.offsetWidth;
    progress.style.setProperty("--rotation", `${state.settings.rotation_seconds}s`);
    progress.classList.add("running");
    index += 1;
  };
  show();
  if (state.announcements.length > 1) announcementTimer = setInterval(show, state.settings.rotation_seconds * 1000);
}

function renderRecruitment() {
  const promo = state.promotions[0];
  el("recruitment-title").textContent = promo?.title || state.settings.recruitment_title;
  el("recruitment-body").textContent = promo?.body || state.settings.recruitment_body;
  const link = el("recruitment-link");
  const url = promo?.cta_url || state.settings.recruitment_url;
  link.hidden = !url;
  if (url) {
    link.href = url;
    link.firstChild.textContent = `${promo?.cta_label || state.settings.recruitment_cta} `;
  }
}

function renderCareers() {
  const grid = el("career-grid");
  grid.replaceChildren();
  state.careers.slice(0, 8).forEach((career) => {
    const article = document.createElement("article");
    article.className = "career-card";
    article.style.setProperty("--accent", career.accent || "#ff5a1f");
    const icon = document.createElement("span");
    icon.textContent = career.icon || "◆";
    const title = document.createElement("h3");
    title.textContent = career.short_name || career.name;
    const description = document.createElement("p");
    description.textContent = career.description || "Conoce este programa de Ingeniería.";
    article.append(icon, title, description);
    grid.append(article);
  });
  const orb = document.querySelector(".pulse-orb span");
  if (orb) orb.textContent = state.careers.length;
}

function renderEvidence() {
  const section = el("evidence-section");
  const track = el("evidence-track");
  track.replaceChildren();
  const archivedIds = new Set(state.events.filter((event) => event.status === "archived").map((event) => event.id));
  const media = state.media.filter((item) => archivedIds.has(item.event_id)).slice(0, 4);
  section.hidden = !media.length;
  media.forEach((item) => {
    const figure = document.createElement("figure");
    figure.className = "evidence-card";
    let visual;
    if (item.media_type === "video") {
      visual = document.createElement("video");
      visual.src = item.public_url;
      visual.muted = true;
      visual.loop = true;
      visual.autoplay = true;
      visual.playsInline = true;
      const badge = document.createElement("span");
      badge.className = "video-badge";
      badge.textContent = "VIDEO";
      figure.append(badge);
    } else {
      visual = document.createElement("img");
      visual.src = item.public_url;
      visual.alt = item.caption || "Evidencia de evento DCE";
      visual.loading = "lazy";
    }
    const caption = document.createElement("figcaption");
    caption.textContent = item.caption || "Experiencia DCE";
    figure.prepend(visual);
    figure.append(caption);
    track.append(figure);
  });
}

function renderSettings() {
  el("footer-message").textContent = state.settings.footer_message;
  el("weather-block").hidden = !state.settings.show_weather;
}

function renderAll() {
  renderFeatured();
  renderEvents();
  renderAnnouncements();
  renderRecruitment();
  renderCareers();
  renderEvidence();
  renderSettings();
}

async function loadData() {
  if (!supabase) {
    renderAll();
    showConnection("Modo demostración · agrega la clave pública de Supabase para mostrar contenido en vivo.", 0);
    return;
  }
  const [events, media, announcements, careers, promotions, settings] = await Promise.all([
    supabase.from("events").select("*").in("status", ["published", "archived"]).order("display_order").order("starts_at"),
    supabase.from("event_media").select("*").order("display_order").order("created_at", { ascending: false }),
    supabase.from("announcements").select("*").order("display_order").order("created_at", { ascending: false }),
    supabase.from("careers").select("*").order("display_order"),
    supabase.from("promotional_content").select("*").order("display_order"),
    supabase.from("display_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const failures = [events, media, announcements, careers, promotions, settings].filter((result) => result.error);
  if (failures.length) {
    console.error("No fue posible cargar parte del contenido", failures.map((item) => item.error));
    showConnection("No se pudo actualizar todo el contenido. Se conservará la información disponible.");
  }
  if (events.data?.length) state.events = events.data;
  if (media.data) state.media = media.data;
  if (announcements.data) state.announcements = announcements.data;
  if (careers.data?.length) state.careers = careers.data;
  if (promotions.data) state.promotions = promotions.data;
  if (settings.data) state.settings = { ...state.settings, ...settings.data };
  renderAll();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, state.settings.refresh_seconds * 1000);
}

function startClock() {
  const update = () => {
    const now = new Date();
    el("clock").textContent = formatDate(now, { hour: "2-digit", minute: "2-digit", hour12: false });
    el("weekday").textContent = formatDate(now, { weekday: "long" });
    el("full-date").textContent = formatDate(now, { day: "numeric", month: "long", year: "numeric" });
  };
  update();
  setInterval(update, 1000);
}

async function loadWeather() {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=22.2331&longitude=-97.8611&current=temperature_2m,weather_code&timezone=America%2FMonterrey");
    if (!response.ok) throw new Error("weather unavailable");
    const { current } = await response.json();
    const code = current.weather_code;
    const condition = code === 0 ? ["☀", "Despejado"] : code <= 3 ? ["⛅", "Parcialmente nublado"] : code <= 67 ? ["🌧", "Lluvia"] : code <= 77 ? ["🌨", "Granizo"] : ["⛈", "Tormenta"];
    el("weather-temperature").textContent = `${Math.round(current.temperature_2m)}°`;
    el("weather-icon").textContent = condition[0];
    el("weather-description").textContent = condition[1];
  } catch {
    el("weather-description").textContent = "Clima no disponible";
  }
}

function subscribeRealtime() {
  if (!supabase) return;
  supabase
    .channel("dce-display-live")
    .on("postgres_changes", { event: "*", schema: "public" }, () => loadData())
    .subscribe();
}

startClock();
loadWeather();
loadData();
subscribeRealtime();
