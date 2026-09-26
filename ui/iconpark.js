/**
 * IconPark Unified Vector Icon Suite for TabonKB Workbench
 * Source & Design Standard: ByteDance IconPark (https://iconpark.oceanengine.com/home)
 * Style: Clean, Modern Linear (Stroke)
 * ViewBox: 0 0 24 24
 * Stroke: currentColor, stroke-width: 2, stroke-linecap: round, stroke-linejoin: round
 */

const ICON_PARK_PATHS = {
  // Navigation & Actions
  'download': '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 3v12M7 11l5 5 5-5"/>',
  'refresh': '<path d="M21 12a9 9 0 1 1-2.636-6.364M21 3v6h-6"/>',
  'database': '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
  'close': '<path d="M18 6 6 18M6 6l12 12"/>',
  'close-circle': '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  'check': '<path d="m4 12 5 5L20 7"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-5"/>',
  'down': '<path d="m6 9 6 6 6-6"/>',
  'up': '<path d="m6 15 6-6 6 6"/>',
  'right': '<path d="m9 6 6 6-6 6"/>',
  'left': '<path d="m15 6-6 6 6 6"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
  'external': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  'copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/>',
  'send': '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',

  // Status & Mode
  'edit': '<path d="m14 4 6 6M4 20l5-1 11-11a2.828 2.828 0 0 0-4-4L5 15l-1 5z"/>',
  'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  'time': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  'setting-config': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'options': '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  'cpu': '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/>',
  'alert': '<path d="M12 2L2 20h20L12 2zM12 9v4M12 17h.01"/>',

  // Context & Domain
  'target': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  'globe': '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  'paperclip': '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  'robot': '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 2h6M9 13h.01M15 13h.01M9 17h6"/>',
  'newspaper': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M6 6h10M6 10h10M6 14h6"/>',
  'network': '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M10 7.5 6.5 15.5M14 7.5l3.5 8M8 18h8"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/>',
  'lightbulb': '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-5 11.9V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2.1A7 7 0 0 0 12 2z"/>',
  'dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  'compass': '<circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  'folder': '<path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>',

  // Model Badges & Categories
  'star': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 3v18"/>',
  'lightning': '<path d="M13 2 3 14h8l-1 8 11-12h-8l1-8z"/>',
  'code': '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6M14 4l-4 16"/>',
  'diamond': '<path d="m12 2 9 7-9 13L3 9l9-7z"/><path d="M3 9h18M12 2 8 9l4 13 4-13-4-7z"/>',
  'pic': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  'degree-hat': '<path d="M22 10 12 5 2 10l10 5 10-5zM6 12.5V17c0 3 3 5 6 5s6-2 6-5v-4.5M22 10v6"/>',
  'briefcase': '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
  'mind-mapping': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
  'pie': '<circle cx="12" cy="12" r="9"/><path d="M12 12V3a9 9 0 0 1 9 9h-9z"/>',

  // Tasks, Workflow & Knowledge
  'tasks': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'schedule': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'kanban': '<rect x="3.5" y="3.5" width="4.5" height="17" rx="1.5"/><rect x="10" y="3.5" width="4.5" height="11" rx="1.5"/><rect x="16.5" y="3.5" width="4.5" height="15" rx="1.5"/>',
  'clipboard-check': '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  'bookmark': '<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'bell': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  'topic': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'delete': '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  'hub': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="16" r="2"/><circle cx="4" cy="16" r="2"/><path d="M12 6v3M14.5 13.5 18 15.5M9.5 13.5 6 15.5"/>',
  'pause-one': '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  'circle': '<circle cx="12" cy="12" r="9"/>',
  'info-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  'layers': '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
};

/**
 * Returns IconPark vector SVG HTML string
 * @param {string} iconName - identifier in ICON_PARK_PATHS
 * @param {number|object} options - icon pixel size (number) or config object
 * @returns {string} SVG HTML string
 */
function getIconPark(iconName, options = 14) {
  let size = 14;
  let strokeWidth = 2;
  let className = '';
  let color = 'currentColor';

  if (typeof options === 'number') {
    size = options;
  } else if (options && typeof options === 'object') {
    if (options.size) size = options.size;
    if (options.strokeWidth) strokeWidth = options.strokeWidth;
    if (options.className) className = options.className;
    if (options.color) color = options.color;
  }

  const innerPath = ICON_PARK_PATHS[iconName] || ICON_PARK_PATHS['brain'];
  const fullClass = `tw-ip-icon tw-ip-${iconName}${className ? ' ' + className : ''}`;

  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${fullClass}">${innerPath}</svg>`;
}

