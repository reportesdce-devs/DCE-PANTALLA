import { supabase } from "./supabase.js";

const locale = "es-MX";
const fallback = {
  events: [
    { id: "demo-featured", title: "Semana de Ingeniería", summary: "Ideas que transforman", description: "Conferencias · Talleres · Networking · Tecnología", starts_at: "2026-09-03T15:00:00Z", ends_at: "2026-09-05T02:00:00Z", location: "Auditorio David Gómez Fuentes", status: "archived", is_featured: true, display_order: 1 },
    { id: "demo-1", title: "Hackathon de Innovación", summary: "Soluciones para un mejor futuro", starts_at: "2026-09-10T15:00:00Z", location: "Laboratorios DCE", status: "published", display_order: 2 },
    { id: "demo-2", title: "Conferencia: IA en la Industria", summary: "Retos y oportunidades", starts_at: "2026-09-16T17:00:00Z", location: "Auditorio David Gómez Fuentes", status: "published", display_order: 3 },
    { id: "demo-3", title: "Feria de Prácticas Profesionales", summary: "Conecta con empresas", starts_at: "2026-09-23T16:00:00Z", location: "Explanada Central", status: "published", display_order: 4 },
  ],
  careers: [
    { name: "Ingeniería en Sistemas y Negocios Digitales", short_name: "Sistemas y Negocios Digitales", icon: "▣", accent: "#ff4f1f" },
    { name: "Ingeniería Industrial", short_name: "Industrial", icon: "⚙", accent: "#e7a000" },
    { name: "Ingeniería Mecatrónica", short_name: "Mecatrónica", icon: "⌘", accent: "#7b43e8" },
    { name: "Ingeniería Química", short_name: "Química", icon: "⚗", accent: "#14a663" },
  ],
  announcements: [],
  media: [],
  settings: { refresh_seconds: 60, rotation_seconds: 10, footer_message: "La ingeniería convierte ideas en oportunidades.", show_weather: true },
};

const state = structuredClone(fallback);
const byId = (id) => document.getElementById(id);
let announcementTimer;
let refreshTimer;

function format(value, options) {
  return new Intl.DateTimeFormat(locale, { timeZone: "America/Monterrey", ...options }).format(new Date(value));
}

function splitTitle(title) {
  const colon = title.indexOf(":");
  if (colon > -1) return [title.slice(0, colon + 1), title.slice(colon + 1).trim()];
  const words = title.trim().split(/\s+/);
  return words.length > 1 ? [words.slice(0, -1).join(" "), words.at(-1)] : [title, ""];
}

function splitLocation(location = "IEST Anáhuac") {
  const words = location.split(/\s+/);
  if (words.length < 2) return [location, "IEST Anáhuac"];
  return [words[0], words.slice(1).join(" ")];
}

function featuredEvent() {
  return [...state.events].sort((a, b) =>
    Number(b.is_featured) - Number(a.is_featured) ||
    Number(a.display_order || 0) - Number(b.display_order || 0) ||
    new Date(a.starts_at) - new Date(b.starts_at)
  )[0] || fallback.events[0];
}

function renderFeatured() {
  const event = featuredEvent();
  const [first, accent] = splitTitle(event.title);
  const title = byId("featured-title");
  title.querySelector("span").textContent = first;
  title.querySelector("strong").textContent = accent;
  byId("featured-summary").textContent = event.summary || "Ideas que transforman";
  byId("featured-description").textContent = event.description || "Conferencias · Talleres · Networking · Tecnología";

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const startDay = format(start, { day: "numeric" });
  const endDay = end && end.toDateString() !== start.toDateString() ? format(end, { day: "numeric" }) : null;
  byId("featured-day").textContent = endDay ? `${startDay} – ${endDay}` : startDay;
  byId("featured-month").textContent = format(start, { month: "long", year: "numeric" });
  const [locationMain, locationDetail] = splitLocation(event.location);
  byId("featured-location-main").textContent = locationMain;
  byId("featured-location-detail").textContent = locationDetail;

  const cta = byId("featured-cta");
  cta.hidden = false;
  cta.querySelector(".hero-button-label").textContent = event.cta_label || "Conoce más";
  if (event.cta_url) {
    cta.href = event.cta_url;
  } else {
    cta.removeAttribute("href");
  }

  const media = state.media.find((item) => item.event_id === event.id) || (event.cover_url ? { media_type: "image", public_url: event.cover_url } : null);
  const holder = byId("hero-media");
  holder.replaceChildren();
  holder.style.backgroundImage = "";
  holder.classList.toggle("active", Boolean(media?.public_url));
  if (media?.media_type === "video") {
    const video = document.createElement("video");
    video.src = media.public_url;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    holder.append(video);
  } else if (media?.public_url) {
    holder.style.backgroundImage = `url("${media.public_url.replaceAll('"', "%22")}")`;
  }
}

