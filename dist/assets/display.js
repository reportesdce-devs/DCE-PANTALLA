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
let careerTimer;
let careerIndex = 0;
let featuredTimer;
let featuredMediaTimer;
let featuredIndex = 0;
let featuredSlides = [];
let refreshTimer;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

function featuredEvents() {
  const ordered = [...state.events]
    .filter((event) => ["published", "archived"].includes(event.status))
    .sort((a, b) =>
      Number(a.display_order || 0) - Number(b.display_order || 0) ||
      new Date(a.starts_at) - new Date(b.starts_at)
    );
  const selected = ordered.filter((event) => event.is_featured);
  return selected.length ? selected : [ordered[0] || fallback.events[0]];
}

function buildFeaturedSlides() {
  return featuredEvents().flatMap((event) => {
    const media = state.media.filter((item) => item.event_id === event.id && item.public_url);
    if (media.length) return media.map((item) => ({ event, media: item }));
    if (event.cover_url) return [{ event, media: { media_type: "image", public_url: event.cover_url } }];
    return [{ event, media: null }];
  }).slice(0, 12);
}

function renderFeaturedMedia(media) {
  const holder = byId("hero-media");
  clearTimeout(featuredMediaTimer);
  const previous = [...holder.querySelectorAll(".hero-media-frame")];
  if (!media?.public_url) {
    holder.classList.remove("active");
    featuredMediaTimer = setTimeout(() => holder.replaceChildren(), 720);
    return;
  }

  const frame = document.createElement("div");
  frame.className = "hero-media-frame";
  if (media.media_type === "video") {
    const video = document.createElement("video");
    video.src = media.public_url;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.disablePictureInPicture = true;
    frame.append(video);
  } else {
    frame.style.backgroundImage = `url("${media.public_url.replaceAll('"', "%22")}")`;
  }

  holder.append(frame);
  holder.classList.add("active");
  requestAnimationFrame(() => {
    previous.forEach((item) => item.classList.remove("active"));
    frame.classList.add("active");
  });
  featuredMediaTimer = setTimeout(() => previous.forEach((item) => item.remove()), 720);
}

function showFeaturedSlide(index, animate = true) {
  if (!featuredSlides.length) return;
  featuredIndex = (index + featuredSlides.length) % featuredSlides.length;
  const { event, media } = featuredSlides[featuredIndex];
  const [first, accent] = splitTitle(event.title);
  const title = byId("featured-title");
  title.querySelector("span").textContent = first;
  title.querySelector("strong").textContent = accent;
  byId("featured-summary").textContent = event.summary || "";
  byId("featured-summary").hidden = Boolean(event.description) || !event.summary;
  const description = byId("featured-description");
  description.textContent = event.description || "";
  description.hidden = !event.description;

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
  cta.hidden = !event.cta_url;
  cta.querySelector(".hero-button-label").textContent = event.cta_label || "Conoce más";
  if (event.cta_url) {
    cta.href = event.cta_url;
  } else {
    cta.removeAttribute("href");
  }

  renderFeaturedMedia(media);
  const hero = byId("featured-card");
  hero.setAttribute("aria-label", `Evento destacado: ${event.title}`);
  hero.style.setProperty("--carousel-duration", `${Math.max(12, Number(state.settings.rotation_seconds) || 12)}s`);
  byId("featured-position").textContent = `${String(featuredIndex + 1).padStart(2, "0")} / ${String(featuredSlides.length).padStart(2, "0")}`;
  byId("featured-carousel").hidden = featuredSlides.length < 2 || reducedMotion.matches;
  hero.classList.remove("slide-enter", "carousel-running");
  void hero.offsetWidth;
  if (animate && !reducedMotion.matches) hero.classList.add("slide-enter");
  if (featuredSlides.length > 1 && !document.hidden && !reducedMotion.matches) {
    hero.classList.add("carousel-running");
  }
}

