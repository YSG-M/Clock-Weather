'use strict';

const STORE_KEY = 'clockweather.settings.v1';
const WX_KEY = 'clockweather.weather.v2';
const STALE_MS = 10 * 60 * 1000;       // refetch weather older than this
const OLD_MS = 3 * 60 * 60 * 1000;     // dim weather older than this
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_URL = 'https://api.open-meteo.com/v1/forecast';

const bridge = window.desktop || null;
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- strings ----------

const I18N = {
  en: {
    locale: 'en-US',
    settings: 'Settings', theme: 'Light / dark', about: 'About', fullscreen: 'Full screen', refresh: 'Refresh',
    viewList: 'List', viewDials: 'Dials',
    addCity: 'Add city', addCityLong: 'Add a city', changeHome: 'Choose home city', search: 'City name…',
    noResults: 'No matching cities', searching: 'Searching…', searchFailed: 'Search failed. Check the connection.',
    language: 'Language', timeFormat: 'Time format', h12: '12-hour', h24: '24-hour',
    unit: 'Temperature', themeLabel: 'Theme', light: 'Light', dark: 'Dark', auto: 'System',
    seconds: 'Seconds', onTop: 'Keep window on top', home: 'Home city', change: 'Change',
    on: 'Show', off: 'Hide', onTopOn: 'On', onTopOff: 'Off',
    setMain: 'Make home city', moveUp: 'Move up', moveDown: 'Move down',
    moveLeft: 'Move left', moveRight: 'Move right', remove: 'Remove',
    high: 'High', low: 'Low', feels: 'Feels', humidity: 'Humidity', wind: 'Wind',
    sunrise: 'Sunrise', sunset: 'Sunset', daylight: 'Daylight',
    yesterday: 'yesterday', tomorrow: 'tomorrow',
    loading: 'Loading weather…', updated: 'updated', offline: 'Weather unavailable, retrying every minute',
    source: 'Open-Meteo',
    aboutText: 'A world clock that also shows the weather where each city is. Times come from your computer\'s clock and time-zone database. Weather, sunrise and sunset come from Open-Meteo and refresh every ten minutes.',
    wx: {
      clear: 'Clear', mainlyClear: 'Mostly clear', partly: 'Partly cloudy', overcast: 'Overcast', fog: 'Fog',
      drizzle: 'Drizzle', freezingDrizzle: 'Freezing drizzle', rain: 'Rain', freezingRain: 'Freezing rain',
      snow: 'Snow', snowGrains: 'Snow grains', showers: 'Showers', snowShowers: 'Snow showers',
      thunder: 'Thunderstorm', thunderHail: 'Thunderstorm, hail', unknown: '—',
    },
  },
  zh: {
    locale: 'zh-CN',
    settings: '设置', theme: '浅色 / 深色', about: '关于', fullscreen: '全屏', refresh: '刷新',
    viewList: '列表', viewDials: '表盘',
    addCity: '添加城市', addCityLong: '添加城市', changeHome: '选择所在城市', search: '城市名称…',
    noResults: '没有找到城市', searching: '搜索中…', searchFailed: '搜索失败，请检查网络。',
    language: '语言', timeFormat: '时间格式', h12: '12 小时', h24: '24 小时',
    unit: '温度单位', themeLabel: '主题', light: '浅色', dark: '深色', auto: '跟随系统',
    seconds: '秒', onTop: '窗口置顶', home: '所在城市', change: '更改',
    on: '显示', off: '隐藏', onTopOn: '开', onTopOff: '关',
    setMain: '设为所在城市', moveUp: '上移', moveDown: '下移',
    moveLeft: '左移', moveRight: '右移', remove: '删除',
    high: '最高', low: '最低', feels: '体感', humidity: '湿度', wind: '风速',
    sunrise: '日出', sunset: '日落', daylight: '白昼',
    yesterday: '昨天', tomorrow: '明天',
    loading: '正在加载天气…', updated: '更新于', offline: '无法获取天气，每分钟重试',
    source: 'Open-Meteo',
    aboutText: '一个同时显示各城市天气的世界时钟。时间来自电脑的系统时钟与时区数据库；天气、日出日落来自 Open-Meteo，每十分钟刷新一次。',
    wx: {
      clear: '晴', mainlyClear: '晴间少云', partly: '多云', overcast: '阴', fog: '雾',
      drizzle: '毛毛雨', freezingDrizzle: '冻毛毛雨', rain: '雨', freezingRain: '冻雨',
      snow: '雪', snowGrains: '米雪', showers: '阵雨', snowShowers: '阵雪',
      thunder: '雷雨', thunderHail: '雷雨伴冰雹', unknown: '—',
    },
  },
};
const t = (k) => I18N[S.lang][k] ?? I18N.en[k] ?? k;

