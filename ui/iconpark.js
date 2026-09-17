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
  'folder': '<path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>',

  // Model Badges & Categories
  'star': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  'brain': '<path d="M9.5 2a4 4 0 0 0-4 4c0 .5.1 1 .3 1.4A4 4 0 0 0 4 11a4 4 0 0 0 1.6 3.2A4 4 0 0 0 5 18a4 4 0 0 0 4.5 4M14.5 2a4 4 0 0 1 4 4c0 .5-.1 1-.3 1.4A4 4 0 0 1 20 11a4 4 0 0 1-1.6 3.2A4 4 0 0 1 19 18a4 4 0 0 1-4.5 4M12 2v20M9.5 7h2.5M12 12h-2.5M9.5 17h2.5M12 7h2.5M14.5 12H12M12 17h2.5"/>',
  'lightning': '<path d="M13 2 3 14h8l-1 8 11-12h-8l1-8z"/>',
  'code': '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6M14 4l-4 16"/>',
  'diamond': '<path d="m12 2 9 7-9 13L3 9l9-7z"/><path d="M3 9h18M12 2 8 9l4 13 4-13-4-7z"/>',
  'pic': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  'degree-hat': '<path d="M22 10 12 5 2 10l10 5 10-5zM6 12.5V17c0 3 3 5 6 5s6-2 6-5v-4.5M22 10v6"/>',
  'briefcase': '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  'sparkles': '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z"/>',
  'pie': '<circle cx="12" cy="12" r="9"/><path d="M12 12V3a9 9 0 0 1 9 9h-9z"/>'
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
  if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('anthropic')) {
    return 'claude';
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

  // Default / OpenAI (ChatGPT, GPT-5.6, Codex, GPT-4o, etc.)
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" class="tw-official-brand tw-brand-openai"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3428 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3428 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813v6.7227zm1.145-2.0728l3.4158-1.9681 3.411 1.9681v3.9363l-3.411 1.9681-3.4158-1.9681v-3.9363z"/></svg>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getIconPark, detectModelIconPark, detectModelBrand, getOfficialModelSvg, ICON_PARK_PATHS };
}