function scheduleFeaturedCarousel() {
  clearInterval(featuredTimer);
  if (featuredSlides.length < 2 || document.hidden || reducedMotion.matches) return;
  const seconds = Math.max(12, Number(state.settings.rotation_seconds) || 12);
  featuredTimer = setInterval(() => showFeaturedSlide(featuredIndex + 1), seconds * 1000);
}

function renderFeatured() {
  const nextSlides = buildFeaturedSlides();
  if (JSON.stringify(nextSlides) === JSON.stringify(featuredSlides)) return;
  const currentKey = featuredSlides[featuredIndex]?.event.id;
  featuredSlides = nextSlides;
  const retainedIndex = currentKey ? featuredSlides.findIndex((slide) => slide.event.id === currentKey) : -1;
  featuredIndex = retainedIndex >= 0 ? retainedIndex : 0;
  showFeaturedSlide(featuredIndex, false);
  scheduleFeaturedCarousel();
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
    .filter((event) => event.status === "published" && !event.is_featured)
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

function careerType(career) {
  const name = `${career.name || ""} ${career.short_name || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (name.includes("quim")) return "chemistry";
  if (name.includes("mecatron")) return "mechatronics";
  if (name.includes("industrial")) return "industrial";
  return "systems";
}

function careerPresentation(type) {
  return {
    chemistry: { kicker: "Química", headline: ["Transforma", "la materia."], description: "Ciencia aplicada a procesos, energía y soluciones sostenibles.", tags: ["Procesos", "Materiales", "Energía"], accent: "#10a66d", wash: "#e6f8f0" },
    mechatronics: { kicker: "Mecatrónica", headline: ["Ideas que", "se mueven."], description: "Robótica, electrónica y programación trabajando como un solo sistema.", tags: ["Robótica", "Control", "Automatización"], accent: "#7440e8", wash: "#eee8ff" },
    industrial: { kicker: "Industrial", headline: ["Optimiza", "cada proceso."], description: "Personas, tecnología y recursos conectados con mayor eficiencia.", tags: ["Calidad", "Logística", "Liderazgo"], accent: "#eca700", wash: "#fff3d2" },
    systems: { kicker: "Sistemas", headline: ["Crea el", "mundo digital."], description: "Software, datos e inteligencia artificial convertidos en nuevos negocios.", tags: ["Software", "Datos e IA", "Negocios"], accent: "#ff4b23", wash: "#ffe9e2" },
  }[type];
}

function careerArt(type) {
  const art = {
    chemistry: `<svg class="dce-art" viewBox="0 0 250 115"><path class="base" d="M45 14h42v10l-9 12v22l34 47H20l34-47V36l-9-12V14Z"/><path class="wash" d="M34 80c21-14 40 11 63-3l18 28H18l16-25Z"/><circle class="chem-bubble accent" cx="54" cy="84" r="5"/><circle class="chem-bubble b2 accent" cx="74" cy="89" r="3.5"/><circle class="chem-bubble b3 accent" cx="89" cy="80" r="6"/><g class="atom"><ellipse class="line" cx="190" cy="54" rx="49" ry="17"/><ellipse class="line" cx="190" cy="54" rx="49" ry="17" transform="rotate(60 190 54)"/><ellipse class="line" cx="190" cy="54" rx="49" ry="17" transform="rotate(120 190 54)"/><circle class="accent" cx="190" cy="54" r="8"/><circle class="accent" cx="239" cy="54" r="4"/></g></svg>`,
    mechatronics: `<svg class="dce-art" viewBox="0 0 250 115"><path class="line" d="M14 104h222"/><rect class="base" x="36" y="88" width="65" height="16" rx="4"/><path class="accent" d="M47 88h43l-5-13H52z"/><circle class="base" cx="68" cy="79" r="12"/><circle class="accent" cx="68" cy="79" r="5"/><g class="robot-shoulder"><path class="stroke" d="M68 79 108 45"/><path class="line" d="m74 82 41-34"/><circle class="base" cx="112" cy="45" r="12"/><circle class="accent" cx="112" cy="45" r="5"/><g class="robot-forearm"><path class="stroke" d="M112 45 163 57"/><path class="line" d="m112 52 49 12"/><circle class="base" cx="165" cy="60" r="10"/><circle class="accent" cx="165" cy="60" r="4"/><path class="stroke" d="M165 68v8"/><path class="stroke robot-claw-left" d="m165 75-10 8v8"/><path class="stroke robot-claw-right" d="m165 75 10 8v8"/></g></g><g class="robot-piece"><rect class="wash" x="151" y="89" width="29" height="15" rx="3"/><path class="line" d="M151 94h29m-14-5v15"/></g><rect class="base" x="193" y="20" width="43" height="63" rx="6"/><circle class="accent" cx="204" cy="31" r="4"/><path class="line robot-signal" d="M201 46h27m-27 11h20m-20 11h27"/></svg>`,
    industrial: `<svg class="dce-art" viewBox="0 0 250 115"><rect class="base" x="12" y="77" width="226" height="26" rx="4"/><path class="stroke" d="M14 85h221"/><circle class="line" cx="40" cy="102" r="8"/><circle class="line" cx="86" cy="102" r="8"/><circle class="line" cx="132" cy="102" r="8"/><circle class="line" cx="178" cy="102" r="8"/><g class="parcel"><rect class="accent" x="0" y="55" width="35" height="31" rx="3"/><path d="M0 65h35M17 55v31" stroke="white" stroke-width="2"/></g><g class="parcel p2"><rect class="accent" x="0" y="55" width="35" height="31" rx="3"/><path d="M0 65h35M17 55v31" stroke="white" stroke-width="2"/></g><rect class="base" x="158" y="9" width="78" height="52" rx="7"/><g transform="translate(173 18)"><rect class="bar accent" width="12" height="33" y="9" rx="2"/><rect class="bar b2 accent" width="12" height="42" x="19" rx="2"/><rect class="bar b3 accent" width="12" height="27" x="38" y="15" rx="2"/></g></svg>`,
    systems: `<svg class="dce-art" viewBox="0 0 250 115"><rect class="base" x="18" y="12" width="164" height="84" rx="9"/><path class="line" d="M31 83h137M79 96v10m-25 0h74"/><path class="stroke code" d="m49 39-12 10 12 10m31-20 12 10-12 10M70 30 56 68"/><path class="line net" d="M117 33h27l19 17-19 20h-28"/><circle class="accent" cx="117" cy="33" r="5"/><circle class="accent" cx="163" cy="50" r="5"/><circle class="accent" cx="144" cy="70" r="5"/><circle class="packet accent" cx="191" cy="78" r="5"/><circle class="packet p2 accent" cx="207" cy="91" r="3.5"/><path class="line" d="M198 27h34m-34 13h26m-26 13h34"/></svg>`,
  };
  return art[type];
}

function showCareer(index) {
  const root = byId("career-carousel");
  const slides = [...root.querySelectorAll(".dce-slide")];
  const dots = [...root.querySelectorAll(".dce-dot")];
  if (!slides.length) return;
  careerIndex = (index + slides.length) % slides.length;
  byId("career-grid").style.transform = `translateX(-${careerIndex * 100}%)`;
  slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === careerIndex));
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === careerIndex);
    if (dotIndex === careerIndex) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
  root.style.setProperty("--active", slides[careerIndex].style.getPropertyValue("--accent"));
  clearTimeout(careerTimer);
  if (slides.length > 1 && !document.hidden && !reducedMotion.matches) {
    careerTimer = setTimeout(() => showCareer(careerIndex + 1), 9000);
  }
}

function renderCareers() {
  const grid = byId("career-grid");
  const nav = byId("career-nav");
  const carouselOrder = { chemistry: 0, mechatronics: 1, systems: 2, industrial: 3 };
  const careers = [...state.careers]
    .sort((a, b) => carouselOrder[careerType(a)] - carouselOrder[careerType(b)])
    .slice(0, 4);
  grid.replaceChildren();
  nav.replaceChildren();
  careers.forEach((career, index) => {
    const type = careerType(career);
    const content = careerPresentation(type);
    const slide = document.createElement("article");
    slide.className = `dce-slide${index === 0 ? " is-active" : ""}`;
    slide.style.setProperty("--accent", career.accent || content.accent);
    slide.style.setProperty("--wash", content.wash);
    slide.setAttribute("aria-label", career.name);

    const copy = document.createElement("div");
    copy.className = "dce-copy";
    const kicker = document.createElement("div");
    kicker.className = "dce-kicker";
    kicker.textContent = `${String(index + 1).padStart(2, "0")} · ${career.short_name || content.kicker}`;
    const title = document.createElement("h3");
    title.textContent = career.description || content.headline.join(" ");
    const description = document.createElement("p");
    description.textContent = career.description || content.description;
    const tags = document.createElement("div");
    tags.className = "dce-tags";
    content.tags.forEach((label) => {
      const tag = document.createElement("span");
      tag.textContent = label;
      tags.append(tag);
    });
    copy.append(kicker, title, description, tags);

    const visual = document.createElement("div");
    visual.className = "dce-visual";
    visual.setAttribute("aria-hidden", "true");
    visual.innerHTML = careerArt(type);
    slide.append(copy, visual);
    grid.append(slide);

    const button = document.createElement("button");
    button.className = `dce-dot${index === 0 ? " is-active" : ""}`;
    button.type = "button";
    button.style.setProperty("--dot", career.accent || content.accent);
    button.setAttribute("aria-label", `Mostrar ${career.name}`);
    const progress = document.createElement("i");
    button.append(progress);
    button.addEventListener("click", () => showCareer(index));
    nav.append(button);
  });
  document.querySelector(".dce-title-text").textContent = `Conoce nuestras ${careers.length} ingenierías`;
  careerIndex = Math.min(careerIndex, Math.max(careers.length - 1, 0));
  showCareer(careerIndex);
}

function renderAnnouncements() {
  clearInterval(announcementTimer);
  const bar = byId("announcement-bar");
  const phrase = document.querySelector(".phrase");
  phrase.before(bar);
  phrase.hidden = state.announcements.length > 0;
  phrase.style.display = state.announcements.length ? "none" : "";
  if (!state.announcements.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  let index = 0;
  const show = () => {
    const item = state.announcements[index % state.announcements.length];
    bar.dataset.priority = item.priority || "normal";
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

document.addEventListener("visibilitychange", () => {
  byId("career-carousel").classList.toggle("motion-paused", document.hidden);
  const video = byId("hero-media").querySelector("video");
  if (document.hidden) {
    clearInterval(featuredTimer);
    clearTimeout(careerTimer);
    video?.pause();
    byId("featured-card").classList.remove("carousel-running");
    return;
  }
  video?.play().catch(() => {});
  showFeaturedSlide(featuredIndex, false);
  scheduleFeaturedCarousel();
  showCareer(careerIndex);
});

reducedMotion.addEventListener?.("change", () => {
  showFeaturedSlide(featuredIndex, false);
  scheduleFeaturedCarousel();
  showCareer(careerIndex);
});

byId("career-carousel").addEventListener("mouseenter", () => clearTimeout(careerTimer));
byId("career-carousel").addEventListener("mouseleave", () => showCareer(careerIndex));
byId("career-carousel").addEventListener("focusin", () => clearTimeout(careerTimer));
byId("career-carousel").addEventListener("focusout", () => showCareer(careerIndex));

if (supabase) {
  supabase.channel("dce-original-display").on("postgres_changes", { event: "*", schema: "public" }, loadData).subscribe();
}