// ---------- icons (Lucide-derived, ISC) ----------

const svg = (body) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const CLOUD_BASE = '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"/>';
const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  maximize: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  minimize: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  dots: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
};
const WX_ICONS = {
  sun: ICONS.sun,
  moon: ICONS.moon,
  partly: svg('<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>'),
  partlyNight: svg('<path d="M10.19 8.5A6 6 0 0 1 16 4a1 1 0 0 0 6 6 6 6 0 0 1-3 5.2"/><path d="M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6Z"/>'),
  cloud: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
  fog: svg(`${CLOUD_BASE}<path d="M16 17H7M17 21H9"/>`),
  drizzle: svg(`${CLOUD_BASE}<path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>`),
  rain: svg(`${CLOUD_BASE}<path d="M16 14v6M8 14v6M12 16v6"/>`),
  snow: svg(`${CLOUD_BASE}<path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>`),
  thunder: svg('<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>'),
};

// WMO weather code → [description key, icon key]
function wmo(code) {
  if (code === 0) return ['clear', 'sun'];
  if (code === 1) return ['mainlyClear', 'sun'];
  if (code === 2) return ['partly', 'partly'];
  if (code === 3) return ['overcast', 'cloud'];
  if (code === 45 || code === 48) return ['fog', 'fog'];
  if (code >= 51 && code <= 55) return ['drizzle', 'drizzle'];
  if (code === 56 || code === 57) return ['freezingDrizzle', 'drizzle'];
  if (code >= 61 && code <= 65) return ['rain', 'rain'];
  if (code === 66 || code === 67) return ['freezingRain', 'rain'];
  if (code >= 71 && code <= 75) return ['snow', 'snow'];
  if (code === 77) return ['snowGrains', 'snow'];
  if (code >= 80 && code <= 82) return ['showers', 'rain'];
  if (code === 85 || code === 86) return ['snowShowers', 'snow'];
  if (code === 95) return ['thunder', 'thunder'];
  if (code === 96 || code === 99) return ['thunderHail', 'thunder'];
  return ['unknown', 'cloud'];
}

// ---------- settings ----------