/**
 * Automatically determine the best IconPark icon name based on model text/id
 * @param {string} modelText - Model ID or Name
 * @returns {string} IconPark icon identifier
 */
function detectModelIconPark(modelText) {
  if (!modelText) return 'brain';
  const lower = String(modelText).toLowerCase();
  // 1. Academic / Scientific (e.g. NiceArticle, Science)
  if (lower.includes('science') || lower.includes('academic') || lower.includes('article') || lower.includes('paper')) return 'degree-hat';
  // 2. Image / Drawing / Generation
  if (lower.includes('image') || lower.includes('绘图') || lower.includes('banana') || lower.includes('dall') || lower.includes('生图') || lower.includes('drawing')) return 'pic';
  // 3. Work / Enterprise
  if (lower.includes('wm') || lower.includes('work') || lower.includes('corp')) return 'briefcase';
  // 4. Thinking / Deep Reasoners
  if (lower.includes('thinking') || lower.includes('sol') || lower.includes('o3') || lower.includes('r1')) return 'brain';
  // 5. Code / Codex / Claude
  if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('codex') || lower.includes('code') || lower.includes('dev')) return 'code';
  // 6. Fast / Instant / Grok / Auto
  if (lower.includes('auto') || lower.includes('grok') || lower.includes('instant') || lower.includes('flash')) return 'lightning';
  // 7. Gemini / Flagship diamond
  if (lower.includes('gemini') || lower.includes('pro')) return 'diamond';
  return 'brain';
}

/**
 * Detect official brand category from model ID or model display name
 * @param {string} modelOrBrand
 * @returns {'openai'|'claude'|'gemini'|'grok'|'pi'|'science'|'niceaigc'}
 */
function detectModelBrand(modelOrBrand) {
  if (!modelOrBrand) return 'openai';
  const lower = String(modelOrBrand).toLowerCase().trim();
  if (lower.includes('hermes')) return 'hermes';
  if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('anthropic')) {
    return 'claude';
  }
  if (lower.includes('deepseek') || lower.includes('r1')) {
    return 'deepseek';
  }
  if (lower.includes('qwen') || lower.includes('千问') || lower.includes('alibaba')) {
    return 'qwen';
  }
  if (lower.includes('kimi') || lower.includes('moonshot')) {
    return 'kimi';
  }
  if (lower.includes('doubao') || lower.includes('豆包') || lower.includes('bytedance')) {
    return 'doubao';
  }
  if (lower.includes('gemini') || lower.includes('banana') || lower.includes('google')) {
    return 'gemini';
  }
  if (lower.includes('grok') || lower.includes('xai')) {
    return 'grok';
  }
  if (lower.includes('pi-agent') || lower === 'pi') {
    return 'pi';
  }
  if (lower.includes('nicearticle') || lower.includes('nicescience') || lower.includes('academic') || lower.includes('science') || lower.includes('paper') || lower.includes('article')) {
    return 'science';
  }
  if (lower === 'niceaigc') {
    return 'niceaigc';
  }
  if (lower.includes('glm') || lower.includes('chatglm') || lower.includes('zhipu')) {
    return 'glm';
  }
  if (lower.includes('minimax')) {
    return 'minimax';
  }
  if (lower.includes('longcat')) {
    return 'longcat';
  }
  if (lower.includes('mimo')) {
    return 'mimo';
  }
  if (lower.includes('hunyuan') || /^hy[\d.]/.test(lower)) {
    return 'hunyuan';
  }
  if (lower.includes('muse') || lower.includes('omen')) {
    return 'generic';
  }
  return 'openai';
}

/**
 * Returns authentic official vector SVG logo for AI models & brand families
 * @param {string} modelOrBrand - model id, name or brand key
 * @param {number} size - pixel dimension (default 14)
 * @returns {string} SVG HTML string
 */