function buildEventCard(event) {
  const date = new Date(event.starts_at);
  const card = document.createElement("article");
  card.className = "event-card";

  const time = document.createElement("time");
  time.className = "date-card";
  time.dateTime = date.toISOString();
  const month = document.createElement("span"); month.textContent = format(date, { month: "short" }).replace(".", "");
  const day = document.createElement("strong"); day.textContent = format(date, { day: "2-digit" });
  const weekday = document.createElement("small"); weekday.textContent = format(date, { weekday: "short" }).replace(".", "");
  time.append(month, day, weekday);

  const info = document.createElement("div");
  info.className = "event-info";
  const title = document.createElement("h3"); title.textContent = event.title;
  const summary = document.createElement("p"); summary.textContent = event.summary || "Actividad DCE";
  const location = document.createElement("span"); location.className = "event-location";
  const dot = document.createElement("b"); dot.textContent = "●";
  location.append(dot, document.createTextNode(event.location || "IEST Anáhuac"));
  info.append(title, summary, location);

  const arrow = document.createElement("span"); arrow.className = "event-arrow"; arrow.textContent = "→";
  card.append(time, info, arrow);
  return card;
}

function renderEvents() {
  const section = byId("events-list");
  section.querySelectorAll(".event-card,.events-empty").forEach((node) => node.remove());
  const events = state.events
    .filter((event) => event.status === "published")
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 3);
  section.style.setProperty("--event-count", String(Math.max(events.length, 1)));
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "events-empty";
    empty.textContent = "Pronto publicaremos nuevas actividades.";
    section.append(empty);
    return;
  }
  events.forEach((event) => section.append(buildEventCard(event)));
}

function renderCareers() {
  const grid = byId("career-grid");
  grid.replaceChildren();
  state.careers.slice(0, 4).forEach((career, index) => {
    const program = document.createElement("article");
    program.className = `program ${["systems", "industrial", "mechatronics", "chemistry"][index]}`;
    const icon = document.createElement("div");
    icon.className = "program-icon";
    icon.textContent = career.icon || "◆";
    if (career.accent) icon.style.background = career.accent;
    const title = document.createElement("h3");
    title.textContent = career.short_name || career.name;
    program.append(icon, title);
    grid.append(program);
  });
  const heading = document.querySelector(".programs-header h2");
  heading.textContent = `Conoce nuestras ${state.careers.length} ingenierías`;
}

function renderAnnouncements() {
  clearInterval(announcementTimer);
  const bar = byId("announcement-bar");
  if (!state.announcements.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  let index = 0;
  const show = () => {
    const item = state.announcements[index % state.announcements.length];
    byId("announcement-title").textContent = item.priority === "urgent" ? "Urgente" : item.title || "Aviso";
    byId("announcement-text").textContent = item.body;
    index += 1;
  };
  show();
  if (state.announcements.length > 1) announcementTimer = setInterval(show, state.settings.rotation_seconds * 1000);
}

function renderSettings() {
  byId("footer-message").textContent = state.settings.footer_message || fallback.settings.footer_message;
  document.querySelector(".weather").hidden = state.settings.show_weather === false;
}

function renderAll() {
  renderFeatured();
  renderEvents();
  renderCareers();
  renderAnnouncements();
  renderSettings();
}

async function loadData() {
  if (!supabase) return renderAll();
  const [events, careers, announcements, media, settings] = await Promise.all([
    supabase.from("events").select("*").in("status", ["published", "archived"]).order("display_order"),
    supabase.from("careers").select("*").order("display_order"),
    supabase.from("announcements").select("*").order("display_order"),
    supabase.from("event_media").select("*").order("display_order"),
    supabase.from("display_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (events.data?.length) state.events = events.data;
  if (careers.data?.length) state.careers = careers.data;
  if (announcements.data) state.announcements = announcements.data;
  if (media.data) state.media = media.data;
  if (settings.data) state.settings = { ...state.settings, ...settings.data };
  [events, careers, announcements, media, settings].filter((result) => result.error).forEach((result) => console.error(result.error));
  renderAll();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, state.settings.refresh_seconds * 1000);
}

loadData();

if (supabase) {
  supabase.channel("dce-original-display").on("postgres_changes", { event: "*", schema: "public" }, loadData).subscribe();
}