const DEFAULT_CITIES = [
  { name: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'New York', tz: 'America/New_York', lat: 40.7143, lon: -74.006 },
  { name: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.6895, lon: 139.6917 },
  { name: 'Melbourne', tz: 'Australia/Melbourne', lat: -37.814, lon: 144.9633 },
];
const KNOWN_HOMES = {
  'Asia/Taipei': { name: 'Taipei', lat: 25.0478, lon: 121.5319 },
  'Asia/Shanghai': { name: 'Shanghai', lat: 31.2222, lon: 121.4581 },
  'Asia/Hong_Kong': { name: 'Hong Kong', lat: 22.2783, lon: 114.1747 },
  'Asia/Singapore': { name: 'Singapore', lat: 1.2897, lon: 103.8501 },
  'Asia/Kuala_Lumpur': { name: 'Kuala Lumpur', lat: 3.1412, lon: 101.6865 },
  'Asia/Tokyo': { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
  'Europe/London': { name: 'London', lat: 51.5085, lon: -0.1257 },
  'America/New_York': { name: 'New York', lat: 40.7143, lon: -74.006 },
  'America/Los_Angeles': { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
};

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function guessHome() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const known = KNOWN_HOMES[tz];
  if (known) return { id: uid(), tz, ...known };
  return { id: uid(), tz, name: tz.split('/').pop().replace(/_/g, ' '), lat: null, lon: null };
}

function defaultSettings() {
  return {
    lang: (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en',
    hour12: true, unit: 'C', theme: 'light', view: 'list', seconds: false, onTop: false,
    home: guessHome(),
    cities: DEFAULT_CITIES.map((c) => ({ ...c, id: uid() })),
  };
}

function loadSettings() {
  const saved = readJSON(STORE_KEY);
  if (!saved || !saved.home || !Array.isArray(saved.cities)) return defaultSettings();
  delete saved.layout; // v1 card style, replaced by `view`
  const s = { ...defaultSettings(), ...saved };
  if (s.view !== 'list' && s.view !== 'dials') s.view = 'list';
  return s;
}

let S = loadSettings();
let WX = readJSON(WX_KEY) || {};
const save = () => writeJSON(STORE_KEY, S);

// ---------- time helpers ----------

const fmtCache = new Map();
function fmt(locale, opts) {
  const k = locale + JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}

function zonedParts(tz, date) {
  const o = {};
  for (const p of fmt('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(date)) {
    if (p.type !== 'literal') o[p.type] = +p.value;
  }
  return o;
}

function offsetMinutes(tz, date) {
  const p = zonedParts(tz, date);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000);
}

function timeHTML(tz, date, seconds = S.seconds) {
  const opts = { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: S.hour12 };
  if (seconds) opts.second = '2-digit';
  return fmt(t('locale'), opts).formatToParts(date).map((p) => {
    if (p.type === 'dayPeriod') return `<span class="period">${esc(p.value)}</span>`;
    if (p.type === 'second') return `<span class="sec">${esc(p.value)}</span>`;
    if (p.type === 'literal' && /^\s+$/.test(p.value)) return '';
    return esc(p.value);
  }).join('');
}

const dateLong = (tz, date) =>
  fmt(t('locale'), { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(date);
const dateShort = (tz, date) =>
  fmt(t('locale'), { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(date);
const clockText = (date, tz) =>
  fmt(t('locale'), { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: S.hour12 }).format(date);

// Calendar-day difference between a city and the home city: -1, 0 or +1.
function dayDiff(tz, homeTz, date) {
  const a = zonedParts(tz, date);
  const b = zonedParts(homeTz, date);
  return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
}

function offsetText(min) {
  const a = Math.abs(min);
  return `UTC${min < 0 ? '−' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function diffText(min) {
  if (min === 0) return '±0 h';
  const h = Math.abs(min) / 60;
  return `${min < 0 ? '−' : '+'}${Number.isInteger(h) ? h : +h.toFixed(2)} h`;
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ---------- day / night ----------

const minuteOfDay = (tz, date) => {
  const p = zonedParts(tz, date);
  return p.hour * 60 + p.minute;
};

function sunOf(city) {
  const w = city.lat != null && WX[wxKey(city)];
  return w && w.rise != null && w.set != null && w.rise < w.set ? w : null;
}

function isNight(city, date) {
  const m = minuteOfDay(city.tz, date);
  const sun = sunOf(city);
  const [rise, set] = sun ? [sun.rise, sun.set] : [360, 1080];
  return m < rise || m >= set;
}

function paintBand(band, city) {
  const sun = sunOf(city);
  if (!sun) {
    band.style.background = '';
    band.classList.add('unknown');
    return;
  }
  band.classList.remove('unknown');
  const a = (sun.rise / 1440) * 100;
  const b = (sun.set / 1440) * 100;
  const tw = 1.2; // twilight blend, % of the day
  band.style.background = `linear-gradient(90deg,
    var(--night) 0 ${a - tw}%, var(--day) ${a + tw}% ${b - tw}%, var(--night) ${b + tw}% 100%)`;
}

function moveBandMarker(band, city, date) {
  band.firstElementChild.style.left = `${(minuteOfDay(city.tz, date) / 1440) * 100}%`;
}

// ---------- analog dial ----------

function dialSVG() {
  const rad = (deg) => (deg * Math.PI) / 180;
  const xy = (deg, r) => [(Math.sin(rad(deg)) * r).toFixed(2), (-Math.cos(rad(deg)) * r).toFixed(2)];
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const hour = i % 5 === 0;
    const [x1, y1] = xy(i * 6, hour ? 78 : 88);
    const [x2, y2] = xy(i * 6, 94);
    return `<line class="${hour ? 'tick hour-tick' : 'tick'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  return `<svg class="dial" viewBox="-102 -102 204 204" aria-hidden="true">
    <circle class="face" r="100"/>
    ${ticks}
    <line class="hand hour" x1="0" y1="12" x2="0" y2="-50"/>
    <line class="hand minute" x1="0" y1="14" x2="0" y2="-80"/>
    <line class="hand second" x1="0" y1="24" x2="0" y2="-86"/>
    <circle class="hub" r="3.4"/>
  </svg>`;
}

function mountDial(slot) {
  slot.innerHTML = dialSVG();
  return {
    svg: slot.firstElementChild,
    hour: slot.querySelector('.hour'),
    minute: slot.querySelector('.minute'),
    second: slot.querySelector('.second'),
  };
}

function setDial(dial, city, date) {
  const p = zonedParts(city.tz, date);
  dial.hour.setAttribute('transform', `rotate(${((p.hour % 12) + p.minute / 60) * 30})`);
  dial.minute.setAttribute('transform', `rotate(${(p.minute + p.second / 60) * 6})`);
  dial.second.setAttribute('transform', `rotate(${p.second * 6})`);
  dial.svg.classList.toggle('night', isNight(city, date));
}

// ---------- weather ----------

const wxKey = (c) => `${(+c.lat).toFixed(2)},${(+c.lon).toFixed(2)}`;
const deg = (c) => `${Math.round(S.unit === 'F' ? c * 9 / 5 + 32 : c)}°`;
const wind = (kmh) => (S.unit === 'F' ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);
const isoMinutes = (iso) => (typeof iso === 'string' && iso.length >= 16 ? +iso.slice(11, 13) * 60 + +iso.slice(14, 16) : null);

let wxStatus = 'loading'; // loading | ok | error
let wxInflight = false;

async function refreshWeather(force = false) {
  if (wxInflight) return;
  const now = Date.now();
  const byKey = new Map();
  for (const c of [S.home, ...S.cities]) {
    if (c.lat == null) continue;
    const e = WX[wxKey(c)];
    if (force || !e || now - e.at > STALE_MS) byKey.set(wxKey(c), c);
  }
  if (!byKey.size) return;

  wxInflight = true;
  const locs = [...byKey.values()];
  const q = new URLSearchParams({
    latitude: locs.map((c) => c.lat).join(','),
    longitude: locs.map((c) => c.lon).join(','),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '1',
  });
  try {
    const r = await fetch(`${WX_URL}?${q}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let data = await r.json();
    if (!Array.isArray(data)) data = [data];
    data.forEach((d, i) => {
      WX[wxKey(locs[i])] = {
        at: Date.now(),
        t: d.current.temperature_2m,
        feels: d.current.apparent_temperature,
        rh: d.current.relative_humidity_2m,
        code: d.current.weather_code,
        day: d.current.is_day === 1,
        wind: d.current.wind_speed_10m,
        hi: d.daily.temperature_2m_max[0],
        lo: d.daily.temperature_2m_min[0],
        rise: isoMinutes(d.daily.sunrise[0]),
        set: isoMinutes(d.daily.sunset[0]),
      };
    });
    // Forget cached weather for places no longer shown.
    const keep = new Set([S.home, ...S.cities].filter((c) => c.lat != null).map(wxKey));
    for (const k of Object.keys(WX)) if (!keep.has(k)) delete WX[k];
    writeJSON(WX_KEY, WX);
    wxStatus = 'ok';
  } catch (err) {
    console.warn('weather fetch failed', err);
    wxStatus = 'error';
  } finally {
    wxInflight = false;
  }
  renderWeather();
}

function wxIcon(w) {
  let icon = wmo(w.code)[1];
  if (!w.day && icon === 'sun') icon = 'moon';
  if (!w.day && icon === 'partly') icon = 'partlyNight';
  return WX_ICONS[icon];
}

// mode: 'hero' | 'row' | 'dial'
function wxHTML(city, mode) {
  if (city.lat == null) return '';
  const w = WX[wxKey(city)];
  if (!w) return `<span class="wx-empty">${esc(t('loading'))}</span>`;
  const desc = t('wx')[wmo(w.code)[0]];
  const old = Date.now() - w.at > OLD_MS ? ' old' : '';
  const title = `${t('updated')} ${clockText(w.at)}`;
  const main = `<div class="wx-main">${wxIcon(w)}<span class="wx-temp">${deg(w.t)}</span><span class="wx-desc">${esc(desc)}</span></div>`;

  if (mode === 'hero') {
    const item = (label, value) => `<span><em>${esc(label)}</em> ${value}</span>`;
    return `<div class="wx${old}" title="${esc(title)}">${main}
      <div class="wx-facts">${item(t('high'), deg(w.hi))}${item(t('low'), deg(w.lo))}${item(t('feels'), deg(w.feels))}${item(t('humidity'), `${Math.round(w.rh)}%`)}${item(t('wind'), wind(w.wind))}</div>
    </div>`;
  }
  return `<div class="wx${old}" title="${esc(title)}">${main}<div class="wx-range">${deg(w.hi)} / ${deg(w.lo)}</div></div>`;
}

function renderWeather() {
  $('#hero-wx').innerHTML = wxHTML(S.home, 'hero');
  paintBand($('#hero-band'), S.home);
  const sun = sunOf(S.home);
  $('#hero-sun').innerHTML = sun
    ? `<span><em>${esc(t('sunrise'))}</em> ${hhmm(sun.rise)}</span><span><em>${esc(t('sunset'))}</em> ${hhmm(sun.set)}</span><span><em>${esc(t('daylight'))}</em> ${Math.floor((sun.set - sun.rise) / 60)}h ${String((sun.set - sun.rise) % 60).padStart(2, '0')}m</span>`
    : '';

  for (const c of S.cities) {
    const v = views.get(c.id);
    if (!v) continue;
    v.wx.innerHTML = wxHTML(c, S.view === 'list' ? 'row' : 'dial');
    if (v.band) paintBand(v.band, c);
  }
  renderStatus();
  tick(false);
}

function renderStatus() {
  const el = $('#status-text');
  el.classList.toggle('error', wxStatus === 'error');
  if (wxStatus === 'error') {
    el.textContent = t('offline');
    return;
  }
  const times = Object.values(WX).map((w) => w.at);
  el.textContent = times.length
    ? `${t('source')} · ${t('updated')} ${clockText(Math.max(...times))}`
    : t('loading');
}

// ---------- main render ----------

const views = new Map(); // city id → refs used by tick() and renderWeather()
let heroDial = null;

function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#btn-theme').innerHTML = dark ? ICONS.moon : ICONS.sun;
}

function renderChrome() {
  document.documentElement.lang = S.lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  }
  for (const b of document.querySelectorAll('[data-close]')) b.innerHTML = ICONS.close;
  for (const b of document.querySelectorAll('[data-view]')) b.classList.toggle('active', b.dataset.view === S.view);
  updateFullscreenIcon();
  applyTheme();
}

function cityMenuButton(i) {
  const b = document.createElement('button');
  b.className = 'icon-btn city-menu';
  b.innerHTML = ICONS.dots;
  b.addEventListener('click', (e) => openCityMenu(e.currentTarget, i));
  return b;
}

function renderList(host) {
  S.cities.forEach((city, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="c-name"><div class="city"></div><div class="sub"></div></div>
      <div class="c-time"></div>
      <div class="c-band"><div class="band"><div class="band-now"></div></div></div>
      <div class="c-wx"></div>
      <div class="c-off"><div class="diff"></div><div class="sub utc"></div></div>`;
    $('.city', row).textContent = city.name;
    $('.city', row).title = city.tz;
    row.append(cityMenuButton(i));
    host.append(row);
    views.set(city.id, {
      time: $('.c-time', row), sub: $('.c-name .sub', row), band: $('.band', row),
      wx: $('.c-wx', row), diff: $('.diff', row), utc: $('.utc', row),
    });
  });
}

function renderDials(host) {
  S.cities.forEach((city, i) => {
    const item = document.createElement('div');
    item.className = 'dial-item';
    item.innerHTML = `
      <div class="dial-slot"></div>
      <div class="city"></div>
      <div class="d-time"></div>
      <div class="sub"></div>
      <div class="c-wx"></div>`;
    $('.city', item).textContent = city.name;
    $('.city', item).title = city.tz;
    item.append(cityMenuButton(i));
    host.append(item);
    views.set(city.id, {
      time: $('.d-time', item), sub: $('.sub', item), wx: $('.c-wx', item),
      dial: mountDial($('.dial-slot', item)),
    });
  });
}

function renderCities() {
  const host = $('#cities');
  host.innerHTML = '';
  host.className = S.view === 'list' ? 'city-list' : 'city-dials';
  views.clear();
  if (S.view === 'list') renderList(host);
  else renderDials(host);

  const add = document.createElement('button');
  add.className = 'add-city';
  add.textContent = `+ ${t('addCityLong')}`;
  add.addEventListener('click', () => openSearch('add'));
  host.append(add);
}

function renderAll() {
  renderChrome();
  heroDial = mountDial($('#hero-dial'));
  renderCities();
  renderWeather();
}

function tick(schedule = true) {
  const now = new Date();
  const home = S.home;
  const homeOff = offsetMinutes(home.tz, now);

  $('#utc-now').textContent = `UTC ${fmt('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)}`;
  $('#hero-city').textContent = home.name;
  $('#hero-zone').textContent = `${home.tz.replace(/_/g, ' ')} · ${offsetText(homeOff)}`;
  $('#hero-time').innerHTML = timeHTML(home.tz, now);
  $('#hero-date').textContent = dateLong(home.tz, now);
  setDial(heroDial, home, now);
  moveBandMarker($('#hero-band'), home, now);

  for (const c of S.cities) {
    const v = views.get(c.id);
    if (!v) continue;
    const off = offsetMinutes(c.tz, now);
    const dd = dayDiff(c.tz, home.tz, now);
    const rel = dd < 0 ? t('yesterday') : dd > 0 ? t('tomorrow') : '';
    v.time.innerHTML = timeHTML(c.tz, now, false);
    v.sub.innerHTML = esc(dateShort(c.tz, now)) + (rel ? ` <span class="rel">${esc(rel)}</span>` : '');
    if (v.diff) v.diff.textContent = diffText(off - homeOff);
    if (v.utc) v.utc.textContent = offsetText(off);
    if (v.band) moveBandMarker(v.band, c, now);
    if (v.dial) setDial(v.dial, c, now);
  }

  if (schedule) setTimeout(tick, 1000 - now.getMilliseconds() + 5);
}

// ---------- popup menu ----------

let popup = null;

function closePopup() {
  popup?.remove();
  popup = null;
}

function openPopup(anchor, items) {
  closePopup();
  popup = document.createElement('div');
  popup.className = 'popup';
  for (const it of items) {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.disabled = !!it.disabled;
    if (it.danger) b.classList.add('danger');
    b.addEventListener('click', () => { closePopup(); it.run(); });
    popup.append(b);
  }
  document.body.append(popup);
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.right - popup.offsetWidth), innerWidth - popup.offsetWidth - 8);
  const top = r.bottom + popup.offsetHeight + 8 > innerHeight ? r.top - popup.offsetHeight - 4 : r.bottom + 4;
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

document.addEventListener('pointerdown', (e) => {
  if (popup && !popup.contains(e.target)) closePopup();
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup(); });
window.addEventListener('resize', closePopup);

function openCityMenu(anchor, i) {
  const move = (to) => {
    const [c] = S.cities.splice(i, 1);
    S.cities.splice(to, 0, c);
    save();
    renderAll();
  };
  const list = S.view === 'list';
  openPopup(anchor, [
    {
      label: t('setMain'),
      run: () => {
        const old = S.home;
        S.home = S.cities[i];
        S.cities[i] = old;
        save();
        renderAll();
        refreshWeather();
      },
    },
    { label: t(list ? 'moveUp' : 'moveLeft'), disabled: i === 0, run: () => move(i - 1) },
    { label: t(list ? 'moveDown' : 'moveRight'), disabled: i === S.cities.length - 1, run: () => move(i + 1) },
    {
      label: t('remove'), danger: true,
      run: () => { S.cities.splice(i, 1); save(); renderAll(); },
    },
  ]);
}

// ---------- city search ----------

let searchMode = 'add';
let searchSeq = 0;
let searchTimer = null;

async function geocode(name) {
  const q = new URLSearchParams({ name, count: '10', language: S.lang === 'zh' ? 'zh' : 'en', format: 'json' });
  const r = await fetch(`${GEO_URL}?${q}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).filter((x) => x.timezone);
}

function openSearch(mode) {
  searchMode = mode;
  $('#search-title').textContent = t(mode === 'home' ? 'changeHome' : 'addCity');
  const input = $('#search-input');
  input.placeholder = t('search');
  input.value = '';
  $('#search-results').innerHTML = '';
  $('#search-dialog').showModal();
  input.focus();
}

function setResults(html) {
  $('#search-results').innerHTML = html;
}

$('#search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { setResults(''); return; }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    setResults(`<li class="hint">${esc(t('searching'))}</li>`);
    try {
      const results = await geocode(q);
      if (seq !== searchSeq) return;
      if (!results.length) { setResults(`<li class="hint">${esc(t('noResults'))}</li>`); return; }
      const list = $('#search-results');
      list.innerHTML = '';
      for (const r of results) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        const where = [r.admin1, r.country].filter(Boolean).join(', ');
        b.innerHTML = `<span class="r-name">${esc(r.name)}</span><span class="r-where">${esc(where)}</span><span class="r-tz">${esc(r.timezone.replace(/_/g, ' '))}</span>`;
        b.addEventListener('click', () => pickCity(r));
        li.append(b);
        list.append(li);
      }
    } catch {
      if (seq === searchSeq) setResults(`<li class="hint error">${esc(t('searchFailed'))}</li>`);
    }
  }, 300);
});

$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#search-results button')?.click();
});

function pickCity(r) {
  const city = { id: uid(), name: r.name, tz: r.timezone, lat: r.latitude, lon: r.longitude };
  if (searchMode === 'home') {
    S.home = city;
  } else {
    S.cities.push(city);
  }
  save();
  $('#search-dialog').close();
  if ($('#settings-dialog').open) renderSettings();
  renderAll();
  refreshWeather();
}

// ---------- settings ----------

function seg(key, options) {
  return `<div class="seg">${options.map(([val, label]) =>
    `<button data-key="${key}" data-val="${esc(JSON.stringify(val))}" class="${S[key] === val ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

function renderSettings() {
  const rows = [
    [t('home'), `<div class="home-row"><span>${esc(S.home.name)} <small>${esc(S.home.tz.replace(/_/g, ' '))}</small></span><button class="text-btn accent" id="btn-home">${esc(t('change'))}</button></div>`],
    [t('language'), seg('lang', [['en', 'English'], ['zh', '中文']])],
    [t('timeFormat'), seg('hour12', [[true, t('h12')], [false, t('h24')]])],
    [t('seconds'), seg('seconds', [[true, t('on')], [false, t('off')]])],
    [t('unit'), seg('unit', [['C', '°C'], ['F', '°F']])],
    [t('themeLabel'), seg('theme', [['light', t('light')], ['dark', t('dark')], ['auto', t('auto')]])],
  ];
  if (bridge) rows.push([t('onTop'), seg('onTop', [[true, t('onTopOn')], [false, t('onTopOff')]])]);
  $('#settings-body').innerHTML = rows.map(([label, ctl]) => `<div class="setting"><label>${esc(label)}</label>${ctl}</div>`).join('');
  $('#btn-home').addEventListener('click', () => openSearch('home'));
}

$('#settings-body').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-key]');
  if (!b) return;
  setSetting(b.dataset.key, JSON.parse(b.dataset.val));
});

function setSetting(key, val) {
  S[key] = val;
  save();
  if (key === 'onTop') bridge?.setAlwaysOnTop(val);
  renderAll();
  if ($('#settings-dialog').open) renderSettings();
}

// ---------- header + dialogs ----------

$('#btn-settings').addEventListener('click', () => {
  renderSettings();
  $('#settings-dialog').showModal();
});

$('#btn-add').addEventListener('click', () => openSearch('add'));

$('#btn-theme').addEventListener('click', () => {
  setSetting('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

for (const b of document.querySelectorAll('[data-view]')) {
  b.addEventListener('click', () => setSetting('view', b.dataset.view));
}

$('#btn-info').addEventListener('click', () => {
  $('#about-body').innerHTML = `
    <p>${esc(t('aboutText'))}</p>
    <p><a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a>
     · <a href="https://github.com/YSG-M/Clock-Weather" target="_blank" rel="noopener">GitHub</a></p>
    <p class="muted">Clock Weather 2.0.0 · MIT</p>`;
  $('#about-dialog').showModal();
});

$('#btn-full').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});

function updateFullscreenIcon() {
  $('#btn-full').innerHTML = document.fullscreenElement ? ICONS.minimize : ICONS.maximize;
}
document.addEventListener('fullscreenchange', updateFullscreenIcon);

$('#btn-refresh').addEventListener('click', () => refreshWeather(true));

for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) d.close();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    $('#btn-full').click();
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.addEventListener('online', () => refreshWeather(true));

// ---------- start ----------

async function resolveHomeCoords() {
  if (S.home.lat != null) return;
  try {
    const results = await geocode(S.home.name);
    const r = results.find((x) => x.timezone === S.home.tz) || results[0];
    if (!r) return;
    S.home = { ...S.home, name: r.name, lat: r.latitude, lon: r.longitude };
    save();
    renderAll();
    refreshWeather();
  } catch { /* offline: try again on next start */ }
}

if (bridge && S.onTop) bridge.setAlwaysOnTop(true);
renderAll();
tick();
refreshWeather();
resolveHomeCoords();
setInterval(refreshWeather, 60 * 1000);
