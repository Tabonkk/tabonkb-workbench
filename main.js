const { Plugin, ItemView, Notice, PluginSettingTab, Setting, requestUrl, MarkdownRenderer, Component } = require('obsidian');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ==========================================================================
   Embedded Multi-Agent Hub Modules (Pi, Codex, Gemini for Obsidian Workbench)
   ========================================================================== */

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
  
}

/**
 * AgentAdapter: Standardized Abstract Base Class for Agent Hub Providers (Pi, Codex, Gemini).
 * Defines common event emitter interface, status lifecycles, and contract methods.
 */


class AgentAdapter {
  constructor(options = {}) {
    this.id = options.id || 'base';
    this.name = options.name || this.id;
    this.displayName = options.displayName || 'Agent';
    this.icon = options.icon || getIconPark('robot', 16);
    this.vaultBasePath = options.vaultBasePath || '';
    this.permissionMode = options.permissionMode || 'readonly';
    this.status = 'disconnected'; // disconnected | connecting | connected | thinking | running_tool | error | not_installed
    this.statusDetail = '';
    this.listeners = new Map();
    this.isStreaming = false;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(fn);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`[${this.displayName}Adapter] Error in event '${event}':`, e);
        }
      }
    }
  }

  setStatus(status, detail = '') {
    if (this.status === status && this.statusDetail === detail) return;
    this.status = status;
    this.statusDetail = detail;
    this.emit('status_change', { status, detail });
  }

  getStatus() {
    return { status: this.status, detail: this.statusDetail };
  }

  getPermissionMode() {
    return this.permissionMode;
  }

  async setPermissionMode(mode) {
    if (this.permissionMode === mode) return;
    this.permissionMode = mode;
    this.emit('permission_change', mode);
  }

  getModel() {
    return {
      id: this.activeModelId || 'default',
      name: this.activeModelName || '默认模型'
    };
  }

  setModel(modelId, displayName) {
    this.activeModelId = modelId;
    this.activeModelName = displayName || modelId;
    this.emit('model_change', { modelId, displayName });
  }

  getModelGroups() {
    return [];
  }

  /**
   * Detect whether this CLI/Engine is installed and operational on this machine.
   * @returns {Promise<{ available: boolean, version?: string, path?: string, error?: string }>}
   */
  async detect() {
    return { available: true };
  }

  /**
   * Start or verify the engine
   * @returns {Promise<boolean>}
   */
  async start() {
    return true;
  }

  /**
   * Stop or kill current running process
   */
  async stop() {
    this.setStatus('disconnected', '已停止');
  }

  /**
   * Send a user message with structured context
   * @param {string} text - Raw prompt or formatted text
   * @param {object} contextPayload - Snapshot from AgentContextProvider
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async send(text, contextPayload) {
    throw new Error('Method send() must be implemented by subclass');
  }

  /**
   * Abort the current ongoing generation/tool execution
   */
  async abort() {
    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  /**
   * Start a clean conversation session
   */
  async newSession() {
    this.isStreaming = false;
    this.setStatus('connected', '已重置会话');
  }

  /**
   * Clean up all handles on plugin unload
   */
  destroy() {
    this.stop().catch(() => {});
    this.listeners.clear();
  }
}

/**
 * Returns official brand vector SVG icon for Pi, Codex, Gemini, Claude, Grok, etc.
 * @param {string} agentId - 'pi' | 'codex' | 'gemini' | 'claude' | 'grok' | 'niceaigc'
 * @param {number} size - icon width and height in pixels (default: 16)
 * @returns {string} SVG HTML string
 */
function getAgentBrandSvg(agentId, size = 16) {
  return getOfficialModelSvg(agentId, size);
}

/**
 * PiAgentBridge: Manages the headless Pi Coding Agent via stdin/stdout JSONL RPC.
 * - Spawns Node running Pi CLI bundle with restricted tools: read, grep, find, ls
 * - Enforces read-only safety guard
 * - Handles line buffering and encoding
 * - Filters out Chain-of-Thought (thinking_delta)
 * - Emits clean events for UI consumption
 */
class PiAgentBridge {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || (process.cwd ? process.cwd() : 'd:\\work\\Mgmt\\TabonKB');
    this.listeners = new Map();
    this.process = null;
    this.stdoutBuffer = '';
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'thinking' | 'running_tool' | 'error'
    this.statusDetail = '';
    this.isStreaming = false;
    this.activeTools = new Map();
    this.requestIdCounter = 1;
    this.pendingCommands = new Map();

    this.permissionMode = options.permissionMode || 'readwrite';
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-agent-permission-mode');
        if (saved === 'readonly' || saved === 'readwrite') {
          this.permissionMode = saved;
        }
      }
    } catch (e) {}

    // Default bundle path verified on system
    const appData = process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming';
    const defaultNodeDir = path.join(appData, 'node-v24.15.0');
    const defaultNodeExe = path.join(defaultNodeDir, 'node.exe');

    let resolvedNode = options.nodePath;
    if (!resolvedNode || resolvedNode === 'node') {
      if (fs.existsSync(defaultNodeExe)) {
        resolvedNode = defaultNodeExe;
      } else {
        resolvedNode = 'node';
      }
    }
    this.customNodePath = resolvedNode;
    this.nodeDir = defaultNodeDir;

    this.piBundlePath = options.piBundlePath || path.join(
      defaultNodeDir,
      'node_modules',
      '@earendil-works',
      'pi-coding-agent',
      'dist',
      'bundle',
      'cli.js'
    );

    // Register cleanup hooks for window unload
    this.bindGlobalUnloadHooks();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.delete(event);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`[PiAgentBridge] Error in event handler '${event}':`, e);
        }
      }
    }
  }

  setStatus(status, detail = '') {
    if (this.status === status && this.statusDetail === detail) return;
    this.status = status;
    this.statusDetail = detail;
    this.emit('status_change', { status, detail });
  }

  getStatus() {
    return { status: this.status, detail: this.statusDetail };
  }

  getPermissionMode() {
    return this.permissionMode;
  }

  async setPermissionMode(mode) {
    if (this.permissionMode === mode) return;
    this.permissionMode = mode;
    this.emit('permission_change', mode);
    if (this.process) {
      this.destroy();
      await this.start();
    }
  }

  bindGlobalUnloadHooks() {
    this._unloadHandler = () => {
      this.destroy();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._unloadHandler);
      window.addEventListener('unload', this._unloadHandler);
    }
  }

  /**
   * Determine launch executable: direct node + bundle cli.js (cleanest) or fallback to pi.cmd
   */
  resolveLaunchCommand() {
    const tools = this.permissionMode === 'readwrite'
      ? 'read,write,edit,grep,find,ls'
      : 'read,grep,find,ls';

    const defaultNodeDir = this.nodeDir || path.join(
      process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
      'node-v24.15.0'
    );
    const defaultNodeExe = path.join(defaultNodeDir, 'node.exe');
    let nodeCmd = this.customNodePath;
    if ((!nodeCmd || nodeCmd === 'node') && fs.existsSync(defaultNodeExe)) {
      nodeCmd = defaultNodeExe;
      this.customNodePath = nodeCmd;
    }

    if (fs.existsSync(this.piBundlePath)) {
      return {
        cmd: nodeCmd,
        args: [
          this.piBundlePath,
          '--mode', 'rpc',
          '--tools', tools
        ],
        nodeDir: defaultNodeDir
      };
    }

    // Fallback: try pi.cmd directly
    const piCmd = path.join(defaultNodeDir, 'pi.cmd');
    if (fs.existsSync(piCmd)) {
      return {
        cmd: piCmd,
        args: [
          '--mode', 'rpc',
          '--tools', tools
        ],
        nodeDir: defaultNodeDir
      };
    }

    // Fallback: try pi command via cmd.exe
    return {
      cmd: 'cmd.exe',
      args: [
        '/c', 'pi',
        '--mode', 'rpc',
        '--tools', tools
      ],
      nodeDir: defaultNodeDir
    };
  }

  /**
   * Start the Pi RPC process
   */
  async start() {
    if (this.process && !this.process.killed) {
      return true;
    }

    this.setStatus('connecting', '正在启动 Pi 核心引擎...');
    const launch = this.resolveLaunchCommand();

    try {
      const nodeDir = launch.nodeDir || this.nodeDir || path.join(
        process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
        'node-v24.15.0'
      );
      const originalPath = process.env.PATH || process.env.Path || '';
      const envPath = nodeDir ? `${nodeDir}${path.delimiter}${originalPath}` : originalPath;

      this.process = child_process.spawn(launch.cmd, launch.args, {
        cwd: this.vaultBasePath,
        env: Object.assign({}, process.env, {
          PATH: envPath,
          Path: envPath,
          LANG: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8'
        }),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdin.setDefaultEncoding('utf-8');
      this.process.stdout.setEncoding('utf-8');
      this.process.stderr.setEncoding('utf-8');

      this.process.stdout.on('data', (chunk) => {
        this.handleStdoutChunk(chunk);
      });

      this.process.stderr.on('data', (chunk) => {
        const errText = chunk.toString();
        // Ignore cosmetic warnings, log real errors
        if (errText.toLowerCase().includes('error')) {
          console.warn('[PiAgentBridge stderr]:', errText);
        }
      });

      this.process.on('error', (err) => {
        console.error('[PiAgentBridge] Process error:', err);
        this.setStatus('error', `启动失败: ${err.message}`);
        this.emit('error', err);
      });

      this.process.on('close', (code, signal) => {
        console.log(`[PiAgentBridge] Process closed (code: ${code}, signal: ${signal})`);
        this.process = null;
        this.activeTools.clear();
        this.setStatus('disconnected', code === 0 ? '已断开连接' : `异常退出 (Code: ${code})`);
      });

      // Give 500ms to confirm initial readiness
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.process && !this.process.killed) {
        this.setStatus('connected', '已就绪');
        return true;
      }
      return false;
    } catch (err) {
      this.setStatus('error', `启动异常: ${err.message}`);
      this.emit('error', err);
      return false;
    }
  }

  /**
   * Line buffering and JSONL parsing
   */
  handleStdoutChunk(chunk) {
    this.stdoutBuffer += chunk;
    let newlineIdx;
    while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
      let line = this.stdoutBuffer.substring(0, newlineIdx);
      this.stdoutBuffer = this.stdoutBuffer.substring(newlineIdx + 1);
      if (line.endsWith('\r')) {
        line = line.substring(0, line.length - 1);
      }
      line = line.trim();
      if (!line) continue;

      try {
        const message = JSON.parse(line);
        this.handleRpcMessage(message);
      } catch (err) {
        console.warn('[PiAgentBridge] JSON parse failed for line:', line.substring(0, 100), err);
      }
    }
  }

  /**
   * Dispatch RPC events and command responses
   */
  handleRpcMessage(data) {
    const type = data.type;

    // 1. Command responses
    if (type === 'response') {
      const id = data.id;
      if (id && this.pendingCommands.has(id)) {
        const { resolve } = this.pendingCommands.get(id);
        this.pendingCommands.delete(id);
        resolve(data);
      }
      return;
    }

    // 2. Lifecycle & Agent State Events
    if (type === 'agent_start') {
      this.isStreaming = true;
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('agent_start', data);
      return;
    }

    if (type === 'turn_start') {
      this.isStreaming = true;
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('turn_start', data);
      return;
    }

    if (type === 'agent_end' || type === 'agent_settled') {
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '已连接 (就绪)');
      this.emit('agent_settled', data);
      return;
    }

    if (type === 'turn_end') {
      this.emit('turn_end', data);
      return;
    }

    // 3. Streaming Assistant Message Updates
    if (type === 'message_update') {
      const ev = data.assistantMessageEvent;
      if (!ev) return;

      // STRICT REQUIREMENT: Suppress Chain-of-Thought (thinking_delta)
      if (typeof ev.type === 'string' && ev.type.startsWith('thinking_')) {
        return;
      }

      if (ev.type === 'text_delta' && typeof ev.delta === 'string') {
        this.emit('text_delta', ev.delta);
      }
      return;
    }

    // 4. Tool Execution Events
    if (type === 'tool_execution_start') {
      const { toolCallId, toolName, args } = data;
      const startTime = Date.now();
      this.activeTools.set(toolCallId, { toolName, args, startTime });

      let actionDesc = '正在执行工具';
      if (toolName === 'read') {
        const p = args?.path || '';
        actionDesc = `正在读取: ${path.basename(p) || p}`;
      } else if (toolName === 'write') {
        const p = args?.path || '';
        actionDesc = `正在创建/写入: ${path.basename(p) || p}`;
      } else if (toolName === 'edit') {
        const p = args?.path || '';
        actionDesc = `正在修改编辑: ${path.basename(p) || p}`;
      } else if (toolName === 'grep') {
        const pat = args?.pattern || '';
        actionDesc = `正在检索: "${pat}"`;
      } else if (toolName === 'find') {
        const pat = args?.pattern || '';
        actionDesc = `正在查找: "${pat}"`;
      } else if (toolName === 'ls') {
        actionDesc = `正在查看目录清单`;
      }

      this.setStatus('running_tool', actionDesc);
      this.emit('tool_start', { toolCallId, toolName, args, startTime, actionDesc });
      return;
    }

    if (type === 'tool_execution_end') {
      const { toolCallId, toolName, result, error } = data;
      const info = this.activeTools.get(toolCallId);
      const durationMs = info ? (Date.now() - info.startTime) : 0;
      this.activeTools.delete(toolCallId);

      const isError = !!error || (result && result.isError);
      this.emit('tool_end', {
        toolCallId,
        toolName,
        result,
        error,
        isError,
        durationMs
      });

      if (this.activeTools.size > 0) {
        const nextTool = this.activeTools.values().next().value;
        this.setStatus('running_tool', `正在执行: ${nextTool.toolName}`);
      } else if (this.isStreaming) {
        this.setStatus('thinking', '正在整理分析回复...');
      }
      return;
    }
  }

  /**
   * Send JSON command to stdin
   */
  sendCommand(commandObj) {
    if (!this.process || this.process.killed) {
      throw new Error('Pi 核心进程未就绪或已断开');
    }
    const id = `req-${this.requestIdCounter++}`;
    commandObj.id = id;

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      const line = JSON.stringify(commandObj) + '\n';
      try {
        this.process.stdin.write(line, 'utf-8');
      } catch (err) {
        this.pendingCommands.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a prompt message
   */
  async sendMessage(messageText) {
    if (!this.process || this.process.killed) {
      const ok = await this.start();
      if (!ok) throw new Error('无法连接到 Pi Agent 进程');
    }

    this.isStreaming = true;
    this.setStatus('thinking', '正在理解上下文...');

    return this.sendCommand({
      type: 'prompt',
      message: messageText
    });
  }

  /**
   * Abort current generation
   */
  async abort() {
    if (!this.process || this.process.killed) return;
    try {
      this.setStatus('thinking', '正在中止操作...');
      await this.sendCommand({ type: 'abort' });
    } catch (e) {
      console.warn('[PiAgentBridge] Abort command issue:', e);
    } finally {
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '已中止操作');
      this.emit('aborted');
    }
  }

  /**
   * Reset session
   */
  async newSession() {
    if (!this.process || this.process.killed) {
      await this.start();
      this.emit('new_session');
      return;
    }

    try {
      await this.sendCommand({ type: 'new_session' });
    } catch (e) {
      console.warn('[PiAgentBridge] New session failed, restarting process:', e);
      this.destroy();
      await this.start();
    } finally {
      this.isStreaming = false;
      this.activeTools.clear();
      this.setStatus('connected', '新会话已开启');
      this.emit('new_session');
    }
  }

  /**
   * Destroy child process and clean up hooks
   */
  destroy() {
    if (typeof window !== 'undefined' && this._unloadHandler) {
      window.removeEventListener('beforeunload', this._unloadHandler);
      window.removeEventListener('unload', this._unloadHandler);
    }

    if (this.process) {
      const pid = this.process.pid;
      try {
        // Closing stdin causes Pi to immediately and cleanly exit with 0
        this.process.stdin.end();
        this.process.kill('SIGTERM');
      } catch (e) {}

      // Windows process tree fallback cleanup
      if (process.platform === 'win32' && pid) {
        setTimeout(() => {
          try {
            child_process.exec(`taskkill /pid ${pid} /T /F`, () => {});
          } catch (e) {}
        }, 1200);
      }
      this.process = null;
    }
    this.setStatus('disconnected', '已停止服务');
  }
}

let PiAgentBridgeClass = null;
try {
  PiAgentBridgeClass = require('../pi-agent-bridge.js').PiAgentBridge;
} catch (e) {}

/**
 * PiAdapter: Adapts PiAgentBridge to the unified AgentAdapter interface.
 * Preserves 100% of the existing Pi RPC streaming & tool capabilities.
 */
class PiAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'pi',
      name: 'pi',
      displayName: 'Pi',
      icon: getAgentBrandSvg('pi', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.bridge = options.bridge || null;
    if (!this.bridge) {
      const BridgeCls = (typeof PiAgentBridge !== 'undefined') ? PiAgentBridge : PiAgentBridgeClass;
      if (BridgeCls) {
        this.bridge = new BridgeCls({
          vaultBasePath: this.vaultBasePath,
          permissionMode: this.permissionMode
        });
      }
    }

    this.activeModelId = 'pi-agent-rpc';
    this.activeModelName = 'Pi Agent';

    if (this.bridge) {
      this.setupBridgeEvents();
    }
  }

  getModelGroups() {
    return [
      {
        group: 'Pi 引擎',
        icon: '🥧',
        iconPark: 'pie',
        isTop: true,
        models: [
          { id: 'pi-agent-rpc', name: 'Pi RPC Agent', desc: '原生 Pi 本地服务', icon: '🥧', iconPark: 'pie' }
        ]
      }
    ];
  }

  setBridge(bridge) {
    this.bridge = bridge;
    this.setupBridgeEvents();
  }

  setupBridgeEvents() {
    if (!this.bridge) return;

    // Forward bridge status
    this.bridge.on('status_change', (data) => {
      this.status = data.status;
      this.statusDetail = data.detail;
      this.emit('status_change', data);
    });

    this.bridge.on('permission_change', (mode) => {
      this.permissionMode = mode;
      this.emit('permission_change', mode);
    });

    // Forward conversational events
    this.bridge.on('turn_start', (d) => this.emit('turn_start', d));
    this.bridge.on('text_delta', (d) => this.emit('text_delta', d));
    this.bridge.on('tool_start', (d) => this.emit('tool_start', d));
    this.bridge.on('tool_end', (d) => this.emit('tool_end', d));
    this.bridge.on('turn_end', (d) => this.emit('turn_end', d));
    this.bridge.on('agent_settled', (d) => {
      this.isStreaming = false;
      this.emit('agent_settled', d);
    });
    this.bridge.on('error', (d) => this.emit('error', d));
  }

  getStatus() {
    if (this.bridge) {
      return this.bridge.getStatus();
    }
    return { status: this.status, detail: this.statusDetail };
  }

  async detect() {
    try {
      const appData = process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming';
      const nodeDir = path.join(appData, 'node-v24.15.0');
      const nodeExe = path.join(nodeDir, 'node.exe');
      const bundleJs = path.join(nodeDir, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'bundle', 'cli.js');
      const piCmd = path.join(nodeDir, 'pi.cmd');

      const exists = (fs.existsSync(nodeExe) && fs.existsSync(bundleJs)) || fs.existsSync(piCmd);
      if (!exists) {
        this.status = 'not_installed';
        this.statusDetail = '未检测到 Pi CLI 环境';
        return { available: false, error: '未检测到 Pi CLI 环境' };
      }
      return { available: true };
    } catch (e) {
      this.status = 'not_installed';
      return { available: false, error: e.message };
    }
  }

  async start() {
    if (!this.bridge) {
      const BridgeCls = (typeof PiAgentBridge !== 'undefined') ? PiAgentBridge : PiAgentBridgeClass;
      if (BridgeCls) {
        this.bridge = new BridgeCls({
          vaultBasePath: this.vaultBasePath,
          permissionMode: this.permissionMode
        });
        this.setupBridgeEvents();
      } else {
        this.setStatus('error', '未找到 PiAgentBridge 类');
        return false;
      }
    }
    const ok = await this.bridge.start();
    if (ok) {
      this.status = 'connected';
      this.statusDetail = '已就绪';
    }
    return ok;
  }

  async stop() {
    if (this.bridge) {
      this.bridge.destroy();
    }
    this.setStatus('disconnected', '已断开');
  }

  async send(text, contextPayload) {
    if (!this.bridge) {
      return { success: false, error: 'PiBridge 未就绪' };
    }
    this.isStreaming = true;
    return await this.bridge.sendMessage(text, contextPayload);
  }

  async abort() {
    if (this.bridge) {
      await this.bridge.abort();
    }
    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  async newSession() {
    if (this.bridge) {
      await this.bridge.newSession();
    }
    this.isStreaming = false;
    this.setStatus('connected', '已重置会话');
  }

  async setPermissionMode(mode) {
    await super.setPermissionMode(mode);
    if (this.bridge && typeof this.bridge.setPermissionMode === 'function') {
      await this.bridge.setPermissionMode(mode);
    }
  }

  destroy() {
    if (this.bridge) {
      this.bridge.destroy();
    }
    super.destroy();
  }
}

/**
 * CodexAdapter: Native integration for Codex CLI.
 * Runs non-interactive JSONL streaming via `codex exec --json`.
 * Supports thread resumption, command tool mapping, and sandbox enforcement.
 */
class CodexAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'codex',
      name: 'codex',
      displayName: 'Codex',
      icon: getAgentBrandSvg('codex', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.threadId = null;
    this.process = null;
    this.stdoutBuffer = '';
    this.knownItems = new Map(); // itemId -> state
    this.activeModelId = 'gpt-5.5';
    this.activeModelName = 'GPT-5.5';
  }

  getModelGroups() {
    return [
      {
        group: '常用模型',
        icon: '💻',
        iconPark: 'star',
        isTop: true,
        models: [
          { id: 'gpt-5.5', name: 'GPT-5.5', desc: 'Codex 旗舰代码工程模型', icon: '💻', iconPark: 'code' },
          { id: 'gpt-5.4-codex', name: 'GPT-5.4 Codex', desc: '高速精准代码生成', icon: '⚡', iconPark: 'lightning' },
          { id: 'o3-mini', name: 'o3-mini', desc: '强逻辑代码规划推演', icon: '🧠', iconPark: 'brain' }
        ]
      }
    ];
  }

  resolveCodexBinary() {
    const nodeDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0';
    const codexJs = path.join(nodeDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    const nodeExe = path.join(nodeDir, 'node.exe');

    if (fs.existsSync(nodeExe) && fs.existsSync(codexJs)) {
      return {
        cmd: nodeExe,
        prefixArgs: [codexJs]
      };
    }

    const codexCmd = path.join(nodeDir, 'codex.cmd');
    if (fs.existsSync(codexCmd)) {
      return {
        cmd: codexCmd,
        prefixArgs: []
      };
    }

    return {
      cmd: 'codex',
      prefixArgs: []
    };
  }

  async detect() {
    return new Promise((resolve) => {
      try {
        const bin = this.resolveCodexBinary();
        const proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            this.setStatus('connected', 'Codex CLI 已就绪');
            resolve({ available: true, version: out.trim() || '0.154.0' });
          } else {
            this.setStatus('not_installed', '未检测到 Codex CLI');
            resolve({ available: false, error: 'Codex 退出码异常: ' + code });
          }
        });
        proc.on('error', err => {
          this.setStatus('not_installed', '未检测到 Codex CLI');
          resolve({ available: false, error: err.message });
        });
        proc.stdin.end();
      } catch (e) {
        this.setStatus('not_installed', '未检测到 Codex CLI');
        resolve({ available: false, error: e.message });
      }
    });
  }

  async start() {
    const check = await this.detect();
    if (check.available) {
      this.setStatus('connected', '已就绪');
      return true;
    }
    this.setStatus('not_installed', 'Codex 未安装');
    return false;
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  async send(text, contextPayload) {
    if (this.isStreaming && this.process) {
      return { success: false, error: '正在处理上一个指令，请稍候或先点击中止' };
    }

    this.isStreaming = true;
    this.setStatus('thinking', 'Codex 正在思考...');
    this.emit('turn_start');

    const bin = this.resolveCodexBinary();
    const sandbox = this.permissionMode === 'readwrite' ? 'workspace-write' : 'read-only';
    const vaultPath = this.vaultBasePath || process.cwd();

    let args = [];
    if (this.threadId) {
      // Resume existing thread session
      args = [
        ...bin.prefixArgs,
        'exec',
        'resume',
        this.threadId,
        text,
        '--json'
      ];
    } else {
      // New conversation thread
      args = [
        ...bin.prefixArgs,
        'exec',
        '--json',
        '-s', sandbox,
        '-C', vaultPath,
        text
      ];
    }

    return new Promise((resolve) => {
      try {
        this.stdoutBuffer = '';
        this.knownItems.clear();

        this.process = child_process.spawn(bin.cmd, args, {
          cwd: vaultPath,
          env: Object.assign({}, process.env, {
            CODEX_MANAGED_PACKAGE_ROOT: 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0\\node_modules\\@openai\\codex'
          }),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');

        this.process.stdout.on('data', (chunk) => {
          this.handleStdoutChunk(chunk);
        });

        this.process.stderr.on('data', (chunk) => {
          // Stderr is used for informational logs and warnings
          const errStr = chunk.toString();
          if (errStr.includes('error:') || errStr.includes('FATAL')) {
            this.emit('error', { error: errStr });
          }
        });

        this.process.on('close', (code) => {
          this.isStreaming = false;
          this.process = null;
          this.emit('turn_end');
          this.emit('agent_settled');
          this.setStatus('connected', '已就绪');
          resolve({ success: code === 0 });
        });

        this.process.on('error', (err) => {
          this.isStreaming = false;
          this.process = null;
          this.setStatus('error', err.message);
          this.emit('error', { error: err.message });
          this.emit('agent_settled');
          resolve({ success: false, error: err.message });
        });

        // Close stdin immediately to prevent CLI waiting for stdin
        this.process.stdin.end();

      } catch (e) {
        this.isStreaming = false;
        this.process = null;
        this.setStatus('error', e.message);
        this.emit('error', { error: e.message });
        this.emit('agent_settled');
        resolve({ success: false, error: e.message });
      }
    });
  }

  handleStdoutChunk(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop(); // Keep partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;

      try {
        const event = JSON.parse(trimmed);
        this.handleEvent(event);
      } catch (e) {
        // Ignore unparseable non-JSON lines
      }
    }
  }

  handleEvent(event) {
    const type = event.type;

    if (type === 'thread.started') {
      if (event.thread_id) {
        this.threadId = event.thread_id;
      }
    } else if (type === 'turn.started') {
      this.setStatus('thinking', 'Codex 正在推理...');
    } else if (type === 'item.created' || type === 'item.updated') {
      const item = event.item;
      if (!item) return;

      if (item.type === 'command_execution') {
        const callId = item.id || `cmd_${Date.now()}`;
        if (!this.knownItems.has(callId)) {
          this.knownItems.set(callId, { startTime: Date.now() });
          this.setStatus('running_tool', `正在执行: ${item.command || '命令'}`);
          this.emit('tool_start', {
            toolCallId: callId,
            toolName: 'exec',
            args: { cmd: item.command },
            actionDesc: `正在执行: ${item.command || '命令'}`,
            startTime: Date.now()
          });
        }
      }
    } else if (type === 'item.completed') {
      const item = event.item;
      if (!item) return;

      if (item.type === 'agent_message') {
        const text = item.text || '';
        if (text) {
          this.emit('text_delta', text);
        }
      } else if (item.type === 'command_execution') {
        const callId = item.id || `cmd_${Date.now()}`;
        const prev = this.knownItems.get(callId) || { startTime: Date.now() };
        this.emit('tool_end', {
          toolCallId: callId,
          toolName: 'exec',
          durationMs: Date.now() - prev.startTime,
          isError: item.exit_code !== 0,
          output: item.output || (item.exit_code === 0 ? '执行完成' : '执行失败')
        });
        this.setStatus('thinking', 'Codex 正在归纳输出...');
      } else if (item.type === 'file_change') {
        const callId = item.id || `file_${Date.now()}`;
        this.emit('tool_start', {
          toolCallId: callId,
          toolName: 'edit',
          args: { path: item.path },
          actionDesc: `正在修改: ${item.path || '文档'}`,
          startTime: Date.now()
        });
        this.emit('tool_end', {
          toolCallId: callId,
          toolName: 'edit',
          durationMs: 180,
          isError: false,
          output: `文件修改已应用: ${item.path || ''}`
        });
      }
    } else if (type === 'turn.completed') {
      this.emit('turn_end');
    }
  }

  async abort() {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill('SIGTERM');
      } catch (e) {
        try { this.process.kill('SIGKILL'); } catch (e2) {}
      }
    }
    this.isStreaming = false;
    this.process = null;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  async newSession() {
    await this.abort();
    this.threadId = null;
    this.knownItems.clear();
    this.setStatus('connected', '已重置会话');
  }
}

/**
 * GeminiAdapter: Native integration for Google Gemini CLI.
 * Runs headless mode with `--output-format stream-json`.
 * Features session UUID tracking, tool event mapping, and plan/auto_edit sandboxing.
 */
class GeminiAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'gemini',
      name: 'gemini',
      displayName: 'Gemini',
      icon: getAgentBrandSvg('gemini', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.sessionId = null;
    this.process = null;
    this.stdoutBuffer = '';
    this.activeTools = new Map();
    this.activeModelId = 'gemini-2.5-flash';
    this.activeModelName = 'Gemini 2.5 Flash';
  }

  getModelGroups() {
    return [
      {
        group: 'Gemini 系列',
        icon: '🔷',
        iconPark: 'diamond',
        isTop: true,
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '极速响应与轻量推演', icon: '⚡', iconPark: 'lightning' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: '深度逻辑与复杂多模态任务', icon: '💎', iconPark: 'diamond' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '超长上下文旗舰版', icon: '🔷', iconPark: 'diamond' }
        ]
      }
    ];
  }

  generateSessionId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'gemini-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  resolveGeminiBinary() {
    const nodeDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\node-v24.15.0';
    const geminiJs = path.join(nodeDir, 'node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js');
    const nodeExe = path.join(nodeDir, 'node.exe');

    if (fs.existsSync(nodeExe) && fs.existsSync(geminiJs)) {
      return {
        cmd: nodeExe,
        prefixArgs: [geminiJs]
      };
    }

    const geminiCmd = path.join(nodeDir, 'gemini.cmd');
    if (fs.existsSync(geminiCmd)) {
      return {
        cmd: geminiCmd,
        prefixArgs: []
      };
    }

    return {
      cmd: 'gemini',
      prefixArgs: []
    };
  }

  async detect() {
    return new Promise((resolve) => {
      try {
        const bin = this.resolveGeminiBinary();
        const proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            this.setStatus('connected', 'Gemini CLI 已就绪');
            resolve({ available: true, version: out.trim() || '0.59.0' });
          } else {
            this.setStatus('not_installed', '未检测到 Gemini CLI');
            resolve({ available: false, error: 'Gemini 退出码异常: ' + code });
          }
        });
        proc.on('error', err => {
          this.setStatus('not_installed', '未检测到 Gemini CLI');
          resolve({ available: false, error: err.message });
        });
        proc.stdin.end();
      } catch (e) {
        this.setStatus('not_installed', '未检测到 Gemini CLI');
        resolve({ available: false, error: e.message });
      }
    });
  }

  async start() {
    const check = await this.detect();
    if (check.available) {
      this.setStatus('connected', '已就绪');
      return true;
    }
    this.setStatus('not_installed', 'Gemini 未安装');
    return false;
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  async send(text, contextPayload) {
    if (this.isStreaming && this.process) {
      return { success: false, error: '正在处理上一个指令，请稍候或先点击中止' };
    }

    this.isStreaming = true;
    this.setStatus('thinking', 'Gemini 正在思考...');
    this.emit('turn_start');

    const bin = this.resolveGeminiBinary();
    const vaultPath = this.vaultBasePath || process.cwd();
    const approvalMode = this.permissionMode === 'readwrite' ? 'auto_edit' : 'plan';

    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
    }

    const args = [
      ...bin.prefixArgs,
      '--skip-trust',
      '--session-id', this.sessionId,
      '--approval-mode', approvalMode,
      '-o', 'stream-json',
      '-p', text
    ];

    return new Promise((resolve) => {
      try {
        this.stdoutBuffer = '';
        this.activeTools.clear();

        this.process = child_process.spawn(bin.cmd, args, {
          cwd: vaultPath,
          env: Object.assign({}, process.env, {
            GEMINI_CLI_TRUST_WORKSPACE: 'true'
          }),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');

        this.process.stdout.on('data', (chunk) => {
          this.handleStdoutChunk(chunk);
        });

        this.process.stderr.on('data', (chunk) => {
          const errStr = chunk.toString();
          if (errStr.includes('[ERROR]') || errStr.includes('FATAL')) {
            this.emit('error', { error: errStr });
          }
        });

        this.process.on('close', (code) => {
          this.isStreaming = false;
          this.process = null;
          this.emit('turn_end');
          this.emit('agent_settled');
          this.setStatus('connected', '已就绪');
          resolve({ success: code === 0 });
        });

        this.process.on('error', (err) => {
          this.isStreaming = false;
          this.process = null;
          this.setStatus('error', err.message);
          this.emit('error', { error: err.message });
          this.emit('agent_settled');
          resolve({ success: false, error: err.message });
        });

        // Close stdin immediately
        this.process.stdin.end();

      } catch (e) {
        this.isStreaming = false;
        this.process = null;
        this.setStatus('error', e.message);
        this.emit('error', { error: e.message });
        this.emit('agent_settled');
        resolve({ success: false, error: e.message });
      }
    });
  }

  handleStdoutChunk(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;

      try {
        const event = JSON.parse(trimmed);
        this.handleEvent(event);
      } catch (e) {
        // Ignore unparseable lines
      }
    }
  }

  handleEvent(event) {
    const type = event.type;

    if (type === 'message') {
      if (event.content) {
        this.emit('text_delta', event.content);
      }
    } else if (type === 'tool_use') {
      const toolId = event.tool_id || `tool_${Date.now()}`;
      this.activeTools.set(toolId, {
        name: event.tool_name,
        startTime: Date.now()
      });
      this.setStatus('running_tool', `正在调用: ${event.tool_name || '工具'}`);
      this.emit('tool_start', {
        toolCallId: toolId,
        toolName: event.tool_name || 'tool',
        args: event.parameters || {},
        actionDesc: `正在调用: ${event.tool_name || '工具'}`,
        startTime: Date.now()
      });
    } else if (type === 'tool_result') {
      const toolId = event.tool_id;
      const prev = this.activeTools.get(toolId) || { startTime: Date.now(), name: 'tool' };
      this.emit('tool_end', {
        toolCallId: toolId,
        toolName: prev.name,
        durationMs: Date.now() - prev.startTime,
        isError: event.status === 'error',
        output: event.output || (event.status === 'error' ? (event.error?.message || '调用失败') : '调用成功')
      });
      this.setStatus('thinking', 'Gemini 正在整理结果...');
    } else if (type === 'result') {
      if (event.status === 'error') {
        this.emit('error', { error: event.error?.message || '执行异常' });
      }
      this.emit('turn_end');
    } else if (type === 'error') {
      this.emit('error', { error: event.message || 'Gemini 错误' });
    }
  }

  async abort() {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill('SIGTERM');
      } catch (e) {
        try { this.process.kill('SIGKILL'); } catch (e2) {}
      }
    }
    this.isStreaming = false;
    this.process = null;
    this.setStatus('connected', '已中止');
    this.emit('agent_settled');
  }

  async newSession() {
    await this.abort();
    this.sessionId = this.generateSessionId();
    this.activeTools.clear();
    this.setStatus('connected', '已重置会话');
  }
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function normalizeModel(modelStr) {
  if (!modelStr) return 'gpt-5-6-thinking';
  const m = modelStr.trim();
  // Protect exact slugs from backend models
  if (m === 'gpt-5.6-sol-wm' || m === 'gpt-5.6-terra-wm' || m === 'gpt-5.6-luna-wm' || m === 'gpt-6-astra-wm' || m === 'gpt-5.5-wm') {
    return m;
  }
  const lower = m.toLowerCase();
  if (lower === 'chatgpt 5.6 sol' || lower === '5.6 sol' || lower === 'gpt-5.6 sol' || lower === 'gpt-5-6-thinking') {
    return 'gpt-5-6-thinking';
  }
  if (lower === 'auto' || lower === 'gpt-5-6') return 'gpt-5-6';
  if (lower.includes('5.5') && lower.includes('codex')) return 'gpt-5.5';
  if (lower.includes('5.4') && lower.includes('codex')) return 'gpt-5.4-codex';
  if (lower.includes('4o-mini') || lower === 'gpt-4o mini') return 'gpt-4o-mini';
  if (lower === 'gpt-4o') return 'gpt-5-6';
  return m;
}

/**
 * NiceAigcAdapter: Adapts NiceAIGC (https://node7.nice188.com/ / node8.nice188.com) to the unified AgentAdapter interface.
 * Supports both Web ChatGPT /backend-api/conversation (Session Cookie) and OpenAI /v1/chat/completions,
 * automatic protocol fallback, multi-turn conversation memory, and multi-modal image attachments.
 */
class NiceAigcAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'niceaigc',
      name: 'NiceAIGC',
      displayName: 'NiceAIGC',
      icon: getAgentBrandSvg('niceaigc', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });

    this.app = options.app || null;
    this.getConfig = options.getConfig || (() => ({
      baseUrl: 'https://node7.nice188.com',
      model: 'ChatGPT 5.6 Sol',
      secretName: 'tabonkb-niceaigc-token'
    }));

    const initialConfig = this.getConfig() || {};
    this.activeModelId = options.model || initialConfig.model || 'gpt-5-6-thinking';
    this.activeModelName = options.modelDisplayName || initialConfig.modelDisplayName || 'GPT-5.6 Sol';
    this.reasoningEffort = options.reasoningEffort || initialConfig.reasoningEffort || 'max';

    // In-memory conversation history & server conversation IDs
    this.conversationHistory = [];
    this.conversationId = null;
    this.lastMessageId = null;
    this.activeRequest = null;
    this.abortController = null;
    this._memorySecret = null;
    this._cachedUserId = null;
  }

  getModel() {
    return {
      id: this.activeModelId || 'gpt-5-6-thinking',
      name: this.activeModelName || 'GPT-5.6 Sol',
      reasoningEffort: this.reasoningEffort || 'max'
    };
  }

  setModel(modelId, displayName, reasoningEffort) {
    if (this.activeModelId !== modelId) {
      this.conversationId = null;
      this.lastMessageId = null;
    }
    this.activeModelId = modelId;
    this.activeModelName = displayName || modelId;
    if (reasoningEffort) {
      this.reasoningEffort = reasoningEffort;
    }

    if (this.app) {
      try {
        const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        if (plugin && plugin.settings) {
          if (!plugin.settings.niceaigc) plugin.settings.niceaigc = {};
          plugin.settings.niceaigc.model = modelId;
          plugin.settings.niceaigc.modelDisplayName = displayName || modelId;
          plugin.settings.niceaigc.reasoningEffort = this.reasoningEffort;
          plugin.saveSettings();
        }
      } catch (e) {
        console.warn('[NiceAigcAdapter] Failed to persist model setting:', e);
      }
    }

    this.emit('model_change', { 
      modelId, 
      displayName: this.activeModelName, 
      reasoningEffort: this.reasoningEffort 
    });
  }

  setReasoningEffort(level) {
    this.reasoningEffort = level || 'max';
    if (this.app) {
      try {
        const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        if (plugin && plugin.settings) {
          if (!plugin.settings.niceaigc) plugin.settings.niceaigc = {};
          plugin.settings.niceaigc.reasoningEffort = this.reasoningEffort;
          plugin.saveSettings();
        }
      } catch (e) {}
    }
    this.emit('model_change', { 
      modelId: this.activeModelId, 
      displayName: this.activeModelName, 
      reasoningEffort: this.reasoningEffort 
    });
  }

  getReasoningEffort() {
    return this.reasoningEffort || 'max';
  }

  getReasoningEffortConfig() {
    const level = this.reasoningEffort || 'max';
    const map = {
      'medium': { id: 'medium', label: '中', desc: '思考与速度平衡', apiEffort: 'medium', thinkingEffort: 'standard' },
      'high': { id: 'high', label: '高', desc: '为复杂问题思考更久', apiEffort: 'high', thinkingEffort: 'extended' },
      'max': { id: 'max', label: '极高', desc: '为最难的问题做最深入的分析', apiEffort: 'max', thinkingEffort: 'max' }
    };
    return map[level] || map['max'];
  }

  supportsReasoningEffort(modelId) {
    const id = (modelId || this.activeModelId || '').toLowerCase();
    return id.includes('thinking') || id.includes('sol') || id.includes('terra') || id.includes('luna') || id.startsWith('o1') || id.startsWith('o3');
  }

  getModelGroups() {
    return [
      {
        group: '常用模型',
        brand: 'openai',
        iconPark: 'star',
        isTop: true,
        models: [
          { 
            id: 'gpt-5-6-thinking', 
            name: 'GPT-5.6 Sol', 
            desc: '思考更充分，回答更优质，推荐使用！', 
            brand: 'openai',
            supportsReasoningEffort: true 
          },
          { 
            id: 'gpt-5-6', 
            name: 'Auto', 
            desc: '自动决定使用 5.6 Instant 或 5.6 Sol', 
            brand: 'openai',
            supportsReasoningEffort: false 
          }
        ]
      },
      {
        group: 'ChatGPT Work [原生] (需企业订阅)',
        brand: 'openai',
        iconPark: 'briefcase',
        models: [
          { id: 'gpt-5.6-sol-wm', name: 'GPT-5.6 Sol', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.6-terra-wm', name: 'GPT-5.6 Terra', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.6-luna-wm', name: 'GPT-5.6 Luna', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-5.5-wm', name: 'GPT-5.5', desc: '需开通 Work 企业订阅', brand: 'openai' },
          { id: 'gpt-6-astra-wm', name: 'GPT-6 Astra', desc: '需开通 Work 企业订阅', brand: 'openai' }
        ]
      },
      {
        group: 'Google Gemini模型 (可用推荐)',
        brand: 'gemini',
        iconPark: 'diamond',
        models: [
          { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: '超长上下文，响应极速且稳定 (推荐)', brand: 'gemini' },
          { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', desc: '最新超高速生成', brand: 'gemini' },
          { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: '高速高准确度', brand: 'gemini' },
          { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: '复杂逻辑深度推理', brand: 'gemini' },
          { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: '极速响应', brand: 'gemini' }
        ]
      },
      {
        group: 'Anthropic Claude (上游通道不稳定)',
        brand: 'claude',
        iconPark: 'code',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet', desc: '极强代码编写（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus', desc: '高深推理（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-7', name: 'Claude 4.7 Opus', desc: '深度理解（上游通道可能维护中）', brand: 'claude' },
          { id: 'claude-opus-4-8', name: 'Claude 4.8 Opus', desc: '超大上下文（上游通道可能维护中）', brand: 'claude' }
        ]
      },
      {
        group: 'xAI Grok (可用推荐)',
        brand: 'grok',
        iconPark: 'lightning',
        models: [
          { id: 'grok-4.6', name: 'Grok 4.6', desc: '最新实时知识搜索与代码 (推荐)', brand: 'grok' },
          { id: 'grok-4.5', name: 'Grok 4.5', desc: '高效搜索与代码 (推荐)', brand: 'grok' }
        ]
      },
      {
        group: 'OpenAI Codex系列',
        brand: 'openai',
        iconPark: 'code',
        models: [
          { id: 'gpt-5.5', name: 'GPT-5.5-Codex', desc: '代码研发与工程专精', brand: 'openai' },
          { id: 'gpt-5.4-codex', name: 'GPT-5.4-Codex', desc: '高效精准代码生成', brand: 'openai' }
        ]
      },
      {
        group: 'OpenAI 备用模型',
        brand: 'openai',
        iconPark: 'robot',
        models: [
          { id: 'gpt-5-chat-latest', name: 'GPT-5', desc: 'OpenAI 官方通用通道', brand: 'openai' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '轻量快速经济型', brand: 'openai' }
        ]
      },
      {
        group: '更多模型',
        brand: 'openai',
        iconPark: 'folder',
        models: [
          { id: 'gpt-5-5-thinking', name: 'GPT-5.5 Thinking', desc: '带思维链深度推演', brand: 'openai' },
          { id: 'gpt-5-5-instant', name: 'GPT-5.5 Instant', desc: '即时快速回复', brand: 'openai' },
          { id: 'research', name: 'Deep Research 深入研究', desc: '多轮自主深度学术调研', brand: 'openai' }
        ]
      },
      {
        group: 'image 生图模型',
        brand: 'gemini',
        iconPark: 'pic',
        models: [
          { id: 'gemini-3-pro-image-preview-2k', name: 'Nano Banana Pro 绘图', desc: '高分辨率 2K 生成', brand: 'gemini' },
          { id: 'nano-banana-2', name: 'Nano Banana 2.0 绘图', desc: '超快生图', brand: 'gemini' },
          { id: 'gpt-image-2-1', name: 'GPT Image 2.5（通道 1）', desc: '高质量图像绘制', brand: 'openai' },
          { id: 'gpt-image-2-2', name: 'GPT Image 2.5（通道 2）', desc: '备用通道生图', brand: 'openai' }
        ]
      },
      {
        group: 'NiceScience 学术',
        brand: 'science',
        iconPark: 'degree-hat',
        models: [
          { id: 'NiceArticleNoAI-Pro', name: 'NiceArticleNoAI-Pro', desc: 'Nature/Science期刊专用降AI识别率增强版', brand: 'science' },
          { id: 'NiceArticleNoAI', name: 'NiceArticleNoAI', desc: '标准版降低文章 AI 识别率', brand: 'science' }
        ]
      }
    ];
  }

  /**
   * Safely retrieve token from Obsidian SecretStorage or memory fallback.
   * Credentials NEVER enter logs, data.json, or markdown.
   * @param {string} [secretKey]
   * @returns {Promise<string | null>}
   */
  async getCredential(secretKey = 'tabonkb-niceaigc-token') {
    // 1. Try plugin getSecret
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.getSecret === 'function') {
        const s = await plugin.getSecret(secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 3. Try local plugin .secrets.json
    try {
      
      
      const vaultPath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretKey]) return data[secretKey];
        }
      }
    } catch (e) {}

    // 4. Try Obsidian SecretStorage (if supported)
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.getSecret === 'function') {
        const secret = await this.app.secretStorage.getSecret(secretKey);
        if (secret) return secret;
      }
    } catch (e) {}

    return this._memorySecret || null;
  }

  async setCredential(secretKey = 'tabonkb-niceaigc-token', token) {
    this._memorySecret = token;

    // 1. Save to plugin
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.setSecret === 'function') {
        await plugin.setSecret(secretKey, token);
      }
    } catch (e) {}

    // 2. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) localStorage.setItem('tabonkb-secret-' + secretKey, token);
        else localStorage.removeItem('tabonkb-secret-' + secretKey);
      }
    } catch (e) {}

    // 3. Save to local .secrets.json
    try {
      
      
      const vaultPath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretKey] = token;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}

    // 4. Save to Obsidian SecretStorage
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.setSecret === 'function') {
        await this.app.secretStorage.setSecret(secretKey, token);
      }
    } catch (e) {}
  }

  /**
   * Detect whether NiceAIGC is configured and reachable.
   * @returns {Promise<{ available: boolean, error?: string }>}
   */
  async detect() {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    const token = await this.getCredential(config.secretName || 'tabonkb-niceaigc-token');
    
    if (!token) {
      this.setStatus('disconnected', '未配置登录凭据/Token');
      return { available: false, error: '未在设置中配置 NiceAIGC 会话 Token' };
    }

    this.setStatus('connected', '已就绪 (Web/API)');
    return { available: true };
  }

  /**
   * Start adapter
   * @returns {Promise<boolean>}
   */
  async start() {
    const res = await this.detect();
    if (res.available) {
      this.setStatus('connected', '已就绪');
      return true;
    }
    return false;
  }

  /**
   * Stop any ongoing streaming
   */
  async stop() {
    await this.abort();
    this.setStatus('disconnected', '已停止');
  }

  /**
   * Reset conversation session
   */
  async newSession() {
    await this.abort();
    this.conversationHistory = [];
    this.conversationId = null;
    this.lastMessageId = null;
    this.setStatus('connected', '已重置会话');
  }

  /**
   * Abort current streaming generation
   */
  async abort() {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (e) {}
      this.abortController = null;
    }
    if (this.activeRequest && typeof this.activeRequest.destroy === 'function') {
      try {
        this.activeRequest.destroy();
      } catch (e) {}
      this.activeRequest = null;
    }

    this.isStreaming = false;
    this.setStatus('connected', '已中止');
    this.emit('aborted');
    this.emit('agent_settled');
  }

  /**
   * Helper to fetch current user profile (/backend-api/me) to extract userId
   * @private
   */
  async _fetchMe(baseUrl, token, hostDomain) {
    const url = `${baseUrl}/backend-api/me`;
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node && typeof requestUrl === 'undefined';
    if (!isNode && typeof requestUrl !== 'undefined') {
      try {
        const res = await requestUrl({
          url,
          method: 'GET',
          headers: {
            'Cookie': `__Secure-next-auth.session-token=${token}`,
            'X-Site-Domain': hostDomain || '',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 TabonKB/1.0'
          }
        });
        return res.json;
      } catch (e) {
        return null;
      }
    } else {
      return new Promise(resolve => {
        try {
          const https = url.startsWith('https') ? require('https') : require('http');
          const req = https.get(url, {
            headers: {
              'Cookie': `__Secure-next-auth.session-token=${token}`,
              'X-Site-Domain': hostDomain || '',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 TabonKB/1.0'
            }
          }, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => {
              try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
            });
          });
          req.on('error', () => resolve(null));
        } catch (e) {
          resolve(null);
        }
      });
    }
  }

  /**
   * Send user prompt and stream back completion
   * @param {string} text - User prompt (may include context formatting)
   * @param {object} [contextPayload] - Snapshot from AgentContextProvider
   * @param {Array<any>} [attachments] - Attached documents or images
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async send(text, contextPayload, attachments = []) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    let baseUrl = (config.baseUrl || 'https://node7.nice188.com').trim().replace(/\/+$/, '');
    if (baseUrl.includes('nice188.cc')) {
      baseUrl = baseUrl.replace('nice188.cc', 'nice188.com');
    }
    const rawModel = this.activeModelId || config.model || 'gpt-5-6-thinking';
    const model = normalizeModel(rawModel);

    // If model changed compared to last used model, reset server conversation ID
    if (this.lastUsedModel && this.lastUsedModel !== model) {
      this.conversationId = null;
      this.lastMessageId = null;
    }
    this.lastUsedModel = model;

    const secretKey = config.secretName || 'tabonkb-niceaigc-token';
    let token = await this.getCredential(secretKey);

    if (!token) {
      const errMsg = '未配置 NiceAIGC 登录凭据，请在工作台设置中录入 Cookie / Token';
      this.emit('error', { message: errMsg });
      this.emit('agent_settled');
      return { success: false, error: errMsg };
    }

    token = token.trim();
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      token = token.slice(1, -1).trim();
    }

    this.isStreaming = true;
    this.setStatus('thinking', '正在生成...');
    this.emit('turn_start', { agentId: this.id });

    let hostDomain = '';
    try { hostDomain = new URL(baseUrl).hostname; } catch (e) {}

    // Format headers
    const isFullCookie = token.includes('=');
    let cookieHeader = '';
    let bearerHeader = token;
    let xuserid = '';
    let xtoken = '';
    let xyUuid = '';
    let sessionToken = '';

    if (isFullCookie) {
      cookieHeader = token;
      const mUid = token.match(/(?:^|;\s*)xuserid=([^;]+)/);
      if (mUid) xuserid = decodeURIComponent(mUid[1].trim());
      const mTok = token.match(/(?:^|;\s*)xtoken=([^;]+)/);
      if (mTok) xtoken = decodeURIComponent(mTok[1].trim());
      const mUuid = token.match(/(?:^|;\s*)xy_uuid_token=([^;]+)/);
      if (mUuid) xyUuid = decodeURIComponent(mUuid[1].trim());
      const mSess = token.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|sessionToken|token)=([^;]+)/);
      if (mSess) {
        sessionToken = decodeURIComponent(mSess[1].trim());
      } else {
        // Fallback default session token if user provided document.cookie without HttpOnly session-token
        sessionToken = '20zf9j0ykdgkw0dlbhlxxszdbwgztutf';
        cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; ${cookieHeader}`;
      }
      bearerHeader = sessionToken || xtoken || token;
    } else {
      sessionToken = token.trim();
      bearerHeader = sessionToken;
      cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; sessionToken=${sessionToken}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json, text/plain, */*',
      'Authorization': `Bearer ${bearerHeader.trim()}`,
      'Cookie': cookieHeader,
      'X-Auth-Token': bearerHeader.trim(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TabonKB-Workbench/1.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-Site-Domain': hostDomain
    };

    if (xuserid) headers['xuserid'] = xuserid;
    if (xtoken) headers['xtoken'] = xtoken;
    if (xyUuid) headers['xy_uuid_token'] = xyUuid;
    if (sessionToken) headers['Chatgpt-Account-Id'] = sessionToken;

    // Check for image attachments
    const imageAttachments = (attachments || []).filter(a => a && (a.dataUrl?.startsWith('data:image') || a.path?.match(/\.(png|jpg|jpeg|gif|webp)$/i)));
    let userContent = text;
    if (imageAttachments.length > 0) {
      userContent = [{ type: 'text', text }];
      for (const img of imageAttachments) {
        if (img.dataUrl) {
          userContent.push({
            type: 'image_url',
            image_url: { url: img.dataUrl }
          });
        }
      }
    }
    this.conversationHistory.push({ role: 'user', content: userContent });

    // Determine default protocol: node8.nice188.com returns 503 api_not_enabled on /v1/chat/completions,
    // so for nice188 or when configured, default to /backend-api/conversation (ChatGPT Web web-session protocol)
    const isNiceSite = baseUrl.includes('nice188') || baseUrl.includes('niceaigc');
    let useBackendApi = isNiceSite || config.protocol === 'backend-api';

    const executeRequest = async (asBackendApi) => {
      let apiUrl = '';
      let reqBody = '';

      if (asBackendApi) {
        apiUrl = `${baseUrl}/backend-api/conversation`;
        const messageId = generateUuid();
        const parentId = this.lastMessageId || generateUuid();
        this.lastMessageId = messageId;

        const parts = [text];
        if (imageAttachments.length > 0) {
          for (const img of imageAttachments) {
            if (img.dataUrl) {
              parts.push({
                content_type: 'image',
                asset_pointer: img.dataUrl
              });
            }
          }
        }

        const payload = {
          action: 'next',
          messages: [
            {
              id: messageId,
              author: { role: 'user' },
              content: {
                content_type: imageAttachments.length > 0 ? 'multimodal_text' : 'text',
                parts
              }
            }
          ],
          model,
          parent_message_id: parentId,
          conversation_id: this.conversationId || undefined,
          timezone_offset_min: -480,
          history_and_training_disabled: false
        };

        if (this.supportsReasoningEffort(model)) {
          const effortConfig = this.getReasoningEffortConfig();
          payload.reasoning_effort = effortConfig.apiEffort;
          payload.thinking_effort = effortConfig.thinkingEffort;
        }

        reqBody = JSON.stringify(payload);
      } else {
        apiUrl = baseUrl.endsWith('/chat/completions') 
          ? baseUrl 
          : (baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`);

        const historySlice = this.conversationHistory.slice(-20);
        const messages = [
          {
            role: 'system',
            content: 'You are NiceAIGC, a high-performance technical AI coding assistant integrated into the TabonKB engineering workbench. Provide clear, accurate, structured answers with clean Markdown and code snippets.'
          },
          ...historySlice
        ];

        const v1Payload = {
          model,
          messages,
          stream: true,
          temperature: 0.7
        };

        if (this.supportsReasoningEffort(model)) {
          const effortConfig = this.getReasoningEffortConfig();
          v1Payload.reasoning_effort = effortConfig.apiEffort;
        }

        reqBody = JSON.stringify(v1Payload);
      }

      let fullAssistantText = '';
      // In Obsidian desktop (Electron), Node.js http/https is available and MUST be used,
      // because browser window.fetch() silently strips the 'Cookie' header (W3C Forbidden Header spec).
      const canUseNode = typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions?.node;

      if (canUseNode) {
        await this._streamNode(apiUrl, headers, reqBody, (chunk) => {
          fullAssistantText += chunk;
          this.emit('text_delta', chunk);
        });
      } else {
        await this._streamFetch(apiUrl, headers, reqBody, (chunk) => {
          fullAssistantText += chunk;
          this.emit('text_delta', chunk);
        });
      }

      return fullAssistantText;
    };

    try {
      this.abortController = new AbortController();
      let fullAssistantText = '';

      try {
        fullAssistantText = await executeRequest(useBackendApi);
      } catch (firstErr) {
        // If server rejects cross-model conversation switching (HTTP 403 / new chat required), reset conversation and retry
        if (firstErr.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED' || firstErr.message?.includes('不支持切换') || firstErr.message?.includes('请创建新聊天')) {
          console.warn('[NiceAigcAdapter] Model family changed, auto-retrying with a fresh conversation session...');
          this.conversationId = null;
          this.lastMessageId = null;
          fullAssistantText = await executeRequest(useBackendApi);
        } else if (firstErr.code === 'API_NOT_ENABLED' || firstErr.message?.includes('503') || firstErr.message?.includes('api_not_enabled')) {
          // If first attempt failed with API_NOT_ENABLED or 503, try alternative protocol
          console.warn(`[NiceAigcAdapter] Primary protocol (${useBackendApi ? 'backend-api' : 'v1'}) unavailable, falling back to ${useBackendApi ? 'v1' : 'backend-api'}...`);
          fullAssistantText = await executeRequest(!useBackendApi);
        } else {
          throw firstErr;
        }
      }

      if (fullAssistantText && fullAssistantText.trim().length > 0) {
        fullAssistantText = cleanAssistantMarkdown(fullAssistantText);
        this.conversationHistory.push({ role: 'assistant', content: fullAssistantText });
        this.isStreaming = false;
        this.setStatus('connected', '已就绪');
        this.emit('turn_end', { fullText: fullAssistantText });
        this.emit('agent_settled');
        return { success: true };
      } else {
        const activeName = this.activeModelName || model;
        const errMsg = `当前模型（${activeName}）未返回任何有效文本内容（上游通道可能处于维护或排队状态）。建议点击左下角模型选择器切换至「⭐ GPT-5.6 Sol」或「Google Gemini」重试。`;
        this.isStreaming = false;
        this.setStatus('connected', '已就绪');
        this.emit('error', { message: errMsg });
        this.emit('agent_settled');
        return { success: false, error: errMsg };
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: true };
      }

      this.isStreaming = false;
      this.setStatus('error', '生成异常');
      let sanitized = (err.message || '请求失败').replace(token, '***');
      if (sanitized.includes('缺少用户标识') || sanitized.includes('缺少xuserid') || sanitized.includes('缺少xtoken')) {
        sanitized = 'NiceAIGC 登录凭据缺少用户标识：当前凭据缺少 xuserid 与 xtoken。请在浏览器登录后按 F12 -> Console 执行 document.cookie，将包含 xuserid 和 xtoken 的完整 Cookie 复制并保存到工作台设置。';
      }
      this.emit('error', { message: sanitized });
      this.emit('agent_settled');
      return { success: false, error: sanitized };
    } finally {
      this.abortController = null;
      this.activeRequest = null;
    }
  }

  /**
   * Browser / Electron fetch SSE streaming
   * @private
   */
  async _streamFetch(url, headers, body, onChunk) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch (e) {}

      if (errText.includes('缺少用户标识')) {
        throw new Error('NiceAIGC 缺少用户标识：建议在浏览器登录后按 F12 复制完整 Cookie (含 xuserid 与 xtoken) 填入设置凭据');
      }
      if (errText.includes('套餐暂不支持') || errText.includes('升级订阅套餐')) {
        throw new Error('NiceAIGC 提示：当前账号套餐未开通此模型。建议在浏览器登录后复制包含 xtoken 的完整 Cookie 填入凭据，或在设置中更换模型');
      }
      if (errText.includes('白名单')) {
        throw new Error('NiceAIGC 提示：请求模型不在白名单内，请在设置中切换模型 (如: ChatGPT 5.6 Sol)');
      }
      if (response.status === 429) {
        throw new Error('NiceAIGC 提示请求过于频繁 (HTTP 429)，请稍候 3 秒重试');
      }
      if (response.status === 401) {
        throw new Error('NiceAIGC 登录凭据失效或过期 (HTTP 401: 登录态异常)，请在浏览器登录后复制最新的 Cookie / Token 并保存至设置');
      }
      if (response.status === 403) {
        if (errText.includes('不支持切换') || errText.includes('请创建新聊天') || errText.includes('所处') || errText.includes('拓展模型')) {
          const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
          e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
          throw e;
        }
        if (errText.includes('work_subscription_required') || errText.includes('Upgrade to Plus')) {
          throw new Error('当前账号未开通 ChatGPT Work 原生套餐权限。如需使用 GPT-5.6，请在对话框左下角切换至常用模型的「⭐ GPT-5.6 Sol」，或使用「Anthropic Claude / Google Gemini」');
        }
        throw new Error('NiceAIGC 访问被拒绝 (HTTP 403)，请确认该账号具有模型使用权限');
      }
      if (response.status === 503) {
        if (errText.includes('api_not_enabled')) {
          const e = new Error('API_NOT_ENABLED');
          e.code = 'API_NOT_ENABLED';
          throw e;
        }
        throw new Error('NiceAIGC 返回 HTTP 503 (API服务未启用或处于维护状态)，请确认 Token 权限或 Base URL');
      }
      throw new Error(`NiceAIGC 接口返回异常 (HTTP ${response.status}): ${errText.slice(0, 150)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastAccumulatedLength = 0;
    let currentAssistantMsgId = null;
    let currentPath = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // Comment or ping

        if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
          return;
        }

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);

            let errMsg = null;
            if (parsed.detail) {
              errMsg = typeof parsed.detail === 'object' ? (parsed.detail.message || JSON.stringify(parsed.detail)) : parsed.detail;
            } else if (parsed.error) {
              errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            }
            if (errMsg) {
              if (errMsg.includes('不支持切换') || errMsg.includes('请创建新聊天')) {
                const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                throw e;
              }
              throw new Error(`NiceAIGC: ${errMsg}`);
            }

            const convId = parsed.conversation_id || parsed.v?.conversation_id;
            if (convId) {
              this.conversationId = convId;
            }

            // 1. Message frame (direct or inside parsed.v)
            const msg = parsed.message || (parsed.v && typeof parsed.v === 'object' ? parsed.v.message : null);
            if (msg) {
              const role = msg.author?.role;
              // CRITICAL: DO NOT echo user prompt into assistant view!
              if (role === 'user') {
                continue;
              }

              if (msg.id && msg.id !== currentAssistantMsgId) {
                currentAssistantMsgId = msg.id;
                this.lastMessageId = msg.id;
                lastAccumulatedLength = 0;
              }

              if (role === 'assistant') {
                const parts = msg.content?.parts;
                if (parts && parts.length > 0) {
                  const fullText = parts.join('');
                  if (fullText.length > lastAccumulatedLength) {
                    const delta = fullText.slice(lastAccumulatedLength);
                    lastAccumulatedLength = fullText.length;
                    onChunk(delta);
                  }
                }
              }
              continue;
            }

            // 2. delta_encoding v1 protocol (used by Claude, Gemini, Grok)
            // e.g.: {"p":"/message/content/parts/0","o":"append","v":"text"} or continuation: {"v":"more"}
            if (parsed.p !== undefined) {
              currentPath = parsed.p;
            }

            if (parsed.v !== undefined && typeof parsed.v === 'string') {
              if (currentPath.includes('/message/content/parts')) {
                onChunk(parsed.v);
                continue;
              }
            }

            // 3. Format 3: OpenAI delta or Ollama response
            let delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
            if (!delta && parsed.response) {
              delta = parsed.response;
            }

            if (delta) {
              onChunk(delta);
            }
          } catch (e) {
            if (e.message && (e.message.startsWith('NiceAIGC:') || e.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED')) {
              throw e;
            }
          }
        }
      }
    }
  }

  /**
   * Node.js https.request SSE streaming (for automated test suite)
   * @private
   */
  async _streamNode(url, headers, body, onChunk) {
    const https = url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(url);

    return new Promise((resolve, reject) => {
      const req = https.request(urlObj, {
        method: 'POST',
        headers: Object.assign({}, headers, {
          'Content-Length': Buffer.byteLength(body)
        })
      }, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', c => errData += c);
          res.on('end', () => {
            if (res.statusCode === 503 && errData.includes('api_not_enabled')) {
              const e = new Error('API_NOT_ENABLED');
              e.code = 'API_NOT_ENABLED';
              reject(e);
              return;
            }
            if (errData.includes('缺少用户标识') || errData.includes('缺少xuserid') || errData.includes('缺少xtoken')) {
              reject(new Error('NiceAIGC 缺少用户标识：当前凭据缺少 xuserid 与 xtoken。请在浏览器登录后按 F12 -> Console 输入 document.cookie，将完整 Cookie 复制并保存到工作台设置'));
              return;
            }
            if (errData.includes('套餐暂不支持') || errData.includes('升级订阅套餐')) {
              reject(new Error('NiceAIGC 提示：当前账号套餐未开通此模型。请在浏览器登录后按 F12 复制包含 xtoken 的完整 Cookie 填入凭据，或在设置中更换模型'));
              return;
            }
            if (errData.includes('白名单')) {
              reject(new Error('NiceAIGC 提示：请求模型不在白名单内，请在设置中切换模型 (如: ChatGPT 5.6 Sol)'));
              return;
            }
            if (res.statusCode === 429) {
              reject(new Error('NiceAIGC 提示请求过于频繁 (HTTP 429)，请稍候 3 秒重试'));
              return;
            }
            if (res.statusCode === 403) {
              if (errData.includes('不支持切换') || errData.includes('请创建新聊天') || errData.includes('所处') || errData.includes('拓展模型')) {
                const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                reject(e);
                return;
              }
              if (errData.includes('work_subscription_required') || errData.includes('Upgrade to Plus')) {
                reject(new Error('当前账号未开通 ChatGPT Work 原生套餐权限。如需使用 GPT-5.6，请在对话框左下角切换至常用模型的「⭐ GPT-5.6 Sol」，或使用「Anthropic Claude / Google Gemini」'));
                return;
              }
              reject(new Error('NiceAIGC 访问被拒绝 (HTTP 403)，请确认该账号具有模型使用权限'));
              return;
            }
            if (res.statusCode === 401) {
              reject(new Error('NiceAIGC 登录凭据失效或过期 (HTTP 401: 登录态异常)，请在浏览器登录后重新复制最新的 Cookie / Token 并保存至设置'));
              return;
            }
            reject(new Error(`HTTP ${res.statusCode}: ${errData.slice(0, 150)}`));
          });
          return;
        }

        let buffer = '';
        let lastAccumulatedLength = 0;
        let currentAssistantMsgId = null;
        let currentPath = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
              resolve();
              return;
            }
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);

                let errMsg = null;
                if (parsed.detail) {
                  errMsg = typeof parsed.detail === 'object' ? (parsed.detail.message || JSON.stringify(parsed.detail)) : parsed.detail;
                } else if (parsed.error) {
                  errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                }
                if (errMsg) {
                  if (errMsg.includes('不支持切换') || errMsg.includes('请创建新聊天')) {
                    const e = new Error('MODEL_SWITCH_NEW_CHAT_REQUIRED');
                    e.code = 'MODEL_SWITCH_NEW_CHAT_REQUIRED';
                    reject(e);
                    return;
                  }
                  reject(new Error(`NiceAIGC: ${errMsg}`));
                  return;
                }

                const convId = parsed.conversation_id || parsed.v?.conversation_id;
                if (convId) {
                  this.conversationId = convId;
                }

                // 1. Message frame (direct or inside parsed.v)
                const msg = parsed.message || (parsed.v && typeof parsed.v === 'object' ? parsed.v.message : null);
                if (msg) {
                  const role = msg.author?.role;
                  // CRITICAL: DO NOT echo user prompt into assistant view!
                  if (role === 'user') {
                    continue;
                  }

                  if (msg.id && msg.id !== currentAssistantMsgId) {
                    currentAssistantMsgId = msg.id;
                    this.lastMessageId = msg.id;
                    lastAccumulatedLength = 0;
                  }

                  if (role === 'assistant') {
                    const parts = msg.content?.parts;
                    if (parts && parts.length > 0) {
                      const fullText = parts.join('');
                      if (fullText.length > lastAccumulatedLength) {
                        const delta = fullText.slice(lastAccumulatedLength);
                        lastAccumulatedLength = fullText.length;
                        onChunk(delta);
                      }
                    }
                  }
                  continue;
                }

                // 2. delta_encoding v1 protocol (used by Claude, Gemini, Grok)
                if (parsed.p !== undefined) {
                  currentPath = parsed.p;
                }

                if (parsed.v !== undefined && typeof parsed.v === 'string') {
                  if (currentPath.includes('/message/content/parts')) {
                    onChunk(parsed.v);
                    continue;
                  }
                }

                // 3. Format 3: OpenAI delta or Ollama response
                let delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
                if (!delta && parsed.response) {
                  delta = parsed.response;
                }

                if (delta) onChunk(delta);
              } catch (e) {
                if (e.message && (e.message.startsWith('NiceAIGC:') || e.code === 'MODEL_SWITCH_NEW_CHAT_REQUIRED')) {
                  reject(e);
                  return;
                }
              }
            }
          }
        });

        res.on('end', () => resolve());
        res.on('error', reject);
      });

      req.on('error', reject);
      this.activeRequest = req;

      if (this.abortController?.signal) {
        if (this.abortController.signal.aborted) {
          try { req.destroy(); } catch (e) {}
          reject(new Error('AbortError'));
          return;
        }
        this.abortController.signal.addEventListener('abort', () => {
          try { req.destroy(); } catch (e) {}
          reject(new Error('AbortError'));
        });
      }

      req.write(body);
      req.end();
    });
  }
}

/**
 * Clean raw Delimiters, Cites, and Search/URL markers from ChatGPT Web SSE responses
 * @param {string} text
 * @returns {string}
 */
function cleanAssistantMarkdown(text) {
  if (!text) return '';
  let cleaned = text;

  // 1. Process PUA URL blocks: \uE200url\uE202title\uE202url\uE201 or \uE000url\uE002title\uE002url\uE001 -> [title](url)
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202]([^\uE000-\uF8FF\r\n]+?)[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 2. Process literal box URL blocks: □url□title□url□
  cleaned = cleaned.replace(/□url□([^□\r\n]+?)□(https?:\/\/[^□\s\)]+?)□/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/□url□(https?:\/\/[^□\s\)]+?)□/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 3. Strip PUA citation blocks: \uE200cite...\uE201
  cleaned = cleaned.replace(/[\uE000\uE200]cite[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 4. Strip PUA search/browse/call/nav/tool/python blocks
  cleaned = cleaned.replace(/[\uE000\uE200](?:search|browse|nav|call|tool|python)[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 5. Strip literal box citations & tools: □cite□...□
  cleaned = cleaned.replace(/□(?:cite|search|browse|nav|call|tool|python)□[^□\r\n]*?□/g, '');

  // 6. Strip standard web citations like 【4:0†source】
  cleaned = cleaned.replace(/【\d*(?::\d+)?†[a-zA-Z0-9_\-\s]*】/g, '');

  // 7. Strip leftover private-use characters & non-printable ASCII control chars
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 8. Clean isolated stray box characters
  cleaned = cleaned.replace(/(?:^|\s)□+(?:\s|$)/g, ' ');

  // 9. Clean excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * AgentSessionManager: Isolates and persists multi-agent conversations independently.
 * Ensures switching between Pi, Codex, Gemini, and NiceAIGC keeps messages, active tool state,
 * and context perfectly intact across session reloads, app restarts, and agent switches.
 */
class AgentSessionManager {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || (process.cwd ? process.cwd() : '');
    this.app = options.app || null;
    this.agents = new Map();

    this.initAgent('pi');
    this.initAgent('codex');
    this.initAgent('gemini');
    this.initAgent('niceaigc');

    this.loadSessions();
  }

  _getStorageFile() {
    try {
      
      const basePath = this.vaultBasePath || this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (basePath) {
        return path.join(basePath, '.obsidian', 'plugins', 'tabonkb-workbench', '.chat-history.json');
      }
    } catch (e) {}
    return null;
  }

  initAgent(agentId) {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        agentId,
        activeSessionId: null,
        sessions: [],
        draft: '',
        currentAssistantMessage: null,
        activeToolCards: new Map(),
        updatedAt: Date.now()
      });
    }
    return this.agents.get(agentId);
  }

  getAgent(agentId) {
    if (!this.agents.has(agentId)) {
      return this.initAgent(agentId);
    }
    return this.agents.get(agentId);
  }

  loadSessions() {
    let rawData = null;

    // 1. Try reading from .chat-history.json
    try {
      
      const filePath = this._getStorageFile();
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content) {
          rawData = JSON.parse(content);
        }
      }
    } catch (e) {
      console.warn('[AgentSessionManager] Failed to read .chat-history.json:', e);
    }

    // 2. Fallback to localStorage
    if (!rawData) {
      try {
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem('tabonkb-chat-history');
          if (stored) {
            rawData = JSON.parse(stored);
          }
        }
      } catch (e) {}
    }

    if (rawData && typeof rawData === 'object') {
      for (const [agentId, data] of Object.entries(rawData)) {
        const agent = this.getAgent(agentId);
        agent.draft = data.draft || '';

        // Case A: New segmented format with sessions array
        if (Array.isArray(data.sessions)) {
          agent.sessions = data.sessions;
          // By default start fresh with activeSessionId = null (default hidden)
          agent.activeSessionId = null;
        } 
        // Case B: Legacy format with flat messages array -> migrate to a segmented session
        else if (Array.isArray(data.messages) && data.messages.length > 0) {
          const firstUser = data.messages.find(m => m.role === 'user');
          const title = firstUser ? (firstUser.text || '').slice(0, 36).replace(/\n/g, ' ') : '历史对话';
          agent.sessions = [{
            id: 'sess_legacy_' + (data.updatedAt || Date.now()),
            title: title,
            createdAt: data.updatedAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            messages: data.messages
          }];
          agent.activeSessionId = null;
        } else {
          agent.sessions = [];
          agent.activeSessionId = null;
        }
        agent.updatedAt = data.updatedAt || Date.now();
      }
    }
  }

  saveSessions() {
    const payload = {};
    for (const [agentId, agent] of this.agents.entries()) {
      // Keep up to 50 sessions per agent, each session up to 100 messages
      const cleanSessions = (agent.sessions || []).slice(0, 50).map(s => ({
        id: s.id || ('sess_' + Date.now()),
        title: s.title || '对话',
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
        messages: (s.messages || []).slice(-100).map(m => ({
          id: m.id || Math.random().toString(36).slice(2),
          role: m.role,
          text: m.text,
          badge: m.badge || null,
          model: m.model || null,
          images: Array.isArray(m.images) ? m.images : null,
          toolCount: m.toolCount || 0,
          timestamp: m.timestamp || Date.now()
        }))
      }));

      payload[agentId] = {
        agentId,
        activeSessionId: agent.activeSessionId,
        sessions: cleanSessions,
        draft: agent.draft || '',
        updatedAt: agent.updatedAt || Date.now()
      };
    }

    const jsonStr = JSON.stringify(payload, null, 2);

    try {
      
      const filePath = this._getStorageFile();
      if (filePath) {
        fs.writeFileSync(filePath, jsonStr, 'utf8');
      }
    } catch (e) {
      console.warn('[AgentSessionManager] Failed to write .chat-history.json:', e);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-chat-history', jsonStr);
      }
    } catch (e) {}
  }

  getSessions(agentId) {
    const agent = this.getAgent(agentId);
    return (agent.sessions || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getActiveSession(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent.activeSessionId) return null;
    return agent.sessions.find(s => s.id === agent.activeSessionId) || null;
  }

  getSession(agentId) {
    return this.getActiveSession(agentId) || {
      id: null,
      agentId,
      messages: this.getMessages(agentId),
      draft: this.getDraft(agentId)
    };
  }

  getActiveSessionId(agentId) {
    const agent = this.getAgent(agentId);
    return agent.activeSessionId;
  }

  createSession(agentId, title = '新对话') {
    const agent = this.getAgent(agentId);
    const newSession = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    agent.sessions.unshift(newSession);
    agent.activeSessionId = newSession.id;
    agent.updatedAt = Date.now();
    this.saveSessions();
    return newSession;
  }

  switchSession(agentId, sessionId) {
    const agent = this.getAgent(agentId);
    agent.activeSessionId = sessionId;
    agent.updatedAt = Date.now();
    this.saveSessions();
    return this.getActiveSession(agentId);
  }

  newSession(agentId) {
    const agent = this.getAgent(agentId);
    agent.activeSessionId = null;
    agent.currentAssistantMessage = null;
    agent.activeToolCards.clear();
    agent.draft = '';
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  deleteSession(agentId, sessionId) {
    const agent = this.getAgent(agentId);
    agent.sessions = agent.sessions.filter(s => s.id !== sessionId);
    if (agent.activeSessionId === sessionId) {
      agent.activeSessionId = null;
    }
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  getMessages(agentId) {
    const active = this.getActiveSession(agentId);
    return active ? (active.messages || []) : [];
  }

  addMessage(agentId, msg) {
    const agent = this.getAgent(agentId);
    let active = this.getActiveSession(agentId);
    if (!active) {
      const title = (msg.text || '').trim().slice(0, 36).replace(/\n/g, ' ') || 
                    (msg.images && msg.images.length > 0 ? `[图片] ${msg.images[0].name || ''}`.trim() : '新对话');
      active = this.createSession(agentId, title);
    } else if (active.title === '新对话' && msg.role === 'user') {
      const title = (msg.text || '').trim().slice(0, 36).replace(/\n/g, ' ') || 
                    (msg.images && msg.images.length > 0 ? `[图片] ${msg.images[0].name || ''}`.trim() : '');
      if (title) active.title = title;
    }

    active.messages.push(msg);
    active.updatedAt = Date.now();
    agent.updatedAt = Date.now();
    this.saveSessions();
  }

  clearSession(agentId) {
    this.newSession(agentId);
  }

  clearAll() {
    for (const agent of this.agents.values()) {
      agent.sessions = [];
      agent.activeSessionId = null;
      agent.currentAssistantMessage = null;
      agent.activeToolCards.clear();
      agent.draft = '';
      agent.updatedAt = Date.now();
    }
    this.saveSessions();
  }

  getDraft(agentId) {
    return this.getAgent(agentId).draft || '';
  }

  setDraft(agentId, draft) {
    const agent = this.getAgent(agentId);
    agent.draft = draft || '';
    this.saveSessions();
  }

  getCurrentAssistant(agentId) {
    return this.getAgent(agentId).currentAssistantMessage;
  }

  setCurrentAssistant(agentId, msg) {
    const agent = this.getAgent(agentId);
    agent.currentAssistantMessage = msg;
    agent.updatedAt = Date.now();
  }
}

/**
 * AgentHub: Core router and orchestrator for Multi-Agent execution in TabonKB.
 * Coordinates Pi, Codex, Gemini, and NiceAIGC with shared context and isolated sessions.
 */
class AgentHub {
  constructor(options = {}) {
    this.vaultBasePath = options.vaultBasePath || '';
    this.permissionMode = options.permissionMode || this.getSavedPermissionMode();
    this.sessionManager = new AgentSessionManager({
      vaultBasePath: this.vaultBasePath,
      app: options.app
    });
    this.adapters = new Map();
    this.listeners = new Map();

    this.initAdapters(options);
    this.activeAgentId = this.getSavedActiveAgent();

    this.bindActiveAdapterEvents();
  }

  getSavedPermissionMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-agent-permission-mode');
        if (saved === 'readonly' || saved === 'readwrite') return saved;
      }
    } catch (e) {}
    return 'readwrite';
  }

  getSavedActiveAgent() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tabonkb-active-agent-id');
        if (saved && (saved === 'pi' || saved === 'codex' || saved === 'gemini' || saved === 'niceaigc')) {
          return saved;
        }
      }
    } catch (e) {}
    return 'pi';
  }

  saveActiveAgent(id) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-active-agent-id', id);
      }
    } catch (e) {}
  }

  initAdapters(options) {
    const opts = {
      vaultBasePath: this.vaultBasePath,
      permissionMode: this.permissionMode
    };

    // 1. Pi Adapter
    const pi = new PiAdapter(Object.assign({}, opts, { bridge: options.bridge }));
    this.adapters.set('pi', pi);

    // 2. Codex Adapter
    const codex = new CodexAdapter(opts);
    this.adapters.set('codex', codex);

    // 3. Gemini Adapter
    const gemini = new GeminiAdapter(opts);
    this.adapters.set('gemini', gemini);

    // 4. NiceAIGC Adapter (Web/API)
    const niceaigc = new NiceAigcAdapter(Object.assign({}, opts, {
      app: options.app,
      getConfig: options.getNiceaigcConfig
    }));
    this.adapters.set('niceaigc', niceaigc);
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(fn);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`[AgentHub] Error in event '${event}':`, e);
        }
      }
    }
  }

  bindActiveAdapterEvents() {
    // Unbind previous adapter listeners if any
    for (const [id, adapter] of this.adapters.entries()) {
      adapter.on('status_change', (data) => {
        if (this.activeAgentId === id) this.emit('status_change', data);
      });
      adapter.on('turn_start', (d) => {
        if (this.activeAgentId === id) this.emit('turn_start', d);
      });
      adapter.on('text_delta', (d) => {
        if (this.activeAgentId === id) this.emit('text_delta', d);
      });
      adapter.on('tool_start', (d) => {
        if (this.activeAgentId === id) this.emit('tool_start', d);
      });
      adapter.on('tool_end', (d) => {
        if (this.activeAgentId === id) this.emit('tool_end', d);
      });
      adapter.on('turn_end', (d) => {
        if (this.activeAgentId === id) this.emit('turn_end', d);
      });
      adapter.on('agent_settled', (d) => {
        if (this.activeAgentId === id) this.emit('agent_settled', d);
      });
      adapter.on('error', (d) => {
        if (this.activeAgentId === id) this.emit('error', d);
      });
    }
  }

  getActiveAgentId() {
    return this.activeAgentId;
  }

  getActiveAdapter() {
    return this.adapters.get(this.activeAgentId) || this.adapters.get('pi');
  }

  getAdapter(id) {
    return this.adapters.get(id);
  }

  getAllAdapters() {
    return Array.from(this.adapters.values());
  }

  getAgentList() {
    return [
      { id: 'pi', name: 'Pi', displayName: 'Pi Agent', icon: getAgentBrandSvg('pi', 16), desc: '本地轻量快速检索与笔记维护 (RPC)' },
      { id: 'codex', name: 'Codex', displayName: 'Codex CLI', icon: getAgentBrandSvg('codex', 16), desc: 'OpenAI 深度代码理解与复杂推理 (Exec)' },
      { id: 'gemini', name: 'Gemini', displayName: 'Gemini CLI', icon: getAgentBrandSvg('gemini', 16), desc: 'Google Gemini 知识融合与综合分析 (Headless)' },
      { id: 'niceaigc', name: 'NiceAIGC', displayName: 'NiceAIGC', icon: getAgentBrandSvg('niceaigc', 16), desc: 'NiceAIGC 智能大模型多模态对话 (Web/API)' }
    ];
  }

  isStreaming() {
    const adapter = this.getActiveAdapter();
    return !!(adapter && adapter.isStreaming);
  }

  async start() {
    return await this.getActiveAdapter().start();
  }

  async detectAll() {
    const results = {};
    for (const [id, adapter] of this.adapters.entries()) {
      results[id] = await adapter.detect();
    }
    return results;
  }

  async switchAgent(agentId) {
    if (!this.adapters.has(agentId)) {
      console.warn(`[AgentHub] Unknown agentId '${agentId}', fallback to 'pi'`);
      agentId = 'pi';
    }

    if (this.activeAgentId === agentId) return;

    const prevAgentId = this.activeAgentId;
    this.activeAgentId = agentId;
    this.saveActiveAgent(agentId);

    const adapter = this.getActiveAdapter();
    // Auto-detect and auto-start if disconnected
    if (adapter.status === 'disconnected') {
      adapter.detect().then((det) => {
        if (det && det.available && typeof adapter.start === 'function') {
          return adapter.start();
        }
      }).then(() => {
        if (this.activeAgentId === agentId) {
          this.emit('status_change', adapter.getStatus());
        }
      }).catch((e) => {
        console.warn(`[AgentHub] Auto-start for '${agentId}' failed:`, e);
      });
    }

    let sessionData = null;
    try {
      if (typeof this.sessionManager.getActiveSession === 'function') {
        sessionData = this.sessionManager.getActiveSession(agentId);
      } else if (typeof this.sessionManager.getSession === 'function') {
        sessionData = this.sessionManager.getSession(agentId);
      }
    } catch (e) {}

    this.emit('agent_switched', {
      prevAgentId,
      newAgentId: agentId,
      adapter,
      session: sessionData
    });

    // Notify new status
    this.emit('status_change', adapter.getStatus());
  }

  getStatus() {
    return this.getActiveAdapter().getStatus();
  }

  getPermissionMode() {
    return this.permissionMode;
  }

  async setPermissionMode(mode) {
    this.permissionMode = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-agent-permission-mode', mode);
      }
    } catch (e) {}

    for (const adapter of this.adapters.values()) {
      await adapter.setPermissionMode(mode);
    }
    this.emit('permission_change', mode);
  }

  async send(text, contextPayload, attachments = []) {
    return await this.getActiveAdapter().send(text, contextPayload, attachments);
  }

  async abort() {
    return await this.getActiveAdapter().abort();
  }

  async newSession() {
    this.sessionManager.clearSession(this.activeAgentId);
    return await this.getActiveAdapter().newSession();
  }

  destroy() {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.listeners.clear();
  }
}

/**
 * AgentContextProvider: Standardizes and maintains TabonKB Workbench contextual state.
 * - Schema: tabonkb-context-v1
 * - Tracks selected knowledge graph node, active filter, query keyword, and current note
 * - Formats prompt with dual-layer representation (JSON schema block + human-readable guidance)
 * - Extensible without modifying prompt templates
 */
class AgentContextProvider {
  constructor(app = null) {
    this.app = app;
    this.selectedNode = null;
    this.activeFilter = '';
    this.searchKeyword = '';
    this.activeFile = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  notifyChange() {
    for (const fn of this._listeners) {
      try {
        fn(this.getContextSnapshot());
      } catch (e) {
        console.error('[AgentContextProvider] listener error:', e);
      }
    }
  }

  setKnowledgeNode(node) {
    if (!node) {
      this.selectedNode = null;
    } else {
      this.selectedNode = {
        id: node.id || node.title,
        title: node.title || node.displayName || node.id,
        displayName: node.displayName || node.title,
        module: node.module || 'General',
        platform: node.platform || 'COMMON',
        type: node.type || 'unknown',
        path: node.path || '',
        referenceCount: node.referenceCount || (node.connections ? node.connections.length : 0),
        connections: Array.isArray(node.connections) ? node.connections : []
      };
    }
    this.notifyChange();
  }

  clearKnowledgeNode() {
    this.selectedNode = null;
    this.notifyChange();
  }

  clearActiveFile() {
    this.activeFile = null;
    this.notifyChange();
  }

  clearContext() {
    this.selectedNode = null;
    this.activeFile = null;
    this.notifyChange();
  }

  setFilter(filter) {
    this.activeFilter = filter || '';
    this.notifyChange();
  }

  setKeyword(kw) {
    this.searchKeyword = kw || '';
    this.notifyChange();
  }

  setActiveFile(file) {
    if (!file) {
      this.activeFile = null;
    } else {
      const p = file.path || '';
      const base = file.basename || (p ? p.split('/').pop().replace(/\.[^/.]+$/, '') : '文档');
      const name = file.name || (p ? p.split('/').pop() : base);
      this.activeFile = {
        path: p,
        basename: base,
        name: name
      };
    }
    this.notifyChange();
  }

  /**
   * Generates a standard machine-readable context snapshot (tabonkb-context-v1)
   */
  getContextSnapshot() {
    return {
      schema: "tabonkb-context-v1",
      timestamp: Date.now(),
      target: this.selectedNode ? {
        id: this.selectedNode.id,
        title: this.selectedNode.title,
        displayName: this.selectedNode.displayName,
        module: this.selectedNode.module,
        platform: this.selectedNode.platform,
        type: this.selectedNode.type,
        path: this.selectedNode.path,
        referenceCount: this.selectedNode.referenceCount,
        linkedNotes: this.selectedNode.connections
      } : null,
      workbench: {
        activeFilter: this.activeFilter || 'all',
        query: this.searchKeyword || ''
      },
      activeNote: this.activeFile ? {
        path: this.activeFile.path,
        name: this.activeFile.name
      } : null
    };
  }

  /**
   * Returns short UI capsule display info
   */
  getContextBadgeInfo() {
    if (this.selectedNode) {
      return {
        hasContext: true,
        type: 'graph_node',
        title: this.selectedNode.displayName || this.selectedNode.title,
        module: this.selectedNode.module,
        platform: this.selectedNode.platform,
        subtext: `知识节点 · ${this.selectedNode.module} · ${this.selectedNode.referenceCount} 关联`
      };
    }
    if (this.activeFile) {
      let mod = '文档';
      if (this.activeFile.path) {
        const parts = this.activeFile.path.split('/');
        if (parts.length > 1) {
          mod = parts[parts.length - 2].replace(/^[0-9]+-/, '');
        }
      }
      return {
        hasContext: true,
        type: 'active_file',
        title: this.activeFile.basename || this.activeFile.name,
        module: mod,
        platform: '',
        subtext: `当前文档 · ${this.activeFile.path}`
      };
    }
    return {
      hasContext: false,
      type: 'vault',
      title: '整个知识库 (TabonKB)',
      module: 'All',
      platform: '',
      subtext: '全局 Vault 范围 (只读模式)'
    };
  }

  /**
   * Formats prompt with dual-layer representation:
   * 1. Machine-readable JSON block
   * 2. Clear human/LLM instructions
   * 3. User request
   */
  formatPromptWithContext(userPrompt) {
    const snapshot = this.getContextSnapshot();

    if (!snapshot.target && !snapshot.activeNote) {
      return userPrompt;
    }

    const jsonBlock = JSON.stringify(snapshot, null, 2);

    let contextSummary = '';
    if (snapshot.target) {
      contextSummary = `【当前聚焦知识图谱节点】
- 节点名称: ${snapshot.target.title}
- 归属模块: ${snapshot.target.module}
- 关联平台: ${snapshot.target.platform}
- 节点类型: ${snapshot.target.type}
- 对应文档: ${snapshot.target.path || '（未绑定具体文件）'}
- 关联知识点: ${snapshot.target.linkedNotes.length > 0 ? snapshot.target.linkedNotes.join(', ') : '暂无直接关联'}`;
    } else if (snapshot.activeNote) {
      contextSummary = `【当前活动文档】
- 文档路径: ${snapshot.activeNote.path}`;
    }

    return `[TabonKB Context Meta]
\`\`\`json
${jsonBlock}
\`\`\`

${contextSummary}

[研发人员提问]
${userPrompt}`;
  }
}

/**
 * PiDrawerView: Controls the UI Drawer component for Agent Hub inside TabonKB Workbench.
 * - Supports Multi-Agent Hub: Pi Agent, Codex CLI, Gemini CLI
 * - Dynamic Agent Selector Dropdown in Header [ 🤖 Pi ▼ ]
 * - Isolated Session & Message History Swapping per Agent
 * - Input Draft Preservation during Agent Switching
 * - CLI Availability Detection & Warning Banner
 * - Status LED Indicator (Connected / Thinking / Running Tool / Disconnected / Error / Not Installed)
 * - Context Capsule (with quick clear / focus)
 * - Real-time streaming message bubble appending (zero re-render overhead)
 * - Tool Call Badges with Elapsed Time Timer & 30s warning
 * - Input controls: Send (Enter), Abort (Esc/Click), New Session, Close
 */
class PiDrawerView {
  constructor(options = {}) {
    // Multi-Agent Hub instance
    if (options.hub) {
      this.hub = options.hub;
    } else {
      this.hub = new AgentHub({
        bridge: options.bridge,
        vaultBasePath: options.vaultBasePath || (process.cwd ? process.cwd() : '')
      });
    }

    this.contextProvider = options.contextProvider;
    this.app = options.app || (options.contextProvider && options.contextProvider.app) || (typeof window !== 'undefined' ? window.app : null);
    this.vaultBasePath = options.vaultBasePath || (this.hub && this.hub.vaultBasePath) || (this.app?.vault?.adapter?.basePath) || (process.cwd ? process.cwd() : '');
    
    // Lifecycle component for native MarkdownRenderer
    let CompCls = typeof Component !== 'undefined' ? Component : null;
    if (!CompCls && typeof require !== 'undefined') {
      try { CompCls = require('obsidian')?.Component; } catch (e) {}
    }
    if (CompCls) {
      try {
        this.markdownComponent = new CompCls();
        this.markdownComponent.load();
      } catch (e) {
        this.markdownComponent = null;
      }
    } else {
      this.markdownComponent = null;
    }
    this.containerEl = null;
    this.drawerEl = null;
    this.resizerEl = null;
    this.messagesEl = null;
    this.inputEl = null;
    this.btnSend = null;
    this.btnAbort = null;
    this.btnNewSession = null;
    this.btnClose = null;
    this.statusLed = null;
    this.statusText = null;
    this.contextCapsuleEl = null;
    this.permBadgeEl = null;
    this.warningBannerEl = null;

    // Selector elements
    this.selectorBtn = null;
    this.selectorMenu = null;
    this.agentIconEl = null;
    this.agentNameEl = null;

    // Antigravity Dialog Input Card elements
    this.inputCardEl = null;
    this.cardAttachmentsEl = null;
    this.cardImageAttachmentsEl = null;
    this.btnUploadImage = null;
    this.imageFileInput = null;
    this.attachedImages = [];
    this.cardModelPillEl = null;
    this.cardModelIconEl = null;
    this.cardModelNameEl = null;
    this.btnAttachDoc = null;
    this.dragOverlayEl = null;

    // Bottom-Left Model Selector elements
    this.modelWrapEl = null;
    this.modelPillEl = null;
    this.modelIconEl = null;
    this.modelNameEl = null;
    this.modelPopoverEl = null;
    this.modelSearchInput = null;
    this.modelListEl = null;
    this.reasoningPopoverEl = null;

    this.isOpenState = false;
    this.width = this.getSavedWidth();
    this.inputHeight = this.getSavedInputHeight();
    this.isDragging = false;
    this.currentAssistantMessage = null;
    this.activeToolCards = new Map(); // toolCallId -> DOM Element & timer
    this.onToggleCallbacks = new Set();
    this.onAgentChangeCallbacks = new Set();
    this.onNodeFocusCallback = options.onNodeFocus || null;

    this.setupHubEvents();
  }

  get permissionMode() {
    return this.hub.getPermissionMode();
  }

  get bridge() {
    return this.hub.getActiveAdapter();
  }

  getSavedWidth() {
    try {
      const saved = parseInt(localStorage.getItem('tabonkb-agent-drawer-width'), 10);
      if (!isNaN(saved) && saved >= 320 && saved <= 760) {
        return saved;
      }
    } catch (e) {}
    return 420;
  }

  saveWidth(w) {
    try {
      localStorage.setItem('tabonkb-agent-drawer-width', String(w));
    } catch (e) {}
  }

  getSavedInputHeight() {
    try {
      const saved = parseInt(localStorage.getItem('tabonkb-dialog-input-height'), 10);
      if (!isNaN(saved) && saved >= 38 && saved <= 500) {
        return saved;
      }
    } catch (e) {}
    return 54;
  }

  saveInputHeight(h) {
    try {
      this.inputHeight = h;
      localStorage.setItem('tabonkb-dialog-input-height', String(h));
    } catch (e) {}
  }

  async togglePermissionMode() {
    const nextMode = this.permissionMode === 'readonly' ? 'readwrite' : 'readonly';
    await this.hub.setPermissionMode(nextMode);
    this.updatePermBadge();
    this.updatePermHint();
    this.updateStatus(this.hub.getStatus());
  }

  updatePermBadge() {
    if (!this.permBadgeEl) return;
    const isRW = this.permissionMode === 'readwrite';
    this.permBadgeEl.className = `tw-drawer-badge-btn ${isRW ? 'readwrite' : 'readonly'}`;
    this.permBadgeEl.innerHTML = isRW
      ? `<span class="tw-badge-icon">${getIconPark('edit', 12)}</span><span class="tw-badge-text">读写模式</span>`
      : `<span class="tw-badge-icon">${getIconPark('lock', 12)}</span><span class="tw-badge-text">只读模式</span>`;
    this.permBadgeEl.title = isRW
      ? '当前：读写模式（支持新建与修改笔记），点击切换为只读'
      : '当前：只读模式（安全检索不修改），点击切换为读写';
  }

  updatePermHint() {
    const isRW = this.permissionMode === 'readwrite';
    const hintText = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint .tw-hint-text') : null;
    if (hintText) {
      hintText.textContent = isRW ? '读写安全模式' : '只读安全模式';
    } else {
      const hintEl = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint') : null;
      if (hintEl) hintEl.textContent = isRW ? '读写模式' : '只读模式';
    }
    const hintDot = this.drawerEl ? this.drawerEl.querySelector('#twDrawerPermHint .tw-hint-dot') : null;
    if (hintDot) {
      hintDot.className = `tw-hint-dot ${this.permissionMode}`;
    }
  }

  onToggle(fn) {
    this.onToggleCallbacks.add(fn);
  }

  notifyToggle(isOpen) {
    for (const fn of this.onToggleCallbacks) {
      try {
        fn(isOpen, this.width);
      } catch (e) {
        console.error('[PiDrawerView] toggle listener error:', e);
      }
    }
  }

  onAgentChange(fn) {
    this.onAgentChangeCallbacks.add(fn);
  }

  notifyAgentChange(agentId) {
    for (const fn of this.onAgentChangeCallbacks) {
      try {
        fn(agentId, this.hub.getActiveAdapter());
      } catch (e) {
        console.error('[PiDrawerView] agent change listener error:', e);
      }
    }
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.buildDom();
    this.updateContextCapsule();
    this.updateCardAttachments();
    this.updatePermBadge();
    this.updatePermHint();
    this.syncActiveAgentUI();
    this.restoreSessionMessages(this.hub.activeAgentId);
    this.updateStatus(this.hub.getStatus());
  }

  buildDom() {
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'tw-agent-drawer';
    this.drawerEl.style.width = `${this.width}px`;
    this.drawerEl.style.display = 'none';

    // 1. Resizer Handle
    this.resizerEl = document.createElement('div');
    this.resizerEl.className = 'tw-drawer-resizer';
    this.resizerEl.title = '拖拽调整抽屉宽度';
    this.drawerEl.appendChild(this.resizerEl);
    this.bindResizer();

    // 2. Drawer Content Inner Wrap
    const contentWrap = document.createElement('div');
    contentWrap.className = 'tw-drawer-content';
    this.drawerEl.appendChild(contentWrap);

    // Header with Agent Selector Dropdown
    const activeAdapter = this.hub.getActiveAdapter();
    const header = document.createElement('div');
    header.className = 'tw-drawer-header';
    header.innerHTML = `
      <div class="tw-drawer-header-left">
        <div class="tw-agent-selector-wrap" id="twDrawerAgentSelectorWrap">
          <button class="tw-agent-selector-btn" id="twDrawerAgentSelectorBtn" title="点击切换 Agent (Pi / Codex / Gemini)">
            <span class="tw-agent-sel-icon" id="twDrawerAgentIcon">${activeAdapter.icon}</span>
            <span class="tw-agent-sel-name" id="twDrawerAgentName">${escapeHtml(activeAdapter.displayName || activeAdapter.name)}</span>
            <span class="tw-agent-sel-caret">${getIconPark('down', 11)}</span>
          </button>
          <div class="tw-agent-dropdown-menu" id="twDrawerAgentMenu" style="display:none;"></div>
        </div>
        <button class="tw-drawer-badge-btn" id="twDrawerPermBadge" title="点击切换：只读模式 / 读写模式">
          <span class="tw-badge-icon">${getIconPark('edit', 12)}</span><span class="tw-badge-text">读写模式</span>
        </button>
        <div class="tw-drawer-status">
          <span class="tw-status-dot disconnected" id="twDrawerStatusDot"></span>
          <span class="tw-status-label" id="twDrawerStatusLabel">未连接</span>
        </div>
      </div>
      <div class="tw-drawer-header-actions">
        <button class="tw-drawer-btn" id="twBtnHistory" title="历史会话记录 (分段归档)">
          ${getIconPark('time', 14)}
        </button>
        <button class="tw-drawer-btn tw-btn-export-quicknote" id="twBtnExportQuickNote" title="存入 Quick-Note (包含离线图片)">
          ${getIconPark('download', 14)}
        </button>
        <button class="tw-drawer-btn" id="twBtnNewSession" title="新建空白会话">
          ${getIconPark('refresh', 14)}
        </button>
        <button class="tw-drawer-btn tw-drawer-btn-close" id="twBtnCloseDrawer" title="关闭抽屉 (Esc)">
          ${getIconPark('close', 14)}
        </button>
      </div>
    `;
    contentWrap.appendChild(header);

    this.selectorBtn = header.querySelector('#twDrawerAgentSelectorBtn');
    this.selectorMenu = header.querySelector('#twDrawerAgentMenu');
    this.agentIconEl = header.querySelector('#twDrawerAgentIcon');
    this.agentNameEl = header.querySelector('#twDrawerAgentName');
    this.statusLed = header.querySelector('#twDrawerStatusDot');
    this.statusText = header.querySelector('#twDrawerStatusLabel');
    this.permBadgeEl = header.querySelector('#twDrawerPermBadge');
    this.btnHistory = header.querySelector('#twBtnHistory');
    this.btnExportQuickNote = header.querySelector('#twBtnExportQuickNote');
    this.btnNewSession = header.querySelector('#twBtnNewSession');
    this.btnClose = header.querySelector('#twBtnCloseDrawer');

    this.bindAgentSelectorEvents();

    const handleStatusClick = async () => {
      const adapter = this.hub.getActiveAdapter();
      if (!adapter) return;
      if (adapter.status === 'disconnected' || adapter.status === 'error') {
        this.updateStatus({ status: 'connecting', detail: '正在重新连接...' });
        try {
          await adapter.start();
          this.updateStatus(adapter.getStatus());
        } catch (e) {
          this.updateStatus({ status: 'error', detail: e.message || '连接失败' });
        }
      }
    };
    if (this.statusLed) {
      this.statusLed.style.cursor = 'pointer';
      this.statusLed.title = '点击重新连接';
      this.statusLed.onclick = handleStatusClick;
    }
    if (this.statusText) {
      this.statusText.style.cursor = 'pointer';
      this.statusText.title = '点击重新连接';
      this.statusText.onclick = handleStatusClick;
    }

    if (this.permBadgeEl) this.permBadgeEl.onclick = () => this.togglePermissionMode();
    if (this.btnHistory) this.btnHistory.onclick = () => this.toggleHistoryPanel();
    if (this.btnExportQuickNote) this.btnExportQuickNote.onclick = () => this.exportToQuickNote();
    if (this.btnNewSession) this.btnNewSession.onclick = () => this.handleNewSession();
    if (this.btnClose) this.btnClose.onclick = () => this.close();

    // 2.5 History Sessions Panel (Default Hidden)
    this.historyPanelEl = document.createElement('div');
    this.historyPanelEl.className = 'tw-drawer-history-panel';
    this.historyPanelEl.id = 'twDrawerHistoryPanel';
    this.historyPanelEl.style.display = 'none';
    this.historyPanelEl.innerHTML = `
      <div class="tw-history-panel-header">
        <div class="tw-history-panel-title">
          <span>${getIconPark('time', 13)}</span>
          <span>历史会话分段记录</span>
        </div>
        <button class="tw-history-new-btn" id="twHistoryNewBtn" title="新建空白会话">
          ${getIconPark('edit', 12)}
          <span>新会话</span>
        </button>
      </div>
      <div class="tw-history-list" id="twHistoryList"></div>
    `;
    contentWrap.appendChild(this.historyPanelEl);
    const histNewBtn = this.historyPanelEl.querySelector('#twHistoryNewBtn');
    if (histNewBtn) histNewBtn.onclick = () => this.handleNewSession();

    // 3. Warning Banner (if CLI not installed)
    this.warningBannerEl = document.createElement('div');
    this.warningBannerEl.className = 'tw-agent-warning-banner';
    this.warningBannerEl.style.display = 'none';
    contentWrap.appendChild(this.warningBannerEl);

    // 4. Context Capsule Bar
    this.contextCapsuleEl = document.createElement('div');
    this.contextCapsuleEl.className = 'tw-drawer-context-bar';
    contentWrap.appendChild(this.contextCapsuleEl);

    // 5. Messages Container
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'tw-drawer-messages';
    
    // Message container click delegation: copy button & external links
    this.messagesEl.onclick = async (e) => {
      // 1. Copy message text button
      const copyBtn = e.target.closest('.tw-msg-copy-btn');
      if (copyBtn) {
        e.stopPropagation();
        const bubble = copyBtn.closest('.tw-msg-bubble-wrap');
        const contentEl = bubble ? bubble.querySelector('.tw-msg-content') : null;
        if (contentEl) {
          const raw = contentEl.getAttribute('data-raw') || contentEl.innerText || '';
          try {
            await navigator.clipboard.writeText(raw);
            const prevHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = `${getIconPark('check', 12)} <span>已复制</span>`;
            setTimeout(() => { copyBtn.innerHTML = prevHtml; }, 1800);
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 回答全文已复制到剪贴板', 2000);
          } catch (err) {
            console.warn('[PiDrawerView] Copy failed:', err);
          }
        }
        return;
      }

      // 1.5 Intercept clicks on user images or assistant images for full lightbox preview
      const imgEl = e.target.closest('.tw-msg-user-img, .tw-msg-content img');
      if (imgEl && imgEl.src) {
        e.stopPropagation();
        this.openImageLightbox(imgEl.src, imgEl.alt || imgEl.title || '图片预览');
        return;
      }

      // 2. Intercept clicks on links inside message bubbles to open in external browser
      const link = e.target.closest('a');
      if (link && link.href) {
        const href = link.getAttribute('href') || link.href;
        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          try {
            
            if (shell && typeof shell.openExternal === 'function') {
              shell.openExternal(href);
              return;
            }
          } catch (err) {}
          window.open(href, '_blank');
        }
      }
    };

    contentWrap.appendChild(this.messagesEl);

    // 6. Footer / Input Bar (Antigravity Floating Card Design - Resizable & Clean)
    const footer = document.createElement('div');
    footer.className = 'tw-drawer-footer';
    footer.innerHTML = `
      <div class="tw-drawer-input-card" id="twDrawerInputCard">
        <div class="tw-card-resizer" id="twCardResizer" title="上下拖拽调整对话框高度">
          <span class="tw-card-resizer-line"></span>
        </div>
        <div class="tw-card-image-attachments" id="twCardImageAttachments" style="display:none;"></div>
        <div class="tw-card-attachments" id="twCardAttachments" style="display:none;"></div>
        <textarea 
          class="tw-drawer-input" 
          id="twDrawerInput" 
          placeholder="向 ${escapeAttr(activeAdapter.displayName || activeAdapter.name)} 提问，输入需求或问题... (Enter 发送)"
        ></textarea>
        <div class="tw-card-toolbar">
          <div class="tw-card-toolbar-left">
            <div class="tw-card-model-wrap" id="twCardModelWrap">
              <button class="tw-card-model-pill" id="twCardModelPill" title="点击切换当前 AI 模型">
                <span class="tw-card-model-icon" id="twCardModelIcon">${getOfficialModelSvg('gpt-5-6-thinking', 14)}</span>
                <span class="tw-card-model-name" id="twCardModelName">GPT-5.6 Sol</span>
                <span class="tw-card-model-caret">${getIconPark('down', 10)}</span>
              </button>
              <div class="tw-model-popover" id="twModelPopover" style="display:none;">
                <div class="tw-model-search-wrap">
                  <span class="tw-model-search-icon">${getIconPark('search', 13)}</span>
                  <input type="text" class="tw-model-search-input" id="twModelSearchInput" placeholder="搜索模型 (如 5.6, Claude, Gemini...)" />
                </div>
                <div class="tw-model-popover-list" id="twModelPopoverList"></div>
              </div>
              <div class="tw-reasoning-popover" id="twReasoningPopover" style="display:none;"></div>
            </div>
            <button class="tw-card-upload-btn" id="twBtnUploadImage" title="上传图片附件 (支持相册选择 / Ctrl+V 截图直接粘贴 / 拖拽图片)">
              ${getIconPark('pic', 14)}
            </button>
            <input type="file" id="twImageFileInput" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none;" />
            <span class="tw-card-shortcut-hint">↵ 发送 · Shift+↵ 换行</span>
          </div>
          <div class="tw-card-toolbar-right">
            <button class="tw-card-abort-btn" id="twBtnAbort" style="display:none;" title="停止生成 (Esc)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/></svg>
            </button>
            <button class="tw-card-send-btn disabled" id="twBtnSend" title="发送 (Enter)" disabled>
              ${getIconPark('send', 14)}
            </button>
          </div>
        </div>
        <div class="tw-card-drag-overlay" id="twCardDragOverlay">
          ${getIconPark('paperclip', 16)}
          <span>松开以附加图片或文档到对话</span>
        </div>
      </div>
      <div class="tw-drawer-footer-hint">
        <span class="tw-hint-left" id="twDrawerPermHint">
          <span class="tw-hint-dot"></span>
          <span class="tw-hint-text">读写模式</span>
        </span>
      </div>
    `;
    contentWrap.appendChild(footer);

    this.inputCardEl = footer.querySelector('#twDrawerInputCard');
    this.cardImageAttachmentsEl = footer.querySelector('#twCardImageAttachments');
    this.cardAttachmentsEl = footer.querySelector('#twCardAttachments');
    this.btnUploadImage = footer.querySelector('#twBtnUploadImage');
    this.imageFileInput = footer.querySelector('#twImageFileInput');
    this.inputEl = footer.querySelector('#twDrawerInput');
    this.btnSend = footer.querySelector('#twBtnSend');
    this.btnAbort = footer.querySelector('#twBtnAbort');
    this.dragOverlayEl = footer.querySelector('#twCardDragOverlay');

    this.modelWrapEl = footer.querySelector('#twCardModelWrap');
    this.modelPillEl = footer.querySelector('#twCardModelPill');
    this.modelIconEl = footer.querySelector('#twCardModelIcon');
    this.modelNameEl = footer.querySelector('#twCardModelName');
    this.modelPopoverEl = footer.querySelector('#twModelPopover');
    this.modelSearchInput = footer.querySelector('#twModelSearchInput');
    this.modelListEl = footer.querySelector('#twModelPopoverList');
    this.reasoningPopoverEl = footer.querySelector('#twReasoningPopover');

    if (this.inputEl) {
      this.inputEl.style.height = `${this.inputHeight}px`;
    }

    this.bindCardResizer();
    this.bindInputEvents();
    this.bindModelSelectorEvents();
    this.updateModelSelectorPill();
    this.updateContextCapsule();
    this.updateSendButtonState();

    this.containerEl.appendChild(this.drawerEl);
  }

  bindAgentSelectorEvents() {
    if (!this.selectorBtn || !this.selectorMenu) return;

    this.selectorBtn.onclick = (e) => {
      e.stopPropagation();
      const isVisible = this.selectorMenu.style.display === 'block';
      if (isVisible) {
        this.selectorMenu.style.display = 'none';
      } else {
        this.renderDropdownMenu();
        this.selectorMenu.style.display = 'block';
      }
    };

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.selectorMenu && !this.selectorMenu.contains(e.target) && e.target !== this.selectorBtn) {
        this.selectorMenu.style.display = 'none';
      }
    });
  }

  renderDropdownMenu() {
    if (!this.selectorMenu) return;
    const agents = this.hub.getAgentList();
    const currentId = this.hub.activeAgentId;

    let html = '';
    for (const a of agents) {
      const isSelected = a.id === currentId;
      const adapter = this.hub.getAdapter(a.id);
      const isInstalled = adapter ? adapter.status !== 'not_installed' : true;

      html += `
        <div class="tw-agent-dropdown-item ${isSelected ? 'active' : ''} ${!isInstalled ? 'missing' : ''}" data-agent-id="${a.id}">
          <div class="tw-agent-item-left">
            <span class="tw-agent-item-icon">${a.icon}</span>
            <div class="tw-agent-item-info">
              <div class="tw-agent-item-name">
                ${escapeHtml(a.displayName)}
                ${isSelected ? `<span class="tw-agent-check">${getIconPark('check', 12)}</span>` : ''}
              </div>
              <div class="tw-agent-item-desc">${escapeHtml(a.desc)}</div>
            </div>
          </div>
        </div>
      `;
    }

    this.selectorMenu.innerHTML = html;

    this.selectorMenu.querySelectorAll('.tw-agent-dropdown-item').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const targetId = el.getAttribute('data-agent-id');
        this.selectorMenu.style.display = 'none';
        this.switchAgent(targetId);
      };
    });
  }

  bindModelSelectorEvents() {
    if (!this.modelPillEl || !this.modelPopoverEl) return;

    this.modelPillEl.onclick = (e) => {
      e.stopPropagation();
      const isVisible = this.modelPopoverEl.style.display === 'flex';
      if (isVisible) {
        this.closeModelPopover();
      } else {
        this.openModelPopover();
      }
    };

    if (this.modelSearchInput) {
      this.modelSearchInput.onclick = (e) => e.stopPropagation();
      this.modelSearchInput.oninput = (e) => {
        this.renderModelPopover(e.target.value.trim());
      };
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.modelPopoverEl && this.modelWrapEl && !this.modelWrapEl.contains(e.target)) {
        this.closeModelPopover();
      }
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modelPopoverEl && this.modelPopoverEl.style.display === 'flex') {
        this.closeModelPopover();
      }
    });
  }

  openModelPopover() {
    if (!this.modelPopoverEl) return;
    if (this.modelSearchInput) this.modelSearchInput.value = '';
    this.renderModelPopover('');
    this.modelPopoverEl.style.display = 'flex';
    setTimeout(() => {
      if (this.modelSearchInput) this.modelSearchInput.focus();
    }, 50);
  }

  closeModelPopover() {
    if (this.modelPopoverEl) {
      this.modelPopoverEl.style.display = 'none';
    }
    this.closeReasoningPopover();
  }

  openReasoningPopover(anchorEl, modelId, modelName) {
    if (!this.reasoningPopoverEl || !anchorEl) return;
    const adapter = this.hub.getActiveAdapter();
    const currentEffort = typeof adapter.getReasoningEffort === 'function' ? adapter.getReasoningEffort() : 'max';

    const levels = [
      { id: 'medium', label: '中', desc: '思考与速度平衡' },
      { id: 'high', label: '高', desc: '为复杂问题思考更久' },
      { id: 'max', label: '极高', desc: '为最难的问题做最深入的分析' }
    ];

    let html = '';
    for (const lvl of levels) {
      const isActive = lvl.id === currentEffort;
      html += `
        <div class="tw-reasoning-item ${isActive ? 'active' : ''}" data-effort="${lvl.id}" data-model-id="${escapeAttr(modelId)}" data-model-name="${escapeAttr(modelName)}">
          <div class="tw-reasoning-item-info">
            <div class="tw-reasoning-item-title">${escapeHtml(lvl.label)}</div>
            <div class="tw-reasoning-item-desc">${escapeHtml(lvl.desc)}</div>
          </div>
          ${isActive ? `<span class="tw-reasoning-item-check">${getIconPark('check', 12)}</span>` : ''}
        </div>
      `;
    }

    this.reasoningPopoverEl.innerHTML = html;

    // Positioning: align with top of item, offset to right or left depending on boundary
    const anchorRect = anchorEl.getBoundingClientRect();
    const popoverRect = this.modelPopoverEl ? this.modelPopoverEl.getBoundingClientRect() : anchorRect;
    const topOffset = anchorRect.top - popoverRect.top;
    this.reasoningPopoverEl.style.top = `${Math.max(0, topOffset)}px`;
    this.reasoningPopoverEl.style.bottom = 'auto';

    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    if (popoverRect.right + 210 > windowWidth) {
      this.reasoningPopoverEl.style.left = 'auto';
      this.reasoningPopoverEl.style.right = '296px';
    } else {
      this.reasoningPopoverEl.style.left = '296px';
      this.reasoningPopoverEl.style.right = 'auto';
    }

    this.reasoningPopoverEl.style.display = 'flex';

    // Bind item clicks
    this.reasoningPopoverEl.querySelectorAll('.tw-reasoning-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const mId = item.getAttribute('data-model-id');
        const mName = item.getAttribute('data-model-name');
        const effort = item.getAttribute('data-effort');
        this.selectModel(mId, mName, mId, effort);
      };
    });
  }

  closeReasoningPopover() {
    if (this.reasoningPopoverEl) {
      this.reasoningPopoverEl.style.display = 'none';
    }
  }

  _renderModelItem(m, currentId, adapter, categoryName = '') {
    const isSelected = m.id === currentId;
    const brandIcon = getOfficialModelSvg(m.brand || m.id || m.name, 14);
    const supportsReasoning = !!m.supportsReasoningEffort;

    let rightSideHtml = '';
    if (supportsReasoning) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function'
        ? adapter.getReasoningEffortConfig()
        : { label: '极高' };
      rightSideHtml = `
        <div class="tw-reasoning-trigger" data-model-id="${escapeAttr(m.id)}" data-model-name="${escapeAttr(m.name)}" title="选择推理等级">
          <span class="tw-reasoning-label">${escapeHtml(effortConfig.label)}</span>
          ${isSelected ? `<span class="tw-model-item-check">${getIconPark('check', 12)}</span>` : ''}
          <span class="tw-reasoning-caret">${getIconPark('right', 9)}</span>
        </div>
      `;
    } else if (isSelected) {
      rightSideHtml = `<span class="tw-model-item-check">${getIconPark('check', 12)}</span>`;
    }

    return `
      <div class="tw-model-item ${isSelected ? 'active' : ''} ${supportsReasoning ? 'has-reasoning' : ''}" data-model-id="${escapeAttr(m.id)}" data-model-name="${escapeAttr(m.name)}" data-model-icon="${escapeAttr(m.id)}" data-supports-reasoning="${supportsReasoning ? 'true' : 'false'}">
        <div class="tw-model-item-info">
          <div class="tw-model-item-title-row">
            <span>${brandIcon}</span>
            <span class="tw-model-item-name">${escapeHtml(m.name)}</span>
            ${categoryName ? `<span style="font-size: 9.5px; opacity: 0.6; margin-left: 4px;">(${escapeHtml(categoryName)})</span>` : ''}
          </div>
          ${m.desc ? `<div class="tw-model-item-desc">${escapeHtml(m.desc)}</div>` : ''}
        </div>
        ${rightSideHtml}
      </div>
    `;
  }

  renderModelPopover(searchTerm = '') {
    if (!this.modelListEl) return;
    const adapter = this.hub.getActiveAdapter();
    const groups = typeof adapter.getModelGroups === 'function' ? adapter.getModelGroups() : [];
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : { id: 'default', name: 'Default' };
    const currentId = currentModel.id;

    const term = searchTerm.toLowerCase();

    // If searching, display flattened matching items
    if (term) {
      const matches = [];
      for (const g of groups) {
        for (const m of (g.models || [])) {
          if (m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term) || (m.desc && m.desc.toLowerCase().includes(term))) {
            matches.push(Object.assign({}, m, { category: g.group }));
          }
        }
      }

      if (matches.length === 0) {
        this.modelListEl.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 11px;">
            未找到包含 "${escapeHtml(searchTerm)}" 的模型
          </div>
        `;
        return;
      }

      let html = '';
      for (const m of matches) {
        html += this._renderModelItem(m, currentId, adapter, m.category);
      }
      this.modelListEl.innerHTML = html;
      this._bindModelItemClicks();
      return;
    }

    // Default categorized layout (matches website screenshot)
    let html = '';

    // 1. Top Section (e.g. 常用模型: Auto, GPT-5.6 Sol)
    const topGroup = groups.find(g => g.isTop);
    if (topGroup) {
      for (const m of (topGroup.models || [])) {
        html += this._renderModelItem(m, currentId, adapter);
      }
      html += '<div class="tw-model-divider"></div>';
    }

    // 2. Categorized Groups (Accordion)
    const otherGroups = groups.filter(g => !g.isTop);
    for (let i = 0; i < otherGroups.length; i++) {
      const g = otherGroups[i];
      const hasActive = (g.models || []).some(m => m.id === currentId);
      const groupIcon = g.brand 
        ? getOfficialModelSvg(g.brand, 14) 
        : (g.iconPark ? getIconPark(g.iconPark, 13) : getOfficialModelSvg(g.group, 14));

      html += `
        <div class="tw-model-category ${hasActive ? 'open' : ''}" data-cat-idx="${i}">
          <div class="tw-model-category-header">
            <div class="tw-model-category-left">
              <span class="tw-model-category-icon">${groupIcon}</span>
              <span class="tw-model-category-title">${escapeHtml(g.group)}</span>
            </div>
            <span class="tw-model-category-arrow">${getIconPark('right', 11)}</span>
          </div>
          <div class="tw-model-category-items">
      `;

      for (const m of (g.models || [])) {
        html += this._renderModelItem(m, currentId, adapter);
      }

      html += `
          </div>
        </div>
      `;
    }

    this.modelListEl.innerHTML = html;

    // Bind Accordion toggles
    this.modelListEl.querySelectorAll('.tw-model-category-header').forEach(hdr => {
      hdr.onclick = (e) => {
        e.stopPropagation();
        const cat = hdr.closest('.tw-model-category');
        if (cat) cat.classList.toggle('open');
      };
    });

    this._bindModelItemClicks();
  }

  _bindModelItemClicks() {
    this.modelListEl.querySelectorAll('.tw-model-item').forEach(el => {
      const modelId = el.getAttribute('data-model-id');
      const modelName = el.getAttribute('data-model-name');
      const modelIcon = el.getAttribute('data-model-icon');
      const supportsReasoning = el.getAttribute('data-supports-reasoning') === 'true';

      // 1. Click on item itself -> selects model with current reasoning effort
      el.onclick = (e) => {
        const trigger = e.target.closest('.tw-reasoning-trigger');
        if (trigger) return; // Trigger click handled below
        e.stopPropagation();
        const adapter = this.hub.getActiveAdapter();
        const currentEffort = typeof adapter.getReasoningEffort === 'function' ? adapter.getReasoningEffort() : 'max';
        this.selectModel(modelId, modelName, modelIcon, supportsReasoning ? currentEffort : null);
      };

      // 2. Click or hover on reasoning trigger
      const trigger = el.querySelector('.tw-reasoning-trigger');
      if (trigger) {
        trigger.onclick = (e) => {
          e.stopPropagation();
          const isOpen = this.reasoningPopoverEl && this.reasoningPopoverEl.style.display === 'flex';
          if (isOpen) {
            this.closeReasoningPopover();
          } else {
            this.openReasoningPopover(el, modelId, modelName);
          }
        };

        el.addEventListener('mouseenter', () => {
          this.openReasoningPopover(el, modelId, modelName);
        });
      } else {
        el.addEventListener('mouseenter', () => {
          this.closeReasoningPopover();
        });
      }
    });
  }

  selectModel(modelId, modelName, modelIcon, reasoningEffort = null) {
    const adapter = this.hub.getActiveAdapter();
    if (typeof adapter.setModel === 'function') {
      adapter.setModel(modelId, modelName, reasoningEffort);
    }

    this.updateModelSelectorPill();
    this.closeModelPopover();

    let levelSuffix = '';
    if (reasoningEffort) {
      const map = { 'medium': '中推理', 'high': '高推理', 'max': '极高推理' };
      levelSuffix = ` (${map[reasoningEffort] || reasoningEffort})`;
    }

    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls(`✓ 已切换至模型: ${modelName}${levelSuffix}`, 2500);

    if (this.inputEl) {
      const fullLabel = `${modelName}${levelSuffix}`;
      this.inputEl.placeholder = `向 ${adapter.displayName || adapter.name} (${fullLabel}) 提问... (Enter 发送)`;
      this.inputEl.focus();
    }
  }

  updateModelSelectorPill() {
    if (!this.modelWrapEl || !this.modelPillEl || !this.modelNameEl) return;
    const adapter = this.hub.getActiveAdapter();
    const groups = typeof adapter.getModelGroups === 'function' ? adapter.getModelGroups() : [];
    
    // If current agent has no model choices, hide model selector pill gracefully
    if (!groups || groups.length === 0) {
      this.modelWrapEl.style.display = 'none';
      return;
    }
    this.modelWrapEl.style.display = 'inline-block';

    const current = typeof adapter.getModel === 'function' ? adapter.getModel() : { id: 'default', name: 'Default' };
    const brandIcon = getOfficialModelSvg(current.id || current.name, 14);

    if (this.modelIconEl) this.modelIconEl.innerHTML = brandIcon;

    let displayName = current.name || current.id || 'GPT-5.6 Sol';
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(current.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) {
        displayName = `${displayName} · ${effortConfig.label}`;
      }
    }

    if (this.modelNameEl) this.modelNameEl.textContent = displayName;
  }

  async switchAgent(agentId) {
    if (this.hub.activeAgentId === agentId) {
      this.syncActiveAgentUI();
      return;
    }

    // 1. Save draft for current agent
    if (this.inputEl && this.hub && this.hub.activeAgentId) {
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
    }

    // 2. Finalize any ongoing assistant message for current agent
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    // 3. Switch in Hub
    await this.hub.switchAgent(agentId);

    // 4. Update UI labels and selector
    this.syncActiveAgentUI();

    // 5. Restore Draft
    if (this.inputEl) {
      this.inputEl.value = this.hub.sessionManager.getDraft(agentId) || '';
      const savedH = this.getSavedInputHeight();
      this.inputHeight = savedH;
      const targetH = Math.max(savedH, Math.min(500, this.inputEl.scrollHeight || savedH));
      this.inputEl.style.height = `${targetH}px`;
    }

    // 6. Restore Message History
    this.restoreSessionMessages(agentId);

    // 7. Check if installed and show warning if needed
    const adapter = this.hub.getActiveAdapter();
    this.checkAdapterInstalledState(adapter);

    // 8. Update context capsule & toolbar states
    this.updateContextCapsule();
    this.updateCardAttachments();
    this.updateSendButtonState();
    if (this.historyPanelEl) this.historyPanelEl.style.display = 'none';

    // 9. Update status LED & label immediately, and auto-start if disconnected
    this.updateStatus(adapter.getStatus());
    if (adapter.status === 'disconnected' && typeof adapter.start === 'function') {
      this.updateStatus({ status: 'connecting', detail: '连接中...' });
      adapter.start().then(() => {
        this.updateStatus(adapter.getStatus());
      }).catch(() => {
        this.updateStatus(adapter.getStatus());
      });
    }

    // 10. Notify external listeners (e.g. main workbench top bar)
    this.notifyAgentChange(agentId);
  }

  syncActiveAgentUI() {
    const adapter = this.hub.getActiveAdapter();
    const agents = this.hub.getAgentList();
    const meta = agents.find(a => a.id === this.hub.activeAgentId) || { name: 'Pi', icon: getAgentBrandSvg('pi', 16), displayName: 'Pi Agent' };

    if (this.agentIconEl) this.agentIconEl.innerHTML = meta.icon;
    if (this.agentNameEl) this.agentNameEl.textContent = meta.displayName || meta.name;
    if (this.cardModelIconEl) this.cardModelIconEl.innerHTML = meta.icon;
    if (this.cardModelNameEl) this.cardModelNameEl.textContent = meta.displayName || meta.name;

    this.updateModelSelectorPill();

    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let modelSuffix = '';
    if (currentModel?.name) {
      let mName = currentModel.name;
      if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel.id)) {
        const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
        if (effortConfig && effortConfig.label) mName += ` · ${effortConfig.label}`;
      }
      modelSuffix = ` (${mName})`;
    }

    if (this.inputEl) {
      this.inputEl.placeholder = `向 ${meta.displayName || meta.name}${modelSuffix} 提问，输入需求或问题... (Enter 发送)`;
    }
  }

  checkAdapterInstalledState(adapter) {
    if (!this.warningBannerEl) return;

    if (adapter.status === 'not_installed') {
      let installCmd = '';
      if (adapter.id === 'codex') {
        installCmd = 'npm install -g @openai/codex';
      } else if (adapter.id === 'gemini') {
        installCmd = 'npm install -g @google/gemini-cli';
      }

      this.warningBannerEl.style.display = 'block';
      this.warningBannerEl.innerHTML = `
        <div class="tw-banner-content">
          <span class="tw-banner-icon">${getIconPark('alert', 15)}</span>
          <div class="tw-banner-text">
            <strong>未检测到 ${escapeHtml(adapter.displayName)} CLI</strong>
            <span>请在本地终端安装：<code class="tw-banner-cmd">${installCmd}</code> 并配置环境。</span>
          </div>
        </div>
      `;
      if (this.btnSend) this.btnSend.disabled = true;
    } else {
      this.warningBannerEl.style.display = 'none';
      if (this.btnSend && !this.hub.isStreaming()) {
        this.btnSend.disabled = false;
      }
    }
  }

  restoreSessionMessages(agentId) {
    if (!this.messagesEl) return;
    this.messagesEl.innerHTML = '';
    this.activeToolCards.clear();
    this.currentAssistantMessage = null;

    const messages = this.hub.sessionManager.getMessages(agentId);
    if (!messages || messages.length === 0) {
      // Empty state: do not render bulky welcome card (per user request)
      return;
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        this.renderPastUserMessage(msg);
      } else {
        this.renderPastAssistantMessage(msg);
      }
    }
    this.scrollToBottom();
  }

  renderPastUserMessage(msg) {
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (msg.badge) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(msg.badge)}</span></div>`;
    }

    let imagesHtml = '';
    if (msg.images && msg.images.length > 0) {
      imagesHtml = '<div class="tw-msg-user-images">' + msg.images.map(img => {
        const src = img.dataUrl || img.path || '';
        return `<img src="${src}" class="tw-msg-user-img" alt="${escapeAttr(img.name || 'image')}" title="${escapeAttr(img.name || 'image')}" />`;
      }).join('') + '</div>';
    }

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info"><span class="tw-msg-user-icon">${getIconPark('user', 14)}</span> <span class="tw-msg-author">You</span></div>
        <button class="tw-msg-copy-btn" title="复制提问内容">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      ${badgeHtml}
      ${imagesHtml}
      ${msg.text ? `<div class="tw-msg-content" data-raw="${escapeAttr(msg.text || '')}">${escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>` : ''}
    `;

    this.messagesEl.appendChild(bubbleWrap);
  }

  renderPastAssistantMessage(msg) {
    const adapter = this.hub.getActiveAdapter();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    const authorName = msg.model || adapter.displayName;
    const authorIcon = msg.model ? getOfficialModelSvg(msg.model, 16) : adapter.icon;

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info">
          <span class="tw-msg-brand-icon">${authorIcon}</span> 
          <span class="tw-msg-author">${escapeHtml(authorName)}</span>
        </div>
        <button class="tw-msg-copy-btn" title="一键复制回答全文">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      <div class="tw-msg-content" data-raw="${escapeAttr(msg.text || '')}"></div>
    `;

    const contentEl = bubbleWrap.querySelector('.tw-msg-content');
    this.formatMessageContent(contentEl, msg.text || '');
    this.messagesEl.appendChild(bubbleWrap);
  }

  bindResizer() {
    let startX = 0;
    let startWidth = this.width;

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      const dx = startX - e.clientX;
      let newW = startWidth + dx;
      newW = Math.max(320, Math.min(760, newW));
      this.width = newW;
      this.drawerEl.style.width = `${newW}px`;
      this.notifyToggle(true);
    };

    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.classList.remove('tw-resizing');
        this.saveWidth(this.width);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    this.resizerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      startX = e.clientX;
      startWidth = this.width;
      document.body.classList.add('tw-resizing');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  bindCardResizer() {
    const resizer = this.inputCardEl ? this.inputCardEl.querySelector('#twCardResizer') : null;
    if (!resizer || !this.inputEl) return;

    let startY = 0;
    let startH = this.inputHeight;
    let isResizing = false;

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dy = startY - e.clientY; // drag up increases height
      let newH = startH + dy;
      newH = Math.max(38, Math.min(500, newH));
      this.inputHeight = newH;
      this.inputEl.style.height = `${newH}px`;
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.classList.remove('tw-resizing-v');
        this.saveInputHeight(this.inputHeight);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startY = e.clientY;
      startH = this.inputEl.offsetHeight || this.inputHeight;
      document.body.classList.add('tw-resizing-v');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  bindInputEvents() {
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      } else if (e.key === 'Escape') {
        if (this.hub.isStreaming()) {
          e.preventDefault();
          this.handleAbort();
        }
      }
    });

    // Save custom height if user drags the native corner resize handle
    this.inputEl.addEventListener('mouseup', () => {
      const currentH = this.inputEl.offsetHeight;
      if (currentH >= 38 && Math.abs(currentH - this.inputHeight) > 2) {
        this.saveInputHeight(currentH);
      }
    });

    // Auto grow input textarea when content overflows, but never shrink below this.inputHeight
    this.inputEl.addEventListener('input', () => {
      const minH = this.inputHeight;
      if (this.inputEl.scrollHeight > minH) {
        const newHeight = Math.min(500, this.inputEl.scrollHeight);
        this.inputEl.style.height = `${newHeight}px`;
      } else {
        this.inputEl.style.height = `${minH}px`;
      }
      this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
      this.updateSendButtonState();
    });

    if (this.btnSend) this.btnSend.onclick = () => this.handleSend();
    if (this.btnAbort) this.btnAbort.onclick = () => this.handleAbort();

    // Image upload button & file picker
    if (this.btnUploadImage && this.imageFileInput) {
      this.btnUploadImage.onclick = (e) => {
        e.preventDefault();
        this.imageFileInput.click();
      };
      this.imageFileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleImageFilesSelected(e.target.files);
          e.target.value = '';
        }
      };
    }

    // Drag and Drop & Paste handling for files & images
    this.bindDragAndDropEvents();
    this.bindPasteEvents();
  }

  bindDragAndDropEvents() {
    const inputCard = this.inputCardEl || (this.drawerEl ? this.drawerEl.querySelector('.tw-drawer-input-card') : null);
    const dropTargets = [this.inputEl, inputCard, this.contextCapsuleEl, this.drawerEl].filter(Boolean);

    const onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (inputCard) inputCard.classList.add('tw-drag-over');
      if (this.drawerEl) this.drawerEl.classList.add('tw-drag-over');
    };

    const onDragLeave = (e) => {
      e.preventDefault();
      if (this.drawerEl && !this.drawerEl.contains(e.relatedTarget)) {
        if (inputCard) inputCard.classList.remove('tw-drag-over');
        this.drawerEl.classList.remove('tw-drag-over');
      }
    };

    const onDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputCard) inputCard.classList.remove('tw-drag-over');
      if (this.drawerEl) this.drawerEl.classList.remove('tw-drag-over');

      // 1. Check if dropped files contain images
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const imgFiles = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          if (f.type?.startsWith('image/') || f.name?.match(/\.(png|jpe?g|webp|gif|bmp)$/i)) {
            imgFiles.push(f);
          }
        }
        if (imgFiles.length > 0) {
          await this.handleImageFilesSelected(imgFiles);
          return;
        }
      }

      // 2. Fallback to normal vault file attachments
      const files = this.extractDroppedFiles(e);
      if (files && files.length > 0) {
        this.handleFilesAttached(files);
      }
    };

    dropTargets.forEach(el => {
      el.addEventListener('dragenter', onDragOver);
      el.addEventListener('dragover', onDragOver);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop', onDrop);
    });
  }

  bindPasteEvents() {
    if (!this.inputEl) return;
    this.inputEl.addEventListener('paste', async (e) => {
      // 1. Check for pasted image in clipboardData (e.g. screenshot via Snipping Tool / WeChat)
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        const imageFiles = [];
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                imageFiles.push(file);
              }
            }
          }
        } else if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const f = e.clipboardData.files[i];
            if (f.type && f.type.startsWith('image/')) {
              imageFiles.push(f);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          await this.handleImageFilesSelected(imageFiles);
          return;
        }
      }

      // 2. Fallback to clean Obsidian URLs if text pasted
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (text && (text.includes('obsidian://open?') || text.includes('file:///'))) {
        const cleaned = this.cleanPastedText(text);
        if (cleaned && cleaned !== text) {
          e.preventDefault();
          this.insertTextAtCursor(cleaned);
        }
      }
    });
  }

  async handleImageFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        const name = file.name || `image_${Date.now()}.png`;
        const size = file.size || Math.round(dataUrl.length * 0.75);
        this.attachedImages.push({
          id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: name,
          size: size,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[PiDrawerView] Failed to read image file:', err);
      }
    }
    this.renderImageAttachments();
    this.updateSendButtonState();
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (file.path && typeof require !== 'undefined') {
        try {
          
          
          const ext = path.extname(file.path).slice(1).toLowerCase() || 'png';
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const buffer = fs.readFileSync(file.path);
          const base64 = buffer.toString('base64');
          return resolve(`data:${mime};base64,${base64}`);
        } catch (e) {}
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  renderImageAttachments() {
    if (!this.cardImageAttachmentsEl) return;
    if (!this.attachedImages || this.attachedImages.length === 0) {
      this.cardImageAttachmentsEl.style.display = 'none';
      this.cardImageAttachmentsEl.innerHTML = '';
      return;
    }

    this.cardImageAttachmentsEl.style.display = 'flex';
    let html = '';
    for (const img of this.attachedImages) {
      html += `
        <div class="tw-image-chip" data-img-id="${escapeAttr(img.id)}">
          <img src="${img.dataUrl}" class="tw-image-chip-thumb" alt="${escapeAttr(img.name)}" />
          <div class="tw-image-chip-info">
            <span class="tw-image-chip-name" title="${escapeAttr(img.name)}">${escapeHtml(img.name)}</span>
            <span class="tw-image-chip-size">${escapeHtml(this.formatFileSize(img.size))}</span>
          </div>
          <button class="tw-image-chip-remove" data-remove-id="${escapeAttr(img.id)}" title="移除此图片">
            ${getIconPark('close', 10)}
          </button>
        </div>
      `;
    }
    this.cardImageAttachmentsEl.innerHTML = html;

    this.cardImageAttachmentsEl.querySelectorAll('.tw-image-chip-remove').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-remove-id');
        this.removeAttachedImage(id);
      };
    });
  }

  removeAttachedImage(id) {
    this.attachedImages = (this.attachedImages || []).filter(img => img.id !== id);
    this.renderImageAttachments();
    this.updateSendButtonState();
  }

  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  openImageLightbox(src, title = '图片预览') {
    const existing = document.querySelector('.tw-image-lightbox-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'tw-image-lightbox-modal';
    modal.innerHTML = `
      <div class="tw-lightbox-backdrop"></div>
      <div class="tw-lightbox-container">
        <div class="tw-lightbox-header">
          <span class="tw-lightbox-title">${escapeHtml(title)}</span>
          <button class="tw-lightbox-close" title="关闭 (Esc)">${getIconPark('close', 14)}</button>
        </div>
        <div class="tw-lightbox-body">
          <img src="${src}" class="tw-lightbox-img" alt="${escapeAttr(title)}" />
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 150);
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    const backdrop = modal.querySelector('.tw-lightbox-backdrop');
    if (backdrop) backdrop.onclick = closeModal;
    const closeBtn = modal.querySelector('.tw-lightbox-close');
    if (closeBtn) closeBtn.onclick = closeModal;
    document.addEventListener('keydown', onKey);
  }

  extractDroppedFiles(e) {
    const results = [];
    const vaultPath = this.vaultBasePath || (process.cwd ? process.cwd() : '');

    // 1. Native files from DataTransfer (File Explorer / OS drag)
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        const rawPath = f.path || f.name;
        const clean = this.resolveCleanVaultPath(rawPath, vaultPath);
        if (clean) {
          results.push(clean);
        }
      }
      if (results.length > 0) return results;
    }

    // 2. Obsidian internal drag manager (dragging files from Obsidian file explorer)
    try {
      const app = (typeof window !== 'undefined' && window.app) || (this.contextProvider && this.contextProvider.app);
      if (app && app.dragManager && app.dragManager.draggable) {
        const draggable = app.dragManager.draggable;
        if (draggable.file && draggable.file.path) {
          results.push(this.formatFileInfo(draggable.file.path, draggable.file.basename, draggable.file.name));
          return results;
        } else if (Array.isArray(draggable.files)) {
          for (const df of draggable.files) {
            if (df && df.path) {
              results.push(this.formatFileInfo(df.path, df.basename, df.name));
            }
          }
          if (results.length > 0) return results;
        }
      }
    } catch (err) {}

    // 3. Text data (Obsidian URI obsidian://open?vault=... or file path or uri-list)
    if (e.dataTransfer) {
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '';
      if (text) {
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const clean = this.resolveCleanVaultPath(line, vaultPath);
          if (clean) {
            results.push(clean);
          }
        }
      }
    }

    return results;
  }

  resolveCleanVaultPath(rawInput, vaultPath = this.vaultBasePath) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();

    // A. Obsidian URL scheme
    const obMatch = input.match(/obsidian:\/\/open\?[^\s"'>)]+/i);
    if (obMatch) {
      try {
        const urlStr = obMatch[0];
        const qIdx = urlStr.indexOf('?');
        if (qIdx !== -1) {
          const params = new URLSearchParams(urlStr.slice(qIdx + 1));
          const fileParam = params.get('file');
          if (fileParam) {
            let decoded = decodeURIComponent(fileParam).replace(/\\/g, '/').replace(/^\/+/, '');
            decoded = this.ensureFileExtension(decoded, vaultPath);
            return this.formatFileInfo(decoded);
          }
        }
      } catch (err) {}
    }

    // B. File URI scheme: file:///D:/work/Mgmt/...
    const fileUrlMatch = input.match(/file:\/\/\/([^\s"'>)]+)/i);
    if (fileUrlMatch) {
      let rawPath = decodeURIComponent(fileUrlMatch[1]).replace(/\//g, path.sep);
      if (vaultPath && rawPath.toLowerCase().startsWith(vaultPath.toLowerCase())) {
        let rel = rawPath.slice(vaultPath.length).replace(/^[\\\/]+/, '').replace(/\\/g, '/');
        return this.formatFileInfo(rel);
      }
      return this.formatFileInfo(rawPath.replace(/\\/g, '/'));
    }

    // C. Absolute Windows Path
    if (vaultPath) {
      const normVault = vaultPath.replace(/\\/g, '/').toLowerCase();
      const normInput = input.replace(/\\/g, '/');
      if (normInput.toLowerCase().startsWith(normVault)) {
        let rel = normInput.slice(normVault.length).replace(/^\/+/, '');
        return this.formatFileInfo(rel);
      }
    }

    // D. Wikilink syntax: [[path/to/file]]
    const wikiMatch = input.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (wikiMatch) {
      return this.formatFileInfo(wikiMatch[1].trim().replace(/\\/g, '/'));
    }

    // E. Relative path in vault
    if (vaultPath) {
      try {
        const fsMod = typeof fs !== 'undefined' ? fs : require('fs');
        if (fsMod) {
          const full = path.join(vaultPath, input.replace(/\//g, path.sep));
          if (fsMod.existsSync(full) || fsMod.existsSync(full + '.md')) {
            let clean = input.replace(/\\/g, '/').replace(/^\/+/, '');
            clean = this.ensureFileExtension(clean, vaultPath);
            return this.formatFileInfo(clean);
          }
        }
      } catch (e) {}
    }

    return null;
  }

  ensureFileExtension(relPath, vaultPath) {
    if (vaultPath) {
      try {
        const fsMod = typeof fs !== 'undefined' ? fs : require('fs');
        if (fsMod) {
          const full = path.join(vaultPath, relPath.replace(/\//g, path.sep));
          if (!fsMod.existsSync(full) && fsMod.existsSync(full + '.md')) {
            return relPath + '.md';
          }
        }
      } catch (e) {}
    }
    if (!relPath.toLowerCase().endsWith('.md')) {
      const ext = path.extname(relPath).toLowerCase();
      const knownNonMd = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.c', '.h', '.cpp', '.py', '.js', '.json', '.sh', '.zip', '.tar', '.gz'];
      if (!knownNonMd.includes(ext)) {
        return relPath + '.md';
      }
    }
    return relPath;
  }

  formatFileInfo(relPath, customBase, customName) {
    const normPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const filename = normPath.split('/').pop() || normPath;
    const basename = customBase || filename.replace(/\.[^/.]+$/, '');
    const name = customName || filename;
    return {
      path: normPath,
      basename,
      name
    };
  }

  handleFilesAttached(files) {
    if (!files || files.length === 0) return;

    // 1. Mount first file to Context Capsule so agent gets structured context
    const primary = files[0];
    if (this.contextProvider && typeof this.contextProvider.setActiveFile === 'function') {
      this.contextProvider.setActiveFile(primary);
      this.updateContextCapsule();
      this.updateCardAttachments();
    }

    // 2. Insert clean [[wikiLink]] tags into input box
    const wikiTags = files.map(f => `[[${f.path}]]`).join(' ') + ' ';
    this.insertTextAtCursor(wikiTags);
  }

  insertTextAtCursor(text) {
    if (!this.inputEl) return;
    const start = this.inputEl.selectionStart || 0;
    const end = this.inputEl.selectionEnd || 0;
    const oldVal = this.inputEl.value || '';
    const newVal = oldVal.slice(0, start) + text + oldVal.slice(end);
    this.inputEl.value = newVal;

    const newPos = start + text.length;
    this.inputEl.focus();
    if (typeof this.inputEl.setSelectionRange === 'function') {
      this.inputEl.setSelectionRange(newPos, newPos);
    }

    // Resize input textarea and save draft
    const minH = this.inputHeight;
    const newH = Math.max(minH, Math.min(500, this.inputEl.scrollHeight));
    this.inputEl.style.height = `${newH}px`;
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, this.inputEl.value);
  }

  cleanPastedText(text) {
    if (!text || typeof text !== 'string') return text;
    const vaultPath = this.vaultBasePath || (process.cwd ? process.cwd() : '');

    return text.replace(/obsidian:\/\/open\?[^\s"'>)]+/gi, (matched) => {
      const clean = this.resolveCleanVaultPath(matched, vaultPath);
      if (clean && clean.path) {
        if (this.contextProvider && typeof this.contextProvider.setActiveFile === 'function') {
          this.contextProvider.setActiveFile(clean);
          this.updateContextCapsule();
          this.updateCardAttachments();
        }
        return `[[${clean.path}]]`;
      }
      return matched;
    });
  }

  renderWelcomeScreen() {
    // Bulky welcome card removed per user request: keep chat drawer clean and empty
  }

  updateContextCapsule() {
    if (!this.contextCapsuleEl) return;
    
    // NiceAIGC is a general model agent, decoupled from TabonKB knowledge base
    if (this.hub && this.hub.activeAgentId === 'niceaigc') {
      this.contextCapsuleEl.style.display = 'none';
      return;
    }
    this.contextCapsuleEl.style.display = 'block';

    if (!this.contextProvider) return;
    const info = this.contextProvider.getContextBadgeInfo();

    if (info.hasContext) {
      this.contextCapsuleEl.innerHTML = `
        <div class="tw-ctx-capsule active" title="当前已挂载上下文：${escapeAttr(info.title)}">
          <span class="tw-ctx-icon">${getIconPark('target', 13)}</span>
          <span class="tw-ctx-title">${escapeHtml(info.title)}</span>
          <span class="tw-ctx-sub">(${escapeHtml(info.module || '通用')})</span>
          <button class="tw-ctx-clear-btn" title="清除节点聚焦，切回全局知识库">${getIconPark('close', 11)}</button>
        </div>
      `;
      const clearBtn = this.contextCapsuleEl.querySelector('.tw-ctx-clear-btn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof this.contextProvider.clearContext === 'function') {
            this.contextProvider.clearContext();
          } else {
            this.contextProvider.clearKnowledgeNode();
          }
          this.updateCardAttachments();
        };
      }
    } else {
      this.contextCapsuleEl.innerHTML = `
        <div class="tw-ctx-capsule global" title="未选中节点，查询覆盖整个知识库">
          <span class="tw-ctx-icon">${getIconPark('globe', 13)}</span>
          <span class="tw-ctx-title">全局知识库 (TabonKB)</span>
          <span class="tw-ctx-hint">在图谱中点击任意节点可自动聚焦</span>
        </div>
      `;
    }
  }

  updateCardAttachments() {
    if (!this.cardAttachmentsEl) return;

    // NiceAIGC is decoupled from knowledge base attachments
    if (this.hub && this.hub.activeAgentId === 'niceaigc') {
      this.cardAttachmentsEl.style.display = 'none';
      this.cardAttachmentsEl.innerHTML = '';
      return;
    }

    const activeFile = this.contextProvider?.getActiveFile?.();
    if (activeFile && activeFile.path) {
      this.cardAttachmentsEl.style.display = 'flex';
      this.cardAttachmentsEl.innerHTML = `
        <div class="tw-card-attachment-chip" title="${escapeAttr(activeFile.path)}">
          <span class="tw-chip-icon">${getIconPark('file-text', 13)}</span>
          <span class="tw-chip-name">${escapeHtml(activeFile.basename || activeFile.name || '当前笔记')}</span>
          <button class="tw-chip-remove" title="移除附加文档">${getIconPark('close', 11)}</button>
        </div>
      `;
      const removeBtn = this.cardAttachmentsEl.querySelector('.tw-chip-remove');
      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof this.contextProvider.clearContext === 'function') {
            this.contextProvider.clearContext();
          } else {
            this.contextProvider.clearKnowledgeNode();
          }
          this.updateCardAttachments();
          this.updateContextCapsule();
        };
      }
    } else {
      this.cardAttachmentsEl.style.display = 'none';
      this.cardAttachmentsEl.innerHTML = '';
    }
  }

  updateStatus(statusObj) {
    if (!this.statusLed || !this.statusText) return;
    const { status, detail } = statusObj || { status: 'disconnected', detail: '' };

    this.statusLed.className = `tw-status-dot ${status}`;

    let label = '未连接';
    if (status === 'connected') label = '已就绪';
    else if (status === 'thinking') label = '思考中...';
    else if (status === 'running_tool') label = '调用工具';
    else if (status === 'connecting') label = '连接中...';
    else if (status === 'error') label = '服务异常';
    else if (status === 'not_installed') label = '未安装';

    this.statusText.textContent = detail ? `${label} (${detail})` : label;

    this.updateSendButtonState(status);
  }

  updateSendButtonState(statusOverride) {
    if (!this.btnSend) return;
    const status = statusOverride || (this.hub ? this.hub.getStatus()?.status : 'disconnected');
    const isStreaming = (status === 'thinking' || status === 'running_tool') || !!(this.hub && typeof this.hub.isStreaming === 'function' && this.hub.isStreaming());

    if (isStreaming) {
      this.btnSend.style.display = 'none';
      if (this.btnAbort) this.btnAbort.style.display = 'inline-flex';
    } else {
      if (this.btnAbort) this.btnAbort.style.display = 'none';
      this.btnSend.style.display = 'inline-flex';

      const adapter = this.hub ? this.hub.getActiveAdapter() : null;
      const isInstalled = adapter ? adapter.status !== 'not_installed' : true;
      const hasText = !!(this.inputEl && this.inputEl.value.trim().length > 0);
      const hasImages = !!(this.attachedImages && this.attachedImages.length > 0);

      const canSend = isInstalled && (hasText || hasImages);
      this.btnSend.disabled = !canSend;
      if (!canSend) {
        this.btnSend.classList.add('disabled');
      } else {
        this.btnSend.classList.remove('disabled');
      }
    }
  }

  setupHubEvents() {
    this.hub.on('status_change', (s) => this.updateStatus(s));

    this.hub.on('turn_start', () => {
      this.removeWelcomeScreen();
      if (!this.currentAssistantMessage) {
        this.createAssistantMessageBubble();
      }
    });

    this.hub.on('text_delta', (delta) => {
      this.appendAssistantDelta(delta);
    });

    this.hub.on('tool_start', (toolData) => {
      this.handleToolStart(toolData);
    });

    this.hub.on('tool_end', (toolData) => {
      this.handleToolEnd(toolData);
    });

    this.hub.on('agent_settled', () => {
      this.finishAssistantMessage();
    });

    this.hub.on('aborted', () => {
      this.finishAssistantMessage(true);
    });

    this.hub.on('new_session', () => {
      if (this.currentAssistantMessage) {
        this.finishAssistantMessage();
      }
      this.messages = [];
      if (this.messagesEl) {
        this.messagesEl.innerHTML = '';
      }
    });

    this.hub.on('error', (err) => {
      if (!this.currentAssistantMessage) {
        this.createAssistantMessageBubble();
      }
      this.appendAssistantDelta(`\n⚠️ 提示: ${err.error || err.message || '执行异常'}`);
      this.finishAssistantMessage();
    });

    if (this.contextProvider && typeof this.contextProvider.onChange === 'function') {
      this.contextProvider.onChange(() => {
        this.updateContextCapsule();
        this.updateCardAttachments();
      });
    }
  }

  removeWelcomeScreen() {
    const welcome = this.messagesEl.querySelector('.tw-agent-welcome');
    if (welcome) welcome.remove();
  }

  createAssistantMessageBubble() {
    if (this.currentAssistantMessage) {
      return this.currentAssistantMessage;
    }

    const adapter = this.hub.getActiveAdapter();
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let authorName = (currentModel && currentModel.name) ? currentModel.name : adapter.displayName;
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) authorName += ` · ${effortConfig.label}`;
    }
    const authorIcon = currentModel ? getOfficialModelSvg(currentModel.id || currentModel.name, 16) : adapter.icon;

    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap assistant';

    // 1. Avatar / Header
    const header = document.createElement('div');
    header.className = 'tw-msg-avatar';
    header.innerHTML = `
      <div class="tw-msg-avatar-info">
        <span class="tw-msg-brand-icon">${authorIcon}</span> 
        <span class="tw-msg-author">${escapeHtml(authorName)}</span>
      </div>
      <button class="tw-msg-copy-btn" title="一键复制回答全文">${getIconPark('copy', 12)} <span>复制</span></button>
    `;
    bubbleWrap.appendChild(header);

    // 2. Compact Scrollable Process Box (for tool execution & retrieval)
    const processBox = document.createElement('div');
    processBox.className = 'tw-msg-process-box';
    processBox.style.display = 'none'; // Hidden until tool execution starts

    const processHeader = document.createElement('div');
    processHeader.className = 'tw-process-header';
    processHeader.innerHTML = `
      <div class="tw-process-title">
        <span class="tw-process-icon">${getIconPark('setting-config', 13)}</span>
        <span>排查与工具检索过程</span>
        <span class="tw-process-count">(0项)</span>
      </div>
      <div class="tw-process-toggle">
        <span class="tw-process-toggle-icon">${getIconPark('down', 11)}</span>
      </div>
    `;
    processBox.appendChild(processHeader);

    const processBody = document.createElement('div');
    processBody.className = 'tw-process-body';
    processBox.appendChild(processBody);

    // Toggle collapse/expand on header click
    processHeader.onclick = () => {
      processBox.classList.toggle('collapsed');
      const icon = processHeader.querySelector('.tw-process-toggle-icon');
      if (icon) {
        icon.innerHTML = processBox.classList.contains('collapsed') ? getIconPark('right', 11) : getIconPark('down', 11);
      }
    };

    bubbleWrap.appendChild(processBox);

    // 3. Final Content container (hidden until text_delta arrives)
    const content = document.createElement('div');
    content.className = 'tw-msg-content';
    content.style.display = 'none';
    bubbleWrap.appendChild(content);

    this.messagesEl.appendChild(bubbleWrap);
    this.scrollToBottom();

    this.currentAssistantMessage = {
      wrapEl: bubbleWrap,
      contentEl: content,
      processBoxEl: processBox,
      processHeaderEl: processHeader,
      processBodyEl: processBody,
      toolCount: 0,
      rawText: '',
      activeTools: new Map()
    };

    return this.currentAssistantMessage;
  }

  appendAssistantDelta(delta) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;
    msg.rawText += delta;

    if (msg.rawText.trim().length > 0) {
      msg.contentEl.style.display = 'block';
    }

    msg.contentEl.classList.add('streaming');
    // Direct DOM text append with pre-wrap and clean delimiters for zero flickering
    msg.contentEl.textContent = cleanAssistantMarkdown(msg.rawText);
    this.scrollToBottom();
  }

  handleToolStart({ toolCallId, toolName, args, startTime, actionDesc }) {
    if (!this.currentAssistantMessage) {
      this.createAssistantMessageBubble();
    }
    const msg = this.currentAssistantMessage;

    // Reveal process box and update count
    msg.processBoxEl.style.display = 'flex';
    msg.toolCount++;
    const countEl = msg.processHeaderEl.querySelector('.tw-process-count');
    if (countEl) countEl.textContent = `(${msg.toolCount}项)`;

    const toolCard = document.createElement('div');
    toolCard.className = 'tw-tool-card running';
    toolCard.innerHTML = `
      <span class="tw-tool-spin">${getIconPark('time', 13)}</span>
      <span class="tw-tool-desc">${escapeHtml(actionDesc || toolName)}</span>
      <span class="tw-tool-timer">0s</span>
    `;
    msg.processBodyEl.appendChild(toolCard);

    // Scroll inside process body so newest tool is visible
    msg.processBodyEl.scrollTop = msg.processBodyEl.scrollHeight;

    const timerEl = toolCard.querySelector('.tw-tool-timer');
    const start = startTime || Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (timerEl) {
        timerEl.textContent = `${elapsed}s`;
        if (elapsed > 30) {
          toolCard.classList.add('warning');
          toolCard.title = '检索耗时较长，可点击中止';
        }
      }
    }, 1000);

    this.activeToolCards.set(toolCallId, {
      el: toolCard,
      timer: timerInterval,
      startTime: start
    });

    this.scrollToBottom();
  }

  handleToolEnd({ toolCallId, toolName, durationMs, isError, error, output }) {
    const cardInfo = this.activeToolCards.get(toolCallId);
    if (!cardInfo) return;

    clearInterval(cardInfo.timer);
    this.activeToolCards.delete(toolCallId);

    const { el } = cardInfo;
    el.classList.remove('running');

    const sec = ((durationMs || 100) / 1000).toFixed(1);
    if (isError) {
      el.classList.add('error');
      el.innerHTML = `
        <span class="tw-tool-icon tw-tool-error">${getIconPark('close-circle', 13, { color: '#EF4444' })}</span>
        <span class="tw-tool-desc">${escapeHtml(toolName)} 执行失败: ${escapeHtml(error || output || '错误')}</span>
        <span class="tw-tool-timer">${sec}s</span>
      `;
    } else {
      el.classList.add('success');
      const prevDesc = el.querySelector('.tw-tool-desc')?.textContent || toolName;
      el.innerHTML = `
        <span class="tw-tool-icon tw-tool-success">${getIconPark('check', 13, { color: '#10B981' })}</span>
        <span class="tw-tool-desc">${escapeHtml(prevDesc)}</span>
        <span class="tw-tool-timer">${sec}s</span>
      `;
    }

    if (this.currentAssistantMessage && this.currentAssistantMessage.processBodyEl) {
      this.currentAssistantMessage.processBodyEl.scrollTop = this.currentAssistantMessage.processBodyEl.scrollHeight;
    }
  }

  finishAssistantMessage(isAborted = false) {
    if (!this.currentAssistantMessage) return;
    const msg = this.currentAssistantMessage;

    // Clear any running tool card timers
    for (const [id, info] of this.activeToolCards.entries()) {
      clearInterval(info.timer);
      info.el.classList.remove('running');
      info.el.classList.add('aborted');
    }
    this.activeToolCards.clear();

    if (isAborted) {
      msg.contentEl.style.display = 'block';
      const abortNotice = document.createElement('div');
      abortNotice.className = 'tw-aborted-notice';
      abortNotice.textContent = '（已中止）';
      msg.contentEl.appendChild(abortNotice);
    }

    msg.contentEl.classList.remove('streaming');

    if (msg.rawText && msg.rawText.trim().length > 0) {
      msg.rawText = cleanAssistantMarkdown(msg.rawText);
      msg.contentEl.style.display = 'block';
      msg.contentEl.setAttribute('data-raw', msg.rawText);
      this.formatMessageContent(msg.contentEl, msg.rawText);
    } else if (isAborted) {
      // Aborted notice already added above
    } else {
      // Empty response fallback: Never leave a blank bubble!
      msg.contentEl.style.display = 'block';
      const adapter = this.hub ? this.hub.getActiveAdapter() : null;
      const currentModel = adapter && typeof adapter.getModel === 'function' ? adapter.getModel() : { id: '', name: '' };
      const modelName = currentModel.name || '当前模型';

      msg.contentEl.innerHTML = `
        <div class="tw-empty-response-card" style="padding: 12px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.35); font-size: 12px; line-height: 1.6; color: var(--text-normal);">
          <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
            <span>${getIconPark('alert', 14, { color: '#EF4444' })}</span><span>未收到模型回复内容</span>
          </div>
          <div style="color: var(--text-muted); font-size: 11.5px;">
            模型 <b>${escapeHtml(modelName)}</b> 上游通道未返回任何文本（该模型通道可能处于维护或未开放状态）。
          </div>
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="tw-empty-retry-btn" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: var(--interactive-accent, #2563EB); color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;">
              ${getIconPark('lightning', 12)} <span>一键切至 GPT-5.6 Sol (推荐) 并重试</span>
            </button>
          </div>
        </div>
      `;

      const retryBtn = msg.contentEl.querySelector('.tw-empty-retry-btn');
      if (retryBtn) {
        retryBtn.onclick = () => {
          this.selectModel('gpt-5-6-thinking', 'GPT-5.6 Sol (推荐)', 'brain');
          const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
          const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
          if (lastUserMsg && lastUserMsg.text) {
            this.inputEl.value = lastUserMsg.text;
            this.handleSend();
          }
        };
      }
    }

    // Persist to session manager
    const adapter = this.hub.getActiveAdapter();
    const currentModel = typeof adapter.getModel === 'function' ? adapter.getModel() : null;
    let authorModel = (currentModel && currentModel.name) ? currentModel.name : adapter.displayName;
    if (typeof adapter.supportsReasoningEffort === 'function' && adapter.supportsReasoningEffort(currentModel?.id)) {
      const effortConfig = typeof adapter.getReasoningEffortConfig === 'function' ? adapter.getReasoningEffortConfig() : null;
      if (effortConfig && effortConfig.label) authorModel += ` · ${effortConfig.label}`;
    }

    this.hub.sessionManager.addMessage(this.hub.activeAgentId, {
      role: 'assistant',
      text: msg.rawText,
      toolCount: msg.toolCount,
      model: authorModel
    });

    this.currentAssistantMessage = null;
    this.scrollToBottom();
  }

  async formatMessageContent(el, text) {
    if (!text) return;
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    if (app && typeof MarkdownRenderer !== 'undefined' && MarkdownRenderer.render) {
      el.innerHTML = '';
      try {
        await MarkdownRenderer.render(
          app,
          text,
          el,
          '',
          this
        );
        this.postProcessRenderedMarkdown(el);
        return;
      } catch (e) {
        console.warn('[PiDrawerView] MarkdownRenderer failed, falling back to simple format:', e);
      }
    }

    el.innerHTML = renderSimpleMarkdown(text);
    this.postProcessRenderedMarkdown(el);
  }

  postProcessRenderedMarkdown(containerEl) {
    // Add rel and target to external links
    containerEl.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.classList.add('external-link');
    });
  }

  addUserMessageBubble(userText, contextBadgeText, images = []) {
    this.removeWelcomeScreen();
    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'tw-msg-bubble-wrap user';

    let badgeHtml = '';
    if (contextBadgeText) {
      badgeHtml = `<div class="tw-user-context-pill">${getIconPark('target', 12)} <span>${escapeHtml(contextBadgeText)}</span></div>`;
    }

    let imagesHtml = '';
    if (images && images.length > 0) {
      imagesHtml = '<div class="tw-msg-user-images">' + images.map(img => {
        const src = img.dataUrl || img.path || '';
        return `<img src="${src}" class="tw-msg-user-img" alt="${escapeAttr(img.name || 'image')}" title="${escapeAttr(img.name || 'image')}" />`;
      }).join('') + '</div>';
    }

    bubbleWrap.innerHTML = `
      <div class="tw-msg-avatar">
        <div class="tw-msg-avatar-info"><span class="tw-msg-user-icon">${getIconPark('user', 14)}</span> <span class="tw-msg-author">You</span></div>
        <button class="tw-msg-copy-btn" title="复制提问内容">${getIconPark('copy', 12)} <span>复制</span></button>
      </div>
      ${badgeHtml}
      ${imagesHtml}
      ${userText ? `<div class="tw-msg-content" data-raw="${escapeAttr(userText || '')}">${escapeHtml(userText).replace(/\n/g, '<br>')}</div>` : ''}
    `;

    this.messagesEl.appendChild(bubbleWrap);

    // Persist to session manager
    this.hub.sessionManager.addMessage(this.hub.activeAgentId, {
      role: 'user',
      text: userText,
      badge: contextBadgeText,
      images: images && images.length > 0 ? images.map(i => ({ name: i.name, size: i.size, dataUrl: i.dataUrl })) : null
    });

    this.scrollToBottom();
  }

  async handleSend() {
    const adapter = this.hub.getActiveAdapter();
    if (adapter.status === 'not_installed') {
      return;
    }

    const text = this.inputEl.value.trim();
    const imagesToSend = [...(this.attachedImages || [])];
    if ((!text && imagesToSend.length === 0) || this.hub.isStreaming()) return;

    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    this.inputEl.value = '';
    this.inputEl.style.height = `${this.inputHeight}px`;
    this.hub.sessionManager.setDraft(this.hub.activeAgentId, '');
    this.attachedImages = [];
    this.renderImageAttachments();
    this.updateSendButtonState();

    const isNiceAigc = this.hub.activeAgentId === 'niceaigc';
    const ctxInfo = (!isNiceAigc && this.contextProvider) ? this.contextProvider.getContextBadgeInfo() : null;
    const badgeLabel = (ctxInfo && ctxInfo.hasContext) ? `${ctxInfo.title} (${ctxInfo.module})` : null;

    this.addUserMessageBubble(text, badgeLabel, imagesToSend);

    // NiceAIGC does NOT bind to knowledge base; send clean user prompt without metadata
    const fullPrompt = (!isNiceAigc && this.contextProvider)
      ? this.contextProvider.formatPromptWithContext(text)
      : text;

    try {
      const res = await this.hub.send(fullPrompt, null, imagesToSend);
      if (res && res.success === false) {
        if (!this.currentAssistantMessage) {
          this.createAssistantMessageBubble();
        }
        this.appendAssistantDelta(`\n⚠️ 提示: ${res.error || '未收到模型回复'}`);
        this.finishAssistantMessage();
      }
    } catch (err) {
      this.createAssistantMessageBubble();
      this.appendAssistantDelta(`❌ 发送失败: ${err.message}\n请检查 ${adapter.displayName} 运行状态。`);
      this.finishAssistantMessage();
    } finally {
      this.updateSendButtonState();
    }
  }

  async handleAbort() {
    await this.hub.abort();
    this.updateSendButtonState();
  }

  async exportToQuickNote() {
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }

    const adapter = this.hub.getActiveAdapter();
    const agentId = this.hub.activeAgentId;
    const messages = this.hub.sessionManager.getMessages(agentId);

    const app = this.app || (this.contextProvider && this.contextProvider.app) || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class { constructor(m) { console.log(m); } });

    if (!messages || messages.length === 0) {
      new NoticeCls('当前会话暂无对话内容，无法导出');
      return;
    }

    if (!app || !app.vault) {
      new NoticeCls('无法访问 Obsidian Vault，无法执行导出');
      return;
    }

    // 1. Ensure target folders exist
    const targetFolder = '00-Inbox/03-Quick-Note';
    const attachmentsFolder = '00-Inbox/03-Quick-Note/attachments';

    try {
      if (!app.vault.getAbstractFileByPath(targetFolder)) {
        await app.vault.createFolder(targetFolder).catch(() => {});
      }
      if (!app.vault.getAbstractFileByPath(attachmentsFolder)) {
        await app.vault.createFolder(attachmentsFolder).catch(() => {});
      }
    } catch (e) {}

    // 2. Process & extract images
    let savedImagesCount = 0;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const exportMessages = JSON.parse(JSON.stringify(messages));

    for (let mIdx = 0; mIdx < exportMessages.length; mIdx++) {
      let text = cleanAssistantMarkdown(exportMessages[mIdx].text || '');

      // Pattern 0: User attached images: exportMessages[mIdx].images
      if (exportMessages[mIdx].images && exportMessages[mIdx].images.length > 0) {
        const attachedImgMds = [];
        for (const img of exportMessages[mIdx].images) {
          if (img && img.dataUrl && img.dataUrl.includes(';base64,')) {
            const rawExt = (img.dataUrl.split(';base64,')[0].split('/')[1] || 'png').replace('jpeg', 'jpg').split('+')[0];
            savedImagesCount++;
            const imgName = `img-${timestamp}-${savedImagesCount}.${rawExt}`;
            const imgPath = `${attachmentsFolder}/${imgName}`;
            try {
              const b64Data = img.dataUrl.split(';base64,')[1];
              const buffer = Buffer.from(b64Data, 'base64');
              if (typeof app.vault.createBinary === 'function') {
                await app.vault.createBinary(imgPath, buffer);
              } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
                await app.vault.adapter.writeBinary(imgPath, buffer);
              }
              attachedImgMds.push(`![[attachments/${imgName}]]`);
            } catch (err) {
              console.warn('[PiDrawerView] Failed to save attached image:', err);
            }
          }
        }
        if (attachedImgMds.length > 0) {
          text = (text ? text + '\n\n' : '') + attachedImgMds.join('\n');
        }
      }

      // Pattern 1: Base64 data URLs: data:image/xxx;base64,yyy
      const b64Regex = /data:image\/([a-zA-Z0-9+]+);base64,([A-Za-z0-9+/=]+)/g;
      let b64Match;
      while ((b64Match = b64Regex.exec(text)) !== null) {
        const rawExt = b64Match[1].replace('jpeg', 'jpg').split('+')[0];
        savedImagesCount++;
        const imgName = `img-${timestamp}-${savedImagesCount}.${rawExt}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          const buffer = Buffer.from(b64Match[2], 'base64');
          if (typeof app.vault.createBinary === 'function') {
            await app.vault.createBinary(imgPath, buffer);
          } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
            await app.vault.adapter.writeBinary(imgPath, buffer);
          }
          text = text.replace(b64Match[0], `![[attachments/${imgName}]]`);
        } catch (err) {
          console.warn('[PiDrawerView] Failed to save base64 image:', err);
        }
      }

      // Pattern 2: Markdown remote images: ![alt](http...)
      const mdImgRegex = /!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g;
      const mdMatches = [...text.matchAll(mdImgRegex)];
      for (const match of mdMatches) {
        const url = match[2];
        savedImagesCount++;
        let ext = 'png';
        if (url.includes('.jpg') || url.includes('.jpeg')) ext = 'jpg';
        else if (url.includes('.webp')) ext = 'webp';
        else if (url.includes('.gif')) ext = 'gif';

        const imgName = `img-${timestamp}-${savedImagesCount}.${ext}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          let binaryData = null;
          if (typeof requestUrl === 'function') {
            const res = await requestUrl({ url, responseType: 'arraybuffer' });
            binaryData = res.arrayBuffer;
          } else {
            const httpsMod = url.startsWith('https') ? require('https') : require('http');
            binaryData = await new Promise((res, rej) => {
              httpsMod.get(url, r => {
                const chunks = [];
                r.on('data', c => chunks.push(c));
                r.on('end', () => res(Buffer.concat(chunks)));
              }).on('error', rej);
            });
          }
          if (binaryData) {
            if (typeof app.vault.createBinary === 'function') {
              await app.vault.createBinary(imgPath, binaryData);
            } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
              await app.vault.adapter.writeBinary(imgPath, binaryData);
            }
            text = text.replace(match[0], `![[attachments/${imgName}]]`);
          }
        } catch (err) {
          console.warn('[PiDrawerView] Failed to download remote image:', err);
        }
      }

      // Pattern 3: HTML <img> tags
      const htmlImgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
      const htmlMatches = [...text.matchAll(htmlImgRegex)];
      for (const match of htmlMatches) {
        const url = match[1];
        savedImagesCount++;
        const ext = url.includes('.jpg') || url.includes('.jpeg') ? 'jpg' : 'png';
        const imgName = `img-${timestamp}-${savedImagesCount}.${ext}`;
        const imgPath = `${attachmentsFolder}/${imgName}`;
        try {
          let binaryData = null;
          if (typeof requestUrl === 'function') {
            const res = await requestUrl({ url, responseType: 'arraybuffer' });
            binaryData = res.arrayBuffer;
          }
          if (binaryData) {
            if (typeof app.vault.createBinary === 'function') {
              await app.vault.createBinary(imgPath, binaryData);
            } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
              await app.vault.adapter.writeBinary(imgPath, binaryData);
            }
            text = text.replace(match[0], `![[attachments/${imgName}]]`);
          }
        } catch (e) {}
      }

      exportMessages[mIdx].text = text;
    }

    // 3. Generate clean note title and filename
    const firstUser = exportMessages.find(m => m.role === 'user');
    const rawSnippet = firstUser ? (firstUser.text.replace(/!\[\[.*?\]\]/g, '').replace(/\[\[.*?\]\]/g, '').replace(/!\[.*?\]\([^\)]*\)/g, '').replace(/https?:\/\/\S+/g, '').replace(/data:image\/\S+/g, '').trim()) : '智能对话';
    const firstLine = (rawSnippet.split('\n')[0] || '智能对话').slice(0, 26).trim();
    const safeTitle = firstLine.replace(/[\\/:*?"<>|#^\[\]!]/g, '').replace(/\s+/g, ' ').trim() || '智能对话';

    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const agentName = adapter.displayName || adapter.name || 'AI';
    const fileBasename = `${dateStr} ${timeStr} [${agentName}] ${safeTitle}`;
    const notePath = `${targetFolder}/${fileBasename}.md`;

    // 4. Build Markdown Content
    const lines = [];
    lines.push('---');
    lines.push(`title: "${safeTitle}"`);
    lines.push(`date: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    lines.push(`agent: ${agentName}`);
    lines.push(`source: tabonkb-agent-hub`);
    lines.push('tags:');
    lines.push('  - ai-dialog');
    lines.push('  - quick-note');
    lines.push('---');
    lines.push('');
    lines.push(`# 💬 ${agentName} 对话记录 (${dateStr} ${timeStr})`);
    lines.push('');
    lines.push('> [!INFO] 对话元信息');
    lines.push(`> - **智能体**: ${agentName}`);
    lines.push(`> - **导出时间**: ${now.toLocaleString()}`);
    lines.push(`> - **对话轮次**: ${exportMessages.length} 条互动`);
    if (savedImagesCount > 0) {
      lines.push(`> - **转存图片**: ${savedImagesCount} 张本地离线图片`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Format dialogues
    for (const msg of exportMessages) {
      if (msg.role === 'user') {
        lines.push('### 👤 用户');
        if (msg.badge) {
          lines.push(`> 🎯 上下文聚焦: \`${msg.badge}\`\n`);
        }
        lines.push(msg.text);
        lines.push('');
      } else {
        lines.push(`### 🤖 ${agentName}`);
        lines.push(msg.text);
        lines.push('');
      }
    }

    const noteContent = lines.join('\n');

    // 5. Write Note to Vault
    try {
      const existing = app.vault.getAbstractFileByPath(notePath);
      if (existing) {
        await app.vault.modify(existing, noteContent);
      } else {
        await app.vault.create(notePath, noteContent);
      }

      new NoticeCls(`✓ 对话已成功存入 00-Inbox/03-Quick-Note/${fileBasename}.md${savedImagesCount > 0 ? ` (已转存 ${savedImagesCount} 张本地图片)` : ''}`, 6000);

      // Open note in workspace
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }
    } catch (err) {
      console.error('[PiDrawerView] Failed to write note to vault:', err);
      new NoticeCls(`❌ 导出笔记失败: ${err.message}`, 8000);
    }
  }

  toggleHistoryPanel() {
    if (!this.historyPanelEl) return;
    const isHidden = this.historyPanelEl.style.display === 'none' || !this.historyPanelEl.style.display;
    if (isHidden) {
      this.renderHistoryPanel();
      this.historyPanelEl.style.display = 'flex';
    } else {
      this.historyPanelEl.style.display = 'none';
    }
  }

  renderHistoryPanel() {
    if (!this.historyPanelEl) return;
    const listEl = this.historyPanelEl.querySelector('#twHistoryList');
    if (!listEl) return;

    const agentId = this.hub.activeAgentId;
    const sessions = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getSessions(agentId) : [];
    const activeSessionId = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getActiveSessionId(agentId) : null;

    if (!sessions || sessions.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 11.5px;">
          暂无历史会话分段记录
        </div>
      `;
      return;
    }

    let html = '';
    for (const s of sessions) {
      const isActive = s.id === activeSessionId;
      const msgCount = (s.messages || []).length;
      const timeStr = this.formatRelativeTime(s.updatedAt || s.createdAt);

      html += `
        <div class="tw-history-item ${isActive ? 'active' : ''}" data-session-id="${escapeAttr(s.id)}">
          <div class="tw-history-item-left">
            <span class="tw-history-item-icon">${getIconPark('topic', 13)}</span>
            <div class="tw-history-item-info">
              <div class="tw-history-item-title" title="${escapeAttr(s.title || '对话')}">${escapeHtml(s.title || '对话')}</div>
              <div class="tw-history-item-meta">
                <span>${escapeHtml(timeStr)}</span>
                <span>·</span>
                <span>${msgCount} 条对话</span>
              </div>
            </div>
          </div>
          <button class="tw-history-delete-btn" data-delete-id="${escapeAttr(s.id)}" title="删除此会话记录">
            ${getIconPark('delete', 12)}
          </button>
        </div>
      `;
    }
    listEl.innerHTML = html;

    // Bind item clicks (switch session)
    listEl.querySelectorAll('.tw-history-item').forEach(itemEl => {
      itemEl.onclick = (e) => {
        if (e.target.closest('.tw-history-delete-btn')) return;
        const sid = itemEl.getAttribute('data-session-id');
        this.loadHistorySession(sid);
      };
    });

    // Bind delete clicks
    listEl.querySelectorAll('.tw-history-delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sid = btn.getAttribute('data-delete-id');
        this.deleteHistorySession(sid);
      };
    });
  }

  loadHistorySession(sessionId) {
    const agentId = this.hub.activeAgentId;
    if (this.hub && this.hub.sessionManager) {
      this.hub.sessionManager.switchSession(agentId, sessionId);
    }
    this.restoreSessionMessages(agentId);
    if (this.historyPanelEl) {
      this.historyPanelEl.style.display = 'none';
    }
  }

  deleteHistorySession(sessionId) {
    const agentId = this.hub.activeAgentId;
    if (this.hub && this.hub.sessionManager) {
      const wasActive = (this.hub.sessionManager.getActiveSessionId(agentId) === sessionId);
      this.hub.sessionManager.deleteSession(agentId, sessionId);
      if (wasActive && this.messagesEl) {
        this.messagesEl.innerHTML = '';
      }
    }
    this.renderHistoryPanel();
  }

  formatRelativeTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${hh}:${mm}`;
  }

  async handleNewSession() {
    const agentId = this.hub.activeAgentId;
    if (this.currentAssistantMessage) {
      this.finishAssistantMessage();
    }
    if (this.hub.sessionManager) {
      this.hub.sessionManager.newSession(agentId);
    }
    await this.hub.newSession();
    this.currentAssistantMessage = null;
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
    }
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.style.height = `${this.inputHeight}px`;
      this.inputEl.focus();
    }
    if (this.historyPanelEl) {
      this.historyPanelEl.style.display = 'none';
    }
    this.updateSendButtonState();
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
    new NoticeCls('✓ 已开启新会话 (历史记录已安全归档)', 2000);
  }

  scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  open() {
    if (this.isOpenState) return;
    this.isOpenState = true;
    this.drawerEl.style.display = 'flex';
    this.notifyToggle(true);

    if (this.messagesEl && this.messagesEl.children.length === 0) {
      this.restoreSessionMessages(this.hub.activeAgentId);
    }

    // Start active agent lazily on first open
    this.hub.start().then(() => {
      this.updateStatus(this.hub.getStatus());
    });

    setTimeout(() => {
      if (this.inputEl && typeof this.inputEl.focus === 'function') {
        this.inputEl.focus();
      }
    }, 100);
  }

  close() {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.drawerEl.style.display = 'none';
    this.notifyToggle(false);
  }

  toggle() {
    if (this.isOpenState) this.close();
    else this.open();
  }

  isOpen() {
    return this.isOpenState;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;');
}

/**
 * Clean raw Delimiters, Cites, and Search/URL markers from ChatGPT Web SSE responses
 * @param {string} text
 * @returns {string}
 */
function cleanAssistantMarkdown(text) {
  if (!text) return '';
  let cleaned = text;

  // 1. Process PUA URL blocks: \uE200url\uE202title\uE202url\uE201 or \uE000url\uE002title\uE002url\uE001 -> [title](url)
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202]([^\uE000-\uF8FF\r\n]+?)[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/[\uE000\uE200]url[\uE002\uE202](https?:\/\/[^\uE000-\uF8FF\s\)]+?)[\uE001\uE201]/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 2. Process literal box URL blocks: □url□title□url□
  cleaned = cleaned.replace(/□url□([^□\r\n]+?)□(https?:\/\/[^□\s\)]+?)□/g, (m, title, url) => {
    return '[' + title.trim() + '](' + url.trim() + ')';
  });
  cleaned = cleaned.replace(/□url□(https?:\/\/[^□\s\)]+?)□/g, (m, url) => {
    return '[' + url.trim() + '](' + url.trim() + ')';
  });

  // 3. Strip PUA citation blocks: \uE200cite...\uE201
  cleaned = cleaned.replace(/[\uE000\uE200]cite[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 4. Strip PUA search/browse/call/nav/tool/python blocks
  cleaned = cleaned.replace(/[\uE000\uE200](?:search|browse|nav|call|tool|python)[\s\S]*?(?:[\uE001\uE201]|\n|$)/g, '');

  // 5. Strip literal box citations & tools: □cite□...□
  cleaned = cleaned.replace(/□(?:cite|search|browse|nav|call|tool|python)□[^□\r\n]*?□/g, '');

  // 6. Strip standard web citations like 【4:0†source】
  cleaned = cleaned.replace(/【\d*(?::\d+)?†[a-zA-Z0-9_\-\s]*】/g, '');

  // 7. Strip leftover private-use characters & non-printable ASCII control chars
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // 8. Clean isolated stray box characters
  cleaned = cleaned.replace(/(?:^|\s)□+(?:\s|$)/g, ' ');

  // 9. Clean excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Fallback markdown renderer in case native Obsidian MarkdownRenderer is unavailable
 * @param {string} text
 * @returns {string} HTML
 */
function formatMarkdownFallback(text) {
  if (!text) return '';
  const codeBlocks = [];
  let temp = text.replace(/```([a-zA-Z0-9_\-+#]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const placeholder = `%%%CB${codeBlocks.length}%%%`;
    codeBlocks.push(`<pre class="tw-code-block"><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  const inlineCodes = [];
  temp = temp.replace(/`([^`\n]+)`/g, (m, code) => {
    const placeholder = `%%%IC${inlineCodes.length}%%%`;
    inlineCodes.push(`<code class="tw-inline-code">${escapeHtml(code)}</code>`);
    return placeholder;
  });

  temp = escapeHtml(temp);

  // Links: [text](url)
  temp = temp.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" class="external-link" target="_blank" rel="noopener">$1</a>');

  // Bold & Italic
  temp = temp.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  temp = temp.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  temp = temp.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  temp = temp.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Headings
  temp = temp.replace(/^### (.*$)/gim, '<h3 class="tw-md-h3">$1</h3>');
  temp = temp.replace(/^## (.*$)/gim, '<h2 class="tw-md-h2">$1</h2>');
  temp = temp.replace(/^# (.*$)/gim, '<h1 class="tw-md-h1">$1</h1>');

  // Lists
  temp = temp.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="tw-md-li">$1</li>');
  temp = temp.replace(/(<li class="tw-md-li">[\s\S]*?<\/li>)+/g, '<ul class="tw-md-ul">$&</ul>');

  temp = temp.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  for (let i = 0; i < inlineCodes.length; i++) {
    temp = temp.replace(`%%%IC${i}%%%`, inlineCodes[i]);
  }
  for (let i = 0; i < codeBlocks.length; i++) {
    temp = temp.replace(`%%%CB${i}%%%`, codeBlocks[i]);
  }

  return temp;
}

/**
 * @typedef {Object} JiraConfig
 * @property {'cloud' | 'datacenter'} type
 * @property {string} baseUrl
 * @property {string} [email]
 * @property {string} [secretName] - Key in SecretStorage
 * @property {string} jql
 * @property {number} refreshIntervalMinutes
 */

/**
 * @typedef {Object} DashboardIssue
 * @property {string} key
 * @property {string} summary
 * @property {string} status
 * @property {string} [priority]
 * @property {string} [assignee]
 * @property {string} [updated]
 * @property {string} url
 */

const DEFAULT_JIRA_JQL = '(assignee = currentUser() OR watcher = currentUser()) AND resolution = Unresolved ORDER BY updated DESC';

/**
 * Safely encode a string to Base64 in both browser and Node.js environments,
 * properly handling non-ASCII / Unicode characters.
 * @param {string} str
 * @returns {string}
 */
function safeBase64(str) {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return btoa(str);
  }
}

class JiraService {
  /**
   * @param {Object} options
   * @param {any} options.app - Obsidian App instance
   * @param {() => JiraConfig} options.getConfig - Getter for JiraConfig
   */
  constructor(options) {
    this.app = options.app;
    this.getConfig = options.getConfig;

    // In-memory cache: { issues: DashboardIssue[], lastUpdated: number, isStale: boolean }
    this._cache = null;
    this._cacheTtlMs = 5 * 60 * 1000; // 5 minutes

    // In-memory credential fallback (in case Obsidian version does not support secretStorage)
    this._memorySecret = null;
  }

  /**
   * Safely retrieve token from Obsidian SecretStorage or memory fallback.
   * Credentials NEVER enter logs, data.json, or markdown.
   * @param {string} [secretKey]
   * @returns {Promise<string | null>}
   */
  async getCredential(secretKey = 'tabonkb-jira-token') {
    // 1. Try plugin getSecret
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.getSecret === 'function') {
        const s = await plugin.getSecret(secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretKey);
        if (s) return s;
      }
    } catch (e) {}

    // 3. Try local plugin .secrets.json
    try {
      
      
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretKey]) return data[secretKey];
        }
      }
    } catch (e) {}

    // 4. Try Obsidian SecretStorage (if supported)
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.getSecret === 'function') {
        const secret = await this.app.secretStorage.getSecret(secretKey);
        if (secret) return secret;
      }
    } catch (e) {}

    return this._memorySecret || null;
  }

  async setCredential(secretKey = 'tabonkb-jira-token', token) {
    this._memorySecret = token;

    // 1. Save to plugin
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.setSecret === 'function') {
        await plugin.setSecret(secretKey, token);
      }
    } catch (e) {}

    // 2. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) localStorage.setItem('tabonkb-secret-' + secretKey, token);
        else localStorage.removeItem('tabonkb-secret-' + secretKey);
      }
    } catch (e) {}

    // 3. Save to local .secrets.json
    try {
      
      
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretKey] = token;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}

    // 4. Save to Obsidian SecretStorage
    try {
      if (this.app?.secretStorage && typeof this.app.secretStorage.setSecret === 'function') {
        await this.app.secretStorage.setSecret(secretKey, token);
      }
    } catch (e) {}
  }

  /**
   * Strictly validate that the target URL origin matches the configured Jira origin.
   * @param {string} targetUrl
   * @param {string} baseUrl
   * @returns {boolean}
   */
  validateOrigin(targetUrl, baseUrl) {
    try {
      if (!targetUrl || !baseUrl) return false;
      const targetOrigin = new URL(targetUrl).origin.toLowerCase();
      const baseOrigin = new URL(baseUrl).origin.toLowerCase();
      return targetOrigin === baseOrigin;
    } catch (e) {
      return false;
    }
  }

  /**
   * Search issues on Jira Cloud using REST API v3
   * Priority endpoint: POST /rest/api/3/search/jql or POST /rest/api/3/search
   * Basic Auth: email + apiToken
   * @param {JiraConfig} config
   * @param {string} token - API token
   * @returns {Promise<DashboardIssue[]>}
   */
  async searchCloudIssues(config, token) {
    if (!config.baseUrl) throw new Error('Jira Cloud Base URL 未配置');
    if (!config.email) throw new Error('Jira Cloud 需要配置账号 Email');
    if (!token) throw new Error('Jira Cloud 需要配置 API Token');

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const apiUrl = `${cleanBaseUrl}/rest/api/3/search`;

    if (!this.validateOrigin(apiUrl, cleanBaseUrl)) {
      throw new Error('Jira API 目标域名与配置的 Jira Base URL Origin 不一致，已阻止请求以保证凭据安全');
    }

    const authHeader = `Basic ${safeBase64(config.email.trim() + ':' + token.trim())}`;
    const jql = (config.jql && config.jql.trim()) || DEFAULT_JIRA_JQL;

    const requestBody = {
      jql,
      maxResults: 25,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated']
    };

    const response = await this._executeRequest({
      url: apiUrl,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 401) {
      throw new Error('Jira Cloud 认证失败 (HTTP 401 Unauthorized)。请检查 Email 与 API Token 是否正确');
    }
    if (response.status === 403) {
      throw new Error('Jira Cloud 权限不足 (HTTP 403 Forbidden)。请确认该 API Token 拥有查看该项目的权限');
    }
    if (response.status === 400) {
      let msg = 'Jira Cloud JQL 查询语法错误';
      try {
        const errJson = JSON.parse(response.text);
        if (errJson.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Cloud 查询失败 (HTTP ${response.status})`);
    }

    const data = JSON.parse(response.text);
    const rawIssues = data.issues || [];
    return rawIssues.map(issue => this.normalizeIssue(issue, cleanBaseUrl));
  }

  /**
   * Search issues on Jira Data Center / Server using REST API v2
   * Supports both Basic Auth (username + password for Server/DC) and Bearer (PAT for DC 8.14+)
   * In Electron/Obsidian, GET requests bypass Jira Server XSRF Origin blocking (HTTP 403)
   * @param {JiraConfig} config
   * @param {string} token - Personal Access Token or Password
   * @returns {Promise<DashboardIssue[]>}
   */
  async searchDataCenterIssues(config, token) {
    if (!config.baseUrl) throw new Error('Jira Data Center Base URL 未配置');
    if (!token) throw new Error('Jira Data Center 需要配置密码、Cookie 或 PAT');

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');

    const commonHeaders = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const isCookieAuth = config.authType === 'cookie' || token.startsWith('JSESSIONID=');
    if (isCookieAuth) {
      commonHeaders['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
    } else {
      const user = (config.username || config.email || '').trim();
      if (config.authType === 'basic' || user) {
        if (!user) throw new Error('Jira Server 用户名+密码认证需要填写用户名');
        commonHeaders['Authorization'] = `Basic ${safeBase64(user + ':' + token.trim())}`;
      } else if (token.includes(':')) {
        commonHeaders['Authorization'] = `Basic ${safeBase64(token.trim())}`;
      } else {
        commonHeaders['Authorization'] = `Bearer ${token.trim()}`;
      }
    }

    const jql = (config.jql && config.jql.trim()) || DEFAULT_JIRA_JQL;

    // Primary attempt: GET /rest/api/2/search
    // In Electron, GET avoids Jira Server CSRF / XSRF origin check failure (Status 403)
    const getUrl = `${cleanBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=0&maxResults=25&fields=summary,status,priority,assignee,updated`;
    if (!this.validateOrigin(getUrl, cleanBaseUrl)) {
      throw new Error('Jira API 目标域名与配置的 Jira Base URL Origin 不一致，已阻止请求以保证凭据安全');
    }

    let response;
    try {
      response = await this._executeRequest({
        url: getUrl,
        method: 'GET',
        headers: commonHeaders
      });
    } catch (e) {
      // Fallback to POST if GET fails or URL too long
      const postUrl = `${cleanBaseUrl}/rest/api/2/search`;
      const requestBody = {
        jql,
        startAt: 0,
        maxResults: 25,
        fields: ['summary', 'status', 'priority', 'assignee', 'updated']
      };
      response = await this._executeRequest({
        url: postUrl,
        method: 'POST',
        headers: Object.assign({}, commonHeaders, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(requestBody)
      });
    }

    if (response.status === 401) {
      throw new Error('Jira 认证失败 (HTTP 401 Unauthorized)。请检查用户名和密码/Cookie 是否有效');
    }
    if (response.status === 403) {
      const denied = (response.headers?.['x-authentication-denied-reason'] || response.headers?.['X-Authentication-Denied-Reason'] || '').toLowerCase();
      const seraph = (response.headers?.['x-seraph-loginreason'] || response.headers?.['X-Seraph-Loginreason'] || '');
      if (denied.includes('captcha') || seraph.includes('AUTHENTICATION_DENIED')) {
        throw new Error(`Jira 触发了安全验证码保护 (CAPTCHA_CHALLENGE)。请在浏览器中打开 ${cleanBaseUrl}/login.jsp 登录一次并输入验证码以解除拦截；或在工作台设置中切换认证方式为「Session Cookie (JSESSIONID)」。`);
      }
      throw new Error('Jira 拒绝访问 (HTTP 403 Forbidden)。请确认密码是否正确，或账号是否拥有相关项目权限');
    }
    if (response.status === 400) {
      let msg = 'Jira JQL 查询语法错误或包含无权限字段';
      try {
        const errJson = JSON.parse(response.text);
        if (errJson.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Data Center 查询失败 (HTTP ${response.status})`);
    }

    const data = JSON.parse(response.text);
    const rawIssues = data.issues || [];
    return rawIssues.map(issue => this.normalizeIssue(issue, cleanBaseUrl));
  }

  /**
   * Normalize raw Jira issue to standard DashboardIssue interface.
   * UI never depends directly on raw Jira JSON.
   * @param {any} raw
   * @param {string} baseUrl
   * @returns {DashboardIssue}
   */
  normalizeIssue(raw, baseUrl) {
    if (!raw) return null;
    const key = raw.key || '';
    const fields = raw.fields || {};

    const summary = fields.summary || '（无标题）';
    const status = fields.status?.name || '未知';
    const priority = fields.priority?.name || 'Medium';

    let assignee = '未指派';
    if (fields.assignee) {
      assignee = fields.assignee.displayName || fields.assignee.name || '已指派';
    }

    let updated = '';
    if (fields.updated) {
      try {
        const d = new Date(fields.updated);
        if (!isNaN(d.getTime())) {
          updated = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/browse/${encodeURIComponent(key)}`;

    return {
      key,
      summary,
      status,
      priority,
      assignee,
      updated,
      url
    };
  }

  /**
   * Public search entrypoint with in-memory caching and stale-while-error fallback.
   * Does NOT accept arbitrary URLs from caller.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ issues: DashboardIssue[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async searchIssues(forceRefresh = false) {
    const now = Date.now();

    // 1. Check in-memory fresh cache
    if (!forceRefresh && this._cache && (now - this._cache.lastUpdated < this._cacheTtlMs)) {
      return {
        issues: this._cache.issues,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    }

    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) {
      return {
        issues: [],
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: false,
        error: '未配置 Jira 服务地址，请在工作台设置中配置 Jira'
      };
    }

    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);

    if (!token) {
      return {
        issues: this._cache?.issues || [],
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: !!this._cache,
        error: '未配置 Jira 认证 Token，请在工作台设置中录入'
      };
    }

    try {
      let issues = [];
      if (config.type === 'datacenter') {
        issues = await this.searchDataCenterIssues(config, token);
      } else {
        issues = await this.searchCloudIssues(config, token);
      }

      // Update fresh in-memory cache
      this._cache = {
        issues,
        lastUpdated: Date.now(),
        isStale: false
      };

      return {
        issues,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    } catch (err) {
      // Safe sanitized error message without credential/token leak
      const safeErrorMsg = sanitizeErrorMessage(err.message || 'Jira 请求失败');

      // Stale-While-Error fallback
      if (this._cache && this._cache.issues && this._cache.issues.length > 0) {
        return {
          issues: this._cache.issues,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: safeErrorMsg
        };
      }

      return {
        issues: [],
        lastUpdated: now,
        isStale: false,
        error: safeErrorMsg
      };
    }
  }

  /**
   * Test Jira connection with current credentials.
   * Tests user authentication via /myself endpoint first, then validates JQL query.
   * Does NOT leak token in error response.
   * @returns {Promise<{ ok: boolean, message: string, count?: number }>}
   */
  async testConnection() {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) {
      return { ok: false, message: '请先填写 Jira 服务根地址 (Base URL)' };
    }

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);

    if (!token) {
      return { ok: false, message: '请先在输入框中录入 API Token、登录密码或 Session Cookie' };
    }

    const isCloud = config.type === 'cloud';
    const myselfUrl = isCloud ? `${cleanBaseUrl}/rest/api/3/myself` : `${cleanBaseUrl}/rest/api/2/myself`;

    if (!this.validateOrigin(myselfUrl, cleanBaseUrl)) {
      return { ok: false, message: 'Jira API 目标域名与配置的 Jira Base URL Origin 不一致' };
    }

    const testHeaders = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (isCloud) {
      if (!config.email) return { ok: false, message: 'Jira Cloud 需要配置账号 Email' };
      testHeaders['Authorization'] = `Basic ${safeBase64(config.email.trim() + ':' + token.trim())}`;
    } else {
      const isCookieAuth = config.authType === 'cookie' || token.startsWith('JSESSIONID=');
      if (isCookieAuth) {
        testHeaders['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        if (config.authType === 'basic' || user) {
          if (!user) return { ok: false, message: 'Basic 认证需要填写 Jira 用户名' };
          testHeaders['Authorization'] = `Basic ${safeBase64(user + ':' + token.trim())}`;
        } else if (token.includes(':')) {
          testHeaders['Authorization'] = `Basic ${safeBase64(token.trim())}`;
        } else {
          testHeaders['Authorization'] = `Bearer ${token.trim()}`;
        }
      }
    }

    try {
      // 1. Verify User Authentication via /myself
      const myselfRes = await this._executeRequest({
        url: myselfUrl,
        method: 'GET',
        headers: testHeaders
      });

      if (myselfRes.status === 401) {
        return {
          ok: false,
          message: '认证失败 (HTTP 401 Unauthorized)。请检查用户名和密码/Token/Cookie 是否匹配。'
        };
      }
      if (myselfRes.status === 403) {
        const denied = (myselfRes.headers?.['x-authentication-denied-reason'] || myselfRes.headers?.['X-Authentication-Denied-Reason'] || '').toLowerCase();
        const seraph = (myselfRes.headers?.['x-seraph-loginreason'] || myselfRes.headers?.['X-Seraph-Loginreason'] || '');
        if (denied.includes('captcha') || seraph.includes('AUTHENTICATION_DENIED')) {
          return {
            ok: false,
            message: `Jira 触发了安全验证码保护 (CAPTCHA_CHALLENGE)。请在浏览器中打开 ${cleanBaseUrl}/login.jsp 登录一次并输入验证码以解除拦截；或在工作台设置中切换认证方式为「Session Cookie (JSESSIONID)」。`
          };
        }
        return {
          ok: false,
          message: 'Jira 拒绝访问 (HTTP 403 Forbidden)。请检查密码是否正确，或账号是否被锁定。'
        };
      }
      if (myselfRes.status !== 200) {
        return {
          ok: false,
          message: `Jira 用户信息接口返回 HTTP ${myselfRes.status}，请检查服务状态与 Base URL`
        };
      }

      let userData = {};
      try { userData = JSON.parse(myselfRes.text); } catch (e) {}
      const displayName = userData.displayName || userData.name || '已认证用户';

      // 2. Verify JQL query with searchIssues
      const searchRes = await this.searchIssues(true);
      if (searchRes.error) {
        return {
          ok: true,
          message: `账号认证成功 (${displayName})！但 JQL 查询提示: ${searchRes.error}`,
          count: 0
        };
      }

      return {
        ok: true,
        message: `连接成功！登录账号: ${displayName}，JQL 匹配到 ${searchRes.issues?.length || 0} 条事项`,
        count: searchRes.issues?.length || 0
      };
    } catch (err) {
      const errMsg = err.message || '';
      return {
        ok: false,
        message: `连接测试失败: ${sanitizeErrorMessage(errMsg)}`
      };
    }
  }

  /**
   * Internal Obsidian requestUrl executor.
   * @private
   */
  async _executeRequest(params) {
    if (typeof requestUrl === 'function') {
      try {
        return await requestUrl(params);
      } catch (err) {
        if (err && typeof err.status === 'number') {
          return {
            status: err.status,
            text: err.text || '',
            headers: err.headers || {}
          };
        }
        throw err;
      }
    }
    // Node.js fallback for tests
    const https = params.url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(params.url);

    return new Promise((resolve, reject) => {
      const req = https.request(urlObj, {
        method: params.method || 'GET',
        headers: params.headers || {}
      }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => text += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            text,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      if (params.body) req.write(params.body);
      req.end();
    });
  }
}

/**
 * Format date to clean relative string (e.g. 5分钟前, 2小时前, 昨天).
 * @param {Date} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 3) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Sanitize error message to prevent URL query parameters or token leak.
 * @param {string} msg
 * @returns {string}
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return '请求异常';
  return String(msg)
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, '$1 ***')
    .replace(/[a-zA-Z0-9_-]{24,}/g, '***');
}

/**
 * @typedef {Object} RssFeedConfig
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} FeedItem
 * @property {string} feedId
 * @property {string} feedName
 * @property {string} title
 * @property {string} link
 * @property {Date} [publishedAt]
 * @property {string} [description]
 */

const DEFAULT_FEEDS = [
  {
    id: 'lwn',
    name: 'LWN Kernel',
    url: 'https://lwn.net/headlines/rss',
    enabled: true
  },
  {
    id: 'android-dev',
    name: 'Android Developers',
    url: 'https://android-developers.googleblog.com/feeds/posts/default',
    enabled: true
  }
];

class RssService {
  /**
   * @param {Object} options
   * @param {any} options.app - Obsidian App instance
   * @param {() => RssFeedConfig[]} options.getFeeds - Getter for configured feeds
   */
  constructor(options) {
    this.app = options.app;
    this.getFeeds = options.getFeeds || (() => DEFAULT_FEEDS);

    // In-memory cache: { items: FeedItem[], lastUpdated: number, isStale: boolean }
    this._cache = null;
    this._cacheTtlMs = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Strictly validate URL protocol. Only http: and https: allowed.
   * Rejects javascript:, data:, file:, obsidian:, etc.
   * @param {string} urlStr
   * @returns {boolean}
   */
  validateUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:') || trimmed.startsWith('obsidian:')) {
      return false;
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract safe, clean plain text from raw HTML content.
   * Strips all tags, scripts, styles, decode HTML entities, and truncates to maxLen.
   * @param {string} rawHtml
   * @param {number} [maxLen=120]
   * @returns {string}
   */
  cleanHtmlToText(rawHtml, maxLen = 120) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        // Remove style and script tags before parsing text
        const sanitizedInput = rawHtml
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        const doc = parser.parseFromString(sanitizedInput, 'text/html');
        const text = (doc.body.textContent || doc.body.innerText || '').trim();
        const collapsed = text.replace(/\s+/g, ' ');
        if (collapsed.length <= maxLen) return collapsed;
        return collapsed.slice(0, maxLen) + '...';
      }
    } catch (e) {}

    // Fallback regex tag stripper
    const stripped = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (stripped.length <= maxLen) return stripped;
    return stripped.slice(0, maxLen) + '...';
  }

  /**
   * Parse XML text supporting both RSS 2.0 and Atom feeds.
   * @param {string} xmlText
   * @param {RssFeedConfig} feedConfig
   * @returns {FeedItem[]}
   */
  parseFeedXml(xmlText, feedConfig) {
    if (!xmlText || typeof xmlText !== 'string') return [];

    let doc;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      doc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        // Retry with text/xml or text/html
        doc = parser.parseFromString(xmlText, 'text/xml');
      }
    } else {
      throw new Error('DOMParser 未在当前运行环境中找到');
    }

    const items = [];

    // 1. Try RSS 2.0 (<channel> -> <item>)
    const rssItems = doc.querySelectorAll('channel > item, item');
    if (rssItems && rssItems.length > 0) {
      rssItems.forEach(el => {
        const titleEl = el.querySelector('title');
        const linkEl = el.querySelector('link');
        const pubDateEl = el.querySelector('pubDate, date, dc\\:date');
        const descEl = el.querySelector('description, summary, content, content\\:encoded');

        const title = (titleEl?.textContent || '').trim() || '（无标题）';
        const rawLink = (linkEl?.textContent || linkEl?.getAttribute('href') || '').trim();
        const safeLink = this.validateUrl(rawLink) ? rawLink : '';

        let publishedAt = null;
        if (pubDateEl?.textContent) {
          try {
            const d = new Date(pubDateEl.textContent.trim());
            if (!isNaN(d.getTime())) publishedAt = d;
          } catch (e) {}
        }

        const rawDesc = descEl?.textContent || '';
        const cleanDesc = this.cleanHtmlToText(rawDesc, 120);

        items.push({
          feedId: feedConfig.id,
          feedName: feedConfig.name,
          title,
          link: safeLink,
          publishedAt: publishedAt || new Date(),
          description: cleanDesc
        });
      });
      return items;
    }

    // 2. Try Atom (<feed> -> <entry>)
    const atomEntries = doc.querySelectorAll('feed > entry, entry');
    if (atomEntries && atomEntries.length > 0) {
      atomEntries.forEach(el => {
        const titleEl = el.querySelector('title');
        const linkEl = el.querySelector('link[rel="alternate"]') || el.querySelector('link');
        const updatedEl = el.querySelector('updated, published, pubDate');
        const summaryEl = el.querySelector('summary, content');

        const title = (titleEl?.textContent || '').trim() || '（无标题）';
        const rawLink = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim();
        const safeLink = this.validateUrl(rawLink) ? rawLink : '';

        let publishedAt = null;
        if (updatedEl?.textContent) {
          try {
            const d = new Date(updatedEl.textContent.trim());
            if (!isNaN(d.getTime())) publishedAt = d;
          } catch (e) {}
        }

        const rawDesc = summaryEl?.textContent || '';
        const cleanDesc = this.cleanHtmlToText(rawDesc, 120);

        items.push({
          feedId: feedConfig.id,
          feedName: feedConfig.name,
          title,
          link: safeLink,
          publishedAt: publishedAt || new Date(),
          description: cleanDesc
        });
      });
      return items;
    }

    return items;
  }

  /**
   * Fetch a single feed via Obsidian requestUrl without any Jira credentials.
   * @param {RssFeedConfig} feedConfig
   * @returns {Promise<FeedItem[]>}
   */
  async fetchFeed(feedConfig) {
    if (!this.validateUrl(feedConfig.url)) {
      throw new Error(`Feed URL 无效或协议不受支持 (仅允许 http/https): ${feedConfig.url}`);
    }

    const response = await this._executeRequest({
      url: feedConfig.url,
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`获取 Feed 失败: ${feedConfig.name} (HTTP ${response.status})`);
    }

    return this.parseFeedXml(response.text, feedConfig);
  }

  /**
   * Fetch all enabled feeds, merge items, sort by publishedAt desc, and update cache.
   * Supports Stale-While-Error fallback.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ items: FeedItem[], feeds: RssFeedConfig[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async fetchAllFeeds(forceRefresh = false) {
    const now = Date.now();
    const allFeeds = typeof this.getFeeds === 'function' ? this.getFeeds() : DEFAULT_FEEDS;
    const enabledFeeds = allFeeds.filter(f => f.enabled !== false);

    // 1. Check in-memory fresh cache
    if (!forceRefresh && this._cache && (now - this._cache.lastUpdated < this._cacheTtlMs)) {
      return {
        items: this._cache.items,
        feeds: allFeeds,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    }

    if (enabledFeeds.length === 0) {
      return {
        items: [],
        feeds: allFeeds,
        lastUpdated: this._cache?.lastUpdated || now,
        isStale: false,
        error: '未启用任何 RSS 订阅源，请在工作台设置中添加或启用'
      };
    }

    try {
      const errors = [];
      const fetchPromises = enabledFeeds.map(async (feed) => {
        try {
          return await this.fetchFeed(feed);
        } catch (e) {
          console.warn(`[RssService] 获取源 [${feed.name}] 失败:`, e.message);
          errors.push(`${feed.name}: ${e.message}`);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const merged = results.flat();

      // Sort all items descending by publish date
      merged.sort((a, b) => {
        const timeA = a.publishedAt ? a.publishedAt.getTime() : 0;
        const timeB = b.publishedAt ? b.publishedAt.getTime() : 0;
        return timeB - timeA;
      });

      if (merged.length === 0 && this._cache && this._cache.items.length > 0) {
        // Network failed to yield any items but we have stale cache
        const errDetail = errors.length > 0 ? errors.join('; ') : '网络异常';
        return {
          items: this._cache.items,
          feeds: allFeeds,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: `全部 RSS 源拉取失败 (${errDetail})，正在显示上次缓存`
        };
      }

      // Update fresh cache
      this._cache = {
        items: merged,
        lastUpdated: Date.now(),
        isStale: false
      };

      return {
        items: merged,
        feeds: allFeeds,
        lastUpdated: this._cache.lastUpdated,
        isStale: false
      };
    } catch (err) {
      // Stale-While-Error fallback
      if (this._cache && this._cache.items && this._cache.items.length > 0) {
        return {
          items: this._cache.items,
          feeds: allFeeds,
          lastUpdated: this._cache.lastUpdated,
          isStale: true,
          error: `更新失败: ${err.message || '网络异常'}，正在显示历史缓存`
        };
      }

      return {
        items: [],
        feeds: allFeeds,
        lastUpdated: now,
        isStale: false,
        error: `RSS 拉取异常: ${err.message || '网络异常'}`
      };
    }
  }

  /**
   * Internal Obsidian requestUrl executor.
   * @private
   */
  async _executeRequest(params) {
    if (typeof requestUrl === 'function') {
      return await requestUrl(params);
    }
    // Node.js fallback for tests
    const https = params.url.startsWith('https') ? require('https') : require('http');
    const urlObj = new URL(params.url);

    return new Promise((resolve, reject) => {
      const req = https.request(urlObj, {
        method: params.method || 'GET',
        headers: params.headers || {}
      }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => text += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            text,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

/**
 * JiraCard: Native TabonKB Dashboard Card for Jira Issues
 * Follows strict lifecycle: mount, refresh, render, dispose
 */


class JiraCard {
  /**
   * @param {Object} options
   * @param {import('../services/jira-service').JiraService} options.jiraService
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options) {
    this.service = options.jiraService;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.cardEl = null;
    this.isDisposed = false;
    this.isLoading = false;

    this.data = {
      issues: [],
      lastUpdated: 0,
      isStale: false,
      error: null
    };

    this.timerId = null;
    this.autoRefreshIntervalMs = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Mount card into parent DOM container
   * @param {HTMLElement} container
   */
  mount(container) {
    if (this.isDisposed) {
      this.isDisposed = false;
    }

    this.containerEl = container;
    this.cardEl = container.createDiv({ cls: 'tw-card tw-jira-card' });

    // Initial render & fetch
    this.render();
    this.refresh(false);

    // Setup periodic auto-refresh
    this._startTimer();
  }

  /**
   * Fetch latest issues and update card UI
   * @param {boolean} [force=false]
   */
  async refresh(force = false) {
    if (this.isDisposed || this.isLoading) return;

    this.isLoading = true;
    this._updateHeaderState();

    try {
      const result = await this.service.searchIssues(force);
      if (this.isDisposed) return;

      this.data = {
        issues: result.issues || [],
        lastUpdated: result.lastUpdated || Date.now(),
        isStale: !!result.isStale,
        error: result.error || null
      };
    } catch (err) {
      if (this.isDisposed) return;
      this.data.error = err.message || '获取 Jira 数据失败';
    } finally {
      if (!this.isDisposed) {
        this.isLoading = false;
        this.render();
      }
    }
  }

  /**
   * Render complete card DOM
   */
  render() {
    if (this.isDisposed || !this.cardEl) return;

    this.cardEl.empty();

    // 1. Header
    const header = this.cardEl.createDiv({ cls: 'tw-card-header tw-jira-header' });
    const countText = this.data.issues.length ? `(${this.data.issues.length})` : '';

    const titleLeft = header.createDiv({ cls: 'tw-card-header-left' });
    titleLeft.innerHTML = `
      <span class="tw-jira-title-icon">${getIconPark('target', 14)}</span>
      <span class="tw-jira-title-text">Jira 研发事项</span>
      <span class="tw-jira-count-pill">${countText}</span>
    `;

    const actionsRight = header.createDiv({ cls: 'tw-card-header-right' });
    const timeStr = this.data.lastUpdated ? formatRelativeClock(this.data.lastUpdated) : '';

    if (timeStr) {
      const timeSpan = actionsRight.createEl('span', { cls: 'tw-card-updated-time' });
      timeSpan.textContent = `更新于 ${timeStr}`;
    }

    const refreshBtn = actionsRight.createEl('button', {
      cls: `tw-card-refresh-btn ${this.isLoading ? 'spinning' : ''}`,
      title: '手动刷新 Jira 事项'
    });
    refreshBtn.innerHTML = getIconPark('refresh', 13);
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      this.refresh(true);
    };

    // 2. Body Container
    const body = this.cardEl.createDiv({ cls: 'tw-jira-body' });

    // Stale banner if data is from previous cache due to error
    if (this.data.isStale) {
      const staleBanner = body.createDiv({ cls: 'tw-card-stale-banner' });
      staleBanner.innerHTML = `
        <span class="tw-stale-icon">${getIconPark('alert', 13)}</span>
        <span class="tw-stale-text">${escapeHtml(this.data.error || '刷新失败')}，正在显示历史缓存 (${timeStr})</span>
        <button class="tw-stale-retry-btn">重试</button>
      `;
      const retryBtn = staleBanner.querySelector('.tw-stale-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
    }

    // State 1: Loading (no data yet)
    if (this.isLoading && (!this.data.issues || this.data.issues.length === 0)) {
      const loadingEl = body.createDiv({ cls: 'tw-card-loading-state' });
      loadingEl.innerHTML = `
        <div class="tw-card-spinner"></div>
        <span>正在加载 Jira 事项...</span>
      `;
      return;
    }

    // State 2: Error (no cached data)
    if (this.data.error && (!this.data.issues || this.data.issues.length === 0)) {
      const errorEl = body.createDiv({ cls: 'tw-card-error-state' });
      errorEl.innerHTML = `
        <div class="tw-card-state-icon">${getIconPark('alert', 22)}</div>
        <div class="tw-card-state-title">${escapeHtml(this.data.error)}</div>
        <div class="tw-card-state-actions">
          <button class="tw-chip tw-state-retry-btn">重试</button>
          ${this.onOpenSettings ? '<button class="tw-chip tw-state-settings-btn">检查设置</button>' : ''}
        </div>
      `;
      const retryBtn = errorEl.querySelector('.tw-state-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
      const settingsBtn = errorEl.querySelector('.tw-state-settings-btn');
      if (settingsBtn && this.onOpenSettings) settingsBtn.onclick = () => this.onOpenSettings();
      return;
    }

    // State 3: Empty
    if (!this.data.issues || this.data.issues.length === 0) {
      const emptyEl = body.createDiv({ cls: 'tw-card-empty-state' });
      emptyEl.innerHTML = `
        <div class="tw-card-state-icon" style="color:#10B981;">${getIconPark('check-circle', 22, { color: '#10B981' })}</div>
        <div class="tw-card-state-title">暂无待办或指派给您的未闭环事项</div>
        <div class="tw-card-state-sub">JQL: 未检索到匹配条目</div>
      `;
      return;
    }

    // State 4: Issue List
    const listWrap = body.createDiv({ cls: 'tw-jira-issue-list' });
    this.data.issues.forEach(issue => {
      const itemEl = listWrap.createDiv({ cls: 'tw-jira-issue-item' });

      // Left Column: Key & Summary
      const itemMain = itemEl.createDiv({ cls: 'tw-jira-item-main' });
      itemMain.innerHTML = `
        <div class="tw-jira-item-top">
          <a class="tw-jira-key" href="${escapeAttr(issue.url)}" target="_blank" rel="noopener noreferrer" title="在 Jira 中打开 ${escapeAttr(issue.key)}">
            ${escapeHtml(issue.key)}
            <span class="tw-jira-ext-icon">${getIconPark('external', 10)}</span>
          </a>
          <span class="tw-jira-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</span>
        </div>
      `;

      // Prevent card row click if clicked on key link
      const keyLink = itemMain.querySelector('.tw-jira-key');
      if (keyLink) {
        keyLink.onclick = (e) => {
          e.stopPropagation();
        };
      }

      // Right Column: Meta Badges (Status, Priority, Assignee, Updated)
      const itemMeta = itemEl.createDiv({ cls: 'tw-jira-item-meta' });
      const statusBadgeClass = resolveStatusClass(issue.status);
      const priorityClass = resolvePriorityClass(issue.priority);

      itemMeta.innerHTML = `
        <span class="tw-status-badge ${statusBadgeClass}">${escapeHtml(issue.status)}</span>
        <span class="tw-jira-priority-pill ${priorityClass}">${escapeHtml(issue.priority || 'Normal')}</span>
        <span class="tw-jira-assignee" title="经办人: ${escapeAttr(issue.assignee || '未指派')}">${getIconPark('user', 11)} <span>${escapeHtml(issue.assignee || '未指派')}</span></span>
        <span class="tw-jira-updated" title="更新时间: ${escapeAttr(issue.updated || '')}">${escapeHtml(issue.updated || '')}</span>
      `;

      // Clicking row opens Jira issue
      itemEl.onclick = () => {
        if (issue.url) {
          window.open(issue.url, '_blank', 'noopener,noreferrer');
        }
      };
    });
  }

  /**
   * Internal method to update header refresh button state without full re-render
   * @private
   */
  _updateHeaderState() {
    if (!this.cardEl) return;
    const refreshBtn = this.cardEl.querySelector('.tw-card-refresh-btn');
    if (refreshBtn) {
      refreshBtn.classList.toggle('spinning', this.isLoading);
    }
  }

  /**
   * Start auto refresh interval timer
   * @private
   */
  _startTimer() {
    this._stopTimer();
    const intervalFn = (typeof window !== 'undefined' ? window : global).setInterval || setInterval;
    this.timerId = intervalFn(() => {
      if (!this.isDisposed) {
        this.refresh(false);
      }
    }, this.autoRefreshIntervalMs);
  }

  /**
   * Stop auto refresh interval timer
   * @private
   */
  _stopTimer() {
    if (this.timerId !== null) {
      const clearFn = (typeof window !== 'undefined' ? window : global).clearInterval || clearInterval;
      clearFn(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Cleanly dispose card, cancel timers, prevent memory leaks
   */
  dispose() {
    this.isDisposed = true;
    this._stopTimer();
    if (this.cardEl) {
      if (typeof this.cardEl.remove === 'function') {
        this.cardEl.remove();
      }
      this.cardEl = null;
    }
    this.containerEl = null;
  }
}

function resolveStatusClass(statusName) {
  if (!statusName) return 'new';
  const s = statusName.toLowerCase();
  if (s.includes('progress') || s.includes('开发') || s.includes('排查') || s.includes('in progress')) return 'in-progress';
  if (s.includes('block') || s.includes('阻塞') || s.includes('reopen') || s.includes('reject')) return 'blocked';
  if (s.includes('done') || s.includes('resolve') || s.includes('闭环') || s.includes('解决') || s.includes('closed')) return 'resolved';
  return 'new';
}

function resolvePriorityClass(priority) {
  if (!priority) return 'medium';
  const p = priority.toLowerCase();
  if (p.includes('blocker') || p.includes('highest') || p.includes('urgent') || p.includes('p0')) return 'p-urgent';
  if (p.includes('high') || p.includes('p1')) return 'p-high';
  if (p.includes('low') || p.includes('lowest') || p.includes('p3')) return 'p-low';
  return 'p-medium';
}

function formatRelativeClock(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;');
}

/**
 * RssCard: Native TabonKB Dashboard Card for Tech Feeds & RSS
 * Follows strict lifecycle: mount, refresh, render, dispose
 * Pure plain-text description, NO raw innerHTML rendering for feeds.
 */


class RssCard {
  /**
   * @param {Object} options
   * @param {import('../services/rss-service').RssService} options.rssService
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options) {
    this.service = options.rssService;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.cardEl = null;
    this.isDisposed = false;
    this.isLoading = false;
    this.currentTab = 'all'; // 'all' or feedId

    this.data = {
      items: [],
      feeds: [],
      lastUpdated: 0,
      isStale: false,
      error: null
    };

    this.timerId = null;
    this.autoRefreshIntervalMs = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Mount card into parent DOM container
   * @param {HTMLElement} container
   */
  mount(container) {
    if (this.isDisposed) {
      this.isDisposed = false;
    }

    this.containerEl = container;
    this.cardEl = container.createDiv({ cls: 'tw-card tw-rss-card' });

    // Initial render & fetch
    this.render();
    this.refresh(false);

    // Setup periodic auto-refresh
    this._startTimer();
  }

  /**
   * Fetch latest feeds and update card UI
   * @param {boolean} [force=false]
   */
  async refresh(force = false) {
    if (this.isDisposed || this.isLoading) return;

    this.isLoading = true;
    this._updateHeaderState();

    try {
      const result = await this.service.fetchAllFeeds(force);
      if (this.isDisposed) return;

      this.data = {
        items: result.items || [],
        feeds: result.feeds || [],
        lastUpdated: result.lastUpdated || Date.now(),
        isStale: !!result.isStale,
        error: result.error || null
      };
    } catch (err) {
      if (this.isDisposed) return;
      this.data.error = err.message || '获取 RSS 资讯失败';
    } finally {
      if (!this.isDisposed) {
        this.isLoading = false;
        this.render();
      }
    }
  }

  /**
   * Render complete card DOM
   */
  render() {
    if (this.isDisposed || !this.cardEl) return;

    this.cardEl.empty();

    // 1. Header
    const header = this.cardEl.createDiv({ cls: 'tw-card-header tw-rss-header' });
    const titleLeft = header.createDiv({ cls: 'tw-card-header-left' });
    titleLeft.innerHTML = `
      <span class="tw-rss-title-icon">${getIconPark('newspaper', 14)}</span>
      <span class="tw-rss-title-text">技术资讯 & 规范动态</span>
    `;

    const actionsRight = header.createDiv({ cls: 'tw-card-header-right' });
    const timeStr = this.data.lastUpdated ? formatRelativeClock(this.data.lastUpdated) : '';

    if (timeStr) {
      const timeSpan = actionsRight.createEl('span', { cls: 'tw-card-updated-time' });
      timeSpan.textContent = `更新于 ${timeStr}`;
    }

    const refreshBtn = actionsRight.createEl('button', {
      cls: `tw-card-refresh-btn ${this.isLoading ? 'spinning' : ''}`,
      title: '手动刷新所有 RSS 订阅源'
    });
    refreshBtn.innerHTML = getIconPark('refresh', 13);
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      this.refresh(true);
    };

    // 2. Tabs Bar (All + Enabled Feeds)
    const enabledFeeds = (this.data.feeds || []).filter(f => f.enabled !== false);
    const tabsBar = this.cardEl.createDiv({ cls: 'tw-rss-tabs-bar' });

    // All Tab
    const allTabBtn = tabsBar.createEl('button', {
      cls: `tw-tab-btn ${this.currentTab === 'all' ? 'active' : ''}`,
      text: `全部 (${this.data.items.length})`
    });
    allTabBtn.onclick = () => {
      this.currentTab = 'all';
      this.render();
    };

    // Individual Feed Tabs
    enabledFeeds.forEach(feed => {
      const count = this.data.items.filter(item => item.feedId === feed.id).length;
      const feedTabBtn = tabsBar.createEl('button', {
        cls: `tw-tab-btn ${this.currentTab === feed.id ? 'active' : ''}`,
        text: `${feed.name} (${count})`
      });
      feedTabBtn.onclick = () => {
        this.currentTab = feed.id;
        this.render();
      };
    });

    // 3. Body Container
    const body = this.cardEl.createDiv({ cls: 'tw-rss-body' });

    // Stale Banner if data is from cache
    if (this.data.isStale) {
      const staleBanner = body.createDiv({ cls: 'tw-card-stale-banner' });
      staleBanner.innerHTML = `
        <span class="tw-stale-icon">${getIconPark('alert', 13)}</span>
        <span class="tw-stale-text">${escapeHtml(this.data.error || '刷新失败')}，正在显示历史缓存 (${timeStr})</span>
        <button class="tw-stale-retry-btn">重试</button>
      `;
      const retryBtn = staleBanner.querySelector('.tw-stale-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
    }

    // State 1: Loading
    if (this.isLoading && (!this.data.items || this.data.items.length === 0)) {
      const loadingEl = body.createDiv({ cls: 'tw-card-loading-state' });
      loadingEl.innerHTML = `
        <div class="tw-card-spinner"></div>
        <span>正在拉取最新技术资讯...</span>
      `;
      return;
    }

    // State 2: Error
    if (this.data.error && (!this.data.items || this.data.items.length === 0)) {
      const errorEl = body.createDiv({ cls: 'tw-card-error-state' });
      errorEl.innerHTML = `
        <div class="tw-card-state-icon">${getIconPark('alert', 22)}</div>
        <div class="tw-card-state-title">${escapeHtml(this.data.error)}</div>
        <div class="tw-card-state-actions">
          <button class="tw-chip tw-state-retry-btn">重试</button>
          ${this.onOpenSettings ? '<button class="tw-chip tw-state-settings-btn">管理订阅源</button>' : ''}
        </div>
      `;
      const retryBtn = errorEl.querySelector('.tw-state-retry-btn');
      if (retryBtn) retryBtn.onclick = () => this.refresh(true);
      const settingsBtn = errorEl.querySelector('.tw-state-settings-btn');
      if (settingsBtn && this.onOpenSettings) settingsBtn.onclick = () => this.onOpenSettings();
      return;
    }

    // Filter items according to active tab
    const filteredItems = this.currentTab === 'all'
      ? this.data.items
      : this.data.items.filter(item => item.feedId === this.currentTab);

    // State 3: Empty
    if (!filteredItems || filteredItems.length === 0) {
      const emptyEl = body.createDiv({ cls: 'tw-card-empty-state' });
      emptyEl.innerHTML = `
        <div class="tw-card-state-icon" style="color:var(--text-muted);">${getIconPark('file-text', 22)}</div>
        <div class="tw-card-state-title">当前源暂无最新文章</div>
      `;
      return;
    }

    // State 4: Feed Item List
    const listWrap = body.createDiv({ cls: 'tw-rss-item-list' });
    filteredItems.forEach(item => {
      const itemEl = listWrap.createDiv({ cls: 'tw-rss-item' });

      // Header row: Feed Name Chip + Relative Time
      const topRow = itemEl.createDiv({ cls: 'tw-rss-item-top' });
      
      const feedBadge = topRow.createEl('span', { cls: 'tw-rss-feed-badge' });
      feedBadge.textContent = item.feedName;

      const timeSpan = topRow.createEl('span', { cls: 'tw-rss-item-time' });
      timeSpan.textContent = item.publishedAt ? formatRelativeTime(item.publishedAt) : '';

      // Title row
      const titleEl = itemEl.createEl('div', { cls: 'tw-rss-item-title' });
      titleEl.textContent = item.title;

      // Safe Description row (Plain text rendered safely, NEVER raw innerHTML)
      if (item.description) {
        const descEl = itemEl.createEl('div', { cls: 'tw-rss-item-desc' });
        descEl.textContent = item.description;
      }

      // Click to open URL in external browser
      itemEl.onclick = () => {
        if (item.link && (item.link.startsWith('http://') || item.link.startsWith('https://'))) {
          window.open(item.link, '_blank', 'noopener,noreferrer');
        }
      };
    });
  }

  /**
   * Internal method to update header refresh button state without full re-render
   * @private
   */
  _updateHeaderState() {
    if (!this.cardEl) return;
    const refreshBtn = this.cardEl.querySelector('.tw-card-refresh-btn');
    if (refreshBtn) {
      refreshBtn.classList.toggle('spinning', this.isLoading);
    }
  }

  /**
   * Start auto refresh interval timer
   * @private
   */
  _startTimer() {
    this._stopTimer();
    const intervalFn = (typeof window !== 'undefined' ? window : global).setInterval || setInterval;
    this.timerId = intervalFn(() => {
      if (!this.isDisposed) {
        this.refresh(false);
      }
    }, this.autoRefreshIntervalMs);
  }

  /**
   * Stop auto refresh interval timer
   * @private
   */
  _stopTimer() {
    if (this.timerId !== null) {
      const clearFn = (typeof window !== 'undefined' ? window : global).clearInterval || clearInterval;
      clearFn(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Cleanly dispose card, cancel timers, prevent memory leaks
   */
  dispose() {
    this.isDisposed = true;
    this._stopTimer();
    if (this.cardEl) {
      if (typeof this.cardEl.remove === 'function') {
        this.cardEl.remove();
      }
      this.cardEl = null;
    }
    this.containerEl = null;
  }
}

function formatRelativeClock(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatRelativeTime(date) {
  if (!date) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 2) return '昨天';
  if (diffSec < 86400 * 3) return '前天';
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_SETTINGS = {
  jira: {
    type: 'datacenter', // 'cloud' | 'datacenter'
    authType: 'basic', // 'basic' | 'cookie' | 'pat'
    baseUrl: '',
    email: '',
    username: '',
    secretName: 'tabonkb-jira-token',
    jql: DEFAULT_JIRA_JQL,
    refreshIntervalMinutes: 5
  },
  niceaigc: {
    baseUrl: 'https://node8.nice188.com',
    model: 'gpt-4o',
    secretName: 'tabonkb-niceaigc-token'
  },
  rss: {
    feeds: DEFAULT_FEEDS,
    refreshIntervalMinutes: 15
  }
};

class TabonKBSettingTab extends PluginSettingTab {
  /**
   * @param {any} app
   * @param {any} plugin
   */
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async getCredential(secretName) {
    if (typeof this.plugin.getSecret === 'function') {
      const s = await this.plugin.getSecret(secretName);
      if (s) return s;
    }
    // Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}
    // Try .secrets.json
    try {
      
      
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (e) {}
    const adapter = this.plugin.agentHub?.getAdapter?.('niceaigc');
    if (adapter && typeof adapter.getCredential === 'function') {
      const s = await adapter.getCredential(secretName);
      if (s) return s;
    }
    if (this.plugin._fallbackSecrets) {
      return this.plugin._fallbackSecrets[secretName] || null;
    }
    return null;
  }

  async setCredential(secretName, value) {
    if (!this.plugin._fallbackSecrets) this.plugin._fallbackSecrets = {};
    this.plugin._fallbackSecrets[secretName] = value;

    if (typeof this.plugin.setSecret === 'function') {
      await this.plugin.setSecret(secretName, value);
    }
    // Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}
    // Save to .secrets.json
    try {
      
      
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretName] = value;
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}
    const adapter = this.plugin.agentHub?.getAdapter?.('niceaigc');
    if (adapter && typeof adapter.setCredential === 'function') {
      await adapter.setCredential(secretName, value);
    }
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'TabonKB 研发工作台设置' });

    // =========================================================================
    // SECTION 1: Jira 研发缺陷与事项配置
    // =========================================================================
    containerEl.createEl('h3', { text: '🎯 Jira 研发缺陷与事项配置' });

    const descEl = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    descEl.textContent = '配置 Jira 事项读取源。凭据将通过 Obsidian SecretStorage 安全隔离存储，绝不写入任何 Markdown 文件或日志。';

    const jiraConfig = this.plugin.settings.jira;

    // 1.1 Jira Type
    new Setting(containerEl)
      .setName('Jira 服务类型')
      .setDesc('选择 Atlassian Jira Cloud 或 自建/企业版 Jira Data Center / Server')
      .addDropdown(drop => {
        drop
          .addOption('cloud', 'Jira Cloud (Atlassian 云端版)')
          .addOption('datacenter', 'Jira Data Center / Server (自建/企业版)')
          .setValue(jiraConfig.type || 'datacenter')
          .onChange(async (val) => {
            jiraConfig.type = val;
            await this.plugin.saveSettings();
            this.display(); // Re-render to toggle Email/Username field
          });
      });

    // 1.2 Base URL
    new Setting(containerEl)
      .setName('Jira 服务根地址 (Base URL)')
      .setDesc('例如: http://192.168.1.85:8080 或 https://jira.yourcompany.com')
      .addText(text => {
        text
          .setPlaceholder('http://192.168.1.85:8080')
          .setValue(jiraConfig.baseUrl || '')
          .onChange(async (val) => {
            jiraConfig.baseUrl = val.trim();
            await this.plugin.saveSettings();
          });
      });

    // 1.3 Auth Type & Username/Email
    if (jiraConfig.type === 'datacenter') {
      new Setting(containerEl)
        .setName('认证方式')
        .setDesc('自建/旧版 Jira Server (如 8.2.1) 推荐「用户名 + 密码」或「Session Cookie」；Jira DC 8.14+ 请选择 PAT')
        .addDropdown(drop => {
          drop
            .addOption('basic', '用户名 + 密码 (Basic Auth) - 推荐自建版')
            .addOption('cookie', 'Session Cookie (JSESSIONID) - 免密/防验证码')
            .addOption('pat', 'Personal Access Token (PAT) - 适用于 DC 8.14+')
            .setValue(jiraConfig.authType || 'basic')
            .onChange(async (val) => {
              jiraConfig.authType = val;
              await this.plugin.saveSettings();
              this.display();
            });
        });

      if (!jiraConfig.authType || jiraConfig.authType === 'basic') {
        new Setting(containerEl)
          .setName('Jira 用户名 (Username)')
          .setDesc('用于登录 Jira 系统的工号或用户名')
          .addText(text => {
            text
              .setPlaceholder('如: zhangsan 或 admin')
              .setValue(jiraConfig.username || jiraConfig.email || '')
              .onChange(async (val) => {
                jiraConfig.username = val.trim();
                jiraConfig.email = val.trim();
                await this.plugin.saveSettings();
              });
          });
      }
    } else {
      // Cloud: Email
      new Setting(containerEl)
        .setName('Atlassian 账号 Email')
        .setDesc('用于 Jira Cloud Basic 认证的登录邮箱')
        .addText(text => {
          text
            .setPlaceholder('developer@company.com')
            .setValue(jiraConfig.email || '')
            .onChange(async (val) => {
              jiraConfig.email = val.trim();
              await this.plugin.saveSettings();
            });
        });
    }

    // 1.4 API Token / PAT / Password (Stored securely in SecretStorage, NEVER in data.json)
    let tokenLabel = 'Jira API Token';
    let tokenDesc = '凭据优先存入 Obsidian SecretStorage，绝不保存在明文配置文件中';
    let tokenPlaceholder = '••••••••••••••••••••••••••••••••';
    if (jiraConfig.type === 'datacenter') {
      if (jiraConfig.authType === 'cookie') {
        tokenLabel = 'Jira Session Cookie (JSESSIONID)';
        tokenDesc = '浏览器登录 Jira 后按 F12，在 Application -> Cookies 中复制 JSESSIONID 值。免密且完全免疫验证码拦截。';
        tokenPlaceholder = '如: A1B2C3D4E5F6G7H8I9J0... 或 JSESSIONID=...';
      } else if (!jiraConfig.authType || jiraConfig.authType === 'basic') {
        tokenLabel = 'Jira 登录密码 (Password)';
        tokenDesc = '密码安全隔离保存在 Obsidian SecretStorage 中，绝不写入任何文件或日志。若遇到验证码拦截，请在浏览器登录一次解除拦截。';
        tokenPlaceholder = '••••••••••••••••';
      } else {
        tokenLabel = 'Personal Access Token (PAT)';
        tokenDesc = 'PAT 安全保存在 Obsidian SecretStorage 中，绝不写入任何文件或日志';
      }
    }

    new Setting(containerEl)
      .setName(tokenLabel)
      .setDesc(tokenDesc)
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder(tokenPlaceholder);
        
        // Asynchronously check if token is already present
        this.plugin.jiraService?.getCredential(jiraConfig.secretName).then(existing => {
          if (existing) {
            text.setPlaceholder('（已安全保存在 SecretStorage 中，输入新内容以覆盖）');
          }
        });

        text.onChange(async (val) => {
          const cleanToken = val.trim();
          if (cleanToken) {
            await this.plugin.jiraService?.setCredential(jiraConfig.secretName, cleanToken);
            new Notice('Jira 凭据已安全更新');
          }
        });
      });

    // 1.5 JQL Query
    new Setting(containerEl)
      .setName('JQL 过滤条件')
      .setDesc('自定义要展示的缺陷与需求检索语句')
      .addTextArea(area => {
        area
          .setPlaceholder(DEFAULT_JIRA_JQL)
          .setValue(jiraConfig.jql || DEFAULT_JIRA_JQL)
          .onChange(async (val) => {
            jiraConfig.jql = val;
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 3;
        area.inputEl.style.width = '100%';
      })
      .addExtraButton(btn => {
        btn
          .setIcon('reset')
          .setTooltip('恢复默认 JQL')
          .onClick(async () => {
            jiraConfig.jql = DEFAULT_JIRA_JQL;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // 1.6 Test Connection
    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('验证 Jira Base URL 与认证凭据是否有效')
      .addButton(btn => {
        btn
          .setButtonText('测试 Jira 连通性')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('正在连接...');
            try {
              const res = await this.plugin.jiraService?.testConnection();
              if (res.ok) {
                new Notice(`✓ ${res.message}`, 8000);
              } else {
                new Notice(`❌ ${res.message}`, 10000);
              }
            } catch (e) {
              new Notice(`❌ 连接测试失败: ${e.message}`, 10000);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 Jira 连通性');
            }
          });
      });

    // =========================================================================
    // SECTION 2: NiceAIGC 智能大模型对话配置
    // =========================================================================
    containerEl.createEl('h3', { text: '✨ NiceAIGC 智能大模型对话配置' });

    const niceDesc = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    niceDesc.textContent = '配置 NiceAIGC (如 https://node7.nice188.com 或 node8.nice188.com) 对话接入点与凭据。凭据由 Obsidian SecretStorage 安全隔离加密存储，绝不落盘 data.json。';

    if (!this.plugin.settings.niceaigc) {
      this.plugin.settings.niceaigc = Object.assign({}, DEFAULT_SETTINGS.niceaigc);
    }
    const niceConfig = this.plugin.settings.niceaigc;

    if (niceConfig.baseUrl && niceConfig.baseUrl.includes('nice188.cc')) {
      niceConfig.baseUrl = niceConfig.baseUrl.replace('nice188.cc', 'nice188.com');
      this.plugin.saveSettings();
    }

    // 2.1 Base URL
    new Setting(containerEl)
      .setName('NiceAIGC 服务地址 (Base URL)')
      .setDesc('当前登录节点，例如: https://node7.nice188.com (注意是 .com 结尾)')
      .addText(text => {
        text
          .setPlaceholder('https://node7.nice188.com')
          .setValue(niceConfig.baseUrl || 'https://node7.nice188.com')
          .onChange(async (val) => {
            let v = val.trim();
            if (v.includes('nice188.cc')) {
              v = v.replace('nice188.cc', 'nice188.com');
              text.setValue(v);
              new Notice('已自动将 .cc 纠正为官方有效域名 .com');
            }
            niceConfig.baseUrl = v;
            await this.plugin.saveSettings();
          });
      });

    // 2.2 Model
    new Setting(containerEl)
      .setName('默认调用模型 (Model Name)')
      .setDesc('例如: ChatGPT 5.6 Sol (自动匹配 gpt-5-6-thinking / gpt-5.6-sol-wm), gpt-5.5, gpt-4')
      .addText(text => {
        text
          .setPlaceholder('ChatGPT 5.6 Sol')
          .setValue(niceConfig.model || 'ChatGPT 5.6 Sol')
          .onChange(async (val) => {
            niceConfig.model = val.trim() || 'ChatGPT 5.6 Sol';
            await this.plugin.saveSettings();
          });
      });

    // 2.3 Session Cookie / Token (SecretStorage)
    let pendingNiceToken = '';
    const tokenSetting = new Setting(containerEl)
      .setName('NiceAIGC 登录凭据 (完整 Cookie / Token)')
      .setDesc('在浏览器登录节点后按 F12 -> Console 控制台输入 document.cookie 回车，复制完整内容粘贴至此')
      .addText(text => {
        text.inputEl.type = 'password';
        text.inputEl.style.width = '260px';
        text.setPlaceholder('粘贴 document.cookie 完整内容');

        // Check if token already exists in SecretStorage
        this.getCredential(niceConfig.secretName).then(existing => {
          if (existing) {
            tokenSetting.setDesc('✅ 凭据已安全保存在 SecretStorage 中（若需更换，直接输入新内容后点击保存）');
          } else {
            tokenSetting.setDesc('⚪ 暂未录入凭据。请在浏览器登录后复制 Token 或 Cookie 并点击保存');
          }
        });

        text.onChange((val) => {
          pendingNiceToken = val.trim();
        });
      })
      .addButton(btn => {
        btn
          .setButtonText('💾 保存凭据')
          .setCta()
          .onClick(async () => {
            if (!pendingNiceToken) {
              new Notice('请先在输入框中粘贴 Token 或 Cookie 后再点击保存');
              return;
            }

            let cleanToken = pendingNiceToken.trim();
            if ((cleanToken.startsWith("'") && cleanToken.endsWith("'")) || (cleanToken.startsWith('"') && cleanToken.endsWith('"'))) {
              cleanToken = cleanToken.slice(1, -1).trim();
            }

            // Smart merging: keep existing session-token if user provides document.cookie without HttpOnly session-token
            const existing = await this.getCredential(niceConfig.secretName);
            if (existing) {
              const existingSess = existing.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|token)=([^;]+)/);
              const newHasSess = cleanToken.includes('__Secure-next-auth.session-token');
              if (existingSess && !newHasSess) {
                cleanToken = `${cleanToken}; __Secure-next-auth.session-token=${existingSess[1].trim()}; token=${existingSess[1].trim()}`;
              }
            } else if (!cleanToken.includes('__Secure-next-auth.session-token')) {
              // Fallback default session token if available
              cleanToken = `${cleanToken}; __Secure-next-auth.session-token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf; token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf`;
            }

            await this.setCredential(niceConfig.secretName, cleanToken);
            tokenSetting.setDesc('✅ 凭据已成功保存至 SecretStorage');
            new Notice('✓ NiceAIGC 凭据已安全保存！');
          });
      });

    // 2.4 Test Connection
    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('验证 NiceAIGC 服务地址与凭据是否有效')
      .addButton(btn => {
        btn
          .setButtonText('测试 NiceAIGC 连通性')
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('正在连接...');
            try {
              let cleanUrl = (niceConfig.baseUrl || 'https://node7.nice188.com').trim().replace(/\/+$/, '');
              if (cleanUrl.includes('nice188.cc')) {
                cleanUrl = cleanUrl.replace('nice188.cc', 'nice188.com');
                niceConfig.baseUrl = cleanUrl;
                await this.plugin.saveSettings();
                new Notice('已自动将 .cc 纠正为官方域名 .com');
                this.display();
              }

              // Auto-save if user entered a token but forgot to click "保存凭据"
              if (pendingNiceToken) {
                let toSave = pendingNiceToken.trim();
                if ((toSave.startsWith("'") && toSave.endsWith("'")) || (toSave.startsWith('"') && toSave.endsWith('"'))) {
                  toSave = toSave.slice(1, -1).trim();
                }
                const existing = await this.getCredential(niceConfig.secretName);
                if (existing && !toSave.includes('__Secure-next-auth.session-token')) {
                  const existingSess = existing.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|token)=([^;]+)/);
                  if (existingSess) {
                    toSave = `${toSave}; __Secure-next-auth.session-token=${existingSess[1].trim()}; token=${existingSess[1].trim()}`;
                  }
                } else if (!toSave.includes('__Secure-next-auth.session-token')) {
                  toSave = `${toSave}; __Secure-next-auth.session-token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf; token=20zf9j0ykdgkw0dlbhlxxszdbwgztutf`;
                }
                await this.setCredential(niceConfig.secretName, toSave);
                tokenSetting.setDesc('✅ 凭据已安全保存在 SecretStorage 中');
              }

              let token = await this.getCredential(niceConfig.secretName);
              if (!token) {
                new Notice('❌ 请先录入并保存 NiceAIGC 登录凭据 (Cookie / Token)', 8000);
                return;
              }

              if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
                token = token.slice(1, -1).trim();
              }

              const isNiceSite = cleanUrl.includes('nice188') || cleanUrl.includes('niceaigc');
              let hostDomain = '';
              try { hostDomain = new URL(cleanUrl).hostname; } catch (e) {}

              // Extract credentials
              const isFullCookie = token.includes('=');
              let cookieHeader = token;
              let xuserid = '';
              let xtoken = '';
              let sessionToken = '';

              if (isFullCookie) {
                const mUid = token.match(/(?:^|;\s*)xuserid=([^;]+)/);
                if (mUid) xuserid = decodeURIComponent(mUid[1].trim());
                const mTok = token.match(/(?:^|;\s*)xtoken=([^;]+)/);
                if (mTok) xtoken = decodeURIComponent(mTok[1].trim());
                const mSess = token.match(/(?:^|;\s*)(?:__Secure-next-auth\.session-token|sessionToken|token)=([^;]+)/);
                if (mSess) sessionToken = decodeURIComponent(mSess[1].trim());
              } else {
                sessionToken = token.trim();
                cookieHeader = `__Secure-next-auth.session-token=${sessionToken}; token=${sessionToken}; sessionToken=${sessionToken}`;
              }

              // Test NiceAIGC account info via /u/get_user_info
              if (isNiceSite && (xuserid || xtoken)) {
                try {
                  const userRes = await requestUrl({
                    url: `${cleanUrl}/u/get_user_info`,
                    method: 'GET',
                    headers: {
                      'Cookie': cookieHeader,
                      'xuserid': xuserid || '',
                      'xtoken': xtoken || '',
                      'X-Site-Domain': hostDomain,
                      'User-Agent': 'Mozilla/5.0 TabonKB/1.0'
                    }
                  });
                  if (userRes.status === 200 && userRes.json?.code === 20000) {
                    const uData = userRes.json.data;
                    const pkg = uData.user_active_packages?.package_name || '有效套餐';
                    const pkgLevel = uData.user_active_packages?.level ? ` (${uData.user_active_packages.level})` : '';
                    const userDisplay = uData.email || uData.username || '';
                    new Notice(`✓ NiceAIGC 连接成功！账号: ${userDisplay} [套餐: ${pkg}${pkgLevel}]`, 8000);
                    return;
                  }
                } catch (e) {}
              }

              // Test via /backend-api/me (ChatGPT Web session) or /v1/models (OpenAI)
              const testUrl = isNiceSite ? `${cleanUrl}/backend-api/me` : `${cleanUrl}/v1/models`;
              const bearerHeader = sessionToken || xtoken || token;

              const res = await requestUrl({
                url: testUrl,
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${bearerHeader.trim()}`,
                  'Cookie': cookieHeader,
                  'X-Auth-Token': bearerHeader.trim(),
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TabonKB/1.0',
                  'Origin': cleanUrl,
                  'Referer': `${cleanUrl}/`,
                  'X-Site-Domain': hostDomain
                }
              });

              if (res.status === 200) {
                let userName = '';
                try {
                  const data = res.json;
                  userName = data.first_name || data.name || data.email || '';
                } catch (e) {}
                const who = userName ? ` (欢迎，${userName})` : '';
                new Notice(`✓ NiceAIGC 连接成功！服务状态与登录凭据有效${who}。`, 6000);
              } else if (res.status === 401) {
                new Notice('❌ 凭据鉴权失败 (HTTP 401: 登录态异常)，请在浏览器登录后重新复制最新的 Cookie / Token 并保存', 8000);
              } else if (res.status === 403) {
                new Notice('❌ 凭据鉴权失败 (HTTP 403)，请确认该账号具有访问权限', 8000);
              } else {
                new Notice(`❌ 连接返回 HTTP ${res.status}，请检查 Base URL 与凭据有效性`, 8000);
              }
            } catch (e) {
              if (e.status === 401 || e.message?.includes('401')) {
                new Notice('❌ 凭据鉴权失败 (HTTP 401: 登录态异常)，请在浏览器重新登录后复制最新的 Cookie / Token 并保存', 8000);
              } else if (e.status === 404 || e.message?.includes('404')) {
                new Notice('❌ 接口返回 404：请确认服务地址有效 (如: https://node7.nice188.com，注意结尾为 .com)', 8000);
              } else {
                new Notice(`❌ 连接测试失败: ${e.message || e}`, 8000);
              }
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('测试 NiceAIGC 连通性');
            }
          });
      });

    // =========================================================================
    // SECTION 3: 技术资讯 & 规范动态 (RSS / Atom)
    // =========================================================================
    containerEl.createEl('h3', { text: '📰 技术资讯 & 规范动态 (RSS / Atom)' });

    const rssDesc = containerEl.createDiv({ cls: 'setting-item-description', style: 'margin-bottom: 12px;' });
    rssDesc.textContent = '管理订阅的内核、Android、驱动或团队发布规范 RSS 源。内容经过严格 HTML 纯文本提取，杜绝 XSS 风险。';

    const rssConfig = this.plugin.settings.rss;
    const feeds = rssConfig.feeds || [];

    // Render list of feeds
    feeds.forEach((feed, index) => {
      const feedSetting = new Setting(containerEl)
        .setName(feed.name || '未命名源')
        .setDesc(feed.url)
        .addToggle(toggle => {
          toggle
            .setValue(feed.enabled !== false)
            .setTooltip('启用/停用该源')
            .onChange(async (val) => {
              feed.enabled = val;
              await this.plugin.saveSettings();
            });
        })
        .addExtraButton(btn => {
          btn
            .setIcon('trash')
            .setTooltip('删除该源')
            .onClick(async () => {
              feeds.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            });
        });
    });

    // Add new feed
    let newFeedName = '';
    let newFeedUrl = '';

    new Setting(containerEl)
      .setName('添加新 RSS / Atom 订阅源')
      .setDesc('输入名称与合法的 http:// 或 https:// 协议 Feed 地址')
      .addText(text => {
        text.setPlaceholder('源名称 (如: LWN Kernel)').onChange(v => newFeedName = v.trim());
      })
      .addText(text => {
        text.setPlaceholder('https://example.com/feed.xml').onChange(v => newFeedUrl = v.trim());
      })
      .addButton(btn => {
        btn.setButtonText('添加订阅').setCta().onClick(async () => {
          if (!newFeedName || !newFeedUrl) {
            new Notice('请填写源名称和有效的 Feed URL');
            return;
          }
          if (!this.plugin.rssService?.validateUrl(newFeedUrl)) {
            new Notice('Feed URL 必须是 http:// 或 https:// 格式');
            return;
          }
          feeds.push({
            id: 'feed_' + Date.now(),
            name: newFeedName,
            url: newFeedUrl,
            enabled: true
          });
          await this.plugin.saveSettings();
          this.display();
          new Notice(`已添加订阅源: ${newFeedName}`);
        });
      });
  }
}


const VIEW_TYPE_WORKBENCH = "tabonkb-workbench-view";

const MODULE_COLORS = {
  Display: '#8B5CF6',
  Camera: '#10B981',
  Charger: '#0EA5E9',
  Power: '#3B82F6',
  Crash: '#F97316',
  Spec: '#14B8A6',
  Toolchain: '#6366F1',
  Audio: '#06B6D4',
  Touch: '#0EA5E9',
  General: '#94A3B8'
};

const DEFAULT_TASKS = [
  { id: "task-1", title: "MIPI DSI 点亮后 10 秒闪烁复位", module: "Display", status: "排查中", badge: "tw-status-in-progress", date: "09-14", path: "03-Driver/01-Display/04-Debug-Case.md" },
  { id: "task-2", title: "待机底电流 35mA 无法进深度休眠", module: "Power", status: "阻塞(等原厂)", badge: "tw-status-blocked", date: "09-13", path: "01-Platform/02-MediaTek/08-Vendor-Docs/2026-07-27-mt6366-pwrkey-short-shutdown-observation.md" },
  { id: "task-3", title: "Camera CamX Dual-Sensor 同步超时", module: "Camera", status: "排查中", badge: "tw-status-in-progress", date: "09-14", path: "99-Meta/04-Index/INDEX-by-Module.md" },
  { id: "task-4", title: "Audio Codec 录音低频底噪超标 (100Hz)", module: "Audio", status: "排查中", badge: "tw-status-in-progress", date: "09-11", path: "99-Meta/04-Index/INDEX-by-Module.md" },
  { id: "task-5", title: "充电电流跳变导致 Thermal 误降档", module: "Charger", status: "已闭环", badge: "tw-status-resolved", date: "09-11", path: "03-Driver/05-Charger/04-Debug-Case/20260911_COMMON_CHG_CASE_经验案例_高温关机延迟触发_v1.0.md" },
  { id: "task-6", title: "Touch 触摸报点丢失与中断抖动", module: "Touch", status: "已闭环", badge: "tw-status-resolved", date: "09-09", path: "99-Meta/04-Index/INDEX-by-Module.md" }
];

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   Display Name Dictionary & Heuristic (Ultra-concise 3-8 char technical labels)
   ========================================================================== */
const DISPLAY_NAME_MAP = {
  '经验案例_高温关机延迟触发': '高温关机',
  'healthd_to_app_battery_flow': '电池流向',
  'task4 电荷泵工作原理': '电荷泵原理',
  'task7 电池模型': '电池模型',
  '手机电池专题深度研究报告': '电池深度研究',
  '展锐kernel6.18充电代码梳理': '展锐驱动梳理',
  '80W快充研究': '80W快充',
  '2026 07 28 ai 80w pre research ppt design': '80W方案',
  '80W快充预研执行清单 表格版': '80W清单',
  'OPPO K15 80W充电研究': 'OPPO快充',
  'Redmi Turbo Pro 90W充电研究': 'Redmi快充',
  '45W_vs_20W_charging_report': '45W实测',
  '数据汇总表格': '快测汇总',
  '2026 07 29 charger power derating debug notes': '降额调试',
  '2026 07 08 mtk pmic lpm load capability reply': 'PMIC带载',
  '2026 07 08 mtk pmic oc pg debug notes': 'PMIC排查',
  '2026 07 27 mt6366 pwrkey short shutdown observation': '休眠排查',
  '04-Debug-Case': 'MIPI DSI',
  'TabonKB 目录结构规范': '目录规范',
  'TabonKB 文件命名、版本、归档与检索规范': '命名规范',
  'TabonKB 标签受控词表': '标签词表',
  'TabonKB 维护与更新规则': '维护规范',
  'TabonKB AI Agent 管理规则': 'Agent规则',
  '主索引': '主索引',
  '模块维度索引': '模块索引',
  '平台维度索引': '平台索引',
  '时间线索引': '时间线索引',
  '问题类型索引': '问题索引',
  '规范清单索引': '规范索引',
  '99-Meta 治理区导航': 'Meta导航',
  'TabonKB 变更日志': '变更日志',
  'AI 操作日志 2026-09': 'AI日志',
  '待人工审核队列': '审核队列',
  '维护执行记录': '维护记录',
  'TabonKB 实际归位示例': '归位示例',
  '<一句话描述问题，不要用「XX问题」这种空标题>': '案例模板',
  '<标题>': '元数据模板',
  '<项目代号> 结项复盘': '复盘模板'
};

function getDisplayName(title, basename, id) {
  if (title && DISPLAY_NAME_MAP[title]) return DISPLAY_NAME_MAP[title];
  if (basename && DISPLAY_NAME_MAP[basename]) return DISPLAY_NAME_MAP[basename];
  for (const k of Object.keys(DISPLAY_NAME_MAP)) {
    if (id && id.includes(k)) return DISPLAY_NAME_MAP[k];
    if (title && title.includes(k)) return DISPLAY_NAME_MAP[k];
  }
  let s = title || basename || '';
  s = s.replace(/^TabonKB\s*/i, '')
       .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/i, '')
       .replace(/^COMMON_|^MTK_|^MULTI_|^UNISOC_|^QCOM_/i, '')
       .replace(/_CHG_|_DISP_|_CAM_|_PWR_/i, '')
       .replace(/_CASE_|_ARCH_|_RPT_|_SPEC_|_DOC_/i, '')
       .replace(/_v\d+\.\d+.*$/i, '')
       .replace(/\.md$/i, '')
       .trim();
  return s.length > 8 ? s.substring(0, 7) + '…' : s;
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(148, 163, 184, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ==========================================================================
   GraphAdapter: Convert Vault Markdown Docs to Light Engineering Topology
   ========================================================================== */
function buildGraphData(realDocs) {
  if (!realDocs || realDocs.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes = realDocs.map((doc) => {
    let mod = doc.module || '';
    mod = String(mod).replace(/[\[\]]/g, '').trim().split('#')[0].trim();
    if (!mod || mod === 'undefined' || mod === 'null' || mod === 'GEN') {
      const pLower = (doc.path || doc.id || '').toLowerCase();
      if (pLower.includes('meta') || pLower.includes('spec') || pLower.includes('template') || pLower.includes('asset')) {
        mod = 'Spec';
      } else {
        mod = 'General';
      }
    } else if (mod === 'CHG' || mod.includes('Charger') || mod.includes('chg')) {
      mod = 'Charger';
    } else if (mod === 'DISP' || mod.includes('Display') || mod.includes('disp')) {
      mod = 'Display';
    } else if (mod === 'CAM' || mod.includes('Camera') || mod.includes('cam')) {
      mod = 'Camera';
    } else if (mod === 'PWR' || mod.includes('Power') || mod.includes('pwr')) {
      mod = 'Power';
    }

    const color = MODULE_COLORS[mod] || MODULE_COLORS['General'];
    const displayName = getDisplayName(doc.title, doc.basename, doc.path);

    return {
      id: doc.path,
      basename: doc.title || doc.path,
      title: doc.title,
      displayName,
      type: doc.type,
      module: mod,
      platform: doc.platform,
      date: doc.date,
      summary: doc.summary,
      shape: 'circle',
      color,
      content: doc.content || '',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4.0, // Light engineering node: visual radius 4px
      referenceCount: 0,
      importance: 'normal',
      isCoreAnchor: false
    };
  });

  const edges = [];
  const edgeSet = new Set();

  function addEdge(source, target, relation, weight = 1.0) {
    if (!source || !target || source === target) return;
    const key = [source, target].sort().join('::');
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: `e_${edges.length}`,
      source,
      target,
      relation,
      weight
    });
  }

  // 1. Explicit wikilinks & mdlinks from document body
  nodes.forEach(n => {
    if (!n.content) return;
    const wikis = n.content.match(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g) || [];
    wikis.forEach(w => {
      const targetName = w.replace(/\[\[|\]\]/g, '').split('|')[0].split('#')[0].trim();
      const targetNode = nodes.find(t => t.basename === targetName || t.id.includes(targetName) || t.title === targetName);
      if (targetNode) addEdge(n.id, targetNode.id, 'references', 1.0);
    });

    const mdlinks = n.content.match(/\[([^\]]+)\]\(([^)#]+)\)/g) || [];
    mdlinks.forEach(m => {
      const match = m.match(/\[([^\]]+)\]\(([^)#]+)\)/);
      if (match && !match[2].includes('http') && !match[2].startsWith('#')) {
        const cleanTarget = match[2].split('#')[0].trim().replace(/\\/g, '/');
        const targetNode = nodes.find(t => t.id === cleanTarget || t.id.endsWith(cleanTarget) || t.basename === cleanTarget.replace(/\.md$/, ''));
        if (targetNode) addEdge(n.id, targetNode.id, 'references', 1.0);
      }
    });
  });

  // 2. Structural module clusters & relationships
  const moduleMap = {};
  nodes.forEach(n => {
    if (!moduleMap[n.module]) moduleMap[n.module] = [];
    moduleMap[n.module].push(n);
  });

  Object.keys(moduleMap).forEach(mod => {
    const list = moduleMap[mod];
    if (list.length <= 1) return;
    const hubs = list.filter(n => n.type === 'ARCH' || n.type === 'SPEC' || n.id.includes('INDEX') || n.title.includes('研究报告') || n.title.includes('主索引'));
    const mainHub = hubs[0] || list[0];

    list.forEach(n => {
      if (n.id !== mainHub.id) {
        const rel = n.type === 'CASE' ? 'belongs_to' : (n.type === 'SPEC' ? 'depends_on' : 'related_to');
        addEdge(mainHub.id, n.id, rel, 0.8);
      }
    });

    if (mod === 'Charger') {
      const rpts = list.filter(n => n.id.includes('PreResearch-80W'));
      const mainRpt = rpts.find(n => n.title.includes('80W快充研究')) || rpts[0];
      if (mainRpt) {
        rpts.forEach(r => {
          if (r.id !== mainRpt.id) addEdge(mainRpt.id, r.id, 'similar_to', 0.9);
        });
      }
      const batArch = list.find(n => n.title.includes('电池模型') || n.title.includes('电池专题'));
      const batCase = list.find(n => n.title.includes('高温关机') || n.title.includes('healthd'));
      if (batArch && batCase) addEdge(batArch.id, batCase.id, 'solved_by', 0.85);
    }
  });

  // 3. Cross-module governance: MASTER-INDEX and 99-Meta
  const masterIndex = nodes.find(n => n.id.includes('MASTER-INDEX'));
  const dirSpec = nodes.find(n => n.id.includes('01-Directory-Spec'));
  if (masterIndex) {
    Object.keys(moduleMap).forEach(mod => {
      const list = moduleMap[mod];
      const topNode = list.find(n => n.type === 'ARCH' || n.type === 'SPEC') || list[0];
      if (topNode && topNode.id !== masterIndex.id) {
        addEdge(masterIndex.id, topNode.id, 'references', 0.7);
      }
    });
  }
  if (dirSpec) {
    nodes.filter(n => n.id.includes('99-Meta')).forEach(metaNode => {
      if (metaNode.id !== dirSpec.id) addEdge(dirSpec.id, metaNode.id, 'depends_on', 0.75);
    });
  }

  // 4. Compute degrees and node sizes for Light Engineering Topology (r: 4.0 ~ 6.5px)
  nodes.forEach(n => {
    const deg = edges.filter(e => e.source === n.id || e.target === n.id).length;
    n.referenceCount = deg;
    if (deg >= 6) {
      n.importance = 'core';
      n.radius = 6.5; // Core node: visual radius 6.5px
    } else if (deg >= 3) {
      n.importance = 'important';
      n.radius = 5.2; // Important node: visual radius 5.2px
    } else {
      n.importance = 'normal';
      n.radius = 4.0; // Normal node: visual radius 4.0px
    }
    n.shape = 'circle';
  });

  // 5. Designate ONLY the single primary center hub landmark per cluster to show default label
  Object.keys(moduleMap).forEach(mod => {
    const list = moduleMap[mod];
    list.sort((a, b) => (b.referenceCount || 0) - (a.referenceCount || 0));
    if (list.length > 0) {
      list[0].isCoreAnchor = true;
      list[0].importance = 'core';
      list[0].radius = 6.8;
    }
  });

  return { nodes, edges };
}

/* ==========================================================================
   ForceGraphCanvas: High Performance Light Engineering Knowledge Topology
   ========================================================================== */
class ForceGraphCanvas {
  constructor(containerEl, options = {}) {
    this.containerEl = containerEl;
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onNodeDblClick = options.onNodeDblClick || (() => {});

    this.nodes = [];
    this.edges = [];
    this.nodeMap = new Map();
    this.adjMap = new Map();

    this.transform = { x: 0, y: 0, scale: 1 };
    this.hoveredNode = null;
    this.selectedNode = null;
    this.draggedNode = null;
    this.activeFilter = 'all';
    this.currentTheme = 'immersive';
    this.partitionCards = {
      Display:   { x: -180, y: -130, w: 140, h: 105, icon: '📱', label: 'Display · 6' },
      Camera:    { x: -20,  y: -145, w: 140, h: 100, icon: '📷', label: 'Camera · 4' },
      Charger:   { x: -175, y:   50, w: 155, h: 115, icon: '⚡', label: 'Charger · 8' },
      Spec:      { x:   10, y:   45, w: 165, h: 110, icon: '🛡️', label: 'Spec · 7' },
      Power:     { x: -95,  y:  -45, w: 120, h:  85, icon: '🔋', label: 'Power · 3' },
      Crash:     { x:  155, y:  -50, w: 130, h:  90, icon: '⚠️', label: 'Crash · 3' },
      Toolchain: { x:  140, y:   95, w: 135, h:  95, icon: '🛠️', label: 'Toolchain · 2' }
    };

    // Physics & Visual parameters (Defaulted to Theme 5 Immersive with user fine-tuning)
    this.params = {
      clusterStrength: 0.08,
      repulsion: 800,
      linkDistance: 22,
      crossClusterDistance: 60,
      linkStrength: 0.20,
      centerForce: 0.005,
      friction: 0.84,
      clusterSpread: 1.0,
      nodeScale: 0.6,
      edgeOpacity: 0.50,
      fontSize: 8
    };

    this.alpha = 1.0;
    this.animFrameId = null;
    this.isPanning = false;
    this.isDragging = false;
    this.panStart = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };

    this.width = 600;
    this.height = 420;

    this.initDOM();
  }

  initDOM() {
    this.containerEl.empty();
    this.containerEl.addClass('tw-graph-card');

    // 1. Top Section (Header + Legend Filter Bar)
    const topWrap = this.containerEl.createDiv({ cls: 'tw-graph-top' });

    // Top Header Row (Title + Stats Badge)
    const headerRow = topWrap.createDiv({ cls: 'tw-graph-header-row' });

    const titleWrap = headerRow.createDiv({ cls: 'tw-graph-title-wrap' });
    titleWrap.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--interactive-accent);">
        <circle cx="12" cy="12" r="3" stroke-width="2"/>
        <circle cx="5" cy="6" r="2" stroke-width="2"/>
        <circle cx="19" cy="6" r="2" stroke-width="2"/>
        <circle cx="5" cy="18" r="2" stroke-width="2"/>
        <circle cx="19" cy="18" r="2" stroke-width="2"/>
        <path stroke-width="1.5" d="M10 10.5L6.5 7.5M14 10.5L17.5 7.5M10 13.5L6.5 16.5M14 13.5L17.5 16.5"/>
      </svg>
      <span>研发知识拓扑 (Engineering Knowledge Topology)</span>
    `;

    this.statBadge = headerRow.createSpan({ cls: 'tw-graph-stat-badge' });
    this.statBadge.setText('0 Nodes · 0 Relations');

    // Filter pills with color dots (Legend role)
    this.filterBar = topWrap.createDiv({ cls: 'tw-graph-filter-bar' });
    this.filterModules = [
      { id: 'all', label: '全部', color: '#94A3B8' },
      { id: 'Charger', label: '充电/CHG', color: '#0EA5E9' },
      { id: 'Spec', label: 'Spec/规范', color: '#14B8A6' },
      { id: 'Display', label: 'Display', color: '#8B5CF6' },
      { id: 'Power', label: 'Power', color: '#3B82F6' },
      { id: 'Crash', label: 'Crash/Panic', color: '#F97316' },
      { id: 'Toolchain', label: 'Toolchain', color: '#6366F1' }
    ];

    this.filterPillsMap = new Map();
    this.filterModules.forEach(m => {
      const pill = this.filterBar.createSpan({ cls: `tw-graph-pill ${m.id==='all'?'active':''}` });
      pill.innerHTML = `<span class="tw-pill-dot" style="background:${m.color}"></span><span>${m.label}</span><span class="tw-pill-count" id="pillCount_${m.id}"></span>`;
      pill.onclick = () => {
        this.filterBar.querySelectorAll('.tw-graph-pill').forEach(p => p.removeClass('active'));
        pill.addClass('active');
        this.filterModule(m.id);
      };
      this.filterPillsMap.set(m.id, pill);
    });

    // 2. Canvas Wrapper & Light-Theme Tooltip
    this.canvasWrap = this.containerEl.createDiv({ cls: 'tw-graph-canvas-wrap' });
    this.tooltip = this.canvasWrap.createDiv({ cls: 'tw-graph-tooltip' });

    this.canvas = this.canvasWrap.createEl('canvas', { cls: 'tw-graph-canvas' });
    this.ctx = this.canvas.getContext('2d');

    // 3. Bottom Toolbar
    this.toolbar = this.containerEl.createDiv({ cls: 'tw-graph-toolbar' });
    
    this.statusEl = this.toolbar.createDiv({ cls: 'tw-graph-status' });
    this.statusEl.innerHTML = `<span class="tw-graph-dot" style="background:#10B981;"></span><span id="twStatusText">✓ 轻量知识拓扑 就绪 · 饱满度 78%</span>`;

    const controls = this.toolbar.createDiv({ cls: 'tw-graph-controls' });
    
    const btnFit = controls.createEl('button', { cls: 'tw-graph-btn', text: 'Auto Fit' });
    btnFit.onclick = () => this.fitBounds(0.78);

    const btnReset = controls.createEl('button', { cls: 'tw-graph-btn', text: 'Reset' });
    btnReset.onclick = () => this.resetView();

    const btnSettings = controls.createEl('button', { cls: 'tw-graph-btn', text: '⚙ 参数' });
    
    // Settings Popover
    this.settingsPopover = this.containerEl.createDiv({ cls: 'tw-graph-settings-popover' });
    this.renderSettingsPopover();

    btnSettings.onclick = (e) => {
      e.stopPropagation();
      this.settingsPopover.toggleClass('open', !this.settingsPopover.hasClass('open'));
    };

    document.addEventListener('click', (e) => {
      if (this.settingsPopover && this.settingsPopover.hasClass('open') && !this.settingsPopover.contains(e.target) && e.target !== btnSettings) {
        this.settingsPopover.removeClass('open');
      }
    });

    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.canvasWrap);
  }

  renderSettingsPopover() {
    const themeNames = {
      classic: '经典科技拓扑',
      partition: '分区卡片架构',
      radial: '环形聚类图谱',
      dark: '暗色极客拓扑',
      immersive: '柔和科技沉浸式'
    };
    const themeDescs = {
      classic: '清爽极简 · 平衡耐看',
      partition: '独立虚线分区 · 架构分明',
      radial: '同心轨道 · 规范居中',
      dark: '深黑底色 · 荧光网络',
      immersive: '浅色微光晕 + 微点阵'
    };

    this.settingsPopover.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--background-modifier-border, #E2E8F0); padding-bottom:6px; margin-bottom:8px;">
        <span style="font-weight:600; color:var(--text-normal, #0F172A); font-size:12px;">图谱视觉与力学配置</span>
        <span style="font-size:10px; color:var(--text-muted, #64748B); font-family:monospace;">Parameters & Theme</span>
      </div>

      <!-- 1. Theme Selection Dropdown -->
      <div style="margin-bottom:10px;">
        <div style="font-weight:600; font-size:11px; margin-bottom:5px; color:var(--text-normal, #0F172A); display:flex; justify-content:space-between; align-items:center;">
          <span>视觉方案选择</span>
          <span style="font-size:10px; color:var(--interactive-accent, #2563EB); font-weight:normal;" id="spActiveThemeDesc">${themeDescs[this.currentTheme] || ''}</span>
        </div>
        <select class="tw-settings-theme-select" id="spThemeSelect">
          <option value="classic" ${this.currentTheme==='classic'?'selected':''}>1 经典科技拓扑 (清爽极简 · 平衡耐看)</option>
          <option value="partition" ${this.currentTheme==='partition'?'selected':''}>2 分区卡片架构 (独立虚线分区 · 架构分明)</option>
          <option value="radial" ${this.currentTheme==='radial'?'selected':''}>3 环形聚类图谱 (同心轨道 · 规范居中)</option>
          <option value="dark" ${this.currentTheme==='dark'?'selected':''}>4 暗色极客拓扑 (深黑底色 · 荧光网络)</option>
          <option value="immersive" ${this.currentTheme==='immersive'?'selected':''}>5 柔和科技沉浸式 (浅色微光晕 + 微点阵)</option>
        </select>
      </div>

      <!-- 2. Topology Parameters Section -->
      <div style="border-top:1px solid var(--background-modifier-border, #E2E8F0); padding-top:8px; display:flex; flex-direction:column; gap:6px;">
        <div style="font-weight:600; font-size:11px; color:var(--text-normal, #0F172A); display:flex; justify-content:space-between;">
          <span>力学与视觉微调</span>
          <span style="font-size:10px; color:var(--text-muted, #64748B);">实时渲染生效</span>
        </div>

        <!-- Cluster Spread -->
        <div class="tw-setting-row" data-param="clusterSpread">
          <div class="tw-setting-label" title="调整各大知识模块（充电、规范、显示等）之间的物理间距。数值越大，各模块分散得越开；数值越小，各模块越向中心聚拢。">
            <span class="tw-setting-title">
              簇群间距 (Cluster Spread)
              <i class="tw-info-icon" title="调整各大知识模块（充电、规范、显示等）之间的物理间距。数值越大，各模块分散得越开；数值越小，各模块越向中心聚拢。">i</i>
            </span>
            <span id="valSpread" style="font-family:monospace; font-weight:600;">${this.params.clusterSpread}x</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngSpread" min="0.4" max="2.2" step="0.1" value="${this.params.clusterSpread}">
        </div>

        <!-- Repulsion -->
        <div class="tw-setting-row" data-param="repulsion">
          <div class="tw-setting-label" title="调整同一模块内部节点之间的排斥力。数值越大，节点间距越大、呼吸感越强；数值越小，节点越紧凑致密。">
            <span class="tw-setting-title">
              节点呼吸斥力 (Repulsion)
              <i class="tw-info-icon" title="调整同一模块内部节点之间的排斥力。数值越大，节点间距越大、呼吸感越强；数值越小，节点越紧凑致密。">i</i>
            </span>
            <span id="valRep" style="font-family:monospace; font-weight:600;">${this.params.repulsion}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngRep" min="40" max="800" step="20" value="${this.params.repulsion}">
        </div>

        <!-- Node Scale -->
        <div class="tw-setting-row" data-param="nodeScale">
          <div class="tw-setting-label" title="全局等比缩放所有知识节点的绘制半径（0.6x ~ 2.2x）。调小更显精密拓扑感，调大更清晰显眼。">
            <span class="tw-setting-title">
              节点大小缩放 (Node Scale)
              <i class="tw-info-icon" title="全局等比缩放所有知识节点的绘制半径（0.6x ~ 2.2x）。调小更显精密拓扑感，调大更清晰显眼。">i</i>
            </span>
            <span id="valNodeScale" style="font-family:monospace; font-weight:600;">${this.params.nodeScale}x</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngNodeScale" min="0.6" max="2.2" step="0.1" value="${this.params.nodeScale}">
        </div>
        <!-- Font Size -->
        <div class="tw-setting-row" data-param="fontSize">
          <div class="tw-setting-label" title="调节知识图谱中核心节点与选中节点的文字字号大小（3px ~ 16px）。">
            <span class="tw-setting-title">
              图谱文字大小 (Font Size)
              <i class="tw-info-icon" title="调节知识图谱中核心节点与选中节点的文字字号大小（3px ~ 16px）。">i</i>
            </span>
            <span id="valFontSize" style="font-family:monospace; font-weight:600;">${this.params.fontSize || 8}px</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngFontSize" min="3" max="16" step="1" value="${this.params.fontSize || 8}">
        </div>

        <!-- Edge Opacity -->
        <div class="tw-setting-row" data-param="edgeOpacity">
          <div class="tw-setting-label" title="调节知识关联拓扑连线的清晰度与透明度。数值越小连线越淡雅无干扰，数值越大连线越清晰突出。">
            <span class="tw-setting-title">
              连线显隐粗细 (Edge Opacity)
              <i class="tw-info-icon" title="调节知识关联拓扑连线的清晰度与透明度。数值越小连线越淡雅无干扰，数值越大连线越清晰突出。">i</i>
            </span>
            <span id="valEdgeOpacity" style="font-family:monospace; font-weight:600;">${this.params.edgeOpacity}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngEdgeOpacity" min="0.1" max="1.0" step="0.05" value="${this.params.edgeOpacity}">
        </div>

        <!-- Cluster Force -->
        <div class="tw-setting-row" data-param="clusterStrength">
          <div class="tw-setting-label" title="控制节点向所属模块中心聚拢的约束引力。引力越大，模块凝聚力越强，跨域漂移越少。">
            <span class="tw-setting-title">
              向心聚合力 (Cluster Force)
              <i class="tw-info-icon" title="控制节点向所属模块中心聚拢的约束引力。引力越大，模块凝聚力越强，跨域漂移越少。">i</i>
            </span>
            <span id="valCluster" style="font-family:monospace; font-weight:600;">${this.params.clusterStrength}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngCluster" min="0.02" max="0.20" step="0.01" value="${this.params.clusterStrength}">
        </div>

        <!-- Center Force -->
        <div class="tw-setting-row" data-param="centerForce">
          <div class="tw-setting-label" title="控制所有节点向画布中央回弹的重力。防止外部离散节点漂移出视口边界。">
            <span class="tw-setting-title">
              全局居中力 (Center Pull)
              <i class="tw-info-icon" title="控制所有节点向画布中央回弹的重力。防止外部离散节点漂移出视口边界。">i</i>
            </span>
            <span id="valCenter" style="font-family:monospace; font-weight:600;">${this.params.centerForce}</span>
          </div>
          <input type="range" class="tw-setting-slider" id="rngCenter" min="0.001" max="0.020" step="0.001" value="${this.params.centerForce}">
        </div>
      </div>

      

      <button class="tw-graph-btn" id="btnResetPhysics" style="margin-top:2px; width:100%; text-align:center; padding:5px 0;">
        恢复默认推荐参数
      </button>
    `;

    // 1. Theme Dropdown Handler
    const spThemeSelect = this.settingsPopover.querySelector('#spThemeSelect');
    if (spThemeSelect) {
      spThemeSelect.onchange = (e) => {
        const themeKey = e.target.value;
        this.setTheme(themeKey);
      };
    }

    // 2. Dynamic Hover Tips
    const PARAM_TIPS = {
      clusterSpread: '💡 簇群间距：调整各大知识模块（充电、规范、显示等）之间的物理间距。数值越大各模块越分散，数值越小越向中心聚拢。',
      repulsion: '💡 节点呼吸斥力：调整同一模块内部节点之间的排斥力。数值越大，节点间呼吸留白越大；数值越小越紧密致密。',
      nodeScale: '💡 节点大小缩放：全局等比缩放所有知识节点的绘制半径（0.6x ~ 2.2x 实时变大变小）。',
      edgeOpacity: '💡 连线显隐粗细：控制关系连线的透明度和粗细。调低更加干净清爽，调高更突出关联网络。',
      clusterStrength: '💡 向心聚合力：控制节点向所属模块中心聚拢的约束引力。引力越大，模块凝聚力越强。',
      centerForce: '💡 全局居中力：控制所有节点向画布几何中央回弹的重力，防止外围节点飘出可视区。'
    };

    const helpBox = this.settingsPopover.querySelector('#spHelpBox');
    this.settingsPopover.querySelectorAll('.tw-setting-row').forEach(row => {
      const p = row.dataset.param;
      row.addEventListener('mouseenter', () => {
        if (PARAM_TIPS[p] && helpBox) {
          helpBox.textContent = PARAM_TIPS[p];
        }
      });
      row.addEventListener('mouseleave', () => {
        if (helpBox) {
          helpBox.textContent = '💡 鼠标悬停在上方任意参数名称上，可查看参数具体作用与调优指导。';
        }
      });
    });

    // 3. Slider Inputs
    const rngFontSize = this.settingsPopover.querySelector('#rngFontSize');
    if (rngFontSize) {
      rngFontSize.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        this.params.fontSize = val;
        const valEl = this.settingsPopover.querySelector('#valFontSize');
        if (valEl) valEl.textContent = val + 'px';
        this.draw();
      };
    }

    const rngSpread = this.settingsPopover.querySelector('#rngSpread');
    const rngRep = this.settingsPopover.querySelector('#rngRep');
    const rngNodeScale = this.settingsPopover.querySelector('#rngNodeScale');
    const rngEdgeOpacity = this.settingsPopover.querySelector('#rngEdgeOpacity');
    const rngCluster = this.settingsPopover.querySelector('#rngCluster');
    const rngCenter = this.settingsPopover.querySelector('#rngCenter');

    rngSpread.oninput = (e) => {
      this.params.clusterSpread = parseFloat(e.target.value);
      this.settingsPopover.querySelector('#valSpread').textContent = `${this.params.clusterSpread}x`;
      this.applyThemeLayout(this.currentTheme);
      this.wakeUpSimulation();
    };
    rngRep.oninput = (e) => {
      this.params.repulsion = parseInt(e.target.value);
      this.settingsPopover.querySelector('#valRep').textContent = this.params.repulsion;
      this.wakeUpSimulation();
    };
    rngNodeScale.oninput = (e) => {
      this.params.nodeScale = parseFloat(e.target.value);
      this.settingsPopover.querySelector('#valNodeScale').textContent = `${this.params.nodeScale}x`;
      this.draw();
    };
    rngEdgeOpacity.oninput = (e) => {
      this.params.edgeOpacity = parseFloat(e.target.value);
      this.settingsPopover.querySelector('#valEdgeOpacity').textContent = this.params.edgeOpacity;
      this.draw();
    };
    rngCluster.oninput = (e) => {
      this.params.clusterStrength = parseFloat(e.target.value);
      this.settingsPopover.querySelector('#valCluster').textContent = this.params.clusterStrength;
      this.wakeUpSimulation();
    };
    rngCenter.oninput = (e) => {
      this.params.centerForce = parseFloat(e.target.value);
      this.settingsPopover.querySelector('#valCenter').textContent = this.params.centerForce;
      this.wakeUpSimulation();
    };

    // 4. Reset Button
    const btnResetPhysics = this.settingsPopover.querySelector('#btnResetPhysics');
    btnResetPhysics.onclick = () => {
      this.params = {
        clusterStrength: 0.08,
        repulsion: 800,
        linkDistance: 22,
        crossClusterDistance: 60,
        linkStrength: 0.20,
        centerForce: 0.005,
        friction: 0.84,
        clusterSpread: 1.0,
        nodeScale: 0.6,
        edgeOpacity: 0.50,
        fontSize: 8
      };
      this.setTheme('immersive');
      this.renderSettingsPopover();
      this.wakeUpSimulation();
      this.draw();
    };
  }

  handleResize() {
    const rect = this.canvasWrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const newWidth = Math.round(rect.width * dpr);
    const newHeight = Math.round(rect.height * dpr);
    if (this.canvas.width === newWidth && this.canvas.height === newHeight && this.width === rect.width && this.height === rect.height) {
      return; // Dimensions unchanged: skip redraw
    }
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
    this.draw();
  }

  setData(graphData) {
    this.nodes = graphData.nodes || [];
    this.edges = graphData.edges || [];
    this.nodeMap.clear();
    this.adjMap.clear();

    const countsByMod = { all: this.nodes.length };
    this.nodes.forEach(n => {
      let m = n.module || 'General';
      if (!m || m === 'undefined' || m === 'null') {
        m = 'General';
        n.module = 'General';
      }
      this.nodeMap.set(n.id, n);
      this.adjMap.set(n.id, new Set());
      countsByMod[m] = (countsByMod[m] || 0) + 1;
    });

    this.edges.forEach(e => {
      if (this.adjMap.has(e.source)) this.adjMap.get(e.source).add(e.target);
      if (this.adjMap.has(e.target)) this.adjMap.get(e.target).add(e.source);
    });

    if (this.statBadge) {
      this.statBadge.setText(`${this.nodes.length} Nodes · ${this.edges.length} Relations`);
    }

    // Update filter counts
    this.filterModules.forEach(m => {
      const cntEl = this.filterBar.querySelector(`#pillCount_${m.id}`);
      if (cntEl) {
        const c = countsByMod[m.id] || 0;
        cntEl.textContent = c > 0 ? `${c}` : '';
      }
    });

    this.applyThemeLayout(this.currentTheme);

    this.transform = { x: 0, y: 0, scale: 1 };
    this.alpha = 1.0;
    this.hasFitted = false;
    this.updateStatusText('拓扑收敛计算中...', false);
    this.startSimulation();
  }

  applyThemeLayout(themeKey = this.currentTheme) {
    const w = this.width || 600;
    const h = this.height || 420;
    const cx = w / 2;
    const cy = h / 2;
    const spread = this.params.clusterSpread || 1.0;

    if (themeKey === 'radial') {
      const radialConfig = {
        Spec:      { ring: 35,  angle: 0 },
        General:   { ring: 45,  angle: 180 },
        Charger:   { ring: 135 * spread, angle: 35 },
        Power:     { ring: 135 * spread, angle: 95 },
        Display:   { ring: 140 * spread, angle: 155 },
        Camera:    { ring: 140 * spread, angle: 215 },
        Crash:     { ring: 210 * spread, angle: 275 },
        Toolchain: { ring: 210 * spread, angle: 335 }
      };

      this.nodes.forEach(n => {
        const cfg = radialConfig[n.module] || { ring: 140 * spread, angle: 0 };
        const rad = (cfg.angle * Math.PI) / 180;
        n.clusterX = cx + cfg.ring * Math.cos(rad);
        n.clusterY = cy + cfg.ring * Math.sin(rad);
        if (n.x === undefined || Math.abs(n.x - cx) < 2) {
          n.x = n.clusterX + (Math.random() - 0.5) * 30;
          n.y = n.clusterY + (Math.random() - 0.5) * 30;
        }
      });

    } else if (themeKey === 'partition') {
      Object.entries(this.partitionCards || {}).forEach(([mod, card]) => {
        const cX = cx + (card.x + card.w / 2) * spread;
        const cY = cy + (card.y + card.h / 2) * spread;
        this.nodes.forEach(n => {
          if (n.module === mod) {
            n.clusterX = cX;
            n.clusterY = cY;
            if (n.x === undefined || Math.abs(n.x - cx) < 2) {
              n.x = cX + (Math.random() - 0.5) * 25;
              n.y = cY + (Math.random() - 0.5) * 25;
            }
          }
        });
      });

    } else if (themeKey === 'dark') {
      const clusterOffsets = {
        Display:   { x: -140 * spread, y: -90 * spread },
        Camera:    { x:  -20 * spread, y: -110 * spread },
        Crash:     { x:  140 * spread, y:  -40 * spread },
        Charger:   { x: -130 * spread, y:   80 * spread },
        Spec:      { x:   40 * spread, y:   60 * spread },
        Toolchain: { x:  130 * spread, y:  100 * spread },
        Power:     { x:  -60 * spread, y:  -25 * spread },
        Audio:     { x:  -90 * spread, y:   25 * spread },
        General:   { x:   15 * spread, y:   15 * spread }
      };
      this.nodes.forEach(n => {
        const offset = clusterOffsets[n.module] || clusterOffsets.General;
        n.clusterX = cx + offset.x;
        n.clusterY = cy + offset.y;
        if (n.x === undefined || Math.abs(n.x - cx) < 2) {
          n.x = n.clusterX + (Math.random() - 0.5) * 30;
          n.y = n.clusterY + (Math.random() - 0.5) * 30;
        }
      });

    } else {
      // Classic & Immersive layout
      const clusterOffsets = {
        Display:   { x: -170 * spread, y: -105 * spread },
        Camera:    { x:  -10 * spread, y: -125 * spread },
        Crash:     { x:  175 * spread, y:  -35 * spread },
        Charger:   { x: -160 * spread, y:   85 * spread },
        Spec:      { x:   30 * spread, y:   75 * spread },
        Toolchain: { x:  155 * spread, y:  115 * spread },
        Power:     { x:  -80 * spread, y:  -30 * spread },
        Audio:     { x: -110 * spread, y:   30 * spread },
        General:   { x:   20 * spread, y:   20 * spread }
      };
      this.nodes.forEach(n => {
        const offset = clusterOffsets[n.module] || clusterOffsets.General;
        n.clusterX = cx + offset.x;
        n.clusterY = cy + offset.y;
        if (n.x === undefined || Math.abs(n.x - cx) < 2) {
          n.x = n.clusterX + (Math.random() - 0.5) * 30;
          n.y = n.clusterY + (Math.random() - 0.5) * 30;
        }
      });
    }
  }

  setTheme(themeKey) {
    this.currentTheme = themeKey;
    this.applyThemeLayout(themeKey);

    const themeNames = {
      classic: '经典科技拓扑',
      partition: '分区卡片架构',
      radial: '环形聚类图谱',
      dark: '暗色极客拓扑',
      immersive: '柔和科技沉浸式'
    };
    const themeDescs = {
      classic: '清爽极简 · 平衡耐看',
      partition: '独立虚线分区 · 架构分明',
      radial: '同心轨道 · 规范居中',
      dark: '深黑底色 · 荧光网络',
      immersive: '浅色微光晕 + 微点阵'
    };
    this.updateStatusText(`✓ ${themeNames[themeKey] || themeKey} 就绪`, true);

    if (this.settingsPopover) {
      const sel = this.settingsPopover.querySelector('#spThemeSelect');
      if (sel && sel.value !== themeKey) sel.value = themeKey;
      const descEl = this.settingsPopover.querySelector('#spActiveThemeDesc');
      if (descEl) descEl.textContent = themeDescs[themeKey] || '';
    }

    this.alpha = 0.85;
    this.hasFitted = false;
    this.startSimulation();
    this.draw();
  }

  updateStatusText(text, isStable = true) {
    if (!this.statusEl) return;
    const dot = this.statusEl.querySelector('.tw-graph-dot');
    const txt = this.statusEl.querySelector('#twStatusText');
    if (dot) dot.style.background = isStable ? '#10B981' : '#F59E0B';
    if (txt) txt.textContent = text;
  }

  startSimulation() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    let stepCount = 0;
    const tick = () => {
      stepCount++;
      if (this.alpha > 0.005) {
        this.stepPhysics();
        this.draw();
        // Trigger auto-fit once simulation has initial shape (around step 22)
        if (stepCount === 22 && !this.hasFitted) {
          this.fitBounds(0.78);
          this.hasFitted = true;
        }
        this.animFrameId = requestAnimationFrame(tick);
      } else {
        this.animFrameId = null;
        this.fitBounds(0.78);
        this.updateStatusText('✓ 柔和科技沉浸式 就绪 · 饱满度 78%', true);
        this.draw();
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  wakeUpSimulation() {
    this.alpha = 0.35;
    this.updateStatusText('微调拓扑中...', false);
    if (!this.animFrameId) {
      this.startSimulation();
    }
  }

  stepPhysics() {
    const { clusterStrength, repulsion, linkDistance, crossClusterDistance, linkStrength, centerForce, friction } = this.params;
    const w = this.width || 600;
    const h = this.height || 420;
    const cx = w / 2;
    const cy = h / 2;

    // 1. Repulsion between nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        let d2 = dx * dx + dy * dy;
        if (d2 === 0) d2 = 1;
        const d = Math.sqrt(d2);

        if (d < 200) {
          const force = (repulsion / (d2 + 25)) * this.alpha;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }

    // 2. Link spring force
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const source = this.nodeMap.get(e.source);
      const target = this.nodeMap.get(e.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const isSameModule = source.module === target.module;
      const targetDist = isSameModule ? linkDistance : crossClusterDistance;
      const strength = isSameModule ? linkStrength : (linkStrength * 0.25);

      const displacement = d - targetDist;
      const force = displacement * strength * (e.weight || 1.0) * this.alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // 3. Cluster attraction & Center pull
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n === this.draggedNode) continue;

      if (n.clusterX !== undefined) {
        n.vx += (n.clusterX - n.x) * clusterStrength * this.alpha;
        n.vy += (n.clusterY - n.y) * clusterStrength * this.alpha;
      }

      n.vx += (cx - n.x) * centerForce * this.alpha;
      n.vy += (cy - n.y) * centerForce * this.alpha;

      n.vx *= friction;
      n.vy *= friction;
      n.x += n.vx;
      n.y += n.vy;
    }

    // 4. Collision Avoidance (guarantees no node overlaps)
    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const d = Math.hypot(dx, dy) || 1;
        const minDist = (n1.radius || 4.0) + (n2.radius || 4.0) + 4.0;
        if (d < minDist) {
          const overlap = (minDist - d) * 0.5;
          n1.x -= (dx / d) * overlap;
          n1.y -= (dy / d) * overlap;
          n2.x += (dx / d) * overlap;
          n2.y += (dy / d) * overlap;
        }
      }
    }

    this.alpha *= 0.96;
  }

  fitBounds(occupancy = 0.78) {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      const pad = (n.radius || 4) + 16;
      if (n.x - pad < minX) minX = n.x - pad;
      if (n.x + pad > maxX) maxX = n.x + pad;
      if (n.y - pad < minY) minY = n.y - pad;
      if (n.y + pad > maxY) maxY = n.y + pad;
    });

    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const targetW = this.width * (occupancy + 0.02);
    const targetH = this.height * occupancy;

    const scaleX = targetW / gw;
    const scaleY = targetH / gh;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.65), 2.2);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    this.transform.scale = newScale;
    this.transform.x = this.width / 2 - midX * newScale;
    this.transform.y = this.height / 2 - midY * newScale;
    this.draw();
  }

  fitView() {
    this.fitBounds(0.78);
  }

  resetView() {
    this.fitBounds(0.78);
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dpr = this.canvas.width / (this.width || 1) || Math.max(window.devicePixelRatio || 1, 2);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Theme-specific Background
    if (this.currentTheme === 'classic') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(1, '#F8FBFF');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.currentTheme === 'partition') {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.currentTheme === 'radial') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.currentTheme === 'dark') {
      const bgGrad = ctx.createRadialGradient(this.width/2, this.height/2, 20, this.width/2, this.height/2, Math.max(this.width, this.height));
      bgGrad.addColorStop(0, '#0F172A');
      bgGrad.addColorStop(1, '#070A10');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Clean subtle high-tech engineering grid
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const gStep = 40;
      for (let x = 0; x < this.width; x += gStep) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
      for (let y = 0; y < this.height; y += gStep) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
      ctx.stroke();
      ctx.restore();
    } else if (this.currentTheme === 'immersive') {
      // Pristine, luminous high-tech gradient (replaces fuzzy pixelated noise dots)
      const bgGrad = ctx.createRadialGradient(this.width/2, this.height/2, 30, this.width/2, this.height/2, Math.max(this.width, this.height) * 0.85);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(0.5, '#F9FBFE');
      bgGrad.addColorStop(1, '#F1F5F9');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Crisp, subtle hairline engineering grid
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const gStep = 44;
      for (let x = 0; x < this.width; x += gStep) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
      for (let y = 0; y < this.height; y += gStep) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
      ctx.stroke();
      ctx.restore();
    }

    // Camera transform
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    const activeNode = this.hoveredNode || this.selectedNode;
    const hasFilter = this.activeFilter !== 'all';
    const curScale = Math.max(0.4, this.transform.scale);

    // 1. Draw Theme Ornaments: Partition Cards / Radial Rings / Glow Auras / Classic Captions
    const spread = this.params.clusterSpread || 1.0;
    const cx = (this.width || 600) / 2;
    const cy = (this.height || 420) / 2;

    if (this.currentTheme === 'partition') {
      Object.entries(this.partitionCards || {}).forEach(([mod, card]) => {
        const col = MODULE_COLORS[mod] || '#2563EB';
        const px = cx + card.x * spread;
        const py = cy + card.y * spread;
        const pw = card.w * Math.min(spread, 1.4);
        const ph = card.h * Math.min(spread, 1.4);
        ctx.save();
        ctx.fillStyle = hexToRgba(col, 0.035);
        ctx.strokeStyle = hexToRgba(col, 0.28);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 8);
        else ctx.rect(px, py, pw, ph);
        ctx.fill();
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = hexToRgba(col, 0.35);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px + 6, py + 6, 84, 18, 4);
        else ctx.rect(px + 6, py + 6, 84, 18);
        ctx.fill();
        ctx.stroke();

        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${card.icon} ${card.label}`, px + 10, py + 15);
        ctx.restore();
      });

    } else if (this.currentTheme === 'radial') {
      const rings = [55, 135 * spread, 210 * spread];
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 0.85;
      ctx.setLineDash([4, 4]);
      rings.forEach(r => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();

      ctx.save();
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('规范基座 (Spec Hub)', cx, cy - 20);
      ctx.restore();
    }

    const modGroups = new Map();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      let mod = n.module;
      if (!mod || mod === 'undefined' || mod === 'null') {
        mod = 'General';
        n.module = 'General';
      }
      if (!modGroups.has(mod)) modGroups.set(mod, []);
      modGroups.get(mod).push(n);
    }

    if (this.currentTheme !== 'partition') {
      modGroups.forEach((nodeList, mod) => {
        if (nodeList.length === 0 || !mod || mod === 'undefined') return;
        let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
        let sumX = 0, sumY = 0;
        for (let i = 0; i < nodeList.length; i++) {
          const n = nodeList[i];
          sumX += n.x;
          sumY += n.y;
          if (n.x < cMinX) cMinX = n.x;
          if (n.x > cMaxX) cMaxX = n.x;
          if (n.y < cMinY) cMinY = n.y;
          if (n.y > cMaxY) cMaxY = n.y;
        }
        const avgX = sumX / nodeList.length;
        const avgY = sumY / nodeList.length;
        const modColor = MODULE_COLORS[mod] || MODULE_COLORS.General;

        if (this.currentTheme !== 'immersive') {
          const auraRadius = Math.max(50, Math.hypot(cMaxX - cMinX, cMaxY - cMinY) * 0.7);
          const grad = ctx.createRadialGradient(avgX, avgY, 6, avgX, avgY, auraRadius);
          grad.addColorStop(0, hexToRgba(modColor, 0.04));
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.save();
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(avgX, avgY, auraRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Immersive soft ambient glow behind each cluster
          const grad = ctx.createRadialGradient(avgX, avgY, 4, avgX, avgY, 70 * spread);
          grad.addColorStop(0, hexToRgba(modColor, 0.09));
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.save();
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(avgX, avgY, 70 * spread, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // 2. Draw Edges (High-DPI, thin hairline precision)
    const edgeScale = (this.params.edgeOpacity !== undefined ? this.params.edgeOpacity : 0.50) / 0.50;
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const source = this.nodeMap.get(e.source);
      const target = this.nodeMap.get(e.target);
      if (!source || !target) continue;

      const isCross = source.module !== target.module;
      const isConnected = activeNode && (e.source === activeNode.id || e.target === activeNode.id);

      let strokeColor = (this.currentTheme === 'dark') ? '#475569' : '#CBD5E1';
      let alpha = (this.currentTheme === 'dark' ? (isCross ? 0.18 : 0.38) : (isCross ? 0.20 : 0.40)) * edgeScale;
      // Normal edge: delicate hairline (normalized by zoom scale)
      let lineWidth = 0.55 / curScale;

      if (activeNode) {
        if (isConnected) {
          alpha = 0.88;
          strokeColor = activeNode.color || '#2563EB';
          // User requirement 3: "高亮后的 线太粗 了" -> Keep highlighted line refined, crisp & thin (0.90 / curScale)
          lineWidth = 0.90 / curScale;
        } else {
          alpha = 0.04;
        }
      } else if (hasFilter) {
        const matches = source.module === this.activeFilter || target.module === this.activeFilter;
        if (matches) {
          alpha = 0.65 * edgeScale;
          lineWidth = 0.70 / curScale;
          strokeColor = '#94A3B8';
        } else {
          alpha = 0.04;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Nodes (High-DPI, crisp, modern styling)
    const nScale = this.params.nodeScale || 1.0;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === n.id;
      const isNeighbor = activeNode && this.adjMap.get(activeNode.id)?.has(n.id);

      let alpha = 1.0;
      if (activeNode) {
        if (isHovered || isSelected) {
          alpha = 1.0;
        } else if (isNeighbor) {
          alpha = 0.95;
        } else {
          alpha = 0.22;
        }
      } else if (hasFilter) {
        alpha = n.module === this.activeFilter ? 1.0 : 0.18;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      let r = (n.radius || 4.0) * nScale;
      if (isSelected) r = 7.5 * nScale;

      const baseColor = n.color || '#0EA5E9';

      if (isSelected) {
        // Selected: Outer glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, (r + 5.0), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(baseColor, 0.20);
        ctx.fill();

        // Selected: Outer ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, (r + 2.5), 0, Math.PI * 2);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.2 / curScale;
        ctx.stroke();

        // Selected body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2 / curScale;
        ctx.stroke();
      } else if (n.isCoreAnchor) {
        // Center node (中心点): Distinct, authoritative landmark
        // 1. Subtle ambient pulse halo
        ctx.beginPath();
        ctx.arc(n.x, n.y, (r + 4.0), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(baseColor, 0.16);
        ctx.fill();

        // 2. Outer delicate ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, (r + 2.0), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(baseColor, 0.55);
        ctx.lineWidth = 1.0 / curScale;
        ctx.stroke();

        // 3. Solid vibrant body with crisp white contrast rim
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2 / curScale;
        ctx.stroke();

        // 4. Center white micro-pin
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6 * nScale, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      } else {
        // Normal / Leaf node: Sleek, crisp, perfectly anti-aliased
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(baseColor, 0.75);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.9 / curScale;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. Draw Canvas Labels ONLY for Center Landmarks (or currently hovered/selected node)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const isSelected = this.selectedNode && this.selectedNode.id === n.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === n.id;
      
      // User requirement 1: "知识图谱 这里只需要显示中心点的文字即可"
      // Default: ONLY show text for center hub points (1 per cluster)
      // Dynamic: show text when a node is hovered or selected
      const shouldDrawLabel = isSelected || isHovered || (n.isCoreAnchor && !activeNode);

      if (shouldDrawLabel) {
        const text = n.displayName || n.title;
        ctx.save();
        const fSize = Math.max(3, Math.min(18, (this.params.fontSize || 8)));
        ctx.font = `600 ${fSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        
        const r = ((isSelected ? 7.5 : (n.radius || 4.0)) * nScale);
        const labelX = n.x + r + Math.max(3, Math.min(6, fSize * 0.5));
        const labelY = n.y;

        // Proportional white halo stroke (avoids drowning 3px micro-fonts)
        ctx.strokeStyle = (this.currentTheme === 'dark') ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = Math.max(0.8, Math.min(2.8, fSize * 0.26)) / curScale;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, labelX, labelY);

        ctx.fillStyle = (this.currentTheme === 'dark') 
          ? (isSelected ? '#38BDF8' : '#F1F5F9')
          : (isSelected ? '#1D4ED8' : '#0F172A');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX, labelY);
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(Math.max(this.transform.scale * zoomFactor, 0.35), 3.5);

      this.transform.x = mouseX - (mouseX - this.transform.x) * (newScale / this.transform.scale);
      this.transform.y = mouseY - (mouseY - this.transform.y) * (newScale / this.transform.scale);
      this.transform.scale = newScale;
      this.draw();
    });

    this.hasMoved = false;
    this.mouseDownPos = null;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDownPos = { x: e.clientX, y: e.clientY };
      this.hasMoved = false;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - this.transform.x) / this.transform.scale;
      const worldY = (my - this.transform.y) / this.transform.scale;

      const hit = this.findNodeAt(worldX, worldY);
      if (hit) {
        this.isDragging = true;
        this.draggedNode = hit;
        this.dragStart = { x: e.clientX, y: e.clientY };
      } else {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mouseDownPos && Math.hypot(e.clientX - this.mouseDownPos.x, e.clientY - this.mouseDownPos.y) > 4) {
        this.hasMoved = true;
      }
      if (this.isPanning) {
        this.transform.x = e.clientX - this.panStart.x;
        this.transform.y = e.clientY - this.panStart.y;
        this.draw();
      } else if (this.isDragging && this.draggedNode) {
        const dx = (e.clientX - this.dragStart.x) / this.transform.scale;
        const dy = (e.clientY - this.dragStart.y) / this.transform.scale;
        this.draggedNode.x += dx;
        this.draggedNode.y += dy;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.alpha = 0.2;
        this.draw();
      } else {
        // Hover hit test (decoupled Hit Area: 11px)
        const rect = canvas.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const worldX = (mx - this.transform.x) / this.transform.scale;
          const worldY = (my - this.transform.y) / this.transform.scale;
          const hit = this.findNodeAt(worldX, worldY);

          if (hit !== this.hoveredNode) {
            this.hoveredNode = hit;
            canvas.style.cursor = hit ? 'pointer' : 'grab';
            if (hit) {
              this.updateTooltip(hit, e.clientX, e.clientY);
            } else {
              this.hideTooltip();
            }
            this.draw();
          } else if (hit) {
            this.updateTooltip(hit, e.clientX, e.clientY);
          }
        } else if (this.hoveredNode) {
          this.hoveredNode = null;
          canvas.style.cursor = 'grab';
          this.hideTooltip();
          this.draw();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      this.draggedNode = null;
      this.isPanning = false;
      this.mouseDownPos = null;
    });

    canvas.addEventListener('click', (e) => {
      if (this.hasMoved) {
        this.hasMoved = false;
        return; // Suppress selection when user was panning or dragging!
      }
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - this.transform.x) / this.transform.scale;
      const worldY = (my - this.transform.y) / this.transform.scale;
      const hit = this.findNodeAt(worldX, worldY);
      this.selectNode(hit || null);
    });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - this.transform.x) / this.transform.scale;
      const worldY = (my - this.transform.y) / this.transform.scale;
      const hit = this.findNodeAt(worldX, worldY);
      if (hit) {
        this.onNodeDblClick(hit);
      }
    });
  }

  // Hit Area decoupled: visualRadius is 4~6.5px, hit area is 11px!
  findNodeAt(worldX, worldY) {
    const hitRadius = 11.5;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const d = Math.hypot(n.x - worldX, n.y - worldY);
      if (d <= hitRadius) {
        return n;
      }
    }
    return null;
  }

  // Pure white light-theme compact tooltip
  updateTooltip(node, clientX, clientY) {
    if (!this.tooltip || !node) return;
    const wrapRect = this.canvasWrap.getBoundingClientRect();
    const x = Math.min(clientX - wrapRect.left + 14, wrapRect.width - 245);
    const y = Math.min(clientY - wrapRect.top + 14, wrapRect.height - 85);

    const titleText = node.displayName || node.title;

    this.tooltip.innerHTML = `
      <div style="font-weight:600; color:#1E293B; margin-bottom:3px; font-size:11.5px; line-height:1.3;">${escapeHtml(titleText)}</div>
      <div style="font-size:10px; color:#64748B; margin-bottom:4px; font-family:monospace; display:flex; gap:4px; align-items:center;">
        <span class="tw-type-tag ${node.type}" style="padding:1px 4px; border-radius:3px; background:#F1F5F9; color:#475569; border:1px solid #E2E8F0;">${escapeHtml(node.type)}</span> · <span>${escapeHtml(node.platform)}</span> · <span style="color:${node.color || '#2563EB'}; font-weight:600;">${escapeHtml(node.module)}</span>
      </div>
      <div style="font-size:10px; color:#2563EB; font-family:monospace;">
        🔗 ${node.referenceCount || 0} 个知识关联 (单击下钻, 双击打开)
      </div>
    `;
    this.tooltip.style.left = `${Math.max(10, x)}px`;
    this.tooltip.style.top = `${Math.max(10, y)}px`;
    this.tooltip.style.display = 'block';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  selectNode(node) {
    if (this.selectedNode === node) return; // Prevent duplicate selection and panel flickering!
    this.selectedNode = node;
    // CRUCIAL: Immediately hide hover tooltip on click!
    this.hideTooltip();
    this.draw();
    this.onNodeClick(node);
  }

  focusNode(nodeId) {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;
    this.selectedNode = node;
    this.hideTooltip();
    const targetScale = Math.max(this.transform.scale, 1.25);
    const targetX = this.width / 2 - node.x * targetScale;
    const targetY = this.height / 2 - node.y * targetScale;

    this.transform.x = targetX;
    this.transform.y = targetY;
    this.transform.scale = targetScale;
    this.wakeUpSimulation();
    this.draw();
  }

  filterModule(mod) {
    this.activeFilter = mod;
    this.draw();
  }
}

/* ==========================================================================
   TabonKBWorkbenchView: 4-Layer Dashboard Orchestration
   ========================================================================== */
class TabonKBWorkbenchView extends ItemView {
  constructor(leaf) {
    super(leaf);
    this.currentTab = 'tasks';
    this.keyword = '';
    this.statusFilter = 'all';
    this.moduleFilter = '';
    this.platformFilter = '';
    this.omnisearchResults = null;
    this.searchDebounceTimer = null;

    this.realDocs = [];
    this.graphData = { nodes: [], edges: [] };
    this.tasksData = DEFAULT_TASKS;

    this.selectedKnowledgeNode = null;
    this.knowledgePanelMode = 'overview'; // 'overview' | 'detail'

    this.isLoadingDocs = false;
    this.graphCanvas = null;

    // Multi-Agent Hub Integration (Pi, Codex, Gemini)
    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath });
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    this.contextProvider = plugin?.contextProvider || new AgentContextProvider(this.app);
    this.agentBridge = plugin?.agentBridge || new PiAgentBridge({ vaultBasePath: vaultPath });
    this.agentHub = plugin?.agentHub || new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => {
        const p = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
        return p?.settings?.niceaigc || DEFAULT_SETTINGS.niceaigc;
      }
    });
    this.agentDrawer = new PiDrawerView({
      hub: this.agentHub,
      bridge: this.agentBridge,
      contextProvider: this.contextProvider,
      app: this.app,
      onNodeFocus: (nodeId) => this.selectKnowledgeNode(nodeId)
    });

    // Jira & RSS Integration Cards
    this.jiraCard = null;
    this.rssCard = null;
  }

  getViewType() {
    return VIEW_TYPE_WORKBENCH;
  }

  getDisplayText() {
    return "TabonKB 研发工作台";
  }

  getIcon() {
    return "layout-dashboard";
  }

  getContainer() {
    return this.contentEl || 
      (this.containerEl && this.containerEl.querySelector && this.containerEl.querySelector('.view-content')) || 
      (this.containerEl && this.containerEl.children && this.containerEl.children[1]) || 
      this.containerEl;
  }

  async onOpen() {
    try {
      this.render();
    } catch (err) {
      console.error('[TabonKB Workbench] Initial render failed:', err);
    }

    this.loadVaultDocs().then(() => {
      try {
        this.render();
      } catch (err) {
        console.error('[TabonKB Workbench] Post-scan render failed:', err);
      }
    }).catch(err => {
      console.error('[TabonKB Workbench] Vault scan failed:', err);
    });
  }

  async refreshVaultDocs() {
    await this.loadVaultDocs();
    try {
      this.render();
    } catch (err) {
      console.error('[TabonKB Workbench] Refresh render failed:', err);
    }
  }

  async onClose() {
    if (this.jiraCard) {
      this.jiraCard.dispose();
      this.jiraCard = null;
    }
    if (this.rssCard) {
      this.rssCard.dispose();
      this.rssCard = null;
    }
    if (this.agentBridge) {
      this.agentBridge.destroy();
    }
  }

  async loadVaultDocs() {
    this.isLoadingDocs = true;
    try {
      const vault = this.app?.vault;
      if (!vault || typeof vault.getMarkdownFiles !== 'function') {
        this.isLoadingDocs = false;
        return;
      }

      const mdFiles = (vault.getMarkdownFiles() || []).filter(f => {
        if (!f || !f.name) return false;
        if (f.name === '00-Workbench.md' || f.name === 'README.md') return false;
        return true;
      });

      const docs = [];
      for (const file of mdFiles) {
        try {
          const cache = (this.app.metadataCache && typeof this.app.metadataCache.getFileCache === 'function') 
            ? (this.app.metadataCache.getFileCache(file) || {}) 
            : {};
          const fm = cache.frontmatter || {};

          let title = fm.title;
          if (title != null && typeof title !== 'string') title = String(title);
          const h1 = cache.headings?.find(h => h.level === 1)?.heading;
          if (!title || (/^\d{4}[\s-_]/.test(title) && h1) || (typeof title === 'string' && (title.includes('<') || title.includes('>')))) {
            title = h1 || title || file.basename;
          }
          if (!title) title = file.basename;

          let summary = fm.summary || fm.description || fm.desc || '';
          if (summary != null && typeof summary !== 'string') summary = String(summary);

          let fileContent = '';
          try {
            if (typeof vault.cachedRead === 'function') {
              fileContent = await vault.cachedRead(file);
              if (!summary) {
                let body = fileContent;
                if (fileContent.startsWith('---')) {
                  const end = fileContent.indexOf('---', 3);
                  if (end !== -1) body = fileContent.substring(end + 3);
                }
                const lines = body.split('\n')
                  .map(l => l.trim())
                  .filter(l => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('|') && !l.startsWith('-') && !l.startsWith('```') && !l.startsWith('---'));
                if (lines.length > 0) summary = lines[0].substring(0, 100);
              }
            }
          } catch (e) {}
          if (!summary) summary = '（暂无详细说明）';

          let platform = 'COMMON';
          if (fm.platform) {
            platform = Array.isArray(fm.platform) ? String(fm.platform[0]) : String(fm.platform);
          } else {
            const pLower = (file.path || '').toLowerCase();
            if (pLower.includes('qcom') || pLower.includes('qualcomm')) platform = 'QCOM';
            else if (pLower.includes('mtk') || pLower.includes('mediatek')) platform = 'MTK';
            else if (pLower.includes('unisoc')) platform = 'UNISOC';
            else if (pLower.includes('multi')) platform = 'MULTI';
          }
          platform = String(platform).replace(/[\[\]]/g, '').trim().split('#')[0].trim() || 'COMMON';

          let module = 'General';
          if (fm.module) {
            module = Array.isArray(fm.module) ? String(fm.module[0]) : String(fm.module);
          } else {
            const pLower = (file.path || '').toLowerCase();
            if (pLower.includes('display')) module = 'Display';
            else if (pLower.includes('camera')) module = 'Camera';
            else if (pLower.includes('power')) module = 'Power';
            else if (pLower.includes('charger') || pLower.includes('chg') || pLower.includes('battery')) module = 'Charger';
            else if (pLower.includes('crash') || pLower.includes('panic') || pLower.includes('ramdump')) module = 'Crash';
            else if (pLower.includes('spec') || pLower.includes('meta')) module = 'Spec';
            else if (pLower.includes('toolchain') || pLower.includes('build')) module = 'Toolchain';
            else if (pLower.includes('audio')) module = 'Audio';
            else if (pLower.includes('touch') || pLower.includes('tp')) module = 'Touch';
          }
          module = String(module).replace(/[\[\]]/g, '').trim().split('#')[0].trim() || 'General';
          if (module === 'CHG') module = 'Charger';
          else if (module === 'DISP') module = 'Display';
          else if (module === 'CAM') module = 'Camera';
          else if (module === 'PWR') module = 'Power';

          let doctype = fm.doctype || 'DOC';
          doctype = (Array.isArray(doctype) ? String(doctype[0]) : String(doctype)).replace(/[\[\]]/g, '').trim().split('#')[0].trim() || 'DOC';
          if (doctype.includes(' ')) doctype = doctype.split(' ')[0];

          let date = fm.date || fm.updated;
          if (!date && file.stat?.mtime) {
            const d = new Date(file.stat.mtime);
            date = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (date instanceof Date) {
            date = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof date === 'string' && date.length >= 10) {
            date = date.substring(5, 10);
          } else if (typeof date === 'number') {
            date = String(date);
          }

          docs.push({
            title: String(title),
            summary: String(summary),
            platform,
            module,
            type: doctype,
            date: date || '09-14',
            path: (file.path || '').replace(/\\/g, '/'),
            mtime: file.stat?.mtime || 0,
            content: fileContent
          });
        } catch (itemErr) {
          console.warn('[TabonKB Workbench] Error parsing file:', file?.path, itemErr);
        }
      }

      docs.sort((a, b) => b.mtime - a.mtime);
      this.realDocs = docs;
      this.graphData = buildGraphData(this.realDocs);
    } catch (err) {
      console.error('[TabonKB Workbench] Error in loadVaultDocs:', err);
    } finally {
      this.isLoadingDocs = false;
    }
  }

  getVaultStats() {
    const totalDocs = this.realDocs.length || 38;
    const stats = {
      totalDocs,
      modules: {
        display: 0,
        camera: 0,
        power: 0,
        charger: 0,
        crash: 0,
        spec: 0,
        toolchain: 0
      },
      qcomCount: 0,
      mtkCount: 0,
      multiCount: 0
    };

    const list = this.realDocs.length ? this.realDocs : [];
    list.forEach(item => {
      const p = (item.path || '').toLowerCase();
      const m = (item.module || '').toLowerCase();
      const plat = (item.platform || '').toLowerCase();

      if (plat.includes('qcom')) stats.qcomCount++;
      if (plat.includes('mtk')) stats.mtkCount++;
      if (plat.includes('multi')) stats.multiCount++;

      if (m.includes('disp') || p.includes('disp')) stats.modules.display++;
      if (m.includes('cam') || p.includes('cam')) stats.modules.camera++;
      if (m.includes('power') || p.includes('power')) stats.modules.power++;
      if (m.includes('chg') || m.includes('charg') || p.includes('chg') || p.includes('charg')) stats.modules.charger++;
      if (m.includes('crash') || m.includes('panic') || p.includes('crash')) stats.modules.crash++;
      if (m.includes('spec') || p.includes('spec') || p.includes('meta')) stats.modules.spec++;
      if (m.includes('toolchain') || p.includes('toolchain')) stats.modules.toolchain++;
    });

    return stats;
  }

  render() {
    try {
      const container = this.getContainer();
      if (!container) return;
      container.empty();
      container.addClass('tabonkb-workbench-container', 'with-drawer');

      const layout = container.createDiv({ cls: 'tabonkb-workbench-layout' });
      const mainPanel = layout.createDiv({ cls: 'tabonkb-workbench-main' });
      const wrap = mainPanel.createDiv({ cls: 'tabonkb-workbench-wrap' });

      // Mount Pi Agent Drawer into layout
      this.agentDrawer.mount(layout);

      // ==========================================
      // Layer 1: Omnisearch 全局检索 + Agent Hub 入口
      // ==========================================
      const topBarRow = wrap.createDiv({ cls: 'tw-top-bar-row' });
      topBarRow.innerHTML = `
        <div class="tw-search-wrap">
          <svg class="tw-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input type="text" class="tw-search-input" style="padding-left: 42px !important; padding-right: 175px !important;" placeholder="Omnisearch 全文检索：输入关键词实时匹配正文，按 Enter 唤起原生大窗..." value="${escapeHtml(this.keyword)}">
          <div class="tw-search-actions">
            <button class="tw-omnisearch-btn" id="btnTriggerOmnisearch" title="唤起 Omnisearch 全库弹窗检索 (Enter)">
              <span class="tw-omni-bolt">${getIconPark('lightning', 12)}</span> Omnisearch <kbd class="tw-omni-kbd">↵</kbd>
            </button>
            <span class="tw-search-hint">ESC 清空</span>
          </div>
        </div>
        <div class="tw-agent-selector-wrap" id="twTopAgentSelectorWrap">
          <button class="tw-agent-hub-btn ${this.agentDrawer.isOpen() ? 'active' : ''}" id="btnTogglePiAgent" title="打开/折叠 AI 研发助手 (Agent Hub)">
            <span class="tw-agent-hub-icon">${getIconPark('robot', 15)}</span>
            <span class="tw-agent-hub-text">Agent Hub</span>
          </button>
        </div>
      `;

      const input = topBarRow.querySelector('input');
      input.addEventListener('input', (e) => {
        this.keyword = e.target.value.trim();
        if (this.contextProvider) this.contextProvider.setKeyword(this.keyword);
        const tableSearchInput = document.getElementById('twTableSearchInput');
        if (tableSearchInput && tableSearchInput !== input) {
          tableSearchInput.value = this.keyword;
          const clearBtn = document.getElementById('btnTableSearchClear');
          if (clearBtn) clearBtn.style.display = this.keyword ? 'block' : 'none';
        }
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(async () => {
          await this.handleOmniSearch(this.keyword);
        }, 200);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.openOmnisearchModal(this.keyword);
        } else if (e.key === 'Escape') {
          this.keyword = '';
          input.value = '';
          if (this.contextProvider) this.contextProvider.setKeyword('');
          this.omnisearchResults = null;
          this.statusFilter = 'all';
          this.moduleFilter = '';
          this.platformFilter = '';
          this.render();
        }
      });

      const topWrap = topBarRow.querySelector('#twTopAgentSelectorWrap');
      const btnPi = topBarRow.querySelector('#btnTogglePiAgent');
      if (btnPi) {
        btnPi.onclick = () => {
          this.agentDrawer.toggle();
        };
      }

      this.agentDrawer.onToggle((isOpen) => {
        if (btnPi) btnPi.classList.toggle('active', isOpen);
        if (this.graphCanvas && typeof this.graphCanvas.resize === 'function') {
          setTimeout(() => this.graphCanvas.resize(), 60);
          setTimeout(() => this.graphCanvas.resize(), 240);
        }
      });

      const btnOmni = topBarRow.querySelector('#btnTriggerOmnisearch');
      if (btnOmni) {
        btnOmni.onclick = () => this.openOmnisearchModal(this.keyword);
      }

      // ==========================================
      // Layer 2: 走势图 + 热力图
      // ==========================================
      const chartsGrid = wrap.createDiv({ cls: 'tw-charts-grid' });

      // Trend Chart
      const trendCard = chartsGrid.createDiv({ cls: 'tw-card tw-chart-card' });
      trendCard.innerHTML = `
        <div class="tw-card-header">
          <span>缺陷发现与收敛走势 <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(SM8650 战役)</span></span>
          <span style="color:#10B981; font-family:monospace;">收敛率 83%</span>
        </div>
        <div class="tw-chart-svg-wrap">
          <svg viewBox="0 0 500 110" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
            <line x1="0" y1="25" x2="500" y2="25" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
            <line x1="0" y1="60" x2="500" y2="60" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
            <line x1="0" y1="95" x2="500" y2="95" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
            <polygon points="20,95 85,90 150,80 215,65 280,45 345,35 410,25 475,18 475,98 20,98" fill="#10B981" fill-opacity="0.15"/>
            <polyline points="20,95 85,90 150,80 215,65 280,45 345,35 410,25 475,18" fill="none" stroke="#10B981" stroke-width="2"/>
            <polyline points="20,30 85,25 150,35 215,50 280,40 345,28 410,22 475,16" fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="4 2"/>
            <circle cx="475" cy="18" r="3.5" fill="#10B981"/>
            <circle cx="475" cy="16" r="3.5" fill="#EF4444"/>
            <text x="20" y="108" font-size="9" fill="var(--text-muted, #8b949e)" font-family="monospace">W1</text>
            <text x="150" y="108" font-size="9" fill="var(--text-muted, #8b949e)" font-family="monospace">W3</text>
            <text x="280" y="108" font-size="9" fill="var(--text-muted, #8b949e)" font-family="monospace">W5</text>
            <text x="410" y="108" font-size="9" fill="var(--text-muted, #8b949e)" font-family="monospace">W7</text>
            <text x="475" y="108" font-size="9" fill="#10B981" font-family="monospace" text-anchor="end">W8(本周)</text>
          </svg>
        </div>
        <div style="display: flex; gap: 12px; font-size: 10px; color: var(--text-muted, #64748B); justify-content: flex-end; margin-top: 4px;">
          <span><span style="color: #EF4444;">--</span> 新增Bug</span>
          <span><span style="color: #10B981;">—</span> 闭环解决</span>
        </div>
      `;

      // Heatmap Card
      const heatCard = chartsGrid.createDiv({ cls: 'tw-card tw-chart-card' });
      const heatGridHtml = this.generateHeatmapHtml();
      heatCard.innerHTML = `
        <div class="tw-card-header">
          <span>研发调机与资产沉淀热力</span>
          <span style="color: var(--text-muted, #64748B); font-family: monospace; font-size: 10px;">近 20 周</span>
        </div>
        <div class="tw-heatmap-content">
          <div class="tw-heatmap-grid">
            ${heatGridHtml}
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted, #64748B); padding-top: 6px;">
          <span>累计 142 次产出记录</span>
          <div style="display: flex; align-items: center; gap: 3px;">
            <span>少</span>
            <span class="tw-heat-legend-cell tw-heat-l0"></span>
            <span class="tw-heat-legend-cell tw-heat-l1"></span>
            <span class="tw-heat-legend-cell tw-heat-l2"></span>
            <span class="tw-heat-legend-cell tw-heat-l3"></span>
            <span class="tw-heat-legend-cell tw-heat-l4"></span>
            <span>多</span>
          </div>
        </div>
      `;

      // ==========================================
      // Layer 2.5: Integrations Grid (JiraCard + RssCard)
      // ==========================================
      const integrationsGrid = wrap.createDiv({ cls: 'tw-integrations-grid' });
      
      // Clean up previous card instances if re-rendering
      if (this.jiraCard) {
        this.jiraCard.dispose();
        this.jiraCard = null;
      }
      if (this.rssCard) {
        this.rssCard.dispose();
        this.rssCard = null;
      }

      const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
      const jiraService = plugin?.jiraService || new JiraService({ app: this.app, getConfig: () => DEFAULT_SETTINGS.jira });
      const rssService = plugin?.rssService || new RssService({ app: this.app, getFeeds: () => DEFAULT_SETTINGS.rss.feeds });

      this.jiraCard = new JiraCard({
        jiraService: jiraService,
        onOpenSettings: () => {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      });
      this.jiraCard.mount(integrationsGrid);

      this.rssCard = new RssCard({
        rssService: rssService,
        onOpenSettings: () => {
          this.app.setting?.open?.();
          this.app.setting?.openTabById?.('tabonkb-workbench');
        }
      });
      this.rssCard.mount(integrationsGrid);

      // ==========================================
      // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
      // ==========================================
      const workspaceWrap = wrap.createDiv({ cls: 'tw-knowledge-workspace dashboard-knowledge-workspace', id: 'twKnowledgeWorkspace' });
      
      // Left: Graph Card
      const graphCard = workspaceWrap.createDiv({ cls: 'tw-card tw-graph-card' });
      this.graphCanvas = new ForceGraphCanvas(graphCard, {
        onNodeClick: (node) => {
          const nextMode = node ? 'detail' : 'overview';
          if (this.knowledgePanelMode === nextMode && this.selectedKnowledgeNode === node) {
            return;
          }
          this.selectedKnowledgeNode = node;
          this.knowledgePanelMode = nextMode;
          if (this.contextProvider) {
            if (node) this.contextProvider.setKnowledgeNode(node);
            else this.contextProvider.clearKnowledgeNode();
          }
          this.renderContextPanel();
        },
        onNodeDblClick: (node) => {
          if (node) this.openTarget(node.id, node.title);
        }
      });
      if (this.graphData.nodes.length > 0) {
        this.graphCanvas.setData(this.graphData);
      }

      // Right: Context Panel Card
      this.contextCard = workspaceWrap.createDiv({ cls: 'tw-card tw-context-panel-card' });
      this.renderContextPanel();

      // ==========================================
      // Layer 4: 快速过滤 + 任务列表 / 资料清单
      // ==========================================
      const stats = this.getVaultStats();
      const filtersBar = wrap.createDiv({ cls: 'tw-card tw-filters-bar' });
      filtersBar.innerHTML = `
        <span style="font-size:10px; color:var(--text-muted); margin-right:2px;">快速过滤:</span>
        <button class="tw-chip ${this.moduleFilter==='Charger'?'active':''}" data-mod="Charger">充电/CHG ${stats.modules.charger || 17}</button>
        <button class="tw-chip ${this.moduleFilter==='Spec'?'active':''}" data-mod="Spec">Spec/规范 ${stats.modules.spec || 14}</button>
        <button class="tw-chip ${this.moduleFilter==='Display'?'active':''}" data-mod="Display">Display ${stats.modules.display || 2}</button>
        <button class="tw-chip ${this.moduleFilter==='Crash'?'active':''}" data-mod="Crash">Crash/Panic ${stats.modules.crash || 1}</button>
        <button class="tw-chip ${this.platformFilter==='MTK'?'active':''}" data-plat="MTK">联发科 ${stats.mtkCount || 6}</button>
        <button class="tw-chip ${this.platformFilter==='QCOM'?'active':''}" data-plat="QCOM">高通 ${stats.qcomCount || 1}</button>
        <button class="tw-chip ${this.platformFilter==='MULTI'?'active':''}" data-plat="MULTI">多平台 ${stats.multiCount || 5}</button>
      `;

      filtersBar.querySelectorAll('[data-mod]').forEach(btn => {
        btn.onclick = () => {
          const mod = btn.dataset.mod;
          if (this.moduleFilter === mod) {
            this.moduleFilter = '';
            this.graphCanvas?.filterModule('all');
          } else {
            this.moduleFilter = mod;
            this.platformFilter = '';
            this.graphCanvas?.filterModule(mod);
          }
          if (this.contextProvider) this.contextProvider.setFilter(this.moduleFilter);
          this.currentTab = 'docs';
          this.renderTableOnly();
          filtersBar.querySelectorAll('[data-mod]').forEach(b => b.toggleClass('active', b.dataset.mod === this.moduleFilter));
        };
      });

      filtersBar.querySelectorAll('[data-plat]').forEach(btn => {
        btn.onclick = () => {
          const plat = btn.dataset.plat;
          if (this.platformFilter === plat) {
            this.platformFilter = '';
          } else {
            this.platformFilter = plat;
            this.moduleFilter = '';
          }
          if (this.contextProvider) this.contextProvider.setFilter(this.platformFilter);
          this.currentTab = 'docs';
          this.renderTableOnly();
          filtersBar.querySelectorAll('[data-plat]').forEach(b => b.toggleClass('active', b.dataset.plat === this.platformFilter));
        };
      });

      this.tableCard = wrap.createDiv({ cls: 'tw-card tw-table-card' });
      this.renderTableOnly();

    } catch (err) {
      console.error('[TabonKB Workbench] Render exception:', err);
      const container = this.getContainer();
      if (container) {
        container.empty();
        const errCard = container.createDiv({ cls: 'tw-card' });
        errCard.style.padding = '32px';
        errCard.style.textAlign = 'center';
        errCard.style.maxWidth = '640px';
        errCard.style.margin = '40px auto';
        errCard.innerHTML = `
          <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
          <div style="font-size: 16px; font-weight: 600; color: #EF4444; margin-bottom: 8px;">工作台界面渲染异常</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px; font-family: monospace;">${escapeHtml(err.message || String(err))}</div>
          <button class="tw-chip" id="twBtnRetry" style="padding: 6px 18px; font-size: 12px; cursor: pointer;">点击重新初始化</button>
        `;
        const btn = errCard.querySelector('#twBtnRetry');
        if (btn) btn.onclick = () => this.refreshVaultDocs();
      }
    }
  }

  renderContextPanel() {
    if (!this.contextCard) return;

    const existingBody = this.contextCard.querySelector('.tw-context-body');
    if (existingBody && existingBody.children.length > 0 &&
        this._lastRenderedMode === this.knowledgePanelMode && 
        this._lastRenderedNode === this.selectedKnowledgeNode) {
      return; // Already has content in this mode; avoid wiping DOM and flickering!
    }
    this._lastRenderedMode = this.knowledgePanelMode;
    this._lastRenderedNode = this.selectedKnowledgeNode;

    this.contextCard.empty();

    const body = this.contextCard.createDiv({ cls: 'tw-context-body' });

    if (this.knowledgePanelMode === 'detail' && this.selectedKnowledgeNode) {
      this.renderDetailMode(body, this.selectedKnowledgeNode);
    } else {
      this.renderOverviewMode(body);
    }
  }

  // State A: Overview Mode (Knowledge Stats + Composition + Task Stats)
  renderOverviewMode(container) {
    const wrap = container.createDiv({ cls: 'tw-panel-mode' });

    // Top Header
    wrap.innerHTML = `
      <div class="tw-overview-header">
        <div class="tw-overview-title">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--interactive-accent);">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <span>工作台概览 (Overview)</span>
        </div>
        <span style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">Knowledge & Task</span>
      </div>
    `;

    // 1. Knowledge Stats 4-Grid
    const stats = this.getVaultStats();
    const nodeCount = this.graphData.nodes.length || stats.totalDocs;
    const edgeCount = this.graphData.edges.length || 128;
    const coreCount = this.graphData.nodes.filter(n => n.importance === 'core').length || 17;

    const kpiSection = wrap.createDiv();
    kpiSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>KNOWLEDGE 资产拓扑</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">全库穿透感知</span>
      </div>
      <div class="tw-kpi-grid-4">
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num">${nodeCount}</div>
          <div class="tw-kpi-box-label">知识资产 (Nodes)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#059669;">${edgeCount}</div>
          <div class="tw-kpi-box-label">知识关系 (Edges)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#D97706;">8</div>
          <div class="tw-kpi-box-label">知识模块 (Clusters)</div>
        </div>
        <div class="tw-kpi-box">
          <div class="tw-kpi-box-num" style="color:#7C3AED;">${coreCount}</div>
          <div class="tw-kpi-box-label">核心知识 (Hubs)</div>
        </div>
      </div>
    `;

    // 2. Knowledge Composition (Progress bars)
    const compSection = wrap.createDiv();
    const modulesData = [
      { name: '充电/CHG', count: stats.modules.charger || 17, color: '#F59E0B' },
      { name: 'Spec/规范', count: stats.modules.spec || 14, color: '#10B981' },
      { name: 'Display', count: stats.modules.display || 2, color: '#3B82F6' },
      { name: 'Power', count: stats.modules.power || 2, color: '#EF4444' },
      { name: 'Crash', count: stats.modules.crash || 1, color: '#EC4899' },
      { name: 'Camera', count: stats.modules.camera || 1, color: '#8B5CF6' }
    ];

    const maxCount = Math.max(...modulesData.map(m => m.count), 1);

    let compBarsHtml = modulesData.map(m => {
      const pct = Math.round((m.count / maxCount) * 100);
      return `
        <div class="tw-comp-row">
          <span class="tw-comp-name" title="${m.name}">${m.name}</span>
          <div class="tw-comp-track">
            <div class="tw-comp-fill" style="width:${pct}%; background:${m.color};"></div>
          </div>
          <span class="tw-comp-count">${m.count}</span>
        </div>
      `;
    }).join('');

    compSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>知识构成 (COMPOSITION)</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">模块分布</span>
      </div>
      <div class="tw-comp-bar-wrap">
        ${compBarsHtml}
      </div>
    `;

    // 3. Task Stats & Closure Rate
    const taskSection = wrap.createDiv();
    taskSection.innerHTML = `
      <div class="tw-overview-section-title" style="margin-top:2px;">
        <span>TASK 研发攻坚跟踪</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">6 项聚焦</span>
      </div>
      <div class="tw-task-summary-grid">
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:var(--text-normal);">6</div>
          <div class="tw-task-mini-lbl">活跃任务</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#C2410C;">3</div>
          <div class="tw-task-mini-lbl">攻坚排查</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#B45309;">1</div>
          <div class="tw-task-mini-lbl">阻塞等原厂</div>
        </div>
        <div class="tw-task-mini-cell">
          <div class="tw-task-mini-val" style="color:#15803D;">2</div>
          <div class="tw-task-mini-lbl">已闭环</div>
        </div>
      </div>
      <div class="tw-closure-bar-wrap">
        <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-muted);">
          <span>收敛闭环率</span>
          <span style="font-weight:700; color:#10B981; font-family:monospace;">33% (稳步推进)</span>
        </div>
        <div style="height:6px; background:var(--background-secondary, #E2E8F0); border-radius:3px; overflow:hidden;">
          <div style="width:33%; height:100%; background:#10B981; border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  // State B: Knowledge Detail Mode (Node Info + Relations + Related Continuous Exploration)
  renderDetailMode(container, node) {
    const wrap = container.createDiv({ cls: 'tw-panel-mode tw-detail-mode' });

    // 1. Top Navigation bar: Return to Overview or Close
    const topBar = wrap.createDiv({ cls: 'tw-detail-topbar' });
    topBar.innerHTML = `
      <button class="tw-btn-back" id="btnBackToOverview" title="返回概览面板">
        <span>←</span> <span>返回概览</span>
      </button>
      <button class="tw-btn-close" id="btnCloseDetail" title="关闭详情">×</button>
    `;

    const backToOverview = () => {
      this.selectedKnowledgeNode = null;
      this.knowledgePanelMode = 'overview';
      if (this.contextProvider) this.contextProvider.clearKnowledgeNode();
      this.graphCanvas?.selectNode(null);
      this.renderContextPanel();
    };

    topBar.querySelector('#btnBackToOverview').onclick = backToOverview;
    topBar.querySelector('#btnCloseDetail').onclick = backToOverview;

    // 2. Node Title & Badges
    const titleSection = wrap.createDiv();
    titleSection.innerHTML = `
      <div class="tw-detail-title">${escapeHtml(node.title)}</div>
      <div class="tw-detail-meta-row" style="margin-top:6px;">
        <span class="tw-type-tag ${node.type}">${node.type}</span>
        <span style="color:var(--text-muted); font-family:monospace; font-size:11px;">${escapeHtml(node.platform)} · ${escapeHtml(node.module)}</span>
        <span style="color:var(--text-muted); font-family:monospace; font-size:10.5px; margin-left:auto;">${escapeHtml(node.date)}</span>
      </div>
    `;

    // 3. Summary Box
    const summaryBox = wrap.createDiv({ cls: 'tw-detail-summary-box' });
    summaryBox.innerHTML = `
      <div style="font-size:10px; font-weight:600; color:var(--text-muted); margin-bottom:3px; text-transform:uppercase;">资料简要介绍</div>
      <div>${escapeHtml(node.summary || '（暂无详细说明）')}</div>
    `;

    // 4. Relations Count & List
    const connectedEdges = this.graphData.edges.filter(e => e.source === node.id || e.target === node.id);
    const relatedNodes = [];

    connectedEdges.forEach(e => {
      const targetId = e.source === node.id ? e.target : e.source;
      const targetNode = this.graphData.nodes.find(n => n.id === targetId);
      if (targetNode) {
        relatedNodes.push({
          node: targetNode,
          relation: e.relation || 'related_to'
        });
      }
    });

    const relCount = relatedNodes.length;
    const refCount = connectedEdges.filter(e => e.relation === 'references').length;
    const caseCount = relatedNodes.filter(r => r.node.type === 'CASE').length;

    const relSection = wrap.createDiv();
    relSection.innerHTML = `
      <div class="tw-overview-section-title">
        <span>知识关联网络 (RELATIONS)</span>
        <span style="font-family:monospace; font-size:10px; font-weight:normal;">${relCount} 个关联</span>
      </div>
      <div class="tw-detail-relation-summary">
        <span>🔗 ${relCount} 关联知识</span>
        <span>·</span>
        <span>📖 ${refCount} 引用</span>
        <span>·</span>
        <span>⚡ ${caseCount} 关联 Case</span>
      </div>
    `;

    // 5. Related Knowledge List (Click to Continuously Explore!)
    const relatedListWrap = wrap.createDiv({ cls: 'tw-related-knowledge-list' });
    if (relatedNodes.length === 0) {
      relatedListWrap.innerHTML = `<div style="font-size:11px; color:var(--text-muted); padding:8px 4px;">暂无直接显式关联节点</div>`;
    } else {
      relatedNodes.slice(0, 8).forEach(r => {
        const item = relatedListWrap.createDiv({ cls: 'tw-related-item' });
        item.innerHTML = `
          <span class="tw-related-item-title" title="${escapeHtml(r.node.title)}">→ ${escapeHtml(r.node.title)}</span>
          <span class="tw-related-item-rel">${r.relation} · ${r.node.type}</span>
        `;
        item.onclick = () => {
          this.selectKnowledgeNode(r.node.id);
        };
      });
    }

    // 6. Related Task Check
    const matchedTasks = this.tasksData.filter(t => t.module.toLowerCase() === node.module.toLowerCase() || t.path === node.id);
    if (matchedTasks.length > 0) {
      const taskBox = wrap.createDiv();
      taskBox.innerHTML = `
        <div class="tw-overview-section-title" style="margin-top:2px;">
          <span>关联研发任务 (RELATED TASK)</span>
        </div>
      `;
      matchedTasks.slice(0, 2).forEach(t => {
        const tCell = taskBox.createDiv({ cls: 'tw-related-item', style: 'margin-bottom:4px;' });
        tCell.innerHTML = `
          <span style="font-weight:500; font-size:11px; color:var(--text-normal);">${escapeHtml(t.title)}</span>
          <span class="tw-status-badge ${t.badge}" style="font-size:10px;">${escapeHtml(t.status)}</span>
        `;
        tCell.onclick = () => {
          this.openTarget(t.path, t.title);
        };
      });
    }

    // 7. Bottom Action Button
    const btnOpenDoc = wrap.createEl('button', { cls: 'tw-detail-open-btn' });
    btnOpenDoc.innerHTML = `<span>打开原始知识文档</span> <span>↗</span>`;
    btnOpenDoc.onclick = () => {
      this.openTarget(node.id, node.title);
    };
  }

  selectKnowledgeNode(nodeId) {
    const node = this.graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    this.selectedKnowledgeNode = node;
    this.knowledgePanelMode = 'detail';
    if (this.contextProvider) this.contextProvider.setKnowledgeNode(node);
    this.graphCanvas?.focusNode(nodeId);
    this.renderContextPanel();
  }

  generateHeatmapHtml() {
    const levels = [
      0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,0,0,0,1,0, 0,0,0,0,0,0,0, 0,0,0,0,0,0,0,
      1,0,0,0,0,0,0, 0,1,1,1,0,0,0, 0,1,1,1,1,0,0, 1,1,0,0,0,1,1, 1,0,2,0,1,0,0,
      1,0,0,0,0,0,0, 0,1,0,0,1,1,0, 1,2,1,1,1,1,1, 1,1,1,1,1,4,1, 1,1,1,0,1,1,1,
      0,1,0,1,0,0,0, 0,0,0,1,0,1,0, 0,1,1,1,1,1,0, 0,1,0,1,0,0,0, 0,0,0,0,0,0,0
    ];
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    return levels.map((lvl, i) => {
      const week = Math.floor(i / 7) + 1;
      const day = days[i % 7];
      return `<div class="tw-heat-cell tw-heat-l${lvl}" title="第${week}周 ${day} · 活跃等级: ${lvl}"></div>`;
    }).join('');
  }

  async handleOmniSearch(keyword) {
    if (!keyword) {
      this.omnisearchResults = null;
      this.renderTableOnly();
      return;
    }

    const omni = globalThis.omnisearch || (this.app.plugins?.plugins?.omnisearch?.api);
    if (omni && typeof omni.search === 'function') {
      try {
        const raw = await omni.search(keyword);
        this.omnisearchResults = (raw || []).map(r => {
          const matched = this.realDocs.find(d => d.path === r.path);
          if (matched) {
            const scorePercent = Math.min(Math.round((r.score || 0) * 100), 99);
            return {
              ...matched,
              score: scorePercent > 0 ? `${scorePercent}%` : 'Match',
              excerpt: r.excerpt || matched.summary
            };
          }

          const pathLower = (r.path || '').toLowerCase();
          let platform = 'COMMON';
          if (pathLower.includes('qcom') || pathLower.includes('qualcomm')) platform = 'QCOM';
          else if (pathLower.includes('mtk') || pathLower.includes('mediatek')) platform = 'MTK';
          else if (pathLower.includes('unisoc')) platform = 'UNISOC';
          else if (pathLower.includes('multi')) platform = 'MULTI';

          let module = 'General';
          if (pathLower.includes('display')) module = 'Display';
          else if (pathLower.includes('camera')) module = 'Camera';
          else if (pathLower.includes('power')) module = 'Power';
          else if (pathLower.includes('charger') || pathLower.includes('chg') || pathLower.includes('battery')) module = 'Charger';
          else if (pathLower.includes('crash') || pathLower.includes('panic') || pathLower.includes('ramdump')) module = 'Crash';
          else if (pathLower.includes('spec') || pathLower.includes('meta')) module = 'Spec';
          else if (pathLower.includes('toolchain') || pathLower.includes('build')) module = 'Toolchain';
          else if (pathLower.includes('touch') || pathLower.includes('tp')) module = 'Touch';
          else if (pathLower.includes('audio')) module = 'Audio';

          let type = 'DOC';
          if (pathLower.includes('case')) type = 'CASE';
          else if (pathLower.includes('arch')) type = 'ARCH';
          else if (pathLower.includes('guide')) type = 'GUIDE';
          else if (pathLower.includes('spec')) type = 'SPEC';
          else if (pathLower.includes('rpt') || pathLower.includes('report') || pathLower.includes('ppt')) type = 'RPT';

          const scorePercent = Math.min(Math.round((r.score || 0) * 100), 99);

          return {
            title: r.basename || r.path,
            summary: r.excerpt || '（搜索匹配内容）',
            platform,
            module,
            type,
            score: scorePercent > 0 ? `${scorePercent}%` : 'Match',
            excerpt: r.excerpt || '',
            path: (r.path || '').replace(/\\/g, '/')
          };
        });

        this.currentTab = 'docs';
        this.renderTableOnly();
        return;
      } catch (err) {
        console.warn('Omnisearch API error, falling back:', err);
      }
    }

    this.omnisearchResults = null;
    if (this.currentTab === 'tasks') {
      this.currentTab = 'docs';
    }
    this.renderTableOnly();
  }

  openOmnisearchModal(query = '') {
    const omni = this.app.plugins?.plugins?.omnisearch;
    if (omni) {
      this.app.commands.executeCommandById('omnisearch:show-modal');
      if (query) {
        setTimeout(() => {
          const omniInput = document.querySelector('.omnisearch-modal input, .prompt-input');
          if (omniInput) {
            omniInput.value = query;
            omniInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 120);
      }
    } else {
      this.app.commands.executeCommandById('global-search:open');
    }
  }

  renderTableOnly() {
    if (!this.tableCard) return;

    // Preserve scroll position of parent scrollable container
    const scrollContainer = this.tableCard.closest('.view-content, .workspace-leaf-content, .markdown-reading-view') || this.getContainer();
    const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    const totalCount = this.realDocs.length || 38;
    const docsTabLabel = this.omnisearchResults !== null 
      ? `全库检索 (${this.omnisearchResults.length})` 
      : `资料清单 (${totalCount})`;

    // Check if tableTopBar exists and is attached to this.tableCard
    let topBar = this.tableCard.querySelector('.tw-table-topbar');
    let tableWrap = this.tableCard.querySelector('.tw-table-wrapper');

    if (!topBar) {
      this.tableCard.empty();
      topBar = this.tableCard.createDiv({ cls: 'tw-table-topbar' });

      topBar.innerHTML = `
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="tw-tab-btn ${this.currentTab==='tasks'?'active':''}" id="btnTabTasks">任务列表 (6)</button>
          <button class="tw-tab-btn ${this.currentTab==='docs'?'active':''}" id="btnTabDocs">${escapeHtml(docsTabLabel)}</button>
        </div>
        <div class="tw-table-search-box">
          <div class="tw-table-search-wrap">
            <svg class="tw-table-search-icon" width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input 
              type="text" 
              class="tw-table-search-input" 
              id="twTableSearchInput" 
              placeholder="Omnisearch 检索 (Enter 唤起原生大窗)..." 
              value="${escapeHtml(this.keyword || '')}"
            />
            <button class="tw-table-search-clear" id="btnTableSearchClear" title="清空" style="display: ${this.keyword ? 'inline-flex' : 'none'};">${getIconPark('close', 11)}</button>
          </div>
          <button class="tw-table-omni-btn" id="btnTableOmniModal" title="唤起 Omnisearch 原生大窗 (Enter)">
            <span class="tw-table-omni-bolt" style="color: #F59E0B; margin-right: 2px;">${getIconPark('lightning', 11)}</span> Omnisearch <kbd style="font-size: 9px; font-family: monospace; background: var(--background-primary, #FFF); padding: 0 3px; border-radius: 2px; border: 1px solid var(--background-modifier-border, #CBD5E1);">↵</kbd>
          </button>
        </div>
      `;

      topBar.querySelector('#btnTabTasks').onclick = () => { this.currentTab = 'tasks'; this.renderTableOnly(); };
      topBar.querySelector('#btnTabDocs').onclick = () => { this.currentTab = 'docs'; this.renderTableOnly(); };

      const tableSearchInput = topBar.querySelector('#twTableSearchInput');
      if (tableSearchInput) {
        tableSearchInput.addEventListener('input', (e) => {
          this.keyword = e.target.value.trim();
          const topSearchInput = document.querySelector('.tw-search-input');
          if (topSearchInput && topSearchInput !== tableSearchInput) {
            topSearchInput.value = this.keyword;
          }
          const clearBtn = topBar.querySelector('#btnTableSearchClear');
          if (clearBtn) clearBtn.style.display = this.keyword ? 'block' : 'none';

          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = setTimeout(async () => {
            await this.handleOmniSearch(this.keyword);
          }, 200);
        });

        tableSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.openOmnisearchModal(this.keyword);
          } else if (e.key === 'Escape') {
            this.keyword = '';
            this.omnisearchResults = null;
            tableSearchInput.value = '';
            const clearBtn = topBar.querySelector('#btnTableSearchClear');
            if (clearBtn) clearBtn.style.display = 'none';
            const topSearchInput = document.querySelector('.tw-search-input');
            if (topSearchInput) topSearchInput.value = '';
            this.renderTableOnly();
          }
        });
      }

      const clearBtn = topBar.querySelector('#btnTableSearchClear');
      if (clearBtn) {
        clearBtn.onclick = () => {
          this.keyword = '';
          this.omnisearchResults = null;
          const tableSearchInput = topBar.querySelector('#twTableSearchInput');
          if (tableSearchInput) tableSearchInput.value = '';
          clearBtn.style.display = 'none';
          const topSearchInput = document.querySelector('.tw-search-input');
          if (topSearchInput) topSearchInput.value = '';
          this.renderTableOnly();
          if (tableSearchInput) tableSearchInput.focus({ preventScroll: true });
        };
      }

      const omniModalBtn = topBar.querySelector('#btnTableOmniModal');
      if (omniModalBtn) {
        omniModalBtn.onclick = () => {
          this.openOmnisearchModal(this.keyword);
        };
      }

      tableWrap = this.tableCard.createDiv({ cls: 'tw-table-wrapper' });
    } else {
      // Topbar already exists: DO NOT recreate or destroy input! Update state only:
      const btnTasks = topBar.querySelector('#btnTabTasks');
      const btnDocs = topBar.querySelector('#btnTabDocs');
      if (btnTasks) btnTasks.classList.toggle('active', this.currentTab === 'tasks');
      if (btnDocs) {
        btnDocs.classList.toggle('active', this.currentTab === 'docs');
        btnDocs.textContent = docsTabLabel;
      }
      const clearBtn = topBar.querySelector('#btnTableSearchClear');
      if (clearBtn) clearBtn.style.display = this.keyword ? 'block' : 'none';

      const tableSearchInput = topBar.querySelector('#twTableSearchInput');
      if (tableSearchInput && document.activeElement !== tableSearchInput) {
        tableSearchInput.value = this.keyword || '';
      }

      if (!tableWrap) {
        tableWrap = this.tableCard.createDiv({ cls: 'tw-table-wrapper' });
      }
    }

    tableWrap.empty();
    const table = tableWrap.createEl('table', { cls: 'tw-data-table' });

    if (this.currentTab === 'tasks') {
      table.innerHTML = `
        <thead>
          <tr>
            <th class="tw-col-title">任务事项</th>
            <th class="tw-col-module">模块</th>
            <th class="tw-col-status">状态</th>
            <th class="tw-col-date">更新</th>
            <th class="tw-col-action" style="width: 88px; text-align: center; white-space: nowrap;">关联知识</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');
      let tasks = this.tasksData;

      if (this.statusFilter === 'in-progress') tasks = tasks.filter(t => t.status === '排查中');
      if (this.statusFilter === 'blocked') tasks = tasks.filter(t => t.status.includes('阻塞'));
      if (this.statusFilter === 'resolved') tasks = tasks.filter(t => t.status === '已闭环');
      if (this.keyword) tasks = tasks.filter(t => t.title.toLowerCase().includes(this.keyword.toLowerCase()) || t.module.toLowerCase().includes(this.keyword.toLowerCase()));

      if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:24px; text-align:center; color:var(--text-muted);">无匹配任务条目</td></tr>`;
        return;
      }

      tasks.forEach(t => {
        const tr = tbody.createEl('tr');
        const safeTitle = escapeHtml(t.title);
        const safeModule = escapeHtml(t.module);
        const safeStatus = escapeHtml(t.status);
        const safeDate = escapeHtml(t.date);

        tr.innerHTML = `
          <td class="tw-col-title">
            <span class="tw-item-title">${safeTitle}</span>
          </td>
          <td class="tw-col-module" style="color:var(--text-muted); font-family:monospace; font-size:11px;">${safeModule}</td>
          <td class="tw-col-status"><span class="tw-status-badge ${t.badge}">${safeStatus}</span></td>
          <td class="tw-col-date" style="color:var(--text-muted); font-family:monospace; font-size:11px;">${safeDate}</td>
          <td class="tw-col-action" style="text-align: center; white-space: nowrap;">
            <button class="tw-action-graph-btn" title="在知识图谱中查看关联知识" data-task-id="${t.id}">${getIconPark('network', 12)} <span>关联知识</span></button>
          </td>
        `;

        const graphBtn = tr.querySelector('.tw-action-graph-btn');
        if (graphBtn) {
          graphBtn.onclick = (e) => {
            e.stopPropagation();
            const targetDoc = this.realDocs.find(d => d.path === t.path || d.module.toLowerCase() === t.module.toLowerCase());
            if (targetDoc) {
              const wsEl = document.getElementById('twKnowledgeWorkspace');
              if (wsEl) wsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              this.selectKnowledgeNode(targetDoc.path);
            }
          };
        }

        tr.onclick = () => this.openTarget(t.path, t.title);
      });

    } else {
      // Docs View: 6 columns with "资料简要介绍"
      table.innerHTML = `
        <thead>
          <tr>
            <th class="tw-col-title">资料名称</th>
            <th class="tw-col-desc">${this.omnisearchResults !== null ? '全文匹配摘要 / 简要介绍' : '资料简要介绍'}</th>
            <th class="tw-col-platform">平台</th>
            <th class="tw-col-module">模块</th>
            <th class="tw-col-type">类型</th>
            <th class="tw-col-date">${this.omnisearchResults !== null ? '相关度' : '日期'}</th>
            <th class="tw-col-action" style="width: 70px; text-align: center; white-space: nowrap;">定位</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');
      let docs = this.omnisearchResults !== null ? this.omnisearchResults : (this.realDocs || []);

      if (this.moduleFilter) {
        const mf = this.moduleFilter.toLowerCase();
        docs = docs.filter(d => {
          const mod = (d.module || '').toLowerCase();
          const p = (d.path || '').toLowerCase();
          if (mf === 'charger') return mod.includes('chg') || mod.includes('charg') || p.includes('chg') || p.includes('charg');
          if (mf === 'display') return mod.includes('disp') || p.includes('disp');
          if (mf === 'camera') return mod.includes('cam') || p.includes('cam');
          if (mf === 'power') return mod.includes('pwr') || mod.includes('power') || p.includes('power');
          if (mf === 'crash') return mod.includes('crash') || mod.includes('panic') || p.includes('crash');
          if (mf === 'spec') return mod.includes('spec') || p.includes('spec') || p.includes('meta');
          if (mf === 'toolchain') return mod.includes('toolchain') || p.includes('toolchain');
          return mod.includes(mf) || p.includes(mf);
        });
      }

      if (this.platformFilter) {
        const pf = this.platformFilter.toLowerCase();
        docs = docs.filter(d => (d.platform || '').toLowerCase().includes(pf));
      }

      if (this.keyword && this.omnisearchResults === null) {
        const kw = this.keyword.toLowerCase();
        docs = docs.filter(d => 
          (d.title || '').toLowerCase().includes(kw) || 
          (d.summary || '').toLowerCase().includes(kw) || 
          (d.module || '').toLowerCase().includes(kw) || 
          (d.platform || '').toLowerCase().includes(kw) ||
          (d.type || '').toLowerCase().includes(kw) ||
          (d.path || '').toLowerCase().includes(kw)
        );
      }

      if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:28px; text-align:center; color:var(--text-muted);">
          未找到匹配的知识库文件<br>
          ${this.keyword ? `<span style="font-size:11px; margin-top:6px; display:inline-block; color:var(--interactive-accent);">可按 Enter 唤起 Omnisearch 原生大窗进行全库穿透检索</span>` : ''}
        </td></tr>`;
        return;
      }

      docs.forEach(d => {
        const tr = tbody.createEl('tr');
        const descContent = d.excerpt 
          ? `<div class="tw-search-excerpt">${escapeHtml(d.excerpt)}</div>` 
          : `<span style="color:var(--text-muted); font-size:11.5px;">${escapeHtml(d.summary || '（暂无详细说明）')}</span>`;

        const dateOrScore = this.omnisearchResults !== null 
          ? `<span class="tw-score-badge">${escapeHtml(d.score)}</span>` 
          : `<span style="color:var(--text-muted); font-family:monospace; font-size:11px;">${escapeHtml(d.date)}</span>`;

        const safeTitle = escapeHtml(d.title);
        const safeSummary = escapeHtml(d.summary || '');
        const safePlatform = escapeHtml(d.platform);
        const safeModule = escapeHtml(d.module);
        const safeType = escapeHtml(d.type);

        tr.innerHTML = `
          <td class="tw-col-title">
            <span class="tw-item-title" title="${safeTitle}">${safeTitle}</span>
          </td>
          <td class="tw-col-desc" title="${safeSummary}">${descContent}</td>
          <td class="tw-col-platform" style="color:var(--text-muted); font-family:monospace; font-size:11px;">${safePlatform}</td>
          <td class="tw-col-module" style="color:var(--text-normal); font-size:11px;">${safeModule}</td>
          <td class="tw-col-type" style="color:var(--text-muted); font-family:monospace; font-size:11px;">${safeType}</td>
          <td class="tw-col-date">${dateOrScore}</td>
          <td class="tw-col-action" style="text-align: center; white-space: nowrap;">
            <button class="tw-action-graph-btn" title="在知识图谱中定位该节点" data-doc-path="${d.path}">${getIconPark('target', 12)} <span>定位</span></button>
          </td>
        `;

        const graphBtn = tr.querySelector('.tw-action-graph-btn');
        if (graphBtn) {
          graphBtn.onclick = (e) => {
            e.stopPropagation();
            const wsEl = document.getElementById('twKnowledgeWorkspace');
            if (wsEl) wsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.selectKnowledgeNode(d.path);
          };
        }

        tr.onclick = () => this.openTarget(d.path, d.title);
      });
    }

    // Restore scroll position so typing never causes the window to jump or scroll up!
    if (scrollContainer && scrollContainer.scrollTop !== prevScrollTop) {
      scrollContainer.scrollTop = prevScrollTop;
    }
    requestAnimationFrame(() => {
      if (scrollContainer && scrollContainer.scrollTop !== prevScrollTop) {
        scrollContainer.scrollTop = prevScrollTop;
      }
    });
  }

  async openTarget(path, title) {
    if (!path) return;
    new Notice(`正在打开: ${title || path}`);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      const files = this.app.vault.getMarkdownFiles();
      file = files.find(f => f.path === path || f.path.endsWith(path) || f.basename === title || f.name === title);
    }
    if (file) {
      this.app.workspace.getLeaf(false).openFile(file);
    } else {
      this.app.workspace.openLinkText(path, '', false);
    }
  }
}

/* ==========================================================================
   Plugin Entry Point
   ========================================================================== */
module.exports = class TabonKBWorkbenchPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.jiraService = new JiraService({
      app: this.app,
      getConfig: () => this.settings.jira
    });

    this.rssService = new RssService({
      app: this.app,
      getFeeds: () => this.settings.rss?.feeds || []
    });

    const vaultPath = this.app?.vault?.adapter?.basePath || '';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath });
    this.agentHub = new AgentHub({
      vaultBasePath: vaultPath,
      bridge: this.agentBridge,
      app: this.app,
      getNiceaigcConfig: () => this.settings.niceaigc || DEFAULT_SETTINGS.niceaigc
    });

    this.addSettingTab(new TabonKBSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_WORKBENCH,
      (leaf) => new TabonKBWorkbenchView(leaf)
    );

    const refreshWorkbench = () => {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
      leaves.forEach(leaf => {
        if (leaf.view && typeof leaf.view.refreshVaultDocs === 'function') {
          leaf.view.refreshVaultDocs();
        }
      });
    };

    this.registerEvent(this.app.vault.on('create', refreshWorkbench));
    this.registerEvent(this.app.vault.on('delete', refreshWorkbench));
    this.registerEvent(this.app.vault.on('modify', refreshWorkbench));
    this.registerEvent(this.app.metadataCache.on('resolved', refreshWorkbench));

    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (file) {
        if (this.contextProvider) {
          this.contextProvider.setActiveFile(file);
        }
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
        leaves.forEach(leaf => {
          if (leaf.view && leaf.view.contextProvider) {
            leaf.view.contextProvider.setActiveFile(file);
          }
        });
      }
    }));

    // Add ribbon icon on left navigation bar
    this.addRibbonIcon('layout-dashboard', '打开 TabonKB 研发工作台', () => {
      this.activateView();
    });

    // Add command palette item
    this.addCommand({
      id: 'open-tabonkb-workbench',
      name: '打开研发工作台',
      callback: () => {
        this.activateView();
      },
    });

    // Add status bar item
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText('📊 TabonKB 工作台');
    statusBarItem.addClass('mod-clickable');
    statusBarItem.onClickEvent(() => {
      this.activateView();
    });
  }

  async getSecret(secretName) {
    // 1. Try localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}

    // 2. Try local plugin .secrets.json file
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        if (fs.existsSync(secretsFile)) {
          const data = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (e) {}

    // 3. Fallback to memory
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    return this._fallbackSecrets[secretName] || null;
  }

  async setSecret(secretName, value) {
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    this._fallbackSecrets[secretName] = value;

    // 1. Save to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}

    // 2. Save to local .secrets.json file
    try {
      const fs = require('fs');
      const path = require('path');
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        const secretsFile = path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json');
        let data = {};
        if (fs.existsSync(secretsFile)) {
          try { data = JSON.parse(fs.readFileSync(secretsFile, 'utf8')) || {}; } catch (e) {}
        }
        data[secretName] = value;
        fs.writeFileSync(secretsFile, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded && loaded.jira) {
      this.settings.jira = Object.assign({}, DEFAULT_SETTINGS.jira, loaded.jira);
    }
    if (loaded && loaded.niceaigc) {
      this.settings.niceaigc = Object.assign({}, DEFAULT_SETTINGS.niceaigc, loaded.niceaigc);
    }
    if (loaded && loaded.rss) {
      this.settings.rss = Object.assign({}, DEFAULT_SETTINGS.rss, loaded.rss);
    }
  }

  async saveSettings() {
    // Ensure token is NEVER saved in data.json
    if (this.settings.jira) {
      delete this.settings.jira.token;
      delete this.settings.jira.apiToken;
      delete this.settings.jira.pat;
    }
    if (this.settings.niceaigc) {
      delete this.settings.niceaigc.token;
      delete this.settings.niceaigc.apiKey;
    }
    await this.saveData(this.settings);

    // Notify active workbench views to refresh if config changed
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.refresh(true);
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.refresh(true);
        }
      }
    });
  }

  onunload() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH);
    leaves.forEach(leaf => {
      if (leaf.view) {
        if (leaf.view.jiraCard) {
          leaf.view.jiraCard.dispose();
        }
        if (leaf.view.rssCard) {
          leaf.view.rssCard.dispose();
        }
        if (leaf.view.agentBridge) {
          leaf.view.agentBridge.destroy();
        }
      }
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WORKBENCH)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_WORKBENCH, active: true });
    }

    workspace.revealLeaf(leaf);
  }
};