function getOfficialModelSvg(modelOrBrand, size = 14) {
  const brand = detectModelBrand(modelOrBrand);
  if (brand === 'claude') {
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="#D97757" class="tw-official-brand tw-brand-claude"><path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/></svg>`;
  }

  if (brand === 'deepseek') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#0D53FF" class="tw-official-brand tw-brand-deepseek"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 13.5c-1.5 1.2-3.5 1.5-5.5.8-1.2-.4-2.2-1.3-2.8-2.3 1.2.2 2.5 0 3.6-.6 1.4-.8 2.3-2 2.7-3.4.8.9 1.5 2 1.8 3.2.3 1-.1 1.7.2 2.3z"/></svg>`;
  }

  if (brand === 'qwen') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#615CED" class="tw-official-brand tw-brand-qwen"><path d="M12 2l3 5 5 1-3.5 4.5 1 5.5-5.5-2.5L6.5 18l1-5.5L4 8l5-1 3-5z"/></svg>`;
  }

  if (brand === 'kimi') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#0066FF" class="tw-official-brand tw-brand-kimi"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M8 12l4-5 4 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (brand === 'doubao') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#3370FF" class="tw-official-brand tw-brand-doubao"><circle cx="12" cy="12" r="9.5" fill="#3370FF"/><circle cx="9" cy="10" r="1.5" fill="#FFFFFF"/><circle cx="15" cy="10" r="1.5" fill="#FFFFFF"/><path d="M8.5 14.5c1 1.5 6 1.5 7 0" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  if (brand === 'gemini') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-gemini"><defs><linearGradient id="tw-brand-gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4E82EE"/><stop offset="54%" stop-color="#9B72CF"/><stop offset="100%" stop-color="#D96570"/></linearGradient></defs><path d="M12 0C12 6.6274 6.6274 12 0 12C6.6274 12 12 17.3726 12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.6274 12 0Z" fill="url(#tw-brand-gemini-grad)"/></svg>`;
  }

  if (brand === 'grok') {
    return `<svg viewBox="60 50 390 390" width="${size}" height="${size}" fill="currentColor" class="tw-official-brand tw-brand-grok"><path d="M213.2 306l179-180v.2l51.7-51.8c-1 1.3-1.9 2.6-2.8 3.9-39.3 54.2-58.5 80.6-43.1 146.9l-.1-.1c10.6 45.1-.7 95.1-37.4 131.8-46.2 46.3-120.2 56.6-181.1 14.9l42.5-19.7c38.9 15.3 81.4 8.6 112-22 30.5-30.6 37.4-75.2 22-112.3-2.9-7-11.7-8.8-17.8-4.3L213.2 306zm-25.8 22.4l-.1.1-119.2 106.7c7.5-10.4 17-20.3 26.3-30.2 26.4-27.8 52.7-55.3 36.7-94.3-21.5-52.1-9-113.2 30.7-152.9 41.2-41.2 102-51.6 152.7-30.7 11.2 4.1 21 10.1 28.6 15.6l-42.3 19.6c-39.5-16.5-84.7-5.3-112.2 22.3-37.3 37.3-44.9 102-1.2 143.8z"/></svg>`;
  }

  if (brand === 'pi') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-pi"><rect width="24" height="24" rx="5" fill="#10B981" fill-opacity="0.15"/><path d="M5.5 8H18.5M9.5 8V16.5C9.5 16.5 9.5 17.5 8 17.5M14.5 8V15.5C14.5 16.6046 15.3954 17.5 16.5 17.5C17.6046 17.5 18 17 18 17" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (brand === 'science') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tw-official-brand tw-brand-science"><path d="M22 10 12 5 2 10l10 5 10-5zM6 12.5V17c0 3 3 5 6 5s6-2 6-5v-4.5M22 10v6"/></svg>`;
  }

  if (brand === 'niceaigc') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-niceaigc"><defs><linearGradient id="tw-brand-niceaigc-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8B5CF6"/><stop offset="50%" stop-color="#EC4899"/><stop offset="100%" stop-color="#3B82F6"/></linearGradient></defs><path d="M12 2L14.5 8.8L21.5 11.2L14.5 13.6L12 20.5L9.5 13.6L2.5 11.2L9.5 8.8L12 2Z" fill="url(#tw-brand-niceaigc-grad)"/><path d="M19 16L20 18.5L22.5 19.5L20 20.5L19 23L18 20.5L15.5 19.5L18 18.5L19 16Z" fill="url(#tw-brand-niceaigc-grad)"/></svg>`;
  }

  if (brand === 'hermes') {
    return `<img src="data:image/png;base64,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" width="${size}" height="${size}" class="tw-official-brand tw-brand-hermes" style="border-radius: 22%;" alt="Hermes" />`;
  }

  if (brand === 'glm') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-glm"><defs><linearGradient id="tw-brand-glm-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3859FF"/><stop offset="100%" stop-color="#8B5CF6"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#tw-brand-glm-grad)"/><path d="M7.5 7h9v2.5l-5.6 4.3h5.6V17h-9v-2.5l5.6-4.3H7.5z" fill="#FFFFFF"/></svg>`;
  }

  if (brand === 'minimax') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-minimax"><defs><linearGradient id="tw-brand-minimax-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF4D4F"/><stop offset="100%" stop-color="#FF7A45"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#tw-brand-minimax-grad)"/><path d="M7 16.5V8l3 3.8 2-2.4 2 2.4L17 8v8.5h-2.3v-4.2L12 15.6l-2.7-3.3v4.2z" fill="#FFFFFF"/></svg>`;
  }

  if (brand === 'longcat') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-longcat"><path d="M6.5 10.5 8 6l2.4 2.6h3.2L16 6l1.5 4.5" fill="#FF9F1C"/><circle cx="12" cy="13.5" r="6" fill="#FF9F1C"/><circle cx="9.8" cy="12.8" r="1" fill="#FFFFFF"/><circle cx="14.2" cy="12.8" r="1" fill="#FFFFFF"/><path d="M10.5 15.6c.9.8 2.1.8 3 0" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }

  if (brand === 'mimo') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-mimo"><rect width="24" height="24" rx="6" fill="#FF6900"/><text x="12" y="16" font-size="9.5" font-weight="700" fill="#FFFFFF" text-anchor="middle" font-family="-apple-system, 'Segoe UI', sans-serif">Mi</text></svg>`;
  }

  if (brand === 'hunyuan') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-hunyuan"><defs><linearGradient id="tw-brand-hunyuan-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0052D9"/><stop offset="100%" stop-color="#7C5CFF"/></linearGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#tw-brand-hunyuan-grad)"/><path d="M12 6.5a5.5 5.5 0 1 1-5.5 5.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="#FFFFFF"/></svg>`;
  }

  if (brand === 'generic') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" class="tw-official-brand tw-brand-generic"><rect width="24" height="24" rx="6" fill="#64748B" fill-opacity="0.18"/><path d="M12 6l1.8 4.2L18 12l-4.2 1.8L12 18l-1.8-4.2L6 12l4.2-1.8z" fill="#64748B"/></svg>`;
  }

  // Default / OpenAI (ChatGPT, GPT-5.6, Codex, GPT-4o, etc.)
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" class="tw-official-brand tw-brand-openai"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3428 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3428 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813v6.7227zm1.145-2.0728l3.4158-1.9681 3.411 1.9681v3.9363l-3.411 1.9681-3.4158-1.9681v-3.9363z"/></svg>`;
}

/**
 * Official vendor platform wordmarks (verbatim brand assets, canvas trimmed to content):
 * - MTK:    mediatek.com hubfs/raw_assets/public/MediaTek_Mar_2024/images/mediatek-logo.svg
 * - Unisoc: unisoc.com/images/logo-cn.svg (紫光展锐标准字, 已剔除画外杂点与依赖字体的 <text>)
 * @param {'mtk'|'unisoc'} platform
 * @param {number} size - pixel height
 * @returns {string} SVG HTML string
 */
function getVendorPlatformSvg(platform, size = 14) {
  if (platform === 'mtk') {
    return `<svg viewBox="-0.97 0.09 159.12 40.31" width="${(size * 3.948).toFixed(2)}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="tw-official-brand tw-brand-mtk"><g fill="none" fill-rule="evenodd"><path d="m137.152 36.839c-.989 1.68-3.39 3.055-5.34 3.055h-129.546c-1.948 0-2.736-1.375-1.748-3.055l19.508-33.197c.988-1.68 3.39-3.056 5.34-3.056h129.546c1.949 0 2.736 1.375 1.749 3.056z" fill="#ec9430"/><g fill="#fffffe"><path d="m117.113 26.234h3.571v-12.701h-3.571zm8.706-6.336h-.008l.008-.029 3.665-6.336h-3.57l-3.667 6.336.021.029h-.021l3.667 6.336h3.57zm-39.393-6.364h-2.867l-7.334 12.7h3.612l5.222-9.043v9.043h3.611v-12.7zm-39.116 7.406h5.62l1.218-2.083h-5.702z"/><path d="m46.16 18.35h.004c0-1.604.48-2.207 2.04-2.207h5.082l1.519-2.633h-7.135c-3.037 0-5.045 1.065-5.045 4.914v7.834h10.976l1.52-2.632h-8.961zm61.697 2.59h5.623l1.217-2.083h-5.703z"/><path d="m106.832 18.35h.004c0-1.604.48-2.207 2.042-2.207h5.08l1.52-2.633h-7.133c-3.038 0-5.045 1.065-5.045 4.914v7.834h10.975l1.52-2.632h-8.963zm-16.586-2.174h4.442v10.058h3.495v-10.058h3.287l1.524-2.642h-11.222zm-27.766 7.454h-1.938v-7.493h1.938c2.823 0 3.708.497 3.708 3.65 0 3.154-.885 3.844-3.708 3.844zm.76-10.12h-6.122v12.748h6.286c4.416 0 6.402-1.703 6.402-6.474 0-4.512-1.967-6.274-6.565-6.274zm8.559 12.724h3.571v-12.7h-3.571zm-39.115-6.246v-6.454l-4.246.013-7.324 12.673h3.502l4.497-7.779v7.727l-.031.052h.031v.014h3.571l4.397-7.793v7.793h3.571v-12.7l-4.246.013z"/></g></g></svg>`;
  }
  if (platform === 'unisoc') {
    return `<svg viewBox="244.71 39 164.85 41.55" width="${(size * 3.968).toFixed(2)}" height="${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" class="tw-official-brand tw-brand-unisoc"><path d="M376.7,57.24h1.91V54.68H376.7V53.09h-3.23v1.59h-7.39V53.21h-3.23v1.47h-2.11l.84,2.56h1.27v1.61h-2.43l.81,2.56H362v4.66a3.31,3.31,0,0,0,.55,2.25,2.72,2.72,0,0,0,2,.6l1.17,0h3.83V66.83h-3.34c-.48,0-.77-.07-.86-.21-.2-.32-.14-.62-.14-1.43V61.41H378.7V58.85h-2Zm-3.23,1.61h-7.39V57.24h7.39Z" fill="#931984"/><path d="M375.48,66.7a13.86,13.86,0,0,1-1.74-1.5H375a2.11,2.11,0,0,0,1.39-.39,2.94,2.94,0,0,0,.75-1,13.22,13.22,0,0,0,.67-1.84H374.6l-.19.56c-.14.44-.47,1.44-1,1.44h-.61l-2.3-2h-4l4.77,5.52a6.86,6.86,0,0,0,1,1,1.74,1.74,0,0,0,.85.32,12.46,12.46,0,0,0,1.66.08h3.87V66.83h-2.17a3.08,3.08,0,0,1-1-.13" fill="#931984"/><path d="M389.83,44.64h-3.28l-.72,2.81c-.05.22-.57,2.44-1,2.44h-.4V51h1.77a2.87,2.87,0,0,0,1.5-.27,1.69,1.69,0,0,0,.59-.6c.12-.22.25-.48.38-.77h5.19V46.58h-4.51Z" fill="#931984"/><path d="M385.46,55.51h1.46v3.12h-2.34l.87,2.81h1.47v5.15a3.89,3.89,0,0,0,.14,1.06,2.46,2.46,0,0,0,.57.91,2.52,2.52,0,0,0,1.75.43h3.67V66.72h-1.83a1.07,1.07,0,0,1-.71-.16q-.18-.15-.18-.78V61.44h3.45V58.63h-3.45V55.51h3.45V52.68h-9.2Z" fill="#931984"/><path d="M398.06,48.54h2v-.89h-.63c-.44,0-1.15-1.56-1.72-3h-3c.43,1.06.92,2.19,1.24,2.77a2.46,2.46,0,0,0,2.11,1.13" fill="#931984"/><path d="M405,48.54a2.45,2.45,0,0,0,2.11-1.13,28.89,28.89,0,0,0,1.24-2.77h-3c-.57,1.45-1.27,3-1.72,3h-.62v.89h2" fill="#931984"/><path d="M396.73,65s-.61,3.13-1.78,3.13h-.48l.31.85h1.83a2.82,2.82,0,0,0,2.68-1.39,47.86,47.86,0,0,0,1.61-6.73h-3.3Z" fill="#931984"/><path d="M405.35,66.13V59.74h.4c1.06,0,1.75-.27,2.05-.81a3.27,3.27,0,0,0,.46-1.65v-8H395.11V59.74h7.05v6.6c0,2.74,3.05,2.68,3.05,2.68h3.35v-1.5h-1.7a1.33,1.33,0,0,1-1.5-1.39m-.47-10a1,1,0,0,1-.16.63.62.62,0,0,1-.48.16h-5.73V52.17h6.37Z" fill="#931984"/><path d="M377.2,52.13a1.85,1.85,0,0,0,1-1.09,6.32,6.32,0,0,0,.24-2V45.21H359.54l.63,2.57h14.94V49.1c0,.56-.27.84-.8.84H359.54V45.21h-3.4V66a5,5,0,0,1-.1,1.49c-.1.2-.25.42-.5.42h-.7l.43,1.14h1.07a4.15,4.15,0,0,0,2.08-.4,2.06,2.06,0,0,0,.89-1.34,10.2,10.2,0,0,0,.23-2.43V52.53h15.74a4,4,0,0,0,1.92-.4" fill="#931984"/><path d="M311.4,54.09h9v-2h-6.19c-1.27,0-1.24-1.46-1.24-1.46V48.19h7.34v-2H313V44.65h-4s0,3.85,0,6.69a2.56,2.56,0,0,0,2.44,2.75" fill="#931984"/><path d="M299.31,54.13h9.12v-2h-2.17V48.19h2v-2h-2V44.64h-4v7.47h-.41a1.34,1.34,0,0,1-1.38-1.46V45.4H296.9v6a2.58,2.58,0,0,0,2.41,2.75" fill="#931984"/><path d="M318.22,62.88c1.56,0,2.54-1.07,2-2.48,0,0-1.44-2.91-1.44-2.91H315l1.36,2.62c.12.49-.12.68-.38.75h-7.9c3.6-1.3,6.92-3.26,8.77-5.9h-5.37a18.44,18.44,0,0,1-3.3,2.61H305a14.63,14.63,0,0,0,3.44-2.65H303.1c-1.57,2.32-6.27,2.81-6.27,2.81s.73,1.69.83,1.82H304a23,23,0,0,1-7.32,1.31l.71,2h9.21v3.77a1,1,0,0,1-1.13,1.13c-1,0-1.5,0-1.5,0l.42,1.24h4.45a2.14,2.14,0,0,0,2-2.38V62.88h7.3Z" fill="#931984"/><path d="M304.49,63.51h-4.21s-.77,3.46-2.82,4.28a9.7,9.7,0,0,1-1,.06l.43,1.19h2.59c3.75,0,5-5.53,5-5.53" fill="#931984"/><path d="M320.79,69v-1.2a9.7,9.7,0,0,1-1-.06c-2.05-.82-2.82-4.28-2.82-4.28h-4.21S314,69,317.77,69Z" fill="#931984"/><path d="M344.29,65V56.9h5.78V55h-9.84V44.66h-4.57V55H326l.61,1.95H332l-1.38,6.65s-1.08,4.28-2.68,4.28h-1.81l.42,1.16h3.9s2.72.2,3.66-1.9,2.3-9.7,2.39-10.19h3.47v8.43c0,3.75,4.16,3.66,4.16,3.66h6.27V66.93h-4A1.82,1.82,0,0,1,344.29,65" fill="#931984"/><path d="M332.38,53.75h2.8V52.52h-.86c-1.16,0-3.59-7.54-3.59-7.54h-4.32s2.06,5.43,3,7.21a3.38,3.38,0,0,0,2.92,1.56" fill="#931984"/><path d="M343.55,53.75a3.38,3.38,0,0,0,2.92-1.56c1-1.78,3-7.21,3-7.21h-4.33s-2.42,7.54-3.58,7.54h-.86v1.23h2.8" fill="#931984"/><path d="M284.51,54.6V78.83H260.13a4.79,4.79,0,0,1-4.78-4.78V70.31h4.87V74h19.37V54.63h-4.78V69.1H270l-9.73-12v12H250.5a4.79,4.79,0,0,1-4.79-4.79V40h24.37a4.73,4.73,0,0,1,4.73,4.73v3.78H270V45H250.58V64.32h4.77V49.79h4.87L270,61.85V49.77h9.71A4.84,4.84,0,0,1,284.51,54.6Z" fill="#931984" fill-rule="evenodd"/><path d="M301.53,77.29a1,1,0,0,1-.34.88,1.73,1.73,0,0,1-1,.25,1.64,1.64,0,0,1-1.07-.27,1.1,1.1,0,0,1-.3-.84V72.55H296.9v4.58a2.1,2.1,0,0,0,.72,1.73,5,5,0,0,0,4.58,0,1.8,1.8,0,0,0,.72-1.51V72.55h-1.39Z" fill="#931984"/><path d="M406.34,72.49a4.24,4.24,0,0,0-2.9.92,3,3,0,0,0-1,2.37v.48a3,3,0,0,0,1,2.37,4.24,4.24,0,0,0,2.9.92,5.57,5.57,0,0,0,1.18-.11,3.7,3.7,0,0,0,.71-.21V78.14c-.19.07-.43.15-.72.23a3.75,3.75,0,0,1-1,.12,2.28,2.28,0,0,1-1.62-.56,2.4,2.4,0,0,1-.61-1.82v-.19a2.39,2.39,0,0,1,.61-1.81,2.28,2.28,0,0,1,1.62-.56,3.39,3.39,0,0,1,1,.12,6.21,6.21,0,0,1,.72.23V72.81a3.7,3.7,0,0,0-.71-.21,5.57,5.57,0,0,0-1.18-.11" fill="#931984"/><path d="M386.56,73.3a3.56,3.56,0,0,0-2.64-1,3.77,3.77,0,0,0-2.65,6.26,3.63,3.63,0,0,0,2.65.94,3.59,3.59,0,0,0,2.64-.94,4.22,4.22,0,0,0,0-5.31Zm-1.32,4.55a1.67,1.67,0,0,1-2.64,0,3.25,3.25,0,0,1-.46-1.9,3.29,3.29,0,0,1,.46-1.9,1.51,1.51,0,0,1,1.32-.64,1.55,1.55,0,0,1,1.32.64,3.37,3.37,0,0,1,.46,1.9A3.33,3.33,0,0,1,385.24,77.85Z" fill="#931984"/><path d="M365.5,72.7l-.09,1a6.09,6.09,0,0,0-.93-.21,4.86,4.86,0,0,0-.82-.07,2.35,2.35,0,0,0-1.1.2.62.62,0,0,0-.1,1.09,6.19,6.19,0,0,0,1.26.64l.15.07c1.42.6,2.12,1.26,2.12,2a1.7,1.7,0,0,1-.9,1.48,4.52,4.52,0,0,1-2.37.56,8.08,8.08,0,0,1-1.2-.09,6.62,6.62,0,0,1-1.08-.23l.13-1a7.24,7.24,0,0,0,1.05.3,5.86,5.86,0,0,0,1,.1,2.23,2.23,0,0,0,1.13-.24.71.71,0,0,0,.42-.63c0-.41-.51-.83-1.54-1.26l-.34-.14a5.14,5.14,0,0,1-1.56-.9,1.31,1.31,0,0,1-.42-1,1.52,1.52,0,0,1,.87-1.36,4.59,4.59,0,0,1,2.34-.51,8.22,8.22,0,0,1,1,.06C364.85,72.58,365.18,72.64,365.5,72.7Z" fill="#931984"/><rect x="341.24" y="72.55" width="1.88" height="6.8" fill="#931984"/><polygon points="322.39 79.3 323.96 79.3 323.96 72.44 322.39 72.44 322.39 77.32 319.16 72.44 317.63 72.44 317.63 79.28 317.63 79.28 317.63 79.3 319.18 79.3 319.18 79.28 319.18 79.28 319.18 74.78 322.39 79.3" fill="#931984"/></svg>`;
  }
  return '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getIconPark, detectModelIconPark, detectModelBrand, getOfficialModelSvg, getVendorPlatformSvg, ICON_PARK_PATHS };
}
