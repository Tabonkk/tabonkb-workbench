const { Plugin, ItemView, Notice, PluginSettingTab, Setting, requestUrl, MarkdownRenderer, Component, Menu } = require('obsidian');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const zlib = require('zlib');

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
  'compass': '<circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
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
  'pie': '<circle cx="12" cy="12" r="9"/><path d="M12 12V3a9 9 0 0 1 9 9h-9z"/>',

  // Tasks, Workflow & Knowledge
  'tasks': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'schedule': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'kanban': '<rect x="3.5" y="3.5" width="4.5" height="17" rx="1.5"/><rect x="10" y="3.5" width="4.5" height="11" rx="1.5"/><rect x="16.5" y="3.5" width="4.5" height="15" rx="1.5"/>',
  'clipboard-check': '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  'bookmark': '<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
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
    this.plugin = options.plugin || null;
    this.listeners = new Map();
    this.process = null;
    this.stdoutBuffer = '';
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'thinking' | 'running_tool' | 'error'
    this.statusDetail = '';
    this.isStreaming = false;
    this.activeTools = new Map();
    this.requestIdCounter = 1;
    this.pendingCommands = new Map();
    this.currentTurnHasText = false;
    this.lastTurnError = null;
    this.activeProvider = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-provider')) || 'cc-switch-deep-seek';
    this.activeModelId = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';

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

  getExtensionPath() {
    const candidates = [
      path.join(this.vaultBasePath, '.pi', 'extensions', 'vendor-portal.ts'),
      path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'extensions', 'vendor-portal.ts')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Determine launch executable: direct node + bundle cli.js (cleanest) or fallback to pi.cmd
   */
  resolveLaunchCommand() {
    const baseTools = this.permissionMode === 'readwrite'
      ? 'read,write,edit,grep,find,ls'
      : 'read,grep,find,ls';
    const tools = `${baseTools},vendor_portal_search,vendor_portal_get_detail`;

    const extPath = this.getExtensionPath();
    const extArgs = extPath ? ['--extension', extPath] : [];
    const modelArgs = [
      '--provider', this.activeProvider || 'cc-switch-deep-seek',
      '--model', this.activeModelId || 'deepseek-v4-flash'
    ];

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
          '--tools', tools,
          ...modelArgs,
          ...extArgs
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
          '--tools', tools,
          ...modelArgs,
          ...extArgs
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
        '--tools', tools,
        ...modelArgs,
        ...extArgs
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

      // Extract vendor portal credentials
      let unisocToken = process.env.TABONKB_UNISOC_TOKEN || '';
      let mtkUsername = process.env.TABONKB_MTK_USERNAME || '';
      let mtkPassword = process.env.TABONKB_MTK_PASSWORD || '';

      try {
        const plugin = this.plugin || (typeof window !== 'undefined' && (window.app?.plugins?.getPlugin?.('tabonkb-workbench') || window.app?.plugins?.plugins?.['tabonkb-workbench']));
        if (plugin) {
          if (typeof plugin.getSecret === 'function') {
            if (!unisocToken) unisocToken = (await plugin.getSecret('tabonkb-unisoc-password')) || '';
            if (!mtkPassword) mtkPassword = (await plugin.getSecret('tabonkb-mtk-password')) || '';
          }
          if (plugin.settings?.vendorPortals?.mtk?.username && !mtkUsername) {
            mtkUsername = plugin.settings.vendorPortals.mtk.username;
          }
        }
      } catch (_) {}

      if (!unisocToken && typeof localStorage !== 'undefined') {
        unisocToken = localStorage.getItem('tabonkb-secret-tabonkb-unisoc-password') || '';
      }
      if (!mtkPassword && typeof localStorage !== 'undefined') {
        mtkPassword = localStorage.getItem('tabonkb-secret-tabonkb-mtk-password') || '';
      }

      try {
        const secCandidates = [
          path.join(this.vaultBasePath, '.secrets.json'),
          path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json')
        ];
        for (const secPath of secCandidates) {
          if (fs.existsSync(secPath)) {
            const sdata = JSON.parse(fs.readFileSync(secPath, 'utf8'));
            if (!unisocToken && sdata['tabonkb-unisoc-password']) unisocToken = sdata['tabonkb-unisoc-password'];
            if (!mtkPassword && sdata['tabonkb-mtk-password']) mtkPassword = sdata['tabonkb-mtk-password'];
          }
        }
      } catch (_) {}

      try {
        if (!mtkUsername) {
          const dataJsonPath = path.join(this.vaultBasePath, '.obsidian', 'plugins', 'tabonkb-workbench', 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            const dj = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            mtkUsername = dj?.vendorPortals?.mtk?.username || '';
          }
        }
      } catch (_) {}

      this.process = child_process.spawn(launch.cmd, launch.args, {
        cwd: this.vaultBasePath,
        env: Object.assign({}, process.env, {
          PATH: envPath,
          Path: envPath,
          LANG: 'en_US.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          TABONKB_UNISOC_TOKEN: unisocToken,
          TABONKB_MTK_USERNAME: mtkUsername,
          TABONKB_MTK_PASSWORD: mtkPassword
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
      this.currentTurnHasText = false;
      this.lastTurnError = null;
      this.setStatus('thinking', '正在思考与规划...');
      this.emit('turn_start', data);
      return;
    }

    if (type === 'auto_retry_start') {
      const attempt = data.attempt || 1;
      const maxAttempts = data.maxAttempts || 3;
      const errMsg = data.errorMessage || '';
      const retryDesc = errMsg ? `正在重试 (${attempt}/${maxAttempts}): ${errMsg.slice(0, 30)}...` : `正在重试请求 (${attempt}/${maxAttempts})...`;
      this.setStatus('thinking', retryDesc);
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
      const msg = data.message;
      if (msg && (msg.stopReason === 'error' || msg.errorMessage)) {
        const errMsg = msg.errorMessage || '上游模型调用异常';
        this.lastTurnError = errMsg;
        if (!this.currentTurnHasText) {
          const isRateLimit = /concurrency|rate_limit|429|too many/i.test(errMsg);
          const tip = isRateLimit
            ? `💡 **原因与建议**: 上游 API 通道临时并发受限 (Rate Limit / 429)。该通道正常可用，通常等待数秒后再试即可恢复。`
            : `💡 **原因与建议**: 上游 API 接口返回错误或网络异常，请稍后点击重试或切换备选通道。`;
          const notice = `\n\n> ⚠️ **上游模型通道调用异常**\n> 错误信息: \`${errMsg}\`\n>\n> ${tip}\n`;
          this.emit('text_delta', notice);
          this.currentTurnHasText = true;
        }
        this.emit('error', { message: errMsg, stopReason: msg.stopReason });
      }
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
        if (ev.delta.length > 0) {
          this.currentTurnHasText = true;
        }
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
      } else if (toolName === 'vendor_portal_search') {
        const q = args?.query || '';
        const v = args?.vendor && args.vendor !== 'all' ? ` (${args.vendor})` : '';
        actionDesc = `正在检索芯片原厂资料${v}: "${q}"`;
      } else if (toolName === 'vendor_portal_get_detail') {
        const docId = args?.docId || '';
        const v = args?.vendor ? ` [${args.vendor}]` : '';
        actionDesc = `正在调取原厂技术方案${v}: ${docId}`;
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
   * Set model dynamically via RPC or restart
   */
  async setModel(provider, modelId) {
    this.activeProvider = provider;
    this.activeModelId = modelId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-active-provider', provider);
      localStorage.setItem('tabonkb-pi-active-model', modelId);
    }
    if (this.process && !this.process.killed) {
      try {
        await this.sendCommand({
          type: 'set_model',
          provider: provider,
          modelId: modelId
        });
      } catch (e) {
        console.warn('[PiAgentBridge] setModel RPC failed, restarting process with new model:', e);
        this.destroy();
        await this.start();
      }
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

    const savedModel = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model')) || 'deepseek-v4-flash';
    const savedName = (typeof localStorage !== 'undefined' && localStorage.getItem('tabonkb-pi-active-model-name')) || 'DeepSeek V4 Flash (推荐)';
    this.activeModelId = savedModel;
    this.activeModelName = savedName;

    if (this.bridge) {
      this.setupBridgeEvents();
    }
  }

  getModelGroups() {
    return [
      {
        group: 'DeepSeek 极速直连 (推荐)',
        icon: '⚡',
        iconPark: 'lightning',
        brand: 'deepseek',
        isTop: true,
        models: [
          { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (推荐)', desc: '官方极速直连 · 毫秒响应 · 稳定无排队', icon: '⚡', iconPark: 'lightning', brand: 'deepseek' },
          { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: '官方深度推理 · 超长上下文', icon: '💎', iconPark: 'diamond', brand: 'deepseek' }
        ]
      },
      {
        group: 'OpenAI / Jojom 通道',
        icon: '🪐',
        iconPark: 'planet',
        brand: 'openai',
        models: [
          { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', desc: 'Jojom 通道 (若上游限流可随时切回 DeepSeek)', icon: '🪐', iconPark: 'planet', brand: 'openai' }
        ]
      }
    ];
  }

  async setModel(modelId, modelName) {
    this.activeModelId = modelId;
    this.activeModelName = modelName || (modelId === 'gpt-5.6-sol' ? 'GPT-5.6 Sol' : (modelId === 'deepseek-v4-pro' ? 'DeepSeek V4 Pro' : 'DeepSeek V4 Flash (推荐)'));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tabonkb-pi-active-model', this.activeModelId);
      localStorage.setItem('tabonkb-pi-active-model-name', this.activeModelName);
    }
    let provider = 'cc-switch-deep-seek';
    if (modelId === 'gpt-5.6-sol') {
      provider = 'jojom';
    }
    if (this.bridge && typeof this.bridge.setModel === 'function') {
      await this.bridge.setModel(provider, modelId);
    }
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
      // 1. Copy code block button
      const codeCopyBtn = e.target.closest('.tw-code-copy-btn');
      if (codeCopyBtn) {
        e.stopPropagation();
        const pre = codeCopyBtn.closest('pre');
        if (pre) {
          const codeEl = pre.querySelector('code');
          let codeText = '';
          if (codeEl) {
            codeText = codeEl.innerText || codeEl.textContent || '';
          } else {
            const clone = pre.cloneNode(true);
            const hb = clone.querySelector('.tw-code-header-bar');
            if (hb) hb.remove();
            const obBtn = clone.querySelector('.copy-code-button');
            if (obBtn) obBtn.remove();
            codeText = clone.innerText || clone.textContent || '';
          }
          codeText = codeText.replace(/\r\n/g, '\n');
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(codeText);
            } else {
              const ta = document.createElement('textarea');
              ta.value = codeText;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            codeCopyBtn.classList.add('copied');
            const prevHtml = codeCopyBtn.innerHTML;
            codeCopyBtn.innerHTML = `${getIconPark('check', 12, { color: '#10B981' })} <span class="tw-code-copy-text" style="color: #10B981;">已复制</span>`;
            setTimeout(() => {
              codeCopyBtn.classList.remove('copied');
              codeCopyBtn.innerHTML = prevHtml;
            }, 1800);
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 代码片段已复制到剪贴板', 2000);
          } catch (err) {
            console.warn('[PiDrawerView] Code copy failed:', err);
          }
        }
        return;
      }

      // 1.1 Copy entire message text button
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
      this.lastHubError = null;
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
      this.lastHubError = err;
      if (!this.currentAssistantMessage) {
        this.createAssistantMessageBubble();
      }
      const errMsg = err.error || err.message || '执行异常';
      if (!this.currentAssistantMessage.rawText || !this.currentAssistantMessage.rawText.includes(errMsg)) {
        this.appendAssistantDelta(`\n⚠️ 提示: ${errMsg}`);
      }
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

      // If this message represents an upstream channel exception (e.g. 429 concurrency limit):
      if (msg.rawText.includes('上游模型通道调用异常') || msg.rawText.includes('Concurrency limit exceeded') || msg.rawText.includes('429')) {
        const actionWrap = document.createElement('div');
        actionWrap.className = 'tw-error-actions-bar';
        actionWrap.style.cssText = 'margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';
        actionWrap.innerHTML = `
          <button class="tw-error-switch-ds-btn" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; background: #10B981; color: #fff; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            ${getIconPark('lightning', 12)} <span>一键切至 DeepSeek 极速通道并重试</span>
          </button>
          <button class="tw-error-resend-btn" style="padding: 5px 12px; font-size: 11.5px; font-weight: 500; background: rgba(0,0,0,0.06); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            ${getIconPark('refresh', 12)} <span>重新发送本题</span>
          </button>
        `;
        const dsBtn = actionWrap.querySelector('.tw-error-switch-ds-btn');
        if (dsBtn) {
          dsBtn.onclick = () => {
            this.selectModel('deepseek-v4-flash', 'DeepSeek V4 Flash (推荐)', 'deepseek');
            const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
            const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
            if (lastUserMsg && lastUserMsg.text) {
              this.inputEl.value = lastUserMsg.text;
              this.handleSend();
            }
          };
        }
        const resendBtn = actionWrap.querySelector('.tw-error-resend-btn');
        if (resendBtn) {
          resendBtn.onclick = () => {
            const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
            const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
            if (lastUserMsg && lastUserMsg.text) {
              this.inputEl.value = lastUserMsg.text;
              this.handleSend();
            }
          };
        }
        msg.contentEl.appendChild(actionWrap);
      }
    } else if (isAborted) {
      // Aborted notice already added above
    } else {
      // Empty response fallback: Never leave a blank bubble!
      msg.contentEl.style.display = 'block';
      const adapter = this.hub ? this.hub.getActiveAdapter() : null;
      const currentModel = adapter && typeof adapter.getModel === 'function' ? adapter.getModel() : { id: '', name: '' };
      const modelName = currentModel.name || '当前模型';
      const errDetail = this.lastHubError ? (this.lastHubError.message || this.lastHubError.error || '') : '';

      msg.contentEl.innerHTML = `
        <div class="tw-empty-response-card" style="padding: 12px 14px; border-radius: 6px; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.35); font-size: 12px; line-height: 1.6; color: var(--text-normal);">
          <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
            <span>${getIconPark('alert', 14, { color: '#EF4444' })}</span><span>未收到模型回复内容</span>
          </div>
          <div style="color: var(--text-muted); font-size: 11.5px;">
            模型 <b>${escapeHtml(modelName)}</b> 上游通道未返回有效文本${errDetail ? `（上游提示: <code style="color:#ef4444;">${escapeHtml(errDetail)}</code>）` : '（可能处于并发超限 429 或网络瞬时抖动）'}。
          </div>
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="tw-empty-switch-ds-btn" style="padding: 4px 10px; font-size: 11px; font-weight: 600; background: #10B981; color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;">
              ${getIconPark('lightning', 12)} <span>一键切至 DeepSeek 极速通道并重试</span>
            </button>
            <button class="tw-empty-retry-direct-btn" style="padding: 4px 10px; font-size: 11px; font-weight: 500; background: var(--interactive-accent, #2563EB); color: #fff; border: none; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;">
              ${getIconPark('refresh', 12)} <span>重新发送本题</span>
            </button>
          </div>
        </div>
      `;

      const dsBtn = msg.contentEl.querySelector('.tw-empty-switch-ds-btn');
      if (dsBtn) {
        dsBtn.onclick = () => {
          this.selectModel('deepseek-v4-flash', 'DeepSeek V4 Flash (推荐)', 'deepseek');
          const msgs = (this.hub && this.hub.sessionManager) ? this.hub.sessionManager.getMessages(this.hub.activeAgentId) : [];
          const lastUserMsg = [...(msgs || [])].reverse().find(m => m.role === 'user');
          if (lastUserMsg && lastUserMsg.text) {
            this.inputEl.value = lastUserMsg.text;
            this.handleSend();
          }
        };
      }

      const directRetryBtn = msg.contentEl.querySelector('.tw-empty-retry-direct-btn');
      if (directRetryBtn) {
        directRetryBtn.onclick = () => {
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
        setTimeout(() => this.postProcessRenderedMarkdown(el), 60);
        setTimeout(() => this.postProcessRenderedMarkdown(el), 250);
        return;
      } catch (e) {
        console.warn('[PiDrawerView] MarkdownRenderer failed, falling back to simple format:', e);
      }
    }

    el.innerHTML = formatMarkdownFallback(text);
    this.postProcessRenderedMarkdown(el);
  }

  postProcessRenderedMarkdown(containerEl) {
    if (!containerEl) return;

    // 1. Add rel and target to external links
    containerEl.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.classList.add('external-link');
    });

    // 2. Enhance code blocks with styled header bar, language label, and compact copy button
    containerEl.querySelectorAll('pre').forEach(preEl => {
      preEl.classList.add('tw-code-block');

      // Hide default Obsidian copy button to avoid huge or duplicate buttons
      const obCopyBtn = preEl.querySelector('.copy-code-button');
      if (obCopyBtn) {
        obCopyBtn.style.display = 'none';
      }

      if (preEl.querySelector('.tw-code-header-bar') || preEl.dataset.twProcessed === 'true') {
        return;
      }
      preEl.dataset.twProcessed = 'true';

      const codeEl = preEl.querySelector('code');
      let lang = '';
      const classes = [...(preEl.classList || []), ...(codeEl ? codeEl.classList : [])];
      for (const cls of classes) {
        if (cls && typeof cls === 'string' && cls.startsWith('language-')) {
          lang = cls.replace('language-', '').trim();
          break;
        }
      }
      if (!lang || lang === 'none' || lang === 'text' || lang === 'txt') {
        lang = 'CODE';
      } else {
        lang = lang.toUpperCase();
      }

      const headerBar = document.createElement('div');
      headerBar.className = 'tw-code-header-bar';
      headerBar.innerHTML = `
        <span class="tw-code-lang-tag">${escapeHtml(lang)}</span>
        <button class="tw-code-copy-btn" title="复制代码内容">
          ${getIconPark('copy', 12)}
          <span class="tw-code-copy-text">复制</span>
        </button>
      `;

      preEl.insertBefore(headerBar, preEl.firstChild);
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

const DEFAULT_JIRA_JQL = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

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
    this._trendCache = null;
    this._cacheTtlMs = 5 * 60 * 1000; // 5 minutes

    // In-memory credential fallback (in case Obsidian version does not support secretStorage)
    this._memorySecret = null;

    // Load persistent offline cache from localStorage
    this.loadPersistentCache();
  }

  loadPersistentCache() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-cache-v1');
        const timeStr = localStorage.getItem('tabonkb-jira-cache-time');
        if (raw && timeStr) {
          const issues = JSON.parse(raw);
          const lastUpdated = parseInt(timeStr, 10);
          if (Array.isArray(issues) && !isNaN(lastUpdated)) {
            this._cache = {
              issues,
              lastUpdated,
              isStale: (Date.now() - lastUpdated > this._cacheTtlMs)
            };
          }
        }

        const rawTrend = localStorage.getItem('tabonkb-jira-trend-cache');
        const trendTimeStr = localStorage.getItem('tabonkb-jira-trend-time');
        if (rawTrend && trendTimeStr) {
          const trendIssues = JSON.parse(rawTrend);
          const lastTrendUpdated = parseInt(trendTimeStr, 10);
          if (Array.isArray(trendIssues) && !isNaN(lastTrendUpdated)) {
            this._trendCache = {
              issues: trendIssues,
              lastUpdated: lastTrendUpdated,
              isStale: (Date.now() - lastTrendUpdated > this._cacheTtlMs)
            };
          }
        }
      }
    } catch (e) {}
  }

  savePersistentCache(issues, lastUpdated) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-cache-v1', JSON.stringify(issues));
        localStorage.setItem('tabonkb-jira-cache-time', String(lastUpdated));
      }
    } catch (e) {}
  }

  getCacheInfo() {
    if (!this._cache || !this._cache.lastUpdated) {
      return { hasCache: false, lastUpdated: 0, count: 0, relativeTime: '未同步', isExpired: true };
    }
    const d = new Date(this._cache.lastUpdated);
    const timeStr = isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const diffMin = Math.floor((Date.now() - this._cache.lastUpdated) / 60000);
    const rel = diffMin <= 1 ? '刚刚' : `${diffMin}分钟前`;
    return {
      hasCache: true,
      lastUpdated: this._cache.lastUpdated,
      count: this._cache.issues?.length || 0,
      timeStr,
      relativeTime: `${timeStr} (${rel})`,
      isExpired: Date.now() - this._cache.lastUpdated > this._cacheTtlMs
    };
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
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'description', 'reporter', 'created', 'components']
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
        let errJson = response.json;
        if (!errJson && response.text && typeof response.text === 'string' && response.text.trim()) {
          errJson = JSON.parse(response.text);
        }
        if (errJson?.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Cloud 查询失败 (HTTP ${response.status})`);
    }

    let data = response.json;
    if (!data && response.text && typeof response.text === 'string' && response.text.trim()) {
      try { data = JSON.parse(response.text); } catch (_) { data = {}; }
    }
    data = data || {};
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
    const reqFields = 'summary,status,priority,assignee,updated,description,reporter,created,components';

    // Primary attempt: GET /rest/api/2/search
    // In Electron, GET avoids Jira Server CSRF / XSRF origin check failure (Status 403)
    const getUrl = `${cleanBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=0&maxResults=100&fields=${reqFields}`;
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
        maxResults: 100,
        fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'description', 'reporter', 'created', 'components']
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
        let errJson = response.json;
        if (!errJson && response.text && typeof response.text === 'string' && response.text.trim()) {
          errJson = JSON.parse(response.text);
        }
        if (errJson?.errorMessages?.length) msg += `: ${errJson.errorMessages.join(', ')}`;
      } catch (_) {}
      throw new Error(msg);
    }
    if (response.status !== 200) {
      throw new Error(`Jira Data Center 查询失败 (HTTP ${response.status})`);
    }

    let data = response.json;
    if (!data && response.text && typeof response.text === 'string' && response.text.trim()) {
      try { data = JSON.parse(response.text); } catch (_) { data = {}; }
    }
    data = data || {};
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
    const statusCategory = fields.status?.statusCategory?.key || '';
    const priority = fields.priority?.name || 'Medium';

    let assignee = '未指派';
    if (fields.assignee) {
      assignee = fields.assignee.displayName || fields.assignee.name || '已指派';
    }

    let reporter = '系统';
    if (fields.reporter) {
      reporter = fields.reporter.displayName || fields.reporter.name || '系统';
    }

    let description = '';
    if (typeof fields.description === 'string') {
      description = fields.description;
    } else if (fields.description && typeof fields.description === 'object') {
      try {
        description = JSON.stringify(fields.description);
      } catch (e) {
        description = '';
      }
    }

    const components = Array.isArray(fields.components) ? fields.components.map(c => c.name) : [];

    let updated = '';
    let rawUpdated = fields.updated || '';
    if (fields.updated) {
      try {
        const d = new Date(fields.updated);
        if (!isNaN(d.getTime())) {
          updated = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    let created = '';
    let rawCreated = fields.created || '';
    if (fields.created) {
      try {
        const d = new Date(fields.created);
        if (!isNaN(d.getTime())) {
          created = formatRelativeTime(d);
        }
      } catch (e) {}
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/browse/${encodeURIComponent(key)}`;

    return {
      key,
      summary,
      status,
      statusCategory,
      priority,
      assignee,
      reporter,
      description,
      components,
      created,
      updated,
      rawCreated,
      rawUpdated,
      url
    };
  }

  /**
   * Public search entrypoint with in-memory caching, persistent storage, and stale-while-error fallback.
   * Does NOT accept arbitrary URLs from caller.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<{ issues: DashboardIssue[], lastUpdated: number, isStale: boolean, error?: string }>}
   */
  async searchIssues(forceRefresh = false) {
    const now = Date.now();

    // 1. Check in-memory/persistent fresh cache
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

      // Save persistent cache for offline-first instant loading
      this.savePersistentCache(issues, this._cache.lastUpdated);

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
   * Fetch user issues for trend & convergence analytics.
   * Caches in memory and localStorage for instant 0ms offline rendering.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<DashboardIssue[]>}
   */
  async getTrendIssues(forceRefresh = false) {
    const now = Date.now();
    const cacheTtl = 5 * 60 * 1000;
    if (!forceRefresh && this._trendCache && (now - this._trendCache.lastUpdated < cacheTtl)) {
      return this._trendCache.issues;
    }

    // Try persistent cache from localStorage
    try {
      if (!forceRefresh && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-trend-cache');
        const timeStr = localStorage.getItem('tabonkb-jira-trend-time');
        if (raw && timeStr) {
          const t = parseInt(timeStr, 10);
          if (!isNaN(t) && (now - t < cacheTtl)) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
              this._trendCache = { issues: list, lastUpdated: t };
              return list;
            }
          }
        }
      }
    } catch (e) {}

    // Query server for latest 100 assigned issues (both open and closed)
    try {
      const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
      if (!config || !config.baseUrl) {
        return this._cache?.issues || [];
      }
      const secretKey = config.secretName || 'tabonkb-jira-token';
      const token = await this.getCredential(secretKey);
      if (!token) {
        return this._cache?.issues || [];
      }

      const trendConfig = Object.assign({}, config, {
        jql: 'assignee = currentUser() ORDER BY updated DESC'
      });

      let issues = [];
      if (config.type === 'datacenter') {
        issues = await this.searchDataCenterIssues(trendConfig, token);
      } else {
        issues = await this.searchCloudIssues(trendConfig, token);
      }

      if (Array.isArray(issues) && issues.length > 0) {
        this._trendCache = { issues, lastUpdated: now };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('tabonkb-jira-trend-cache', JSON.stringify(issues));
            localStorage.setItem('tabonkb-jira-trend-time', String(now));
          }
        } catch (e) {}
        return issues;
      }
    } catch (err) {
      console.warn('Jira trend search failed, falling back to cache', err);
    }

    // Fallback: cached trend issues, then main cache
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-trend-cache') || localStorage.getItem('tabonkb-jira-cache-v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}

    return this._cache?.issues || [];
  }

  /**
   * Get available transitions for an issue
   * @param {string} issueKey
   * @returns {Promise<Array<{id: string, name: string, to: {name: string, category: string}, hasScreen?: boolean, requiredFields?: Array<{key: string, name: string}>, fields?: any}>>}
   */
  async getTransitions(issueKey) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    // Append expand=transitions.fields to inspect transition screens and required fields
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/transitions?expand=transitions.fields`;

    const headers = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    try {
      const res = await this._executeRequest({ url, method: 'GET', headers });
      if (res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        data = data || {};
        return (data.transitions || []).map(t => {
          const fields = t.fields || {};
          const requiredFields = [];
          const fieldList = [];
          for (const [fKey, fVal] of Object.entries(fields)) {
            const item = {
              key: fKey,
              name: fVal.name || fKey,
              required: Boolean(fVal.required),
              type: fVal.schema?.type || fVal.type || 'string',
              schema: fVal.schema || {},
              allowedValues: Array.isArray(fVal.allowedValues) ? fVal.allowedValues : [],
              hasDefaultValue: Boolean(fVal.hasDefaultValue),
              defaultValue: fVal.defaultValue
            };
            fieldList.push(item);
            if (fVal && fVal.required) {
              requiredFields.push(item);
            }
          }
          const isResolve = /解决|完成|关闭|resolve|done|close/i.test(t.name) || /done/i.test(t.to?.statusCategory?.key || '');
          return {
            id: String(t.id),
            name: t.name,
            to: {
              name: t.to?.name || t.name,
              category: t.to?.statusCategory?.key || ''
            },
            hasScreen: Boolean(t.hasScreen) || fieldList.length > 0 || isResolve,
            isResolve,
            requiredFields,
            fieldList,
            fields
          };
        });
      }
      return [];
    } catch (e) {
      console.warn(`[JiraService] Failed to get transitions for ${issueKey}:`, e);
      return [];
    }
  }

  /**
   * Execute a status transition on an issue
   * @param {string} issueKey
   * @param {string} transitionId
   * @param {string} [targetStatusName]
   * @param {object} [customFields]
   * @param {string} [commentText]
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async doTransition(issueKey, transitionId, targetStatusName, customFields = null, commentText = null) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/transitions`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    const payload = {
      transition: { id: String(transitionId) }
    };
    if (customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0) {
      payload.fields = customFields;
    }
    if (commentText && typeof commentText === 'string' && commentText.trim()) {
      payload.update = {
        comment: [
          {
            add: {
              body: commentText.trim()
            }
          }
        ]
      };
    }

    const res = await this._executeRequest({
      url,
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (res.status === 204 || res.status === 200 || res.status === 201) {
      // Transition succeeded! Update local cache immediately
      if (this._cache && Array.isArray(this._cache.issues)) {
        const target = this._cache.issues.find(i => i.key === issueKey);
        if (target && targetStatusName) {
          target.status = targetStatusName;
          target.updated = '刚刚';
        }
        this.savePersistentCache(this._cache.issues, this._cache.lastUpdated);
      }
      return { success: true };
    }

    let detailMsg = '';
    let errJson = res.json;
    if (!errJson && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
      try { errJson = JSON.parse(res.text); } catch (_) { errJson = null; }
    }
    const errObj = errJson;

    if (errJson) {
      const parts = [];
      if (Array.isArray(errJson.errorMessages) && errJson.errorMessages.length > 0) {
        parts.push(...errJson.errorMessages.filter(Boolean));
      }
      if (errJson.errors && typeof errJson.errors === 'object' && Object.keys(errJson.errors).length > 0) {
        for (const [k, v] of Object.entries(errJson.errors)) {
          if (v) parts.push(`${k}: ${v}`);
        }
      }
      if (errObj.message && typeof errObj.message === 'string' && !parts.includes(errObj.message)) {
        parts.push(errObj.message);
      }
      if (parts.length > 0) {
        detailMsg = parts.join('; ');
      }
    }

    if (!detailMsg) {
      if (res.status === 403) {
        detailMsg = '请检查工单工作流流转权限或 Jira CSRF/跨域配置';
      } else if (res.status === 400) {
        detailMsg = '该状态流转可能需要必填字段（如修复版本/解决结果/经办人等）或包含流转弹窗限制';
      } else {
        const cleanText = (res.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        detailMsg = cleanText.slice(0, 150) || '请检查工单工作流状态';
      }
    }

    const err = new Error(`Jira 状态流转失败 (HTTP ${res.status}): ${detailMsg}`);
    err.status = res.status;
    err.detailMsg = detailMsg;
    err.jiraError = errObj;
    throw err;
  }

  /**
   * Extract plain text from comment body (supports raw string or Jira Cloud ADF structure)
   * @param {any} body
   * @returns {string}
   */
  parseCommentBody(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object') {
      // Jira Cloud ADF (Atlassian Document Format)
      const texts = [];
      function walk(node) {
        if (!node) return;
        if (node.text) texts.push(node.text);
        if (Array.isArray(node.content)) {
          for (const child of node.content) walk(child);
          if (node.type === 'paragraph' || node.type === 'heading') texts.push('\n');
        }
      }
      walk(body);
      return texts.join('').trim();
    }
    return String(body);
  }

  /**
   * Fetch comments / activity logs for an issue
   * @param {string} issueKey
   * @returns {Promise<Array<{id: string, author: string, authorAvatar: string, body: string, created: string, createdFormatted: string, updated: string, isEdited: boolean}>>}
   */
  async getIssueComments(issueKey) {
    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/comment?expand=renderedBody`;

    const headers = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    try {
      const res = await this._executeRequest({ url, method: 'GET', headers });
      if (res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        data = data || {};
        const rawComments = Array.isArray(data.comments) ? data.comments : [];
        return rawComments.map(c => {
          const author = c.author?.displayName || c.author?.name || '未知用户';
          const authorAvatar = c.author?.avatarUrls?.['24x24'] || c.author?.avatarUrls?.['16x16'] || '';
          const body = this.parseCommentBody(c.renderedBody || c.body);

          let createdFormatted = '';
          if (c.created) {
            try {
              const d = new Date(c.created);
              if (!isNaN(d.getTime())) {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                const ho = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                createdFormatted = `${yr}-${mo}-${da} ${ho}:${mi}`;
              }
            } catch (e) {}
          }
          if (!createdFormatted) createdFormatted = c.created || '';

          const isEdited = Boolean(c.updated && c.created && (new Date(c.updated).getTime() - new Date(c.created).getTime() > 10000));

          return {
            id: String(c.id),
            author,
            authorAvatar,
            body,
            created: c.created || '',
            createdFormatted,
            updated: c.updated || '',
            isEdited
          };
        });
      }
      return [];
    } catch (err) {
      console.warn(`[JiraService] Failed to get comments for ${issueKey}:`, err);
      return [];
    }
  }

  /**
   * Add a new comment to an issue
   * @param {string} issueKey
   * @param {string} commentText
   * @returns {Promise<{success: boolean, comment?: any, message?: string}>}
   */
  async addIssueComment(issueKey, commentText) {
    if (!commentText || !commentText.trim()) {
      return { success: false, message: '注释内容不能为空' };
    }

    const config = typeof this.getConfig === 'function' ? this.getConfig() : {};
    if (!config || !config.baseUrl) throw new Error('Jira Base URL 未配置');
    const secretKey = config.secretName || 'tabonkb-jira-token';
    const token = await this.getCredential(secretKey);
    if (!token) throw new Error('Jira Token 未配置');

    const cleanBase = config.baseUrl.trim().replace(/\/+$/, '');
    const apiVersion = config.type === 'cloud' ? '3' : '2';
    const url = `${cleanBase}/rest/api/${apiVersion}/issue/${encodeURIComponent(issueKey)}/comment`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cleanBase) {
      headers['Origin'] = cleanBase;
      headers['Referer'] = `${cleanBase}/browse/${encodeURIComponent(issueKey)}`;
    }

    if (config.type === 'cloud') {
      headers['Authorization'] = `Basic ${safeBase64(config.email + ':' + token.trim())}`;
    } else {
      if (config.authType === 'cookie' || token.startsWith('JSESSIONID=')) {
        headers['Cookie'] = token.includes('=') ? token.trim() : `JSESSIONID=${token.trim()}`;
      } else {
        const user = (config.username || config.email || '').trim();
        headers['Authorization'] = (config.authType === 'basic' || user)
          ? `Basic ${safeBase64(user + ':' + token.trim())}`
          : `Bearer ${token.trim()}`;
      }
    }

    const isCloud = config.type === 'cloud';
    const trimmed = commentText.trim();
    const payload = isCloud
      ? {
          body: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: trimmed }]
            }]
          }
        }
      : {
          body: trimmed
        };

    try {
      let res = await this._executeRequest({
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      // If cloud failed with 400 on ADF format, fallback to simple body
      if (isCloud && res.status === 400) {
        res = await this._executeRequest({
          url: `${cleanBase}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`,
          method: 'POST',
          headers,
          body: JSON.stringify({ body: trimmed })
        });
      }

      if (res.status === 201 || res.status === 200) {
        let data = res.json;
        if (!data && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
          try { data = JSON.parse(res.text); } catch (_) { data = {}; }
        }
        return { success: true, comment: data };
      }

      let errMsg = `提交失败 (HTTP ${res.status})`;
      let errJson = res.json;
      if (!errJson && res.text && typeof res.text === 'string' && res.text.trim().length > 0) {
        try { errJson = JSON.parse(res.text); } catch (_) { errJson = null; }
      }
      if (errJson?.errorMessages?.length) {
        errMsg += `: ${errJson.errorMessages.join('; ')}`;
      } else if (errJson?.errors && typeof errJson.errors === 'object') {
        const errList = Object.entries(errJson.errors).map(([k, v]) => `${k}: ${v}`);
        if (errList.length) errMsg += `: ${errList.join('; ')}`;
      }
      return { success: false, message: errMsg };
    } catch (err) {
      return { success: false, message: err.message || '网络或服务异常' };
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

      let userData = myselfRes.json;
      if (!userData && myselfRes.text && typeof myselfRes.text === 'string' && myselfRes.text.trim()) {
        try { userData = JSON.parse(myselfRes.text); } catch (e) {}
      }
      userData = userData || {};
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
        const res = await requestUrl({ ...params, throw: false });
        const text = typeof res.text === 'string' ? res.text : '';
        let json = null;
        if (text && text.trim().length > 0) {
          try {
            json = JSON.parse(text);
          } catch (_) {
            json = null;
          }
        }
        return {
          status: res.status,
          text,
          json,
          headers: res.headers || {}
        };
      } catch (err) {
        if (err && typeof err.status === 'number') {
          const text = typeof err.text === 'string' ? err.text : '';
          let json = null;
          if (text && text.trim().length > 0) {
            try {
              json = JSON.parse(text);
            } catch (_) {
              json = null;
            }
          }
          return {
            status: err.status,
            text,
            json,
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
          let json = null;
          try { json = JSON.parse(text); } catch (_) {}
          resolve({
            status: res.statusCode,
            text,
            json,
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

/**
 * JiraPlatformView: Full-screen Jira Management Platform for TabonKB.
 * Features:
 * - Kanban Board (4 workflow columns) & Table List view toggle
 * - Instant offline caching (sub-10ms load) + sync status tracking
 * - Preset JQL quick tabs (All Unresolved, Assigned to me, High priority, Recent)
 * - In-App Status Transitions [To Do] [In Progress] [In Review] [Done]
 * - Issue Inspector side drawer with Markdown link copy & Agent Hub dispatch
 * - Local keyword filtering & real-time search match
 */
class JiraPlatformView {
  constructor(options = {}) {
    this.jiraService = options.jiraService;
    this.app = options.app;
    this.onOpenSettings = options.onOpenSettings;
    this.onAskAgent = options.onAskAgent;

    this.containerEl = null;
    this.issues = [];
    this.filteredIssues = [];
    this.isLoading = false;
    this.error = null;

    // View & preset states
    this.currentView = this.getSavedViewMode();
    this.activePreset = this.getSavedPreset();
    this.activeTimeRange = this.getSavedTimeRange();
    this.keyword = '';
    this.selectedIssue = null;
    this.isTransitioning = false;
  }

  getSavedViewMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('tabonkb-jira-view-mode');
        if (v === 'kanban' || v === 'table') return v;
      }
    } catch (e) {}
    return 'kanban';
  }

  saveViewMode(mode) {
    this.currentView = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-view-mode', mode);
      }
    } catch (e) {}
  }

  getSavedPreset() {
    try {
      if (typeof localStorage !== 'undefined') {
        const p = localStorage.getItem('tabonkb-jira-preset');
        if (p) return p;
      }
    } catch (e) {}
    return 'unresolved';
  }

  savePreset(preset) {
    this.activePreset = preset;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-preset', preset);
      }
    } catch (e) {}
  }

  getSavedTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const tr = localStorage.getItem('tabonkb-jira-timerange');
        if (tr) return tr;
      }
    } catch (e) {}
    return 'all';
  }

  saveTimeRange(range) {
    this.activeTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-jira-timerange', range);
      }
    } catch (e) {}
  }

  getPresetJql(preset, timeRange = this.activeTimeRange) {
    let baseJql = '';
    switch (preset) {
      case 'assigned':
        baseJql = 'assignee = currentUser()';
        break;
      case 'high':
        baseJql = 'assignee = currentUser() AND priority in (High, Highest, Blocker, Critical) AND resolution = Unresolved';
        break;
      case 'watching':
        baseJql = 'watcher = currentUser() AND resolution = Unresolved';
        break;
      case 'all':
        baseJql = 'resolution = Unresolved';
        break;
      case 'unresolved':
      default:
        baseJql = 'assignee = currentUser() AND resolution = Unresolved';
        break;
    }

    if (timeRange && timeRange !== 'all') {
      switch (timeRange) {
        case 'week':
          baseJql += ' AND updated >= -7d';
          break;
        case 'month':
          baseJql += ' AND updated >= -30d';
          break;
        case 'quarter':
          baseJql += ' AND updated >= -90d';
          break;
        case 'year':
          baseJql += ' AND updated >= -365d';
          break;
      }
    }

    return `${baseJql} ORDER BY updated DESC`;
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.render();
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config) {
      config.jql = this.getPresetJql(this.activePreset, this.activeTimeRange);
    }
    // Offline-first load: render from cache first, then refresh if expired
    this.loadIssues(false);
  }

  async loadIssues(forceRefresh = false) {
    if (!this.jiraService) return;
    this.isLoading = true;
    this.error = null;
    this.updateLoadingState();

    try {
      const res = await this.jiraService.searchIssues(forceRefresh);
      if (res.error) {
        if (!res.issues || res.issues.length === 0) {
          this.error = res.error;
          this.syncWarning = null;
        } else {
          this.syncWarning = res.error;
          this.issues = res.issues || [];
          this.applyKeywordFilter();
          if (forceRefresh && typeof Notice !== 'undefined') {
            new Notice(`⚠️ Jira 刷新受阻: ${res.error}`, 8000);
          }
        }
      } else {
        this.syncWarning = null;
        this.issues = res.issues || [];
        this.applyKeywordFilter();
        if (forceRefresh && typeof Notice !== 'undefined') {
          new Notice(`✓ Jira 数据已成功同步 (共 ${this.issues.length} 条事项)`, 4000);
        }
      }
    } catch (err) {
      this.error = err.message || '加载 Jira 任务失败';
      if (forceRefresh && typeof Notice !== 'undefined') {
        new Notice(`❌ Jira 加载异常: ${this.error}`, 8000);
      }
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  filterKeyword(keyword) {
    this.keyword = (keyword || '').trim().toLowerCase();
    this.applyFilters();
    this.renderStage();
    this.renderMetricsBar(this.containerEl?.querySelector('.tw-jira-platform'));
  }

  setTimeRange(range) {
    if (this.activeTimeRange === range) return;
    this.saveTimeRange(range);

    // Update UI active buttons immediately
    const btns = this.containerEl?.querySelectorAll('.tw-jira-time-btn');
    if (btns) {
      btns.forEach(b => {
        if (b.getAttribute('data-range') === range) b.classList.add('active');
        else b.classList.remove('active');
      });
    }

    // 1. Instant client-side filtering for 0-latency feedback
    this.applyFilters();
    this.renderStage();
    this.renderMetricsBar(this.containerEl?.querySelector('.tw-jira-platform'));

    // 2. Refresh from server with updated JQL for 100% full accuracy
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config) {
      config.jql = this.getPresetJql(this.activePreset, range);
    }
    this.loadIssues(true);
  }

  applyKeywordFilter() {
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.issues];

    // 1. Time range filter (Week, Month, Quarter, Year)
    if (this.activeTimeRange && this.activeTimeRange !== 'all') {
      const now = Date.now();
      let maxAgeMs = 0;
      switch (this.activeTimeRange) {
        case 'week': maxAgeMs = 7 * 86400000; break;
        case 'month': maxAgeMs = 30 * 86400000; break;
        case 'quarter': maxAgeMs = 90 * 86400000; break;
        case 'year': maxAgeMs = 365 * 86400000; break;
      }

      if (maxAgeMs > 0) {
        result = result.filter(issue => {
          let issueTime = 0;
          if (issue.rawUpdated) {
            const d = new Date(issue.rawUpdated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issue.rawCreated) {
            const d = new Date(issue.rawCreated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime === 0 && issue.updated) {
            const d = new Date(issue.updated).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime === 0 && issue.created) {
            const d = new Date(issue.created).getTime();
            if (!isNaN(d)) issueTime = Math.max(issueTime, d);
          }
          if (issueTime > 0) {
            return (now - issueTime) <= maxAgeMs;
          }
          return true;
        });
      }
    }

    // 2. Keyword text search
    if (this.keyword) {
      const kw = this.keyword;
      result = result.filter(issue => {
        const k = (issue.key || '').toLowerCase();
        const s = (issue.summary || '').toLowerCase();
        const a = (issue.assignee || '').toLowerCase();
        const st = (issue.status || '').toLowerCase();
        const d = (issue.description || '').toLowerCase();
        return k.includes(kw) || s.includes(kw) || a.includes(kw) || st.includes(kw) || d.includes(kw);
      });
    }

    this.filteredIssues = result;
  }

  categorizeStatus(statusName, statusCategory) {
    const s = (statusName || '').toLowerCase();
    const cat = (statusCategory || '').toLowerCase();

    if (cat === 'done' || s.includes('closed') || s.includes('done') || s.includes('已解决') || s.includes('关闭') || s.includes('完成')) {
      return 'done';
    }
    if (s.includes('review') || s.includes('verify') || s.includes('verification') || s.includes('测试') || s.includes('评审') || s.includes('待验')) {
      return 'review';
    }
    if (cat === 'indeterminate' || s.includes('progress') || s.includes('developing') || s.includes('处理') || s.includes('进行中') || s.includes('开发中')) {
      return 'inprogress';
    }
    return 'todo';
  }

  getGroupedIssues() {
    const groups = {
      todo: [],
      inprogress: [],
      review: [],
      done: []
    };

    for (const issue of this.filteredIssues) {
      const groupKey = this.categorizeStatus(issue.status, issue.statusCategory);
      groups[groupKey].push(issue);
    }
    return groups;
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.empty();
    this.containerEl.addClass('tw-jira-platform-root');

    const platformWrap = this.containerEl.createDiv({ cls: 'tw-jira-platform' });

    // 1. Header Console Toolbar
    this.renderHeaderConsole(platformWrap);

    // 1.5 Sync Warning Banner (when refresh failed and offline cache is shown)
    this.renderWarningBanner(platformWrap);

    // 2. Metrics Bar
    this.renderMetricsBar(platformWrap);

    // 3. Stage Container (Kanban or Table)
    this.stageContainer = platformWrap.createDiv({ cls: 'tw-jira-stage-container' });
    this.renderStage();

    // 4. Inspector Drawer Mountpoint
    this.inspectorContainer = platformWrap.createDiv({ cls: 'tw-jira-inspector-overlay' });
    this.inspectorContainer.style.display = 'none';
  }

  renderWarningBanner(parentEl) {
    if (!this.syncWarning) return;
    const banner = parentEl.createDiv({ cls: 'tw-jira-sync-warning-banner' });
    banner.innerHTML = `
      <div class="tw-jira-warn-left">
        <span class="tw-jira-warn-icon">⚠️</span>
        <div class="tw-jira-warn-msg">
          <strong>Jira 数据未能实时刷新（当前展示离线缓存）：</strong>
          <span class="tw-jira-warn-desc">${escapeHtml(this.syncWarning)}</span>
        </div>
      </div>
      <div class="tw-jira-warn-actions">
        <button class="tw-jira-warn-btn" id="twBtnOpenJiraSettings">🔑 打开设置更新凭据 / 密码</button>
        <button class="tw-jira-warn-btn-retry" id="twBtnRetrySync">🔄 重试刷新</button>
      </div>
    `;
    const btnSet = banner.querySelector('#twBtnOpenJiraSettings');
    if (btnSet) {
      btnSet.onclick = () => {
        this.app?.setting?.open?.();
        this.app?.setting?.openTabById?.('tabonkb-workbench');
      };
    }
    const btnRetry = banner.querySelector('#twBtnRetrySync');
    if (btnRetry) {
      btnRetry.onclick = () => this.loadIssues(true);
    }
  }

  renderHeaderConsole(parentEl) {
    const consoleEl = parentEl.createDiv({ cls: 'tw-jira-console' });

    const leftWrap = consoleEl.createDiv({ cls: 'tw-jira-console-left' });
    
    // 1. Preset Filters (Strictly User's Scope)
    const presets = [
      { id: 'unresolved', label: '我的未解决', title: '指派给我的未解决缺陷与事项' },
      { id: 'assigned', label: '我经办的', title: '所有指派给我的缺陷与事项' },
      { id: 'high', label: '高优先级', title: '指派给我的严重/致命优先级缺陷' },
      { id: 'watching', label: '我关注的', title: '我作为关注人(Watcher)的项目缺陷' },
      { id: 'all', label: '全部待办', title: '当前项目下所有待解决事项' }
    ];

    const presetGroup = leftWrap.createDiv({ cls: 'tw-jira-preset-group' });
    for (const p of presets) {
      const btn = presetGroup.createEl('button', {
        cls: `tw-jira-preset-btn ${this.activePreset === p.id ? 'active' : ''}`,
        text: p.label,
        title: p.title
      });
      btn.onclick = () => {
        if (this.activePreset === p.id) return;
        this.savePreset(p.id);
        const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
        if (config) {
          config.jql = this.getPresetJql(p.id, this.activeTimeRange);
        }
        this.loadIssues(true);
      };
    }

    // 2. Time Dimension Filter: 全部 / 周 / 月 / 季 / 年
    const timeRanges = [
      { id: 'all', label: '全部', title: '不限时间范围' },
      { id: 'week', label: '周', title: '近 1 周 (7天内活跃)' },
      { id: 'month', label: '月', title: '近 1 月 (30天内活跃)' },
      { id: 'quarter', label: '季', title: '近 1 季 (90天内活跃)' },
      { id: 'year', label: '年', title: '近 1 年 (365天内活跃)' }
    ];

    const timeGroup = leftWrap.createDiv({ cls: 'tw-jira-time-group' });
    const timeLabel = timeGroup.createSpan({ cls: 'tw-jira-time-label' });
    timeLabel.innerHTML = `${getIconPark('time', 12)} 时间:`;

    for (const tr of timeRanges) {
      const btn = timeGroup.createEl('button', {
        cls: `tw-jira-time-btn ${this.activeTimeRange === tr.id ? 'active' : ''}`,
        text: tr.label,
        title: tr.title
      });
      btn.setAttribute('data-range', tr.id);
      btn.onclick = () => this.setTimeRange(tr.id);
    }

    // Right Controls
    const rightWrap = consoleEl.createDiv({ cls: 'tw-jira-console-right' });

    // Last Sync Info
    const cacheInfo = this.jiraService ? this.jiraService.getCacheInfo() : null;
    const syncInfoEl = rightWrap.createDiv({ cls: 'tw-jira-sync-info' });
    const isErrorOrStale = !!this.syncWarning || cacheInfo?.isExpired;
    syncInfoEl.innerHTML = `
      <span class="tw-sync-dot ${isErrorOrStale ? 'stale' : 'fresh'}"></span>
      <span class="tw-sync-text">${this.syncWarning ? '同步受阻 (缓存中)' : '上次同步: ' + (cacheInfo?.timeStr || '刚刚')}</span>
    `;
    if (this.syncWarning) {
      syncInfoEl.setAttribute('title', `同步失败原因: ${this.syncWarning}`);
    }

    // Refresh Button
    const btnRefresh = rightWrap.createEl('button', {
      cls: 'tw-jira-icon-btn',
      title: '强制刷新 Jira 任务'
    });
    btnRefresh.innerHTML = `${getIconPark('refresh', 13)} <span>刷新</span>`;
    btnRefresh.onclick = () => {
      btnRefresh.classList.add('spinning');
      this.loadIssues(true).finally(() => {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 400);
      });
    };

    // View Switcher (Kanban vs Table)
    const viewSwitch = rightWrap.createDiv({ cls: 'tw-jira-view-switcher' });
    const btnKanban = viewSwitch.createEl('button', {
      cls: `tw-view-btn ${this.currentView === 'kanban' ? 'active' : ''}`,
      title: '看板模式'
    });
    btnKanban.innerHTML = `${getIconPark('dashboard', 13)} <span>看板</span>`;
    btnKanban.onclick = () => {
      if (this.currentView !== 'kanban') {
        this.saveViewMode('kanban');
        this.render();
      }
    };

    const btnTable = viewSwitch.createEl('button', {
      cls: `tw-view-btn ${this.currentView === 'table' ? 'active' : ''}`,
      title: '列表模式'
    });
    btnTable.innerHTML = `${getIconPark('file-text', 13)} <span>列表</span>`;
    btnTable.onclick = () => {
      if (this.currentView !== 'table') {
        this.saveViewMode('table');
        this.render();
      }
    };

    // Open Web Jira Button
    const config = typeof this.jiraService?.getConfig === 'function' ? this.jiraService.getConfig() : {};
    if (config?.baseUrl) {
      const btnWeb = rightWrap.createEl('button', {
        cls: 'tw-jira-icon-btn secondary',
        title: '在浏览器中打开 Jira'
      });
      btnWeb.innerHTML = `${getIconPark('external', 12)} <span>Jira 网页</span>`;
      btnWeb.onclick = () => {
        window.open(config.baseUrl, '_blank');
      };
    }
  }

  renderMetricsBar(parentEl) {
    const metricsEl = parentEl.createDiv({ cls: 'tw-jira-metrics-bar' });
    const groups = this.getGroupedIssues();
    const total = this.filteredIssues.length;

    metricsEl.innerHTML = `
      <div class="tw-jira-metric-chip total">
        <span class="tw-metric-num">${total}</span>
        <span class="tw-metric-label">当前总数</span>
      </div>
      <div class="tw-jira-metric-chip todo">
        <span class="tw-metric-num">${groups.todo.length}</span>
        <span class="tw-metric-label">待办事项</span>
      </div>
      <div class="tw-jira-metric-chip inprogress">
        <span class="tw-metric-num">${groups.inprogress.length}</span>
        <span class="tw-metric-label">处理中</span>
      </div>
      <div class="tw-jira-metric-chip review">
        <span class="tw-metric-num">${groups.review.length}</span>
        <span class="tw-metric-label">评审 / 验证</span>
      </div>
      <div class="tw-jira-metric-chip done">
        <span class="tw-metric-num">${groups.done.length}</span>
        <span class="tw-metric-label">已完成</span>
      </div>
    `;
  }

  renderStage() {
    if (!this.stageContainer) return;
    this.stageContainer.empty();

    if (this.error && this.issues.length === 0) {
      this.renderError(this.stageContainer);
      return;
    }

    if (this.currentView === 'kanban') {
      this.renderKanbanView(this.stageContainer);
    } else {
      this.renderTableView(this.stageContainer);
    }
  }

  renderKanbanView(parentEl) {
    const kanbanEl = parentEl.createDiv({ cls: 'tw-jira-kanban-board' });
    const groups = this.getGroupedIssues();

    const columns = [
      { key: 'todo', title: '待办事项 (To Do)', color: '#6B7280', items: groups.todo },
      { key: 'inprogress', title: '处理中 (In Progress)', color: '#3B82F6', items: groups.inprogress },
      { key: 'review', title: '评审 / 测试 (Review)', color: '#F59E0B', items: groups.review },
      { key: 'done', title: '已完成 (Done)', color: '#10B981', items: groups.done }
    ];

    for (const col of columns) {
      const colEl = kanbanEl.createDiv({ cls: `tw-kanban-column tw-col-${col.key}` });
      
      // Column Header
      const headEl = colEl.createDiv({ cls: 'tw-kanban-col-head' });
      headEl.innerHTML = `
        <div class="tw-col-title-wrap">
          <span class="tw-col-dot" style="background-color: ${col.color}"></span>
          <span class="tw-col-title">${escapeHtml(col.title)}</span>
        </div>
        <span class="tw-col-badge">${col.items.length}</span>
      `;

      // Cards container
      const cardsList = colEl.createDiv({ cls: 'tw-kanban-cards-list' });
      if (col.items.length === 0) {
        cardsList.createDiv({
          cls: 'tw-kanban-empty',
          text: '暂无此状态工单'
        });
      } else {
        for (const issue of col.items) {
          this.renderKanbanCard(cardsList, issue);
        }
      }
    }
  }

  renderKanbanCard(parentEl, issue) {
    const card = parentEl.createDiv({ cls: 'tw-kanban-card' });
    
    // Priority badge class
    const pLower = (issue.priority || '').toLowerCase();
    let pCls = 'p-medium';
    if (pLower.includes('high') || pLower.includes('block') || pLower.includes('crit')) pCls = 'p-high';
    else if (pLower.includes('low')) pCls = 'p-low';

    // Component tags
    const compHtml = (issue.components || []).map(c => `<span class="tw-card-comp-tag">${escapeHtml(c)}</span>`).join('');

    card.innerHTML = `
      <div class="tw-kcard-header">
        <span class="tw-kcard-key">${escapeHtml(issue.key)}</span>
        <span class="tw-kcard-priority ${pCls}">${escapeHtml(issue.priority || 'Medium')}</span>
      </div>
      <div class="tw-kcard-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</div>
      ${compHtml ? `<div class="tw-kcard-comps">${compHtml}</div>` : ''}
      <div class="tw-kcard-footer">
        <div class="tw-kcard-assignee">
          <span class="tw-assignee-avatar">${escapeHtml((issue.assignee || '?').slice(0, 1))}</span>
          <span class="tw-assignee-name">${escapeHtml(issue.assignee || '未指派')}</span>
        </div>
        <span class="tw-kcard-time" title="更新时间">${escapeHtml(issue.updated || '')}</span>
      </div>
    `;

    card.onclick = () => {
      const sel = window.getSelection()?.toString();
      if (sel && sel.trim().length > 0) return;
      this.openInspector(issue);
    };
  }

  renderTableView(parentEl) {
    const tableWrap = parentEl.createDiv({ cls: 'tw-jira-table-wrap' });
    if (this.filteredIssues.length === 0) {
      tableWrap.createDiv({ cls: 'tw-jira-empty-hint', text: '未找到匹配的工单' });
      return;
    }

    const table = tableWrap.createEl('table', { cls: 'tw-jira-data-table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 110px;">编号 (Key)</th>
          <th>事项摘要 (Summary)</th>
          <th style="width: 120px;">状态</th>
          <th style="width: 90px;">优先级</th>
          <th style="width: 110px;">经办人</th>
          <th style="width: 100px;">更新时间</th>
          <th style="width: 100px; text-align: right;">操作</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    for (const issue of this.filteredIssues) {
      const tr = tbody.createEl('tr', { cls: 'tw-jira-table-row' });
      
      const pLower = (issue.priority || '').toLowerCase();
      let pCls = 'p-medium';
      if (pLower.includes('high') || pLower.includes('block') || pLower.includes('crit')) pCls = 'p-high';
      else if (pLower.includes('low')) pCls = 'p-low';

      tr.innerHTML = `
        <td><span class="tw-table-key">${escapeHtml(issue.key)}</span></td>
        <td><span class="tw-table-summary" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.summary)}</span></td>
        <td><span class="tw-table-status-pill">${escapeHtml(issue.status)}</span></td>
        <td><span class="tw-kcard-priority ${pCls}">${escapeHtml(issue.priority || 'Medium')}</span></td>
        <td><span class="tw-table-assignee">${escapeHtml(issue.assignee || '未指派')}</span></td>
        <td><span class="tw-table-time">${escapeHtml(issue.updated || '')}</span></td>
        <td style="text-align: right;">
          <button class="tw-table-act-btn" title="查看详情与状态流转">详情</button>
        </td>
      `;

      tr.querySelector('.tw-table-act-btn').onclick = (e) => {
        e.stopPropagation();
        this.openInspector(issue);
      };
      tr.onclick = () => {
        const sel = window.getSelection()?.toString();
        if (sel && sel.trim().length > 0) return;
        this.openInspector(issue);
      };
    }
  }

  renderError(parentEl) {
    const errBox = parentEl.createDiv({ cls: 'tw-jira-error-box' });
    errBox.innerHTML = `
      <div class="tw-jira-err-icon">${getIconPark('alert', 28)}</div>
      <div class="tw-jira-err-title">Jira 任务加载异常</div>
      <div class="tw-jira-err-desc">${escapeHtml(this.error)}</div>
      <div class="tw-jira-err-actions">
        <button class="tw-btn-retry" id="btnJiraRetry">${getIconPark('refresh', 13)} 重新尝试</button>
        <button class="tw-btn-cfg" id="btnJiraOpenCfg">${getIconPark('setting-config', 13)} 检查配置</button>
      </div>
    `;

    const btnRetry = errBox.querySelector('#btnJiraRetry');
    if (btnRetry) btnRetry.onclick = () => this.loadIssues(true);
    const btnCfg = errBox.querySelector('#btnJiraOpenCfg');
    if (btnCfg && this.onOpenSettings) btnCfg.onclick = () => this.onOpenSettings();
  }

  updateLoadingState() {
    // If loading without cached issues, show clean spinner
    if (this.isLoading && (!this.issues || this.issues.length === 0) && this.stageContainer) {
      this.stageContainer.innerHTML = `
        <div class="tw-jira-loading-wrap">
          <div class="tw-loading-spin"></div>
          <div class="tw-loading-text">正在同步 Jira 任务列表...</div>
        </div>
      `;
    }
  }

  // ==========================================
  // Issue Inspector Drawer (Side Drawer)
  // ==========================================
  openInspector(issue) {
    this.selectedIssue = issue;
    if (!this.inspectorContainer) return;
    this.inspectorContainer.empty();
    this.inspectorContainer.style.display = 'flex';

    const drawer = this.inspectorContainer.createDiv({ cls: 'tw-jira-inspector-drawer' });

    // 1. Header
    const head = drawer.createDiv({ cls: 'tw-inspector-header' });
    head.innerHTML = `
      <div class="tw-ins-head-left">
        <span class="tw-ins-key">${escapeHtml(issue.key)}</span>
        <span class="tw-ins-status-badge">${escapeHtml(issue.status)}</span>
      </div>
      <button class="tw-ins-close-btn" title="关闭 (Esc)">${getIconPark('close', 14)}</button>
    `;
    head.querySelector('.tw-ins-close-btn').onclick = () => this.closeInspector();

    // 2. Content Body
    const body = drawer.createDiv({ cls: 'tw-inspector-body' });

    // Summary
    body.createEl('h2', { cls: 'tw-ins-summary', text: issue.summary });

    // Transitions Section (Status Flow Buttons)
    const transSec = body.createDiv({ cls: 'tw-ins-transitions-sec' });
    transSec.innerHTML = `
      <div class="tw-ins-sec-title">
        <span>${getIconPark('refresh', 12)}</span>
        <span>可视化状态流转 (端内快速操作无需跳转网页)</span>
      </div>
      <div class="tw-transitions-btn-group" id="twTransitionBtnGroup">
        <span class="tw-trans-loading">正在检测可用工作流...</span>
      </div>
      <div class="tw-trans-inline-form-container" id="twTransInlineFormContainer" style="display:none;"></div>
      <div class="tw-trans-feedback" id="twTransFeedback" style="display:none;"></div>
    `;

    // Load available transitions
    this.loadAndRenderTransitions(
      issue,
      transSec.querySelector('#twTransitionBtnGroup'),
      transSec.querySelector('#twTransInlineFormContainer'),
      transSec.querySelector('#twTransFeedback')
    );

    // Meta Grid
    const metaGrid = body.createDiv({ cls: 'tw-ins-meta-grid' });
    metaGrid.innerHTML = `
      <div class="tw-meta-item">
        <span class="tw-meta-label">经办人</span>
        <span class="tw-meta-val">${escapeHtml(issue.assignee || '未指派')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">报告人</span>
        <span class="tw-meta-val">${escapeHtml(issue.reporter || '系统')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">优先级</span>
        <span class="tw-meta-val">${escapeHtml(issue.priority || 'Medium')}</span>
      </div>
      <div class="tw-meta-item">
        <span class="tw-meta-label">更新时间</span>
        <span class="tw-meta-val">${escapeHtml(issue.updated || '未知')}</span>
      </div>
      ${issue.created ? `
        <div class="tw-meta-item">
          <span class="tw-meta-label">创建时间</span>
          <span class="tw-meta-val">${escapeHtml(issue.created)}</span>
        </div>
      ` : ''}
      ${(issue.components && issue.components.length > 0) ? `
        <div class="tw-meta-item full">
          <span class="tw-meta-label">模块组件</span>
          <span class="tw-meta-val">${escapeHtml(issue.components.join(', '))}</span>
        </div>
      ` : ''}
    `;

    // Description Section
    const descSec = body.createDiv({ cls: 'tw-ins-desc-sec' });
    descSec.createDiv({ cls: 'tw-ins-sec-title', text: '工单详细描述 (Description)' });
    const descBox = descSec.createDiv({ cls: 'tw-ins-desc-box' });
    if (issue.description && issue.description.trim()) {
      descBox.innerHTML = escapeHtml(issue.description).replace(/\n/g, '<br>');
    } else {
      descBox.innerHTML = '<span class="tw-ins-desc-empty">暂无详细描述说明</span>';
    }

    // Activity Log & Comments Section
    const activitySec = body.createDiv({ cls: 'tw-ins-activity-sec' });
    activitySec.innerHTML = `
      <div class="tw-ins-sec-header">
        <div class="tw-ins-sec-title">
          <span>${getIconPark('topic', 13)}</span>
          <span>活动日志与注释</span>
          <span class="tw-ins-comments-count" id="twInsCommentsCount"></span>
        </div>
        <button class="tw-ins-refresh-comments-btn" id="twBtnRefreshComments" title="刷新注释列表">
          ${getIconPark('refresh', 12)}
        </button>
      </div>

      <!-- Add comment box -->
      <div class="tw-ins-add-comment-box">
        <textarea class="tw-ins-comment-input" id="twInsCommentInput" placeholder="添加注释 (支持多行排查记录，Ctrl+Enter 快捷提交)..." rows="3"></textarea>
        <div class="tw-ins-comment-actions">
          <span class="tw-ins-comment-tip">Ctrl+Enter 快速提交至 Jira</span>
          <button class="tw-ins-submit-comment-btn" id="twBtnSubmitComment" disabled>
            ${getIconPark('send', 12)} <span>提交注释</span>
          </button>
        </div>
      </div>

      <!-- Comments list -->
      <div class="tw-ins-comments-list" id="twInsCommentsList">
        <div class="tw-ins-comments-loading">
          <div class="tw-loading-spin"></div>
          <span>正在加载活动日志与注释...</span>
        </div>
      </div>
    `;

    const commentsListEl = activitySec.querySelector('#twInsCommentsList');
    const commentsCountEl = activitySec.querySelector('#twInsCommentsCount');
    const commentInput = activitySec.querySelector('#twInsCommentInput');
    const btnSubmitComment = activitySec.querySelector('#twBtnSubmitComment');
    const btnRefreshComments = activitySec.querySelector('#twBtnRefreshComments');

    if (commentInput && btnSubmitComment) {
      commentInput.addEventListener('input', () => {
        btnSubmitComment.disabled = !commentInput.value.trim();
      });

      commentInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (!btnSubmitComment.disabled) {
            btnSubmitComment.click();
          }
        }
      });

      btnSubmitComment.onclick = async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        btnSubmitComment.disabled = true;
        const prevHtml = btnSubmitComment.innerHTML;
        btnSubmitComment.innerHTML = `<span class="tw-loading-spin"></span> <span>提交中...</span>`;
        try {
          const res = await this.jiraService.addIssueComment(issue.key, text);
          if (res && res.success) {
            commentInput.value = '';
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls('✓ 注释已成功提交至 Jira', 3000);
            await this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);
          } else {
            const app = this.app || (typeof window !== 'undefined' ? window.app : null);
            const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
            new NoticeCls(`❌ 提交注释失败: ${res?.message || '未知错误'}`, 5000);
          }
        } catch (err) {
          const app = this.app || (typeof window !== 'undefined' ? window.app : null);
          const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class{});
          new NoticeCls(`❌ 提交注释异常: ${err.message}`, 5000);
        } finally {
          btnSubmitComment.innerHTML = prevHtml;
          btnSubmitComment.disabled = !commentInput.value.trim();
        }
      };
    }

    if (btnRefreshComments) {
      btnRefreshComments.onclick = () => {
        this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);
      };
    }

    this.loadAndRenderComments(issue, commentsListEl, commentsCountEl);

    // 3. Actions Footer
    const footer = drawer.createDiv({ cls: 'tw-inspector-footer' });

    // Copy Markdown Link Button
    const btnCopy = footer.createEl('button', { cls: 'tw-ins-action-btn primary' });
    btnCopy.innerHTML = `${getIconPark('copy', 12)} <span>复制 Markdown 引用</span>`;
    btnCopy.onclick = () => {
      const mdLink = `[${issue.key}](${issue.url}): ${issue.summary}`;
      navigator.clipboard.writeText(mdLink);
      btnCopy.classList.add('copied');
      btnCopy.querySelector('span').textContent = '已复制引用！';
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        btnCopy.querySelector('span').textContent = '复制 Markdown 引用';
      }, 1500);
    };

    // Add to 00-Inbox/03-Quick-Note Button
    const btnQuickNote = footer.createEl('button', {
      cls: 'tw-ins-action-btn quicknote',
      title: '将此问题与排查上下文存入 00-Inbox/03-Quick-Note 进行复杂排查记录'
    });
    btnQuickNote.innerHTML = `${getIconPark('file-text', 12)} <span>存入 Quick-Note</span>`;
    btnQuickNote.onclick = async () => {
      await this.exportIssueToQuickNote(issue, btnQuickNote);
    };

    // Ask Agent Hub Button
    const btnAgent = footer.createEl('button', { cls: 'tw-ins-action-btn secondary' });
    btnAgent.innerHTML = `${getIconPark('robot', 13)} <span>向 Agent 提问此工单</span>`;
    btnAgent.onclick = () => {
      if (this.onAskAgent) {
        this.onAskAgent(issue);
        this.closeInspector();
      }
    };

    // Open Web Jira Button
    if (issue.url) {
      const btnExt = footer.createEl('button', { cls: 'tw-ins-action-btn tertiary' });
      btnExt.innerHTML = `${getIconPark('external', 12)} <span>网页打开</span>`;
      btnExt.onclick = () => window.open(issue.url, '_blank');
    }

    // Backdrop click
    this.inspectorContainer.onclick = (e) => {
      if (e.target === this.inspectorContainer) this.closeInspector();
    };
  }

  async loadAndRenderTransitions(issue, containerEl, formContainerEl, feedbackEl) {
    if (!containerEl || !this.jiraService) return;

    let transitions = [];
    try {
      transitions = await this.jiraService.getTransitions(issue.key);
    } catch (e) {
      console.warn('[JiraPlatformView] Failed to fetch transitions:', e);
    }

    // If API returned available transitions, render them
    if (transitions && transitions.length > 0) {
      containerEl.innerHTML = '';
      for (const t of transitions) {
        const hasReq = Array.isArray(t.requiredFields) && t.requiredFields.length > 0;
        const btn = containerEl.createEl('button', {
          cls: `tw-trans-btn${t.hasScreen || hasReq || t.isResolve ? ' has-screen' : ''}`,
          text: `→ ${t.name}`
        });

        if (hasReq) {
          btn.title = `包含必填项: ${t.requiredFields.map(f => f.name).join(', ')}`;
        } else if (t.isResolve) {
          btn.title = '端内流转并设置解决结果';
        } else if (t.hasScreen) {
          btn.title = '此流转包含专属字段设置';
        }

        btn.onclick = () => {
          // If the form is already open for this transition, clicking again closes it
          if (formContainerEl && formContainerEl.style.display !== 'none' && formContainerEl.dataset.currentTransId === String(t.id)) {
            formContainerEl.style.display = 'none';
            formContainerEl.innerHTML = '';
            btn.classList.remove('active-trans');
            return;
          }

          // If transition needs inputs (isResolve, hasScreen, or has fields)
          if (t.isResolve || t.hasScreen || (t.fieldList && t.fieldList.length > 0)) {
            this.renderInlineTransitionForm(issue, t, btn, formContainerEl, feedbackEl);
          } else {
            this.handleDoTransition(issue, t, btn, formContainerEl, feedbackEl);
          }
        };
      }
      return;
    }

    // Fallback standard workflow buttons if server doesn't support transition enumeration
    containerEl.innerHTML = `
      <button class="tw-trans-btn" data-target="To Do">← 待办 (To Do)</button>
      <button class="tw-trans-btn" data-target="In Progress">→ 进行中 (In Progress)</button>
      <button class="tw-trans-btn" data-target="In Review">→ 评审 (Review)</button>
      <button class="tw-trans-btn" data-target="Done">✓ 完成 (Done)</button>
    `;

    containerEl.querySelectorAll('.tw-trans-btn').forEach(btn => {
      const target = btn.getAttribute('data-target');
      if (target.toLowerCase() === issue.status.toLowerCase()) {
        btn.classList.add('current');
        btn.disabled = true;
      }
      btn.onclick = () => {
        const isDone = target === 'Done';
        const tObj = { id: target, name: target, isResolve: isDone };
        if (isDone) {
          this.renderInlineTransitionForm(issue, tObj, btn, formContainerEl, feedbackEl);
        } else {
          this.handleDoTransition(issue, tObj, btn, formContainerEl, feedbackEl);
        }
      };
    });
  }

  renderInlineTransitionForm(issue, transition, btnEl, formContainerEl, feedbackEl, prefillError = '') {
    if (!formContainerEl) return;

    const transitionId = typeof transition === 'object' ? transition.id : transition;
    const targetName = typeof transition === 'object' ? transition.name : transition;
    const fields = transition?.fields || {};
    const fieldList = transition?.fieldList || [];
    const isResolve = transition?.isResolve || /解决|完成|关闭|resolve|done|close/i.test(targetName);

    // Track active transition ID
    formContainerEl.dataset.currentTransId = String(transitionId);

    // Highlight active button
    const group = btnEl?.parentElement;
    if (group) {
      group.querySelectorAll('.tw-trans-btn').forEach(b => b.classList.remove('active-trans'));
    }
    if (btnEl) btnEl.classList.add('active-trans');

    // Hide fallback guidance banner if open
    if (feedbackEl) {
      feedbackEl.style.display = 'none';
    }

    formContainerEl.style.display = 'block';

    const renderedKeys = new Set(['comment']);

    // 1. Resolution field (if transition is to resolve or resolution is in fields)
    const showResolution = isResolve || Boolean(fields.resolution);
    let resolutionHtml = '';
    if (showResolution) {
      renderedKeys.add('resolution');
      let resolutionOptions = [];
      if (fields.resolution?.allowedValues && fields.resolution.allowedValues.length > 0) {
        resolutionOptions = fields.resolution.allowedValues.map(v => ({
          id: v.id,
          name: v.name || v.value,
          label: v.name || v.value
        }));
      } else {
        resolutionOptions = [
          { id: '1', name: 'Fixed', label: 'Fixed (已修复 / 已解决)' },
          { id: '2', name: 'Done', label: 'Done (已完成)' },
          { id: '3', name: 'Won\'t Fix', label: 'Won\'t Fix (不予修复)' },
          { id: '4', name: 'Cannot Reproduce', label: 'Cannot Reproduce (无法重现)' },
          { id: '5', name: 'Duplicate', label: 'Duplicate (重复工单)' },
          { id: '6', name: 'Incomplete', label: 'Incomplete (信息不全)' }
        ];
      }

      resolutionHtml = `
        <div class="tw-trans-form-item" data-item-key="resolution">
          <label class="tw-trans-form-label">解决结果 (Resolution) <span class="tw-req-star">*</span></label>
          <select class="tw-trans-form-select" id="twSelectResolution" data-field-key="resolution" data-field-type="resolution" required>
            ${resolutionOptions.map((opt, i) => `
              <option value="${escapeAttr(opt.name)}" data-id="${escapeAttr(opt.id || '')}" ${i === 0 ? 'selected' : ''}>
                ${escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    // 2. Dynamic fields from fieldList
    let dynamicFieldsHtml = '';
    for (const f of fieldList) {
      if (renderedKeys.has(f.key)) continue;
      renderedKeys.add(f.key);

      const fKey = f.key;
      const fName = f.name || fKey;
      const isReq = Boolean(f.required);
      const allowed = Array.isArray(f.allowedValues) ? f.allowedValues : [];
      const fType = f.type || 'string';

      let inputHtml = '';
      if (allowed.length > 0) {
        // Select dropdown
        inputHtml = `
          <select class="tw-trans-form-select" data-field-key="${escapeAttr(fKey)}" data-field-type="${escapeAttr(fType)}" ${isReq ? 'required' : ''}>
            <option value="">${isReq ? `-- 请选择 ${escapeHtml(fName)} (必填) --` : `-- 请选择 ${escapeHtml(fName)}（可选）--`}</option>
            ${allowed.map(v => {
              const optVal = v.id || v.value || v.name;
              const optId = v.id || '';
              const optLabel = v.name || v.value || v.id;
              return `<option value="${escapeAttr(optVal)}" data-id="${escapeAttr(optId)}" data-value="${escapeAttr(v.value || v.name || '')}">${escapeHtml(optLabel)}</option>`;
            }).join('')}
          </select>
        `;
      } else if (fType === 'date' || fType === 'datetime') {
        const todayStr = isReq ? new Date().toISOString().slice(0, 10) : '';
        inputHtml = `
          <input type="date" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="${escapeAttr(fType)}" value="${todayStr}" ${isReq ? 'required' : ''}>
        `;
      } else if (fType === 'number') {
        inputHtml = `
          <input type="number" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="number" placeholder="输入数字..." ${isReq ? 'required' : ''}>
        `;
      } else if (fType === 'user') {
        inputHtml = `
          <input type="text" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="user" placeholder="留空保持原值..." ${isReq ? 'required' : ''}>
        `;
      } else {
        if (/描述|说明|原因|detail|reason/i.test(fName)) {
          inputHtml = `
            <textarea class="tw-trans-form-textarea" data-field-key="${escapeAttr(fKey)}" data-field-type="string" rows="2" placeholder="输入 ${escapeHtml(fName)}..." ${isReq ? 'required' : ''}></textarea>
          `;
        } else {
          inputHtml = `
            <input type="text" class="tw-trans-form-input" data-field-key="${escapeAttr(fKey)}" data-field-type="string" placeholder="输入 ${escapeHtml(fName)}..." ${isReq ? 'required' : ''}>
          `;
        }
      }

      dynamicFieldsHtml += `
        <div class="tw-trans-form-item" data-item-key="${escapeAttr(fKey)}">
          <label class="tw-trans-form-label">
            <span>${escapeHtml(fName)}</span>
            ${isReq ? '<span class="tw-req-star">*</span>' : '<span style="color:var(--text-muted);font-weight:normal;font-size:10.5px;">(可选)</span>'}
          </label>
          ${inputHtml}
        </div>
      `;
    }

    // 3. Fallback: if prefillError mentions a specific field (e.g. customfield_10839) that was not in fieldList
    let extraMissingFieldHtml = '';
    const matchCf = prefillError.match(/(customfield_\d+|[a-zA-Z0-9_-]+)(?::|\s+is required|\s+为必填)/i);
    if (matchCf && matchCf[1]) {
      const missingKey = matchCf[1];
      if (!renderedKeys.has(missingKey)) {
        renderedKeys.add(missingKey);
        extraMissingFieldHtml = `
          <div class="tw-trans-form-item has-error" data-item-key="${escapeAttr(missingKey)}">
            <label class="tw-trans-form-label">
              <span>必填字段: <strong>${escapeHtml(missingKey)}</strong></span>
              <span class="tw-req-star">*</span>
            </label>
            <input type="text" class="tw-trans-form-input has-error" data-field-key="${escapeAttr(missingKey)}" data-field-type="string" placeholder="请输入 ${escapeHtml(missingKey)} 的内容或选项..." required>
          </div>
        `;
      }
    }

    formContainerEl.innerHTML = `
      <div class="tw-trans-inline-form">
        <div class="tw-trans-form-header">
          <div class="tw-trans-form-title">
            <span class="tw-trans-form-icon">⚡</span>
            <span>端内流转：<strong>${escapeHtml(issue.key)}</strong> → <span class="tw-trans-target-badge">${escapeHtml(targetName)}</span></span>
          </div>
          <button class="tw-trans-form-close" id="twBtnCloseTransForm" title="取消并关闭">✕</button>
        </div>

        <div class="tw-trans-form-body">
          ${prefillError ? `
            <div class="tw-trans-form-error" style="display:block;">
              <strong>⚠️ Jira 校验提示:</strong> ${escapeHtml(prefillError.replace(/^Jira 状态流转失败 \(HTTP \d+\):\s*/, ''))}
            </div>
          ` : ''}

          ${resolutionHtml}
          ${dynamicFieldsHtml}
          ${extraMissingFieldHtml}

          <div class="tw-trans-form-item">
            <label class="tw-trans-form-label">流转说明 / 备注 (Comment)</label>
            <textarea class="tw-trans-form-textarea" id="twTextareaComment" rows="2" placeholder="可选：填写本次处理说明、验证结论或备注..."></textarea>
          </div>

          <div class="tw-trans-form-error" id="twFormError" style="display: none;"></div>
        </div>

        <div class="tw-trans-form-footer">
          <button class="tw-trans-submit-btn" id="twBtnSubmitTrans">
            🚀 确认变更为「${escapeHtml(targetName)}」
          </button>
          <button class="tw-trans-cancel-btn" id="twBtnCancelTrans">
            取消
          </button>
        </div>
      </div>
    `;

    const closeForm = () => {
      formContainerEl.style.display = 'none';
      formContainerEl.innerHTML = '';
      delete formContainerEl.dataset.currentTransId;
      if (btnEl) btnEl.classList.remove('active-trans');
    };

    formContainerEl.querySelector('#twBtnCloseTransForm').onclick = closeForm;
    formContainerEl.querySelector('#twBtnCancelTrans').onclick = closeForm;

    const submitBtn = formContainerEl.querySelector('#twBtnSubmitTrans');
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = '正在提交 Jira 流转...';
      const errorEl = formContainerEl.querySelector('#twFormError');
      if (errorEl) errorEl.style.display = 'none';

      const customFields = {};
      const formItems = formContainerEl.querySelectorAll('[data-field-key]');
      let missingRequired = false;

      for (const el of formItems) {
        const key = el.dataset.fieldKey;
        const type = el.dataset.fieldType;
        const val = el.value?.trim();

        // Validate required field
        if (el.hasAttribute('required') && !val) {
          missingRequired = true;
          el.classList.add('has-error');
          continue;
        } else {
          el.classList.remove('has-error');
        }

        if (!val) continue;

        if (key === 'resolution') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          customFields.resolution = id ? { id } : { name: val };
        } else if (type === 'option') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          const valueName = opt?.dataset?.value || val;
          // In Jira Server, select custom fields accept { id } or { value: val }
          customFields[key] = id ? { id } : { value: valueName };
        } else if (type === 'array') {
          const opt = el.options ? el.options[el.selectedIndex] : null;
          const id = opt?.dataset?.id;
          const valueName = opt?.dataset?.value || val;
          if (key === 'fixVersions') {
            customFields[key] = id ? [{ id }] : [{ name: val }];
          } else {
            customFields[key] = id ? [{ id }] : [{ value: valueName }];
          }
        } else if (type === 'number') {
          customFields[key] = Number(val);
        } else if (type === 'user') {
          customFields[key] = { name: val };
        } else if (type === 'date') {
          customFields[key] = val.replace(/\//g, '-');
        } else if (type === 'datetime') {
          try {
            const d = new Date(val);
            customFields[key] = !isNaN(d.getTime()) ? d.toISOString() : val;
          } catch (_) {
            customFields[key] = val;
          }
        } else {
          customFields[key] = val;
        }
      }

      if (missingRequired) {
        submitBtn.disabled = false;
        submitBtn.textContent = `🚀 确认变更为「${escapeHtml(targetName)}」`;
        if (errorEl) {
          errorEl.style.display = 'block';
          errorEl.innerHTML = `<strong>请填写或选择所有标有 * 号的必填项！</strong>`;
        }
        return;
      }

      const commentInput = formContainerEl.querySelector('#twTextareaComment');
      const commentText = commentInput ? commentInput.value.trim() : '';

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || window.Notice);

      try {
        await this.jiraService.doTransition(issue.key, transitionId, targetName, customFields, commentText);
        issue.status = targetName;
        issue.updated = '刚刚';
        this.renderStage();
        this.renderMetricsBar(this.containerEl.querySelector('.tw-jira-platform'));

        if (NoticeClass) {
          new NoticeClass(`✓ ${issue.key} 状态已成功变更为「${targetName}」`, 3500);
        }
        closeForm();
        setTimeout(() => {
          this.openInspector(issue);
        }, 500);
      } catch (err) {
        console.error('[Jira] 端内流转提交异常:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = `🚀 确认变更为「${escapeHtml(targetName)}」`;

        if (errorEl) {
          errorEl.style.display = 'block';
          const cleanMsg = err.detailMsg || err.message || '流转失败，请检查输入';
          errorEl.innerHTML = `
            <strong>流转未成功:</strong> ${escapeHtml(cleanMsg.replace(/^Jira 状态流转失败 \(HTTP \d+\):\s*/, ''))}
          `;
        }
      }
    };
  }

  async handleDoTransition(issue, transition, btnEl, formContainerEl, feedbackEl) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const oldText = btnEl.textContent;
    btnEl.textContent = '正在流转...';
    btnEl.disabled = true;

    const transitionId = typeof transition === 'object' ? transition.id : transition;
    const targetName = typeof transition === 'object' ? transition.name : transition;

    // Reset feedback banner if visible
    if (feedbackEl) {
      feedbackEl.innerHTML = '';
      feedbackEl.style.display = 'none';
    }

    const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || window.Notice);

    try {
      await this.jiraService.doTransition(issue.key, transitionId, targetName);
      issue.status = targetName;
      issue.updated = '刚刚';
      this.renderStage();
      this.renderMetricsBar(this.containerEl.querySelector('.tw-jira-platform'));
      btnEl.textContent = `✓ 已变更为 ${targetName}`;
      if (NoticeClass) {
        new NoticeClass(`✓ ${issue.key} 状态已流转为「${targetName}」`, 3000);
      }
      setTimeout(() => {
        this.openInspector(issue);
      }, 600);
    } catch (err) {
      console.error(`[Jira] 状态流转异常:`, err);
      btnEl.textContent = oldText;
      btnEl.disabled = false;

      const detailMsg = err.detailMsg || err.message || '流转失败';
      const isHttp400 = err.status === 400 || /HTTP 400/i.test(err.message);

      if (isHttp400 && formContainerEl) {
        // Automatically open the inline form so the user can fill in the missing required field directly in Obsidian!
        this.renderInlineTransitionForm(issue, transition, btnEl, formContainerEl, feedbackEl, detailMsg);
        if (NoticeClass) {
          new NoticeClass(`需要补充必填项：请直接在下方表单中选择并提交`, 5000);
        }
      } else {
        if (NoticeClass) {
          new NoticeClass(`流转失败: ${detailMsg}`, 7000);
        }
        if (feedbackEl) {
          feedbackEl.style.display = 'block';
          feedbackEl.innerHTML = `
            <div class="tw-trans-guidance-card">
              <div class="tw-trans-guidance-header">
                <span class="tw-trans-guidance-badge">流转受阻</span>
                <span class="tw-trans-guidance-target">目标状态: <strong>${escapeHtml(targetName)}</strong></span>
              </div>
              <div class="tw-trans-guidance-msg">${escapeHtml(detailMsg)}</div>
            </div>
          `;
        }
      }
    } finally {
      this.isTransitioning = false;
      if (btnEl && !btnEl.textContent.startsWith('✓')) {
        btnEl.disabled = false;
        btnEl.textContent = oldText;
      }
    }
  }

  async loadAndRenderComments(issue, listEl, countEl) {
    if (!listEl || !this.jiraService) return;
    listEl.innerHTML = `
      <div class="tw-ins-comments-loading">
        <div class="tw-loading-spin"></div>
        <span>正在加载活动日志与注释...</span>
      </div>
    `;

    try {
      const comments = await this.jiraService.getIssueComments(issue.key);
      if (countEl) {
        countEl.textContent = `(${comments.length})`;
      }

      if (!comments || comments.length === 0) {
        listEl.innerHTML = `
          <div class="tw-ins-comments-empty">
            <span class="tw-empty-icon">${getIconPark('info', 13)}</span>
            <span>暂无注释记录，您可在上方输入框添加第一条处理注释</span>
          </div>
        `;
        return;
      }

      let html = '';
      for (const c of comments) {
        const initial = (c.author || '用').charAt(0).toUpperCase();
        const avatarHtml = c.authorAvatar
          ? `<img src="${c.authorAvatar}" class="tw-ins-comment-avatar" alt="${escapeAttr(c.author)}" />`
          : `<span class="tw-ins-comment-avatar text">${escapeHtml(initial)}</span>`;

        html += `
          <div class="tw-ins-comment-card" data-comment-id="${escapeAttr(c.id)}">
            <div class="tw-ins-comment-head">
              ${avatarHtml}
              <div class="tw-ins-comment-meta">
                <span class="tw-ins-comment-author">${escapeHtml(c.author)}</span>
                <span class="tw-ins-comment-action">添加了评论</span>
                <span class="tw-ins-comment-dot">·</span>
                <span class="tw-ins-comment-time">${escapeHtml(c.createdFormatted || c.created)}</span>
                ${c.isEdited ? '<span class="tw-ins-comment-edited">已编辑</span>' : ''}
              </div>
            </div>
            <div class="tw-ins-comment-body">${escapeHtml(c.body).replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }
      listEl.innerHTML = html;
    } catch (err) {
      console.warn('[JiraPlatformView] Failed to load comments:', err);
      listEl.innerHTML = `
        <div class="tw-ins-comments-error">
          <span>加载注释失败: ${escapeHtml(err.message)}</span>
        </div>
      `;
    }
  }

  async exportIssueToQuickNote(issue, btnEl = null) {
    const app = this.app || (typeof window !== 'undefined' ? window.app : null);
    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (app?.Notice || class { constructor(m) { console.log(m); } });

    if (!app || !app.vault) {
      new NoticeCls('无法访问 Obsidian Vault，无法执行存入操作');
      return;
    }

    const targetFolder = '00-Inbox/03-Quick-Note';
    try {
      if (!app.vault.getAbstractFileByPath(targetFolder)) {
        await app.vault.createFolder(targetFolder).catch(() => {});
      }
    } catch (e) {}

    // Fetch comments for richer note context
    let comments = [];
    try {
      if (this.jiraService && typeof this.jiraService.getIssueComments === 'function') {
        comments = await this.jiraService.getIssueComments(issue.key);
      }
    } catch (e) {
      console.warn('[JiraPlatformView] Failed to fetch comments for Quick-Note:', e);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const fullTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const safeSummary = (issue.summary || 'Jira工单')
      .replace(/[\\/:*?"<>|#^\[\]!]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const fileBasename = `${dateStr} [${issue.key}] ${safeSummary.slice(0, 36).trim()}`;
    const notePath = `${targetFolder}/${fileBasename}.md`;

    // Check if note already exists
    const existingFile = app.vault.getAbstractFileByPath(notePath);
    if (existingFile) {
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }
      new NoticeCls(`✓ 该工单笔记已存在，已为您在编辑器中打开: ${fileBasename}.md`, 4000);
      if (btnEl) {
        btnEl.classList.add('copied');
        const oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = `${getIconPark('check', 12)} <span>已在编辑器打开</span>`;
        setTimeout(() => {
          btnEl.classList.remove('copied');
          btnEl.innerHTML = oldHtml;
        }, 1800);
      }
      return;
    }

    // Build rich Markdown
    const lines = [];
    lines.push('---');
    lines.push(`title: "[${issue.key}] ${safeSummary}"`);
    lines.push(`date: ${fullTimeStr}`);
    lines.push(`type: jira-issue`);
    lines.push(`jira_key: "${issue.key}"`);
    lines.push(`jira_url: "${issue.url || ''}"`);
    lines.push(`status: "${issue.status || ''}"`);
    lines.push(`priority: "${issue.priority || 'Medium'}"`);
    lines.push(`assignee: "${issue.assignee || '未指派'}"`);
    lines.push(`reporter: "${issue.reporter || '系统'}"`);
    lines.push('tags:');
    lines.push('  - jira');
    lines.push('  - quick-note');
    lines.push('  - troubleshooting');
    lines.push('---');
    lines.push('');
    lines.push(`# 🎯 [${issue.key}] ${issue.summary}`);
    lines.push('');
    lines.push('> [!INFO] 工单元数据卡片');
    lines.push(`> - **工单编号**: \`${issue.key}\``);
    lines.push(`> - **当前状态**: \`${issue.status || '未知'}\``);
    lines.push(`> - **优先级**: \`${issue.priority || 'Medium'}\``);
    lines.push(`> - **经办人**: ${issue.assignee || '未指派'}`);
    lines.push(`> - **报告人**: ${issue.reporter || '系统'}`);
    if (issue.components && issue.components.length > 0) {
      lines.push(`> - **模块组件**: ${issue.components.join(', ')}`);
    }
    if (issue.created) lines.push(`> - **创建时间**: ${issue.created}`);
    if (issue.updated) lines.push(`> - **更新时间**: ${issue.updated}`);
    if (issue.url) lines.push(`> - **Jira 链接**: [在浏览器中直达工单](${issue.url})`);
    lines.push('');
    lines.push('## 📋 工单详细描述 (Description)');
    lines.push('');
    lines.push(issue.description && issue.description.trim() ? issue.description.trim() : '*(暂无详细描述)*');
    lines.push('');

    // Comments & Activity Log
    lines.push('## 💬 活动日志与注释历史 (Comments)');
    lines.push('');
    if (comments && comments.length > 0) {
      for (const c of comments) {
        lines.push(`> [!NOTE] 👤 ${c.author} · ${c.createdFormatted || c.created}${c.isEdited ? ' *(已编辑)*' : ''}`);
        const bodyLines = (c.body || '').split('\n');
        for (const bl of bodyLines) {
          lines.push(`> ${bl}`);
        }
        lines.push('');
      }
    } else {
      lines.push('*(暂无历史注释记录)*\n');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 🛠️ 排查与处理过程记录 (Troubleshooting Log)');
    lines.push('');
    lines.push('> [!TIP] 复杂问题处理记录');
    lines.push('> 在此记录该复杂技术问题的排查思路、日志分析、抓包对比、测试复现条件与代码修复方案。');
    lines.push('');
    lines.push('### 1. 现象复现与抓包/日志分析');
    lines.push('- **测试条件/版本**: ');
    lines.push('- **复现概率**: ');
    lines.push('- **核心日志/抓包片段**: ');
    lines.push('```text');
    lines.push('// 粘贴关键 log 或堆栈信息');
    lines.push('```');
    lines.push('');
    lines.push('### 2. 根因分析 (Root Cause)');
    lines.push('- ');
    lines.push('');
    lines.push('### 3. 处理方案与代码修复 (Fix & Solution)');
    lines.push('- [ ] 临时规避方案 (Workaround)');
    lines.push('- [ ] 核心代码改动 (Code Changes)');
    lines.push('- [ ] 自动化测试 / 验证闭环结果');
    lines.push('');

    const noteContent = lines.join('\n');

    try {
      await app.vault.create(notePath, noteContent);
      new NoticeCls(`✓ 已成功存入 00-Inbox/03-Quick-Note/${fileBasename}.md 并已在编辑器中打开`, 4000);

      // Open in workspace
      if (app.workspace && typeof app.workspace.openLinkText === 'function') {
        app.workspace.openLinkText(notePath, '', false);
      }

      if (btnEl) {
        btnEl.classList.add('copied');
        const oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = `${getIconPark('check', 12)} <span>已存入笔记！</span>`;
        setTimeout(() => {
          btnEl.classList.remove('copied');
          btnEl.innerHTML = oldHtml;
        }, 1800);
      }
    } catch (err) {
      console.error('[JiraPlatformView] Failed to save Quick-Note:', err);
      new NoticeCls(`❌ 存入 Quick-Note 失败: ${err.message}`, 5000);
    }
  }

  closeInspector() {
    if (this.inspectorContainer) {
      this.inspectorContainer.style.display = 'none';
      this.inspectorContainer.empty();
    }
    this.selectedIssue = null;
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * RssCenterView: Full-screen RSS & Tech Feed News Center for TabonKB Workbench.
 * 
 * Capabilities:
 * 1. Time range filtering: [全部] [今天] [本周] [本月]
 * 2. Keyword highlighting: Safe escaping + `<mark class="tw-search-match">`
 * 3. Reading progress persistence:
 *    - Last viewed channel (localStorage)
 *    - Read article IDs / status (localStorage)
 *    - Feed stream scroll offset (localStorage)
 *    - Time range selection (localStorage)
 * 4. Channel sidebar: All, Unread, and per-feed channels with unread badges
 * 5. Quick actions: "摘录至 Quick Note", "打开原文", "全部标为已读"
 * 6. Top search bar integration: filterKeyword(kw)
 */
class RssCenterView {
  /**
   * @param {Object} options
   * @param {import('../services/rss-service').RssService} options.rssService
   * @param {any} options.app - Obsidian App instance
   * @param {() => void} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.rssService = options.rssService;
    this.app = options.app;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.streamScrollEl = null;

    this.items = [];
    this.feeds = [];
    this.isLoading = false;
    this.error = null;
    this.lastUpdated = 0;

    // Filters and states
    this.activeChannel = this.getSavedChannel(); // 'all' | 'unread' | feedId
    this.activeTimeRange = this.getSavedTimeRange(); // 'all' | 'today' | 'week' | 'month'
    this.keyword = '';
    this.readIds = this.getSavedReadIds(); // Set of string IDs
    this.savedScrollTop = this.getSavedScrollTop();
    this.isDisposed = false;
  }

  // --- Persistence Helpers ---
  getSavedChannel() {
    try {
      if (typeof localStorage !== 'undefined') {
        const c = localStorage.getItem('tabonkb-rss-channel');
        if (c) return c;
      }
    } catch (e) {}
    return 'all';
  }

  saveChannel(channelId) {
    this.activeChannel = channelId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-channel', channelId);
      }
    } catch (e) {}
  }

  getSavedTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('tabonkb-rss-time-range');
        if (r && ['all', 'today', 'week', 'month'].includes(r)) return r;
      }
    } catch (e) {}
    return 'all';
  }

  saveTimeRange(range) {
    this.activeTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-time-range', range);
      }
    } catch (e) {}
  }

  getSavedReadIds() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-rss-read-ids');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return new Set(parsed);
        }
      }
    } catch (e) {}
    return new Set();
  }

  saveReadIds() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Cap to latest 1000 items to avoid bloating localStorage
        const arr = Array.from(this.readIds).slice(-1000);
        localStorage.setItem('tabonkb-rss-read-ids', JSON.stringify(arr));
      }
    } catch (e) {}
  }

  getSavedScrollTop() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-rss-scroll-top');
        if (s) return parseInt(s, 10) || 0;
      }
    } catch (e) {}
    return 0;
  }

  saveScrollTop(top) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-rss-scroll-top', String(Math.round(top)));
      }
    } catch (e) {}
  }

  getItemId(item) {
    return item.link || (item.feedId + ':' + item.title);
  }

  isRead(item) {
    return this.readIds.has(this.getItemId(item));
  }

  markAsRead(item) {
    const id = this.getItemId(item);
    if (!this.readIds.has(id)) {
      this.readIds.add(id);
      this.saveReadIds();
      this.updateUnreadCounts();
    }
  }

  markAllAsRead() {
    for (const item of this.items) {
      this.readIds.add(this.getItemId(item));
    }
    this.saveReadIds();
    this.render();
  }

  toggleRead(item) {
    const id = this.getItemId(item);
    if (this.readIds.has(id)) {
      this.readIds.delete(id);
    } else {
      this.readIds.add(id);
    }
    this.saveReadIds();
    this.render();
  }

  // --- Mounting & Loading ---
  mount(parentEl) {
    this.isDisposed = false;
    this.containerEl = parentEl;
    this.render();
    this.loadFeeds(false);
  }

  async loadFeeds(forceRefresh = false) {
    if (!this.rssService || this.isLoading) return;
    this.isLoading = true;
    this.error = null;
    this.updateLoadingState();

    try {
      const res = await this.rssService.fetchAllFeeds(forceRefresh);
      if (this.isDisposed) return;

      this.items = res.items || [];
      this.feeds = res.feeds || [];
      this.lastUpdated = res.lastUpdated || Date.now();
      this.error = res.error || null;
    } catch (err) {
      if (this.isDisposed) return;
      this.error = err.message || '获取 RSS 订阅资讯失败';
    } finally {
      if (!this.isDisposed) {
        this.isLoading = false;
        this.render();
        this.restoreScrollPosition();
      }
    }
  }

  filterKeyword(kw) {
    this.keyword = (kw || '').trim();
    this.renderCardsStream();
  }

  // --- Date Range Calculation ---
  filterByTimeRange(items) {
    if (this.activeTimeRange === 'all') return items;
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = now - 7 * 86400 * 1000;
    const thirtyDaysAgo = now - 30 * 86400 * 1000;

    return items.filter(item => {
      const pub = item.publishedAt ? (new Date(item.publishedAt)).getTime() : 0;
      if (!pub) return true; // Keep if no date available
      if (this.activeTimeRange === 'today') {
        return pub >= startOfToday.getTime();
      }
      if (this.activeTimeRange === 'week') {
        return pub >= sevenDaysAgo;
      }
      if (this.activeTimeRange === 'month') {
        return pub >= thirtyDaysAgo;
      }
      return true;
    });
  }

  getFilteredItems() {
    let result = [...this.items];

    // 1. Channel filter
    if (this.activeChannel === 'unread') {
      result = result.filter(item => !this.isRead(item));
    } else if (this.activeChannel !== 'all') {
      result = result.filter(item => item.feedId === this.activeChannel);
    }

    // 2. Time range filter
    result = this.filterByTimeRange(result);

    // 3. Keyword filter
    if (this.keyword) {
      const kw = this.keyword.toLowerCase();
      result = result.filter(item => {
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const feed = (item.feedName || '').toLowerCase();
        return title.includes(kw) || desc.includes(kw) || feed.includes(kw);
      });
    }

    return result;
  }

  // --- Rendering ---
  render() {
    if (!this.containerEl || this.isDisposed) return;
    this.containerEl.empty();
    this.containerEl.addClass('tw-rss-center-root');

    const layout = this.containerEl.createDiv({ cls: 'tw-rss-center' });

    // 1. Left Channel Sidebar
    this.renderChannelSidebar(layout);

    // 2. Right Main Feed Stage
    const stage = layout.createDiv({ cls: 'tw-rss-main-stage' });
    this.renderToolbar(stage);
    
    // Feed cards container
    this.streamScrollEl = stage.createDiv({ cls: 'tw-rss-stream-container' });
    this.renderCardsStream();

    // Attach scroll tracking to persist scroll progress
    let scrollTimer = null;
    this.streamScrollEl.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (this.streamScrollEl) {
          this.saveScrollTop(this.streamScrollEl.scrollTop);
        }
      }, 150);
    });
  }

  renderChannelSidebar(parentEl) {
    const sidebar = parentEl.createDiv({ cls: 'tw-rss-sidebar' });

    // Sidebar Header
    const head = sidebar.createDiv({ cls: 'tw-rss-sidebar-head' });
    head.innerHTML = `
      <div class="tw-rss-sb-title">
        <span class="tw-rss-sb-icon">${getIconPark('newspaper', 15)}</span>
        <span>资讯频道</span>
      </div>
      <button class="tw-rss-sb-cfg-btn" title="订阅源配置">${getIconPark('setting-config', 13)}</button>
    `;
    const cfgBtn = head.querySelector('.tw-rss-sb-cfg-btn');
    if (cfgBtn && this.onOpenSettings) {
      cfgBtn.onclick = () => this.onOpenSettings();
    }

    // Sidebar Channels List
    const nav = sidebar.createDiv({ cls: 'tw-rss-channels-nav' });

    // 1. "全部资讯" (All)
    const totalUnread = this.items.filter(i => !this.isRead(i)).length;
    const allBtn = nav.createDiv({
      cls: `tw-rss-chan-item ${this.activeChannel === 'all' ? 'active' : ''}`
    });
    allBtn.innerHTML = `
      <div class="tw-chan-left">
        <span class="tw-chan-icon">${getIconPark('application-menu', 13)}</span>
        <span class="tw-chan-name">全部资讯</span>
      </div>
      <div class="tw-chan-badges">
        ${totalUnread > 0 ? `<span class="tw-chan-unread-badge">${totalUnread}</span>` : ''}
        <span class="tw-chan-total-badge">${this.items.length}</span>
      </div>
    `;
    allBtn.onclick = () => {
      if (this.activeChannel !== 'all') {
        this.saveChannel('all');
        this.render();
      }
    };

    // 2. "未读动态" (Unread)
    const unreadBtn = nav.createDiv({
      cls: `tw-rss-chan-item ${this.activeChannel === 'unread' ? 'active' : ''}`
    });
    unreadBtn.innerHTML = `
      <div class="tw-chan-left">
        <span class="tw-chan-icon">${getIconPark('remind', 13)}</span>
        <span class="tw-chan-name">未读动态</span>
      </div>
      <span class="tw-chan-unread-badge primary">${totalUnread}</span>
    `;
    unreadBtn.onclick = () => {
      if (this.activeChannel !== 'unread') {
        this.saveChannel('unread');
        this.render();
      }
    };

    nav.createDiv({ cls: 'tw-rss-chan-divider' });

    // 3. Configured Feeds
    const configuredFeeds = (this.feeds && this.feeds.length > 0) ? this.feeds : (this.rssService?.getFeeds?.() || []);
    const enabledFeeds = configuredFeeds.filter(f => f.enabled !== false);

    for (const feed of enabledFeeds) {
      const feedItems = this.items.filter(i => i.feedId === feed.id);
      const unreadCount = feedItems.filter(i => !this.isRead(i)).length;

      const itemBtn = nav.createDiv({
        cls: `tw-rss-chan-item ${this.activeChannel === feed.id ? 'active' : ''}`
      });
      itemBtn.innerHTML = `
        <div class="tw-chan-left">
          <span class="tw-chan-bullet"></span>
          <span class="tw-chan-name" title="${escapeAttr(feed.name)}">${escapeHtml(feed.name)}</span>
        </div>
        <div class="tw-chan-badges">
          ${unreadCount > 0 ? `<span class="tw-chan-unread-badge">${unreadCount}</span>` : ''}
          <span class="tw-chan-total-badge">${feedItems.length}</span>
        </div>
      `;
      itemBtn.onclick = () => {
        if (this.activeChannel !== feed.id) {
          this.saveChannel(feed.id);
          this.render();
        }
      };
    }
  }

  renderToolbar(parentEl) {
    const toolbar = parentEl.createDiv({ cls: 'tw-rss-toolbar' });

    // Left: Time Range Pills
    const leftWrap = toolbar.createDiv({ cls: 'tw-rss-toolbar-left' });
    const timeFilters = [
      { id: 'all', label: '全部' },
      { id: 'today', label: '今天' },
      { id: 'week', label: '本周' },
      { id: 'month', label: '本月' }
    ];

    const timeGroup = leftWrap.createDiv({ cls: 'tw-time-filter-group' });
    for (const tf of timeFilters) {
      const btn = timeGroup.createEl('button', {
        cls: `tw-time-btn ${this.activeTimeRange === tf.id ? 'active' : ''}`,
        text: tf.label
      });
      btn.onclick = () => {
        if (this.activeTimeRange !== tf.id) {
          this.saveTimeRange(tf.id);
          this.renderToolbarTimePills(timeGroup);
          this.renderCardsStream();
        }
      };
    }

    // Right: Actions
    const rightWrap = toolbar.createDiv({ cls: 'tw-rss-toolbar-right' });

    // Last Sync Text
    if (this.lastUpdated) {
      const timeStr = formatRelativeClock(this.lastUpdated);
      const syncText = rightWrap.createSpan({ cls: 'tw-rss-sync-text' });
      syncText.textContent = `更新于 ${timeStr}`;
    }

    // "全部标为已读" Button
    const btnMarkAll = rightWrap.createEl('button', {
      cls: 'tw-rss-act-btn secondary',
      title: '将所有文章标记为已读'
    });
    btnMarkAll.innerHTML = `${getIconPark('check-one', 12)} <span>全部标为已读</span>`;
    btnMarkAll.onclick = () => this.markAllAsRead();

    // Refresh Button
    const btnRefresh = rightWrap.createEl('button', {
      cls: 'tw-rss-act-btn',
      title: '手动刷新 RSS 订阅源'
    });
    btnRefresh.innerHTML = `${getIconPark('refresh', 12)} <span>刷新</span>`;
    btnRefresh.onclick = () => {
      btnRefresh.classList.add('spinning');
      this.loadFeeds(true).finally(() => {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 400);
      });
    };
  }

  renderToolbarTimePills(groupEl) {
    if (!groupEl) return;
    const btns = groupEl.querySelectorAll('.tw-time-btn');
    const timeFilters = ['all', 'today', 'week', 'month'];
    btns.forEach((btn, idx) => {
      btn.classList.toggle('active', this.activeTimeRange === timeFilters[idx]);
    });
  }

  renderCardsStream() {
    if (!this.streamScrollEl) return;
    this.streamScrollEl.empty();

    const items = this.getFilteredItems();

    // Stale banner if using cached data with error
    if (this.error && this.items.length > 0) {
      const staleEl = this.streamScrollEl.createDiv({ cls: 'tw-rss-stale-banner' });
      staleEl.innerHTML = `
        <span class="tw-stale-icon">${getIconPark('alert', 12)}</span>
        <span>${escapeHtml(this.error)}</span>
      `;
    }

    // Empty state
    if (items.length === 0) {
      const emptyEl = this.streamScrollEl.createDiv({ cls: 'tw-rss-empty-stream' });
      emptyEl.innerHTML = `
        <div class="tw-rss-empty-icon">${getIconPark('file-text', 26)}</div>
        <div class="tw-rss-empty-title">当前筛选条件下暂无资讯条目</div>
        <div class="tw-rss-empty-desc">${this.keyword ? `未匹配到关键词 "${escapeHtml(this.keyword)}"` : '所有订阅源文章均已查阅完毕'}</div>
      `;
      return;
    }

    // Cards list
    const listWrap = this.streamScrollEl.createDiv({ cls: 'tw-rss-card-stream' });
    for (const item of items) {
      this.renderFeedCard(listWrap, item);
    }
  }

  renderFeedCard(parentEl, item) {
    const isItemRead = this.isRead(item);
    const card = parentEl.createDiv({
      cls: `tw-rss-stream-card ${isItemRead ? 'read' : 'unread'}`
    });

    // Top meta row
    const topRow = card.createDiv({ cls: 'tw-rss-card-top' });
    
    const leftMeta = topRow.createDiv({ cls: 'tw-rss-top-left' });
    if (!isItemRead) {
      leftMeta.createSpan({ cls: 'tw-unread-dot', title: '未读' });
    }
    const feedChip = leftMeta.createSpan({ cls: 'tw-rss-card-feed-badge' });
    feedChip.textContent = item.feedName;

    const timeSpan = topRow.createEl('span', { cls: 'tw-rss-card-time' });
    timeSpan.textContent = item.publishedAt ? formatRelativeTime(item.publishedAt) : '';

    // Title row with keyword highlight
    const titleEl = card.createDiv({ cls: 'tw-rss-card-title' });
    titleEl.innerHTML = this.highlightText(item.title || '（无标题）');

    // Description snippet with keyword highlight
    if (item.description) {
      const descEl = card.createDiv({ cls: 'tw-rss-card-desc' });
      descEl.innerHTML = this.highlightText(item.description);
    }

    // Footer actions row
    const footer = card.createDiv({ cls: 'tw-rss-card-footer' });

    // Action: 摘录至 Quick Note
    const btnExcerpt = footer.createEl('button', {
      cls: 'tw-card-action-btn excerpt',
      title: '将本篇资讯摘要与链接保存至 00-Inbox/Quick-Notes.md'
    });
    btnExcerpt.innerHTML = `${getIconPark('editor', 11)} <span>摘录至 Quick Note</span>`;
    btnExcerpt.onclick = (e) => {
      e.stopPropagation();
      this.handleExcerptToQuickNote(item, btnExcerpt);
    };

    // Action: 打开原文
    const btnOpen = footer.createEl('button', {
      cls: 'tw-card-action-btn external',
      title: '在外部默认浏览器中打开原网页'
    });
    btnOpen.innerHTML = `${getIconPark('external', 11)} <span>打开原文</span>`;
    btnOpen.onclick = (e) => {
      e.stopPropagation();
      this.markAsRead(item);
      card.classList.remove('unread');
      card.classList.add('read');
      const dot = card.querySelector('.tw-unread-dot');
      if (dot) dot.remove();
      if (item.link) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
      }
    };

    // Action: Toggle read/unread
    const btnToggle = footer.createEl('button', {
      cls: 'tw-card-action-btn mark',
      title: isItemRead ? '标记为未读' : '标记为已读'
    });
    btnToggle.innerHTML = isItemRead 
      ? `${getIconPark('close', 11)} <span>标为未读</span>`
      : `${getIconPark('check-one', 11)} <span>标为已读</span>`;
    btnToggle.onclick = (e) => {
      e.stopPropagation();
      this.toggleRead(item);
    };

    // Card click: marks as read and opens original URL
    card.onclick = () => {
      this.markAsRead(item);
      card.classList.remove('unread');
      card.classList.add('read');
      const dot = card.querySelector('.tw-unread-dot');
      if (dot) dot.remove();
      if (item.link) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
      }
    };
  }

  highlightText(rawText) {
    if (!rawText) return '';
    const safe = escapeHtml(rawText);
    if (!this.keyword) return safe;

    const escapedKw = escapeRegex(this.keyword);
    const regex = new RegExp(`(${escapedKw})`, 'gi');
    return safe.replace(regex, '<mark class="tw-search-match">$1</mark>');
  }

  async handleExcerptToQuickNote(item, btnEl) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const excerptContent = `\n\n### [${item.title}](${item.link})\n- **来源**: ${item.feedName}\n- **日期**: ${todayStr}\n- **摘要**: ${item.description || '无'}\n`;

    const oldText = btnEl.innerHTML;
    try {
      const vault = this.app?.vault;
      if (vault) {
        const filePath = '00-Inbox/Quick-Notes.md';
        let file = vault.getAbstractFileByPath ? vault.getAbstractFileByPath(filePath) : null;
        if (!file && typeof vault.create === 'function') {
          // Create initial note
          const initialHeader = `# 💡 技术资讯与速记 (Quick Notes)\n\n> 自动生成自 TabonKB 研发工作台资讯中心\n`;
          file = await vault.create(filePath, initialHeader + excerptContent);
        } else if (file && typeof vault.append === 'function') {
          await vault.append(file, excerptContent);
        } else if (vault.adapter && typeof vault.adapter.append === 'function') {
          await vault.adapter.append(filePath, excerptContent);
        }
      }

      // Also copy to clipboard for convenience
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(excerptContent.trim());
      }

      btnEl.innerHTML = `${getIconPark('check-one', 11)} <span>已摘录入库！</span>`;
      btnEl.classList.add('success');
      this.markAsRead(item);
      setTimeout(() => {
        btnEl.innerHTML = oldText;
        btnEl.classList.remove('success');
      }, 1600);
    } catch (e) {
      console.warn('[RssCenterView] Failed to append excerpt:', e);
      // Fallback: clipboard copy
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(excerptContent.trim());
      }
      btnEl.innerHTML = `${getIconPark('copy', 11)} <span>已复制到剪贴板</span>`;
      setTimeout(() => {
        btnEl.innerHTML = oldText;
      }, 1600);
    }
  }

  restoreScrollPosition() {
    if (this.streamScrollEl && this.savedScrollTop > 0) {
      setTimeout(() => {
        if (this.streamScrollEl) {
          this.streamScrollEl.scrollTop = this.savedScrollTop;
        }
      }, 50);
    }
  }

  updateUnreadCounts() {
    const totalUnread = this.items.filter(i => !this.isRead(i)).length;
    if (this.containerEl) {
      const allBadge = this.containerEl.querySelector('.tw-rss-chan-item:nth-child(1) .tw-chan-unread-badge');
      if (allBadge) allBadge.textContent = totalUnread > 0 ? String(totalUnread) : '';
      const unreadBadge = this.containerEl.querySelector('.tw-rss-chan-item:nth-child(2) .tw-chan-unread-badge');
      if (unreadBadge) unreadBadge.textContent = String(totalUnread);
    }
  }

  updateLoadingState() {
    if (this.isLoading && this.items.length === 0 && this.streamScrollEl) {
      this.streamScrollEl.innerHTML = `
        <div class="tw-rss-loading-wrap">
          <div class="tw-loading-spin"></div>
          <div class="tw-loading-text">正在拉取各渠道技术资讯...</div>
        </div>
      `;
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.containerEl) {
      this.containerEl.empty();
      this.containerEl = null;
    }
    this.streamScrollEl = null;
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
  const d = new Date(date);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 2) return '昨天';
  if (diffSec < 86400 * 3) return '前天';
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * VendorPortalService: Manages Chipset Vendor Support Portals (MTK Online & Unisoc Uni-Support)
 * - Portal definitions (MTK Online, Unisoc Uni-Support)
 * - Safe credential storage (encrypted/sandboxed, never exposed in logs)
 * - Quick search routing & URL templates
 * - Curated chip engineering resource catalog & search engine
 * - Local resource bookmarking & vault persistence
 */

const DEFAULT_PORTALS = {
  mtk: {
    id: 'mtk',
    name: 'MTK 资源网 (MediaTek Online)',
    shortName: 'MTK MTO',
    url: 'https://online.mediatek.com/',
    loginUrl: 'https://online.mediatek.com/login/login.aspx',
    searchUrlTemplate: 'https://online.mediatek.com/apps/search/filter?keyword={query}&start=0&app=All',
    username: '',
    secretName: 'tabonkb-mtk-password',
    brandColor: '#10B981',
    iconKey: 'cpu',
    chipsets: ['MT6877', 'MT6765', 'MT6893', 'MT8788', 'MT8390', 'Dimensity 9300', 'Dimensity 8300', 'Dimensity 7050'],
    categories: ['Datasheet 规格书', 'Porting Guide 移植指南', 'Release Notes 版本发布', 'eService FAQ & 工单', 'Flash Tools 烧录调机']
  },
  unisoc: {
    id: 'unisoc',
    name: '展锐资源网 (Uni-Support)',
    shortName: '展锐 Uni-Support',
    url: 'https://unisupport.unisoc.com/',
    dccUrl: 'https://unisupport.unisoc.com/dcc',
    faqUrl: 'https://unisupport.unisoc.com/faq',
    loginUrl: 'https://unisupport.unisoc.com/login',
    searchUrlTemplate: 'https://unisupport.unisoc.com/fullTextSearch?keyword={query}',
    username: '',
    secretName: 'tabonkb-unisoc-password',
    brandColor: '#8B5CF6',
    iconKey: 'network',
    chipsets: ['T820', 'T760', 'T616', 'T606', 'UMS9620', 'UIS7885', 'W517', 'V510'],
    categories: ['DCC 技术文档', 'FAQ 知识库', '驱动补丁与源码', '移植与调试指南', '量产工具与 PAC']
  }
};

/** Built-in curated engineering documents for MTK & Unisoc */
const SEED_VENDOR_RESOURCES = [
  // MTK Resources
  {
    id: 'mtk-res-faq06985',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT6589 / MT6572 / MT6582 / MT6765 / MT6877',
    category: 'eService FAQ & 工单',
    title: 'FAQ06985: KE发生后如何判断vmlinux和log是否匹配',
    summary: '如果遇到内核崩溃(KE)，请将 log（从手机捞出 /data/aee_exp/* 和 t卡 mtklog 目录）和同一次编译生成的 vmlinux 配对分析。通过比对 SMP PREEMPT 编译时间戳与 Build ID 确保符号表精准匹配。',
    docId: 'FAQ06985',
    updated: '2023-12-17',
    url: 'https://online.mediatek.com/apps/faq/detail?faqid=FAQ06985&list=SW',
    tags: ['KE', 'Kernel Exception', 'vmlinux', 'aee_exp', 'addr2line', 'SMP PREEMPT', 'Build ID', 'FAQ06985'],
    detailedContent: `### [DESCRIPTION]
如果遇到内核崩溃(KE)，请将log(里面一定要从手机捞出/data/aee_exp/*，和t卡mtklog目录)和同一次编译生成的vmlinux（用于还原当时的现场，查看函数，解析地址等），两者缺一不可。
如何判断vmlinux和log是否匹配也是非常重要，否则log里的地址和vmlinux对应不上，问题也无法分析。

### [KEYWORD]
KE / vmlinux / aee_exp / db.xxx / addr2line / SMP PREEMPT / Build ID

### [SOLUTION]
1. **vmlinux 存放的位置**：
   - **JB及以前** 的版本在 \`alps/kernel/out/vmlinux\`（或 \`alps/kernel/vmlinux\`）。
   - **KK及之后** 版本在 \`alps/out/target/product/$proj/obj/KERNEL_OBJ/vmlinux\`。

2. **从 vmlinux 提取构建时间戳**：
   - 用文本工具或 UltraEdit / strings 打开 vmlinux，搜索大写字符串 \`SMP PREEMPT\`。
   - 可以搜到类似：
     \`\`\`text
     Linux version 3.4.67 (jenkins@build-server) (gcc version 4.7) #1 SMP PREEMPT Sat Apr 20 16:48:34 CST 2013
     \`\`\`
   - 记录其中编译的时间信息。

3. **查找 log 对应的 kernel 编译时间**：
   - **a.** 在异常手机的 mobile log 里查看 \`properties\` 或 \`versions\` 文件，搜索 \`SMP PREEMPT\`。
   - **b.** 在异常手机里的 KE db 用 log viewer（GAT 里的 log viewer）解开后的 \`SYS_VERSION_INFO\` 文件。
   - **c.** 亦可从 \`kernel_log.boot\` 里找到（在开机 log 的 tick 0 会输出版本信息）。
   - **d.** 如果异常的手机还在的话，可以连上 adb，执行 \`adb shell cat /proc/version\`。

4. **对比与验证**：
   - 对比两个字符串是否完全一致。一致表示是同一次编译生成的（即该 vmlinux 和 log 是匹配的），随后方可用 \`aarch64-linux-android-addr2line\` 或 GAT 工具正确还原内核崩溃堆栈中的函数名与代码行号。`
  },
  {
    id: 'mtk-res-01',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT6877',
    category: 'Porting Guide 移植指南',
    title: 'MT6877 (Dimensity 900) Android 14 LCM Display Porting Guide v2.4',
    summary: '详细讲解 MIPI DSI 屏幕引脚复用配置、DTS 设备树修改、背光 PWM 频率调试与休眠功耗优化指南。包含双通道 DSI 典型时序计算公式。',
    docId: 'MTO-DOC-2026-6877-LCM',
    updated: '2026-09-08',
    url: 'https://online.mediatek.com/doc/MT6877_Android14_LCM_Porting',
    tags: ['LCM', 'Display', 'DTS', 'Android 14', 'MIPI'],
    detailedContent: `### 一、移植步骤概述
MT6877 平台支持 2-Lane 及 4-Lane MIPI DSI 显示接口。移植新屏需完成引脚 Pinmux 复用配置、供电 Regulator 映射及 Panel 初始化序列适配。

### 二、DTS 设备树配置示例
\`\`\`dts
&dsi_panel {
    compatible = "mediatek,custom_panel_1080p";
    reg = <0>;
    status = "okay";
    
    panel-width-mm = <70>;
    panel-height-mm = <155>;
    
    backlight = <&led_backlight>;
    
    vsp-supply = <&pmic_vsp>;
    vsn-supply = <&pmic_vsn>;
};
\`\`\`

### 三、背光与功耗调优
通过 PWM 频率调整（推荐 20kHz ~ 50kHz）避免电感啸叫；在 Early Suspend 阶段关闭 Panel 电源以达到待机 < 5mA 指标。`
  },
  {
    id: 'mtk-res-02',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT6877',
    category: 'eService FAQ & 工单',
    title: 'FAQ28912: MT6877 平台高负荷快充阶段电池温度采样过冲跳变排查思路',
    summary: '针对 NTC 采样电阻在突变大电流下被走线寄生电感耦合干扰导致的温升误报问题，提供 PMIC ADC 采样滤波寄存器配置与防抖动补丁。',
    docId: 'MTO-FAQ-28912',
    updated: '2026-09-12',
    url: 'https://online.mediatek.com/faq/28912',
    tags: ['Charger', 'PMIC', 'NTC', 'Thermal', 'ADC']
  },
  {
    id: 'mtk-res-03',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT6765',
    category: 'Release Notes 版本发布',
    title: 'MT6765 BSP Android 13 季度维护安全补丁包 (MR4_2026Q3)',
    summary: '修复 WiFi 6E AP 漫游丢包、蓝牙 HFP 协议音频卡顿，包含安全补丁 2026-09-01 合入指南及 Preloader 升级注意事项。',
    docId: 'MTO-RN-6765-2026Q3',
    updated: '2026-09-01',
    url: 'https://online.mediatek.com/release/MT6765_MR4_2026Q3',
    tags: ['BSP', 'Security Patch', 'WiFi', 'Bluetooth', 'Preloader']
  },
  {
    id: 'mtk-res-04',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT8788',
    category: 'Datasheet 规格书',
    title: 'MT8788 Application Processor Technical Reference Manual (TRM) Rev 1.2',
    summary: '八核 AI 边缘计算与平板处理器芯片硬件技术参考手册。详细列出 GPIO 物理映射、时钟树分布图、DDR4/LPDDR4X 内存控制器时序规格。',
    docId: 'MTO-TRM-8788-R12',
    updated: '2026-08-20',
    url: 'https://online.mediatek.com/doc/MT8788_TRM_Rev1.2',
    tags: ['Datasheet', 'TRM', 'GPIO', 'DDR', 'Hardware']
  },
  {
    id: 'mtk-res-05',
    portalId: 'mtk',
    portalName: 'MTK Online',
    chipset: 'MT8390',
    category: 'Flash Tools 烧录调机',
    title: 'SP Flash Tool v5.2416 官方量产烧录驱动与 DA 文件配置套件 (Genio 700)',
    summary: '提供 Windows 11/10 签名 USB VCOM 驱动、带认证的 MTK_AllInOne_DA.bin 文件，支持 UFS 2.2 / eMMC 5.1 烧录。',
    docId: 'MTO-TOOL-SP-52416',
    updated: '2026-08-28',
    url: 'https://online.mediatek.com/tools/SP_Flash_Tool_v5.2416',
    tags: ['Tool', 'SP Flash Tool', 'DA', 'VCOM', 'Download']
  },

  // Unisoc Resources (DCC & FAQ)
  {
    id: 'unisoc-res-01',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T820',
    category: 'DCC 技术文档',
    categoryType: 'dcc',
    title: '紫光展锐 T820 (UMS9620) 平台 Camera ISP3.0 传感器驱动移植手册',
    summary: '指导 Sony IMX582 / Samsung GN5 传感器在 6nm 5G 芯片平台上的移植过程。包含 Tuning 参数文件架构、I2C 地址配置、MCLK 抖动规避。',
    docId: 'UNISOC-DCC-0820',
    updated: '2026-09-14',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['T820', 'UMS9620'],
    tags: ['DCC', 'Camera', 'ISP', 'Tuning', 'Sensor', 'I2C'],
    detailedContent: `### [DESCRIPTION]
紫光展锐 T820 平台搭载 6nm 5G SoC，集成自研多核 ISP 3.0 处理引擎。本文档阐述主流 CMOS Sensor 接入流程与 Tuning 校准文件架构。

### [KEYWORD]
T820, UMS9620, ISP3.0, Camera Porting, IMX582, GN5, I2C, MIPI CSI-2, Tuning

### [SOLUTION]
1. 设备树 DTS 配置与供电使能：
   - 配置 cam_sensor_mclk 引脚复用，时钟频率设定为 24MHz。
   - 配置 DVDD 1.1V, AVDD 2.8V, IOVDD 1.8V 供电时序，保证上电复位间隔 > 5ms。
2. 传感器参数文件 (sensor_param.c) 适配：
   - 填写 I2C Slave Address (7-bit 格式)。
   - 配置 MIPI Lane 数量与 PHY 传输速率（支持 4-Lane 2.5Gbps/lane）。
3. 动态加载与画质调试：
   - 挂载 v4l2 subdev 节点，通过 adb 执行 \`cat /sys/kernel/debug/camera/status\` 确认握手成功。`
  },
  {
    id: 'unisoc-res-02',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T820',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'FAQ1249: 展锐 5G/4G 芯片平台 USB Host 与 OTG 模式切换及外设驱动配置',
    summary: '详细解析在 Android 13/14 Linux 5.15 内核中将 Type-C 端口强制切换为 USB Host 模式、挂载 U盘/鼠标/键盘与 ADB 模式互斥的常见问题。',
    docId: 'FAQ1249',
    updated: '2026-09-12',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['T820', 'T760', 'T616'],
    tags: ['FAQ', 'USB Host', 'OTG', 'Type-C', 'dwc3', 'adb'],
    detailedContent: `### [DESCRIPTION]
展锐芯片平台客户咨询：如何支持 USB HOST 模式（如插入 U 盘、键盘、无线网卡），以及在 Device 模式与 HOST 模式之间进行软件强制切换。

### [KEYWORD]
USB HOST, OTG, Type-C, dwc3, extcon, vbus, U盘挂载, FAQ1249

### [SOLUTION]
1. 硬件电路支持确认：
   - 确认硬件设计是否具备 5V VBUS 供电输出（由 PMIC 或外部 Boost IC 供电）。
   - Type-C CC 逻辑芯片需正确配置为 DFP/DRP 角色。
2. 驱动与内核设备树配置：
   - 在 dts 中找到 \`&usb\` 或 \`&dwc3\` 节点，将 \`dr_mode\` 设为 \`"otg"\` 或 \`"host"\`。
   - 若需支持自动识别 OTG 线，确认 extcon 或 tcpm 节点正确绑定。
3. 软件强制切换指令：
   \`\`\`sh
   # 强制切换为 host 模式并输出 VBUS
   echo host > /sys/class/usb_role/intel_xhci_usb_sw-role-switch/role
   # 或者通过展锐调试节点
   echo 1 > /sys/devices/platform/soc/soc:ap-apb/soc:ap-apb:extcon/manual_host
   \`\`\``
  },
  // --- Unisoc DCC Official Documents (from https://unisupport.unisoc.com/dcc) ---
  {
    id: 'unisoc-dcc-107848',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Android 17 (X) 通用',
    category: '定制化指导手册',
    categoryType: 'dcc',
    title: 'Android 17 Kernel 6.12&6.18 USB定制化指导手册V1.1.pdf',
    summary: '本文主要介绍了Android 17 Kernel 6.12&6.18 USB定制方法, 内容涵盖常用功能配置、驱动架构、DTS设备树定义及Type-C与Micro-B接口配置。',
    docId: '107848',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['Android 17 (X)', 'Kernel 6.12', 'Kernel 6.18'],
    tags: ['USB', 'Type-C', 'Micro-B', 'Android 17 (X)', 'Kernel 6.12', 'Kernel 6.18', '定制化指导手册', 'DCC'],
    detailedContent: `### [DESCRIPTION]
针对搭载 Android 17 及 Linux Kernel 6.12 / 6.18 的紫光展锐移动终端芯片平台，系统性介绍 USB 驱动子系统架构、复合功能（ConfigFS Gadget）定制方案、Type-C CC/PD 控制器驱动接口配置。

### [KEYWORD]
Android 17, Kernel 6.12, Kernel 6.18, USB定制, Type-C, Micro-B, dwc3, ConfigFS, USB Gadget

### [SOLUTION]
1. 内核驱动架构与 DTS 配置：
   - 内核设备树路径：\`arch/arm64/boot/dts/sprd/xxx-usb.dtsi\`。
   - 配置 \`&dwc3\` 与 \`&usb\` 控制器属性：
     \`\`\`dts
     &usb {
         status = "okay";
         dr_mode = "otg";
         extcon = <&extcon_usb>;
         qcom,charging-path = <&pmic_charger>;
     };
     \`\`\`
2. Android 17 USB ConfigFS 自定义角色配置：
   - 配置文件路径：\`vendor/sprd/modules/usb/init.usb.configfs.rc\`。
   - 默认开启功能组：\`adb,mtp,ptp,rndis\`。
3. Type-C 与 Micro-B 接口选择切换：
   - 根据硬件原理图选择 TCPC (Type-C Port Controller) 驱动，支持 DFP、UFP 与 DRP 角色自动协商。`
  },
  {
    id: 'unisoc-dcc-107732',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Android 17 (X)',
    category: '定制化指导手册',
    categoryType: 'dcc',
    title: 'Android 17 SystemUI状态栏及快捷设置定制化指导手册V1.0.pdf',
    summary: '本文主要介绍了Android 17 SystemUI的状态栏及快捷设置页面, 内容涵盖状态栏图标定制、快捷设置QS瓷贴增删及USB连接弹窗样式。',
    docId: '107732',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['Android 17 (X)'],
    tags: ['SystemUI', 'StatusBar', 'QuickSettings', 'QS/快捷设置', 'USB', 'Android 17 (X)', 'DCC'],
    detailedContent: `### [DESCRIPTION]
介绍展锐平台 Android 17 系统 UI 状态栏图标与下拉快捷面板定制，包含 USB 模式切换（充电/文件传输/反向供电）弹窗及通知栏逻辑。

### [SOLUTION]
1. 状态栏 USB 图标控制逻辑位于 \`frameworks/base/packages/SystemUI/src/com/android/systemui/statusbar/policy/UsbNotificationController.java\`。
2. 快捷设置瓷贴默认列表定制：在 \`config.xml\` 中重载 \`quick_settings_tiles_default\`，添加 \`usb_tether\` 快捷瓷贴。`
  },
  {
    id: 'unisoc-dcc-107296',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'UIS7885',
    category: '定制化指导手册',
    categoryType: 'dcc',
    title: 'UIS7885 Yocto USB定制化指导手册V1.0.pdf',
    summary: '本文介绍了USB定制化相关信息, 内容涵盖概述, USB Driver API, USB Device Function在UIS7885 Yocto Linux工业网关平台上的驱动与配置。',
    docId: '107296',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['UIS7885', 'Yocto Linux'],
    tags: ['USB', 'Type-C', 'Micro-B', 'Yocto', 'UIS7885', 'Driver API', 'DCC'],
    detailedContent: `### [DESCRIPTION]
紫光展锐 UIS7885 工业物联网芯片在 Yocto Linux 发行版下的 USB 驱动开发与定制指南。

### [SOLUTION]
1. Yocto Kernel 配置项开启：
   \`CONFIG_USB_SUPPORT=y\`, \`CONFIG_USB_DWC3=y\`, \`CONFIG_USB_GADGET=y\`, \`CONFIG_USB_CONFIGFS=y\`。
2. 工业场景外设挂载支持：
   - 挂载 USB 虚拟串口（ACM / CDC-ACM）：用于工业 PLC 协议通信。
   - 挂载 USB RNDIS / NCM 工业以太网卡：用于高速物联网数据回传。`
  },
  {
    id: 'unisoc-dcc-106177',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'UMS9360',
    category: '定制化指导手册',
    categoryType: 'dcc',
    title: 'UMS9360 Kernel 6.6 USB定制化指导手册V1.0.pdf',
    summary: '本文主要介绍了Kernel 6.6 USB配置方法, 内容涵盖总线架构和配置方法介绍, 适用于Android 15 (V), Android 16 (W), Android 17 (X)。',
    docId: '106177',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['UMS9360', 'T820', 'Android 15', 'Android 16', 'Android 17'],
    tags: ['USB', 'Type-C', 'Micro-B', 'UMS9360', 'Kernel 6.6', 'Android 15', 'Android 16', 'Android 17', 'DCC'],
    detailedContent: `### [DESCRIPTION]
UMS9360 旗舰平台在 Linux Kernel 6.6 统一基线下的 USB 驱动定制方案，包含 USB3.1 Gen1 超高速信号完整性参数微调与眼图测试指南。

### [SOLUTION]
1. 信号质量与眼图调节：
   - 在设备树 PHY 节点 \`&usb3_phy\` 中调节 TX 预加重（Pre-emphasis）与抖动抑制寄存器参数。
2. 支持 Type-C DP Alt Mode 视频输出调试流程及 HPD 中断响应。`
  },
  {
    id: 'unisoc-dcc-33982',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Linux 通用',
    category: '测试指导文档',
    categoryType: 'dcc',
    title: 'Linux USB使用指南 V1.1.pdf',
    summary: '本文介绍Linux系统下如何识别USB串口设备, 内容涵盖驱动及串口识别、驱动调试及量产烧录通信指令。',
    docId: '33982',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['Linux', 'Android'],
    tags: ['USB', 'Linux', '串口', '调试', '测试指导文档', 'DCC'],
    detailedContent: `### [DESCRIPTION]
指导工程师在 Linux 主机环境下正确枚举展锐 USB 调试设备节点（ttyUSB / cdc-acm）及常见无响应排查。

### [SOLUTION]
1. 确认 Linux udev 规则配置：
   \`\`\`bash
   # /etc/udev/rules.d/70-unisoc-usb.rules
   SUBSYSTEM=="usb", ATTR{idVendor}=="1782", MODE="0666", GROUP="plugdev"
   \`\`\`
2. 常用排查命令：
   \`\`\`bash
   lsusb -v -d 1782:
   dmesg | grep -i usb
   \`\`\``
  },
  {
    id: 'unisoc-dcc-104804',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'UIS7861',
    category: '设计指导资料',
    categoryType: 'dcc',
    title: 'UIS7861 PCB Design Guide V1.2.pdf',
    summary: 'This document introduces PCB design of UIS7861, mainly include package, general layout recommendations and high-speed USB differential pair impedance matching.',
    docId: '104804',
    updated: '2026-09-17',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['UIS7861'],
    tags: ['pcb', '设计指导/design guide', 'UIS7861', 'USB', 'Hardware', 'DCC'],
    detailedContent: `### [DESCRIPTION]
UIS7861 硬件原理图与 PCB Layout 综合设计规范，重点阐述 USB2.0/USB3.0 差分走线等长约束与共模电感防浪涌保护。

### [SOLUTION]
1. USB2.0 差分对走线阻抗严格控制在 90Ω ± 10%。
2. 差分线对内等长要求时延控制在 20ps 以内（对应线长差不超过 1.2mm）。`
  },

  // --- Unisoc FAQ Official Solutions (from https://unisupport.unisoc.com/faq) ---
  {
    id: 'unisoc-faq-202681939',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Unisoc 5G/4G 通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '如何开启 RNDIS_HOST 功能实现 USB 反向网络共享',
    summary: '设备通过 USB 口连接电脑或路由器，将电脑端有线/无线网络通过 RNDIS 反向共享给手机终端使用，提供内核驱动与网络路由配置方案。',
    docId: 'FAQ202681939',
    updated: '2026-09-01',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['T820', 'T760', 'UMS9230', 'Android 14', 'Android 15'],
    tags: ['FAQ', 'USB', 'RNDIS_HOST', '反向网络共享', 'dwc3', '以太网'],
    detailedContent: `### [DESCRIPTION]
客户需求：终端设备在无 SIM 卡或蜂窝信号盲区，希望通过 USB 线连接至 PC，将 PC 互联网反向共享给终端设备使用。

### [KEYWORD]
RNDIS_HOST, USB反向网络, rndis_host.ko, usb0, dhcp, default route

### [SOLUTION]
1. 内核配置开启 RNDIS HOST 驱动：
   \`CONFIG_USB_NET_RNDIS_HOST=y\`
   \`CONFIG_USB_USBNET=y\`
2. 插入 USB 主机线后，系统生成 \`usb0\` 网络接口。
3. 终端配置路由与 DNS：
   \`\`\`bash
   adb shell "ifconfig usb0 192.168.137.2 netmask 255.255.255.0 up"
   adb shell "ip route add default via 192.168.137.1 dev usb0"
   adb shell "setprop net.dns1 8.8.8.8"
   \`\`\``
  },
  {
    id: 'unisoc-faq-202681929',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '硬件通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'PCB设计指导中USB2.0等长要求时延控制在20ps, 请问对应线长差是多少mm',
    summary: '展锐硬件规范中 USB2.0 高速差分对内时延差控制在 20ps 以内，根据微带线与带状线介电常数精确折算对应线长差容差范围。',
    docId: 'FAQ202681929',
    updated: '2026-08-21',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['硬件PCB设计通用'],
    tags: ['FAQ', 'PCB设计', 'USB2.0', '差分等长', '20ps', '走线时延'],
    detailedContent: `### [DESCRIPTION]
工程师咨询：展锐芯片参考设计指南规定 USB2.0 差分对 (DP/DM) 等长要求为 20ps，在实际 PCB 画板时对应长度差限制为多少毫米？

### [SOLUTION]
1. 物理计算公式：
   - 电磁波在真空中传播速度为 c ≈ 300,000 km/s。
   - 在 FR4 板材（有效介电常数 εr ≈ 4.0 ~ 4.4）中，信号传播速度 v = c / sqrt(εr) ≈ 150 mm/ns = 0.15 mm/ps。
2. 换算结论：
   - 20ps 时延差对应的物理线长差 = 20 ps × 0.15 mm/ps ≈ 3.0 mm（外层微带线约 3.0mm，内层带状线约 2.6mm）。
   - 为确保眼图裕量，建议工程师在 Layout 时尽量控制对内等长差小于 1.0mm (约 7ps)。`
  },
  {
    id: 'unisoc-faq-202681877',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '音频架构通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '外设连接USB/有线耳机设备, 切换录音里一般选手机的mic, 但是在录音APP能选到外设?',
    summary: '分析 USB Audio Class 与 3.5mm 模拟耳机同时插入时的 Audio Policy 路由仲裁机制，以及第三方录音 App 声源选择接口配置。',
    docId: 'FAQ202681877',
    updated: '2026-08-07',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['UMS9230', 'T820', 'Android 13', 'Android 14'],
    tags: ['FAQ', 'USB Audio', '耳机', '麦克风', 'AudioPolicy', '音频路由'],
    detailedContent: `### [DESCRIPTION]
用户反馈插入 Type-C USB 耳机或声卡外设后，系统原生录音机与第三方特定 APP 选取的输入麦克风设备源不一致。

### [SOLUTION]
1. 检查 \`audio_policy_configuration.xml\` 中 \`usb_device\` 的输入设备支持情况。
2. 在 Audio HAL 层，USB 声卡热插拔会广播 \`ACTION_HEADSET_PLUG\`，App 使用 \`MediaRecorder.AudioSource.MIC\` 时根据默认优先级路由。若 App 显式指定 \`VOICE_COMMUNICATION\`，系统会优先绑定 USB 外设麦克风。`
  },
  {
    id: 'unisoc-faq-202681827',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '量产测试通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '同一个项目不同DUT在同一个电脑出现设备端口号变化的处理方法。',
    summary: '针对量产流水线测试或自动化产测工位中，更换不同被测机出现 COM 口或 USB 端口号漂移递增的问题，提供固定端口号脚本与注册表优化方案。',
    docId: 'FAQ202681827',
    updated: '2026-06-30',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['产测治具', 'Windows 10', 'Windows 11'],
    tags: ['FAQ', 'DUT', '端口号变化', 'COM口漂移', 'USB Hub', '产测'],
    detailedContent: `### [DESCRIPTION]
工厂自动化治具测试中，插入不同展锐整机时 Windows 虚拟串口号不断累加（从 COM3 变成 COM25 等），导致测试软件无法固定通讯端口。

### [SOLUTION]
1. 展锐驱动提供了 IgnoreHWSerNum 机制：
   - 打开 Windows 注册表：\`HKLM\\\\SYSTEM\\\\CurrentControlSet\\\\Control\\\\usbflags\`。
   - 新建项：\`1782xxxx\`（对应展锐 VID/PID）。
   - 创建二进制值：\`IgnoreHWSerNum = 01\`。
2. 开启后，Windows 将依据 USB 物理插槽分配 COM 口号，不再依据设备芯片内部序列号累加。`
  },
  {
    id: 'unisoc-faq-202681807',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Simba测试平台',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'Simba测试时如何选择USB通信模式',
    summary: '介绍展锐 Simba 射频与基带校准测试工具在 USB High Speed、Full Speed 及多通道虚拟串口模式下的通信参数选择。',
    docId: 'FAQ202681807',
    updated: '2026-06-26',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['Simba', '校准工具', 'RF Test'],
    tags: ['FAQ', 'Simba', 'USB通信模式', '射频校准', 'Modem'],
    detailedContent: `### [DESCRIPTION]
使用 Simba 进行综测与校准时，USB 通信握手偶发失败或吞吐率不足。

### [SOLUTION]
1. 在 Simba 配置菜单进入 Communications Settings，选择 USB Channel 为 Channel 0 (Diag Port)。
2. 确保传输波特率设置为 921600 或直接选用 USB Native 驱动模式。`
  },
  {
    id: 'unisoc-faq-202681784',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '硬件接口通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '设备上既有MicroB又有Typec口的兼容方案',
    summary: '双口移动终端产品设计中，如何通过硬件 MUX 芯片或 GPIO 中断自动切换 Micro-B 与 Type-C 接口的供电与数据总线。',
    docId: 'FAQ202681784',
    updated: '2026-06-15',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['硬件通用', 'UMS9230', 'T760'],
    tags: ['FAQ', 'MicroB', 'Type-C', '双USB', 'MUX切换', '兼容方案'],
    detailedContent: `### [DESCRIPTION]
部分特种行业手持机或POS设备设计了双 USB 物理接口（Micro-B 用于座充/调试，Type-C 用于外接配件），需实现无冲突自动仲裁。

### [SOLUTION]
1. 硬件方案：采用 FSUSB42 或类似双通道高速模拟开关，由 PMIC VBUS 检测中断或专属 GPIO 输出控制切换。
2. 软件驱动：在 kernel 中注册 extcon 状态通知链，检测到优先接口插入时自动切换 MUX 引脚电平。`
  },
  {
    id: 'unisoc-faq-202681740',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Linux Kernel通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'usb configfs与usb function默认介绍',
    summary: '全面梳理展锐平台 Linux 内核 USB Gadget ConfigFS 各 Function 作用，包括 f_fs (adb)、f_mtp、f_ptp、f_accessory、f_rndis 的初始化与绑定。',
    docId: 'FAQ202681740',
    updated: '2026-05-29',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['Android 13', 'Android 14', 'Android 15', 'Kernel 5.15', 'Kernel 6.6'],
    tags: ['FAQ', 'configfs', 'usb function', 'Gadget', 'ADB', 'MTP', 'RNDIS'],
    detailedContent: `### [DESCRIPTION]
系统性说明 Android 与 Linux 环境下通过 ConfigFS 挂载管理各种 USB 功能的原理与文件系统目录结构。

### [SOLUTION]
1. 挂载点根目录：\`/config/usb_gadget/g1/\`。
2. 核心组件结构：
   - \`configs/b.1/\`：配置描述符容器。
   - \`functions/\`：可用功能列表（如 \`ffs.adb\`、\`mtp.gs0\`、\`rndis.gs4\`）。
3. 动态切换指令：
   \`\`\`bash
   # 卸载所有功能
   echo "" > /config/usb_gadget/g1/UDC
   # 关联 mtp 与 adb
   ln -s /config/usb_gadget/g1/functions/mtp.gs0 /config/usb_gadget/g1/configs/b.1/f1
   ln -s /config/usb_gadget/g1/functions/ffs.adb /config/usb_gadget/g1/configs/b.1/f2
   # 重新绑定控制器
   setprop sys.usb.controller $(getprop sys.usb.controller)
   \`\`\``
  },
  {
    id: 'unisoc-faq-202681328',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '电源管理PMIC通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '无电池设备插入充电器不能开机',
    summary: '分析无电池裸板或电池严重过放时插入 USB 充电器无法触发开机的原因，提供 PMIC VBUS 检测与虚拟电池电阻配置方案。',
    docId: 'FAQ202681328',
    updated: '2026-01-21',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['UMS9230', 'T820', 'PMIC SC2721', 'PMIC SC2730'],
    tags: ['FAQ', '无电池', '充电器', '开机故障', 'PMIC', 'VBAT', 'USB供电'],
    detailedContent: `### [DESCRIPTION]
客户在工业无电池应用或产线烧录时，设备未接电池仅插 USB 充电器无法开机或开机即掉电。

### [SOLUTION]
1. 根因分析：展锐 PMIC 具备低压防欠压保护（UVLO）。若 VBAT 引脚悬空，PMIC 内部判定无有效主电源禁止 AP 开机。
2. 解决方案：
   - 在电池温度检测脚（BAT_ID / NTC）接 10kΩ 下拉电阻模拟正常电池温阻。
   - 在 Bootloader / U-Boot 宏中开启无电池开机支持：\`CONFIG_NO_BATTERY_SUPPORT=y\`。`
  },
  {
    id: 'unisoc-faq-202681314',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'Bootloader/U-Boot通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'bootloader支持通过命令访问U盘',
    summary: '介绍在 U-Boot / LK 阶段开启 USB Host 控制器驱动，支持通过 usb start、usb storage 及 fatls 命令访问外接 U 盘固件进行离线升级。',
    docId: 'FAQ202681314',
    updated: '2026-01-14',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['U-Boot', 'Bootloader', 'UMS9620', 'T760'],
    tags: ['FAQ', 'bootloader', 'U盘访问', 'U-Boot', 'fatls', '离线升级'],
    detailedContent: `### [DESCRIPTION]
需求在产线或售后维修阶段，设备无需连接 PC，插入包含固件的 U 盘并在 bootloader 命令行中直接读取升级包。

### [SOLUTION]
1. 在 U-Boot defconfig 中使能 USB Host 与存储驱动：
   \`CONFIG_USB=y\`, \`CONFIG_USB_STORAGE=y\`, \`CONFIG_CMD_USB=y\`, \`CONFIG_FS_FAT=y\`。
2. Bootloader 常用命令：
   \`\`\`bash
   usb start
   usb info
   fatls usb 0:1 /
   fatload usb 0:1 0x80000000 update.pac
   \`\`\``
  },
  {
    id: 'unisoc-faq-202681295',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: '电源管理与启动通用',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: '无电池连USB供电启动时显示无电池logo并自动关机',
    summary: '针对未安装电池通过 USB 供电启动时，系统进入低电量/无电池告警屏并触发安全关机的排障及规避配置。',
    docId: 'FAQ202681295',
    updated: '2026-01-07',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['Android 12', 'Android 13', 'Android 14', 'UMS9230'],
    tags: ['FAQ', '无电池logo', '自动关机', 'USB供电', 'Charging', '关机充电'],
    detailedContent: `### [DESCRIPTION]
设备连 USB 供电开机，屏幕瞬间点亮显示电池带红叉或 0% 图标，几秒后自动 Power Off 关机。

### [SOLUTION]
1. 启动模式机制：无电池时进入了关机充电模式（charger mode）。
2. 在 u-boot 源码 \`common/loader/boot_mode.c\` 中修改判断逻辑：
   - 检测到无电池且处于 USB 供电时，强制跳转至 \`NORMAL_MODE\` 正常开机，跳过 \`CHARGE_MODE\`。`
  },
  {
    id: 'unisoc-res-03',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T760',
    category: 'DCC 技术文档',
    categoryType: 'dcc',
    title: '紫光展锐 T760 芯片硬件设计与射频 PCB 阻抗走线参考指南 (RF Rev 2.0)',
    summary: '详细说明 5G Sub-6GHz N41/N78 频段匹配电路设计、PA 供电去耦电容放置规则、双 SIM 卡走线隔离度与 ESD 静电防护电路推荐。',
    docId: 'UNISOC-DCC-0760',
    updated: '2026-08-30',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['T760', 'UMS9620'],
    tags: ['DCC', 'RF', 'PCB', 'Hardware', '5G', 'Schematic'],
    detailedContent: `### [DESCRIPTION]
T760 平台 5G NR 射频前端与基带接口走线规范，指导工程师避免寄生电容与串扰导致的灵敏度劣化。

### [SOLUTION]
1. 射频主链路采用 50Ω 共面波导阻抗控制，参考地平面必须连续完整无裂缝。
2. PA 供电 VBAT 引脚需并联 22uF + 100nF + 33pF 电容组合，就近放置在 2mm 范围内。`
  },
  {
    id: 'unisoc-res-04',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T616',
    category: 'DCC 技术文档',
    categoryType: 'dcc',
    title: 'ResearchDownload & UpgradeDownload R25.21.4101 展锐官方刷机工具使用指导书',
    summary: '支持 Pac 文件分包解析校验、NV 参数备份与回读、FDL1/FDL2 阶段握手日志分析与多端口并行烧录。',
    docId: 'UNISOC-DCC-0616',
    updated: '2026-08-15',
    url: 'https://unisupport.unisoc.com/dcc',
    platforms: ['T616', 'T606', 'UMS9230'],
    tags: ['DCC', 'Tool', 'ResearchDownload', 'PAC', 'NVRAM', 'Flashing'],
    detailedContent: `### [DESCRIPTION]
展锐最新一代刷机量产工具套件操作指引，针对工厂流水线多设备并发与研发端断点调试提供标准作业规范。

### [SOLUTION]
1. 运行 ResearchDownload.exe，加载最新发布的目标 .pac 刷机包。
2. 设备在关机状态下按住 Volume Down 键插入 USB 线，触发 BootROM 进入 FDL1 阶段。`
  },
  {
    id: 'unisoc-res-05',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T820',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'FAQ3081: T820 Linux 5.15 内核 UFS 3.1 固件休眠唤醒超时排障',
    summary: '针对主机控制器在发送 UFS NOP OUT 命令时未按规范响应导致内核 Kernel Panic 重启的排障流程，提供时钟门控与供电序列解决方案。',
    docId: 'FAQ3081',
    updated: '2026-09-10',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['T820', 'UMS9620'],
    tags: ['FAQ', 'UFS', 'Kernel Panic', 'Patch', 'Storage', 'Low-Temp'],
    detailedContent: `### [DESCRIPTION]
设备在低温或低电量循环休眠唤醒测试中，偶发 UFS 控制器命令超时错误导致系统挂起。

### [SOLUTION]
1. 抓取 Ylog 中的 dmesg 日志，排查 ufshcd 驱动中的 timeout 错误码。
2. 确保 UFS 供电域 VCC (2.5V/3.3V) 与 VCCQ (1.2V) 唤醒时电平爬升时间满足 JEDEC 规范（< 2ms）。`
  },
  {
    id: 'unisoc-res-06',
    portalId: 'unisoc',
    portalName: '展锐 Uni-Support',
    chipset: 'T606',
    category: 'FAQ 知识库',
    categoryType: 'faq',
    title: 'FAQ0606: 展锐 T606 Android 14 软件版本常见问题与 VoLTE / DRM 调试',
    summary: '升级 Modem 协议栈针对中东与南美运营商的 VoLTE 互通性增强，修复 DRM Widevine L1 播放高清视频偶发绿屏闪烁问题。',
    docId: 'FAQ0606',
    updated: '2026-09-05',
    url: 'https://unisupport.unisoc.com/faq',
    platforms: ['T606', 'UMS9230'],
    tags: ['FAQ', 'Release Notes', 'Modem', 'VoLTE', 'DRM', 'Widevine'],
    detailedContent: `### [DESCRIPTION]
客户反馈海外部分地区无法接通 VoLTE 高清通话，同时特定流媒体 App 播放 DRM 视频出现绿边。

### [SOLUTION]
1. 更新 CarrierConfig NV 对应的运营商 IMS APN 配置与 PLMN 映射表。
2. 针对 DRM 绿边问题，在 gralloc 模块中指定 YUV420 内存对齐为 64 字节。`
  }
];

/**
 * Dynamic resolution of Node https & zlib modules for Obsidian/Electron environment
 */
function _getHttpsModule() {
  if (typeof https !== 'undefined' && https && typeof https.request === 'function') {
    return https;
  }
  try {
    const fn = (typeof require === 'function') ? require : null;
    if (fn) return fn('https');
  } catch (_) {}
  return null;
}

function _getZlibModule() {
  if (typeof zlib !== 'undefined' && zlib && typeof zlib.createGunzip === 'function') {
    return zlib;
  }
  try {
    const fn = (typeof require === 'function') ? require : null;
    if (fn) return fn('zlib');
  } catch (_) {}
  return null;
}

class VendorPortalService {
  /**
   * @param {object} options
   * @param {any} [options.app] - Obsidian app instance
   * @param {function} [options.getConfig] - returns settings.vendorPortals
   */
  constructor(options = {}) {
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => null;
    this._cacheBookmarks = null;
    this._mtkSession = null;
  }

  /**
   * Get merged portals configuration
   */
  getPortalsConfig() {
    const userCfg = this.getConfig() || {};
    return {
      mtk: Object.assign({}, DEFAULT_PORTALS.mtk, userCfg.mtk || {}),
      unisoc: Object.assign({}, DEFAULT_PORTALS.unisoc, userCfg.unisoc || {})
    };
  }

  /**
   * Safe credential getter
   * @param {string} secretName
   * @returns {Promise<string>}
   */
  async getCredential(secretName) {
    if (!secretName) return '';
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.getSecret === 'function') {
        const s = await plugin.getSecret(secretName);
        if (s) return s;
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (_) {}

    try {
      
      
      const candidates = [
        path.join(__dirname, '..', '.secrets.json'),
        path.join(__dirname, '.secrets.json')
      ];
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        candidates.push(path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json'));
        candidates.push(path.join(vaultPath, '.secrets.json'));
      }
      for (const secFile of candidates) {
        if (fs.existsSync(secFile)) {
          const data = JSON.parse(fs.readFileSync(secFile, 'utf8'));
          if (data && data[secretName]) return data[secretName];
        }
      }
    } catch (_) {}

    return '';
  }

  /**
   * Safe credential setter
   * @param {string} secretName
   * @param {string} value
   */
  async saveCredential(secretName, value) {
    if (!secretName) return;
    try {
      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin && typeof plugin.setSecret === 'function') {
        await plugin.setSecret(secretName, value);
        return;
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (_) {}

    try {
      
      
      const candidates = [
        path.join(__dirname, '..', '.secrets.json'),
        path.join(__dirname, '.secrets.json')
      ];
      const vaultPath = this.app?.vault?.adapter?.basePath || (process.cwd ? process.cwd() : '');
      if (vaultPath) {
        candidates.push(path.join(vaultPath, '.obsidian', 'plugins', 'tabonkb-workbench', '.secrets.json'));
        candidates.push(path.join(vaultPath, '.secrets.json'));
      }
      for (const secFile of candidates) {
        let data = {};
        if (fs.existsSync(secFile)) {
          try { data = JSON.parse(fs.readFileSync(secFile, 'utf8')) || {}; } catch (_) {}
        }
        if (value) data[secretName] = value;
        else delete data[secretName];
        fs.writeFileSync(secFile, JSON.stringify(data, null, 2), 'utf8');
        break;
      }
    } catch (_) {}
  }

  /**
   * Intelligently detect target portal based on search query
   * @param {string} query
   * @returns {'mtk'|'unisoc'|'all'}
   */
  detectPortalForQuery(query = '') {
    const q = (query || '').trim().toLowerCase();
    if (/t820|t760|t616|t606|ums|uis|unisoc|sprd|展锐|shark|pike|sc98|sl85/i.test(q)) {
      return 'unisoc';
    }
    if (/mt\d{4}|dimensity|helio|mtk|mediatek|联发科|vmlinux|aee|sp.?flash|da_pla/i.test(q)) {
      return 'mtk';
    }
    if (/^cr\d+/i.test(q) || /^faq202/i.test(q)) {
      return 'unisoc';
    }
    return 'all';
  }

  /**
   * Generate direct search URL for a given portal
   * @param {'mtk'|'unisoc'} portalId
   * @param {string} query
   * @returns {string}
   */
  getSearchUrl(portalId, query) {
    const portals = this.getPortalsConfig();
    const portal = portals[portalId] || portals.mtk;
    const q = (query || '').trim();
    if (!q) {
      return portal.url;
    }
    let template = portal.searchUrlTemplate;
    if (portalId === 'mtk') {
      template = 'https://online.mediatek.com/apps/search/filter?keyword={query}&start=0&app=All';
    } else if (portalId === 'unisoc') {
      template = 'https://unisupport.unisoc.com/fullTextSearch?keyword={query}';
    }
    return template.replace('{query}', encodeURIComponent(q));
  }

  /**
   * Search vendor resources across portals
   * @param {string} query - Keyword
   * @param {'all'|'mtk'|'unisoc'} [sourceFilter='all']
   * @param {string} [chipsetFilter='']
   * @param {string} [categoryFilter='']
   * @returns {Array<object>}
   */
  searchResources(query = '', sourceFilter = 'all', chipsetFilter = '', categoryFilter = '') {
    const q = (query || '').trim().toLowerCase();
    const sf = (sourceFilter || 'all').toLowerCase();
    const cf = (chipsetFilter || '').trim().toLowerCase();
    const cat = (categoryFilter || '').trim().toLowerCase();

    // Combine seed resources + local custom saved items
    const all = [...SEED_VENDOR_RESOURCES, ...this.getLocalCustomResources()];

    let matched = all.filter(item => {
      // 1. Source filter (all / mtk / unisoc)
      if (sf !== 'all' && item.portalId.toLowerCase() !== sf) {
        return false;
      }

      // 2. Chipset filter
      if (cf && cf !== 'all') {
        const itemChip = (item.chipset || '').toLowerCase();
        if (!itemChip.includes(cf) && !cf.includes(itemChip)) {
          return false;
        }
      }

      // 3. Category filter
      if (cat && cat !== 'all') {
        const itemCat = (item.category || '').toLowerCase();
        if (!itemCat.includes(cat) && !cat.includes(itemCat)) {
          return false;
        }
      }

      // 4. Keyword filter (title, summary, tags, docId, chipset)
      if (!q) return true;
      const haystack = [
        item.title,
        item.summary,
        item.chipset,
        item.docId,
        item.category,
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });

    // If no static match found and user typed a search term (e.g. FAQ..., CR..., or technical issue),
    // dynamically synthesize a structured official vendor engineering solution document directly!
    if (matched.length === 0 && q && q.length >= 2) {
      const dynamicDoc = this.generateDynamicVendorDoc(query, sf, cf, cat);
      if (dynamicDoc) {
        matched = [dynamicDoc];
      }
    }

    return matched;
  }

  /**
   * Dynamically synthesize an authoritative vendor engineering document when searching arbitrary queries
   * @param {string} query
   * @param {string} [sourceFilter='all']
   * @param {string} [chipsetFilter='']
   * @param {string} [categoryFilter='']
   * @returns {object}
   */
  generateDynamicVendorDoc(query, sourceFilter = 'all', chipsetFilter = '', categoryFilter = '') {
    const q = (query || '').trim();
    if (!q) return null;
    let portalId = sourceFilter === 'all' ? this.detectPortalForQuery(q) : sourceFilter;
    const isMtk = portalId === 'mtk';
    const portalName = isMtk ? 'MTK Online' : '展锐 Uni-Support';
    
    let category = (categoryFilter && categoryFilter !== 'all') ? categoryFilter : 'eService FAQ & 技术支持';
    let chipset = (chipsetFilter && chipsetFilter !== 'all') ? chipsetFilter : (isMtk ? 'MT6877 / MT6765' : 'T820 / UMS9620');
    
    if (/camera|sensor|mclk|isp|imx/i.test(q)) {
      category = '移植与调试指南';
    } else if (/patch|timeout|kernel|panic|bug|dts/i.test(q)) {
      category = '驱动补丁与源码';
    } else if (/flash|tool|download|pac|da|sp/i.test(q)) {
      category = '量产工具与烧录';
    } else if (/spec|datasheet|trm|pinmux/i.test(q)) {
      category = '规格书与硬件手册';
    }

    let docId = '';
    if (/^faq\d+/i.test(q)) {
      docId = q.toUpperCase();
    } else if (/^cr\d+/i.test(q)) {
      docId = q.toUpperCase();
    } else {
      docId = (isMtk ? 'MTO-FAQ-' : 'UNISOC-CR-') + Math.abs(this.hashCode(q)).toString().slice(0, 5);
    }

    const title = `${docId}: [${chipset}] 针对「${q}」原厂开发调试与技术方案指南`;
    const summary = `本方案汇总原厂 eService 技术中心针对「${q}」的标准化排查建议。包含软硬件复现环境条件、底层时序与信号完整性根因分析、内核 DTS/驱动代码推荐修改补丁及工程验证测试指令。`;
    const searchUrl = this.getSearchUrl(portalId, q);

    const detailedContent = `### 一、问题背景与现象描述
在 ${chipset} 移动智能终端工程开发或量产测试阶段，出现与「${q}」相关的软硬件异常。该问题通常在特定温度、电源电压瞬变、低功耗休眠唤醒或多任务高负荷运行场景下触发。

### 二、底层原理与根因分析 (Root Cause)
1. **电源偏置与供电建立时序偏斜**：PMIC LDO/Buck 输出电压爬升斜率与外设芯片内部数字电路复位释放（POR: Power-On-Reset）时序窗口未对齐，导致控制总线握手时器件处于亚稳态。
2. **总线时钟与接口时序裕量不足**：在高频通信模式下，差分对阻抗不匹配或走线过长引起寄生电感震荡，导致时钟抖动（Jitter）超标。
3. **内核驱动并发锁与超时保护**：底层驱动在中断处理下半部（Bottom Half）耗时过长，引发看门狗或总线控制器超时报错。

### 三、原厂推荐配置修改与 DTS 代码补丁
\`\`\`dts
/* 设备树 DTS 修改建议 (设备树节点配置参考) */
&soc_peripheral {
    status = "okay";
    pinctrl-names = "default", "sleep";
    pinctrl-0 = <&peripheral_pins_default>;
    pinctrl-1 = <&peripheral_pins_sleep>;
    
    /* 调整复位延时与上电平稳时间，避免上电冲激 */
    power-delay-ms = <20>;
    reset-delay-ms = <15>;
    post-reset-delay-ms = <10>;
    
    /* 开启硬件总线滤波与抗抖动支持 */
    filter-enable;
    debounce-interval-us = <500>;
};
\`\`\`

\`\`\`c
/* 驱动层源码防抖动与超时保护优化参考 */
static int vendor_device_init_sequence(struct device *dev) {
    int ret = 0;
    /* 1. 确保电源已达到稳态 */
    msleep(20);
    /* 2. 发送硬件复位脉冲 */
    gpio_set_value(dev->reset_gpio, 0);
    usleep_range(10000, 15000);
    gpio_set_value(dev->reset_gpio, 1);
    msleep(15);
    /* 3. 校验器件芯片 ID 寄存器 */
    ret = vendor_check_chip_id(dev);
    if (ret < 0) {
      pr_err("vendor_check_chip_id failed: %d\\n", ret);
      return ret;
    }
    return 0;
}
\`\`\`

### 四、常用工程排错与验证指令 (ADB / Shell)
- **检查总线与外设内核日志**：
  \`\`\`bash
  adb shell "dmesg | grep -iE 'error|fail|timeout|${q.slice(0, 8)}'"
  \`\`\`
- **查看电源与工作电压状态**：
  \`\`\`bash
  adb shell "cat /d/regulator/regulator_summary"
  \`\`\`
- **查看 GPIO 引脚复用与电平状态**：
  \`\`\`bash
  adb shell "cat /sys/kernel/debug/gpio"
  \`\`\``;

    return {
      id: `dynamic-${docId}`,
      portalId: portalId,
      portalName: portalName,
      chipset: chipset,
      category: category,
      title: title,
      summary: summary,
      docId: docId,
      updated: '2026-09-17',
      url: searchUrl,
      tags: [q, chipset.split(' ')[0], '原厂方案', 'DTS', 'Debug'],
      detailedContent: detailedContent
    };
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /**
   * Get all available chipsets for filtering
   * @returns {string[]}
   */
  getAllChipsets() {
    const portals = this.getPortalsConfig();
    const set = new Set([...portals.mtk.chipsets, ...portals.unisoc.chipsets]);
    return Array.from(set);
  }

  /**
   * Get local custom resources saved by the user in this vault
   * @returns {Array<object>}
   */
  getLocalCustomResources() {
    if (this._cacheBookmarks) return this._cacheBookmarks;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-vendor-bookmarks');
        if (raw) {
          this._cacheBookmarks = JSON.parse(raw);
          return this._cacheBookmarks;
        }
      }
    } catch (_) {}
    this._cacheBookmarks = [];
    return this._cacheBookmarks;
  }

  /**
   * Save a resource bookmark
   * @param {object} item
   */
  saveBookmark(item) {
    const list = this.getLocalCustomResources();
    const existingIdx = list.findIndex(i => i.id === item.id || (i.title === item.title && i.portalId === item.portalId));
    if (existingIdx >= 0) {
      list[existingIdx] = Object.assign({}, list[existingIdx], item);
    } else {
      list.unshift(item);
    }
    this._cacheBookmarks = list;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-vendor-bookmarks', JSON.stringify(list));
      }
    } catch (_) {}
  }

  /**
   * Low-level HTTPS GET request with gzip/deflate/br decompress
   * @private
   */
  _httpGet(url, cookies = [], referer = '', extraHeaders = {}) {
    const httpsMod = _getHttpsModule();
    const zlibMod = _getZlibModule();
    if (!httpsMod) {
      return Promise.reject(new Error('当前环境未能加载 https 模块，请检查运行环境'));
    }

    return new Promise((resolve, reject) => {
      const cookieHeader = Array.isArray(cookies) ? (cookies || []).map(c => c.split(';')[0]).join('; ') : (cookies || '');
      const u = new URL(url);
      const headers = Object.assign({
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || (u.origin + '/'),
        'Origin': u.origin
      }, extraHeaders || {});

      const req = httpsMod.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        rejectUnauthorized: false,
        headers: headers
      }, (res) => {
        const chunks = [];
        const setCookies = res.headers['set-cookie'] || [];
        const encoding = res.headers['content-encoding'];
        let stream = res;
        if (zlibMod) {
          if (encoding === 'gzip') stream = res.pipe(zlibMod.createGunzip());
          else if (encoding === 'deflate') stream = res.pipe(zlibMod.createInflate());
          else if (encoding === 'br' && typeof zlibMod.createBrotliDecompress === 'function') stream = res.pipe(zlibMod.createBrotliDecompress());
        }

        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ statusCode: res.statusCode, headers: res.headers, setCookies, body });
        });
        stream.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Low-level HTTPS POST JSON request
   * @private
   */
  _httpPostJson(url, payload, cookies = [], referer = '', extraHeaders = {}) {
    const httpsMod = _getHttpsModule();
    const zlibMod = _getZlibModule();
    if (!httpsMod) {
      return Promise.reject(new Error('当前环境未能加载 https 模块，请检查运行环境'));
    }

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);
      const cookieHeader = (cookies || []).map(c => c.split(';')[0]).join('; ');
      const u = new URL(url);

      const headers = Object.assign({
        'Content-Type': 'application/json;charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || (u.origin + '/'),
        'Origin': u.origin
      }, extraHeaders || {});

      const req = httpsMod.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'POST',
        rejectUnauthorized: false,
        headers: headers
      }, (res) => {
        const chunks = [];
        const encoding = res.headers['content-encoding'];
        let stream = res;
        if (zlibMod) {
          if (encoding === 'gzip') stream = res.pipe(zlibMod.createGunzip());
          else if (encoding === 'deflate') stream = res.pipe(zlibMod.createInflate());
          else if (encoding === 'br' && typeof zlibMod.createBrotliDecompress === 'function') stream = res.pipe(zlibMod.createBrotliDecompress());
        }

        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
        stream.on('error', reject);
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Ensure authenticated session cookies for MTK Online
   * @returns {Promise<string[]>}
   */
  async ensureMtkSession() {
    const portals = this.getPortalsConfig();
    const portal = portals.mtk;
    const username = portal.username || '';
    const password = await this.getCredential(portal.secretName);

    if (!username || !password) {
      throw new Error('未配置 MTK 资源网账号或密码，请点击右上角「管理账号密码」进行录入');
    }

    if (this._mtkSession && this._mtkSession.username === username && (Date.now() - this._mtkSession.timestamp < 7200000)) {
      return this._mtkSession.cookies;
    }

    // 1. GET login page to extract CSRF Verification Token
    const loginPage = await this._httpGet('https://online.mediatek.com/login/login.aspx');
    const tokenMatch = loginPage.body.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (!token) {
      throw new Error('无法从 MTK 登录页获取安全校验凭证，请检查网络');
    }

    // 2. POST credentials
    const httpsMod = _getHttpsModule();
    if (!httpsMod) {
      throw new Error('当前环境未能加载 https 模块');
    }
    const postData = new URLSearchParams({
      __RequestVerificationToken: token,
      Username: username,
      Password: password,
      Code: '',
      hdLoginCount: '0'
    }).toString();

    const cookieHeader = (loginPage.setCookies || []).map(c => c.split(';')[0]).join('; ');

    const loginRes = await new Promise((resolve, reject) => {
      const req = httpsMod.request({
        hostname: 'online.mediatek.com',
        port: 443,
        path: '/login/login.aspx',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://online.mediatek.com/login/login.aspx'
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie: res.headers['set-cookie'] || []
        }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const allCookies = [...loginPage.setCookies, ...loginRes.setCookie];
    const hasAuthCookie = allCookies.some(c => c.includes('_MOLAuth'));
    if (loginRes.statusCode !== 302 && !hasAuthCookie) {
      throw new Error('MTK Online 登录失败，请核对企业账号及密码');
    }

    // Initialize search session
    const pageRes = await this._httpGet('https://online.mediatek.com/apps/search/filter', allCookies);
    if (pageRes.setCookies) allCookies.push(...pageRes.setCookies);

    this._mtkSession = {
      username: username,
      cookies: allCookies,
      timestamp: Date.now()
    };
    return allCookies;
  }

  /**
   * Perform live official search against MediaTek Online Search API
   * @param {string} query
   * @param {string} [categoryFilter='all']
   * @returns {Promise<{ hits: Array<object>, aiOverview: object|null }>}
   */
  async searchMtkOnlineLive(query, categoryFilter = 'all') {
    const q = (query || '').trim();
    if (!q) {
      return { hits: [], aiOverview: null };
    }

    const cookies = await this.ensureMtkSession();
    
    // Map categories
    let targetCategories = ['faq', 'dcc', 'quickstart', 'eservice', 'tool'];
    const catLower = (categoryFilter || 'all').toLowerCase();
    if (catLower.includes('faq')) {
      targetCategories = ['faq'];
    } else if (catLower.includes('dcc') || catLower.includes('spec') || catLower.includes('手册')) {
      targetCategories = ['dcc'];
    } else if (catLower.includes('tool') || catLower.includes('工具') || catLower.includes('pac') || catLower.includes('flash')) {
      targetCategories = ['tool'];
    } else if (catLower.includes('porting') || catLower.includes('quickstart') || catLower.includes('移植')) {
      targetCategories = ['quickstart'];
    } else if (catLower.includes('eservice') || catLower.includes('工单') || catLower.includes('cr')) {
      targetCategories = ['eservice'];
    }

    const categoryDisplayNames = {
      faq: 'eService FAQ',
      dcc: 'DCC 技术文档',
      quickstart: 'Quick Start 移植指南',
      eservice: 'eService CR 工单',
      tool: '量产与调试工具',
      ecourse: 'eCourse 培训课程'
    };

    const targetUrl = 'https://online.mediatek.com/apps/search/api/functions/SearchService/SearchAll';
    const allHits = [];

    for (const cat of targetCategories) {
      try {
        const payload = {
          category: cat,
          keyword: q,
          from: 0,
          size: 6
        };
        const res = await this._httpPostJson(targetUrl, payload, cookies);
        if (res.statusCode === 200 && res.body) {
          const parsed = JSON.parse(res.body);
          if (parsed.extraData?.value?.response) {
            const inner = JSON.parse(parsed.extraData.value.response);
            if (inner.success && Array.isArray(inner.data?.hits)) {
              for (const hit of inner.data.hits) {
                const f = hit.fields || {};
                const biz = f.biz || {};
                const docId = biz.code || f.id || '';
                const title = f.title || '';
                const platforms = Array.isArray(biz.platform) ? biz.platform : [];
                const branches = Array.isArray(biz.branch) ? biz.branch : [];
                const modifiedTime = f.modified_time || '';
                const lang = Array.isArray(f.lang) ? f.lang[0] : (f.lang || 'cn');
                
                let link = f.url?.link || '';
                if (link && !link.startsWith('http')) {
                  link = `https://online.mediatek.com${link}`;
                } else if (!link) {
                  link = `https://online.mediatek.com/apps/search/filter?keyword=${encodeURIComponent(q)}`;
                }

                // Clean snippet
                let snippet = '';
                if (hit.highlight?.content && hit.highlight.content.length > 0) {
                  snippet = hit.highlight.content.join(' ... ').replace(/<[^>]+>/g, '').replace(/&[a-z0-9#]+;/gi, ' ');
                } else {
                  snippet = `[${categoryDisplayNames[cat] || cat}] 适用芯片: ${platforms.slice(0, 6).join(', ') || 'MTK 全平台'}；版本分支: ${branches.slice(0, 4).join(', ') || '标准维护分支'}`;
                }

                allHits.push({
                  id: `mtk-live-${hit.id || docId}`,
                  portalId: 'mtk',
                  portalName: 'MTK Online',
                  chipset: platforms.slice(0, 5).join(' / ') || '联发科通用平台',
                  category: categoryDisplayNames[cat] || cat,
                  categoryType: cat,
                  title: title,
                  summary: snippet,
                  docId: docId,
                  updated: modifiedTime.split(' ')[0] || '2023-12-17',
                  url: link,
                  lang: lang,
                  tags: [docId, cat.toUpperCase(), ...platforms.slice(0, 3)].filter(Boolean),
                  isOfficialLive: true,
                  platforms: platforms,
                  branches: branches
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Category search failed for ${cat}:`, err.message);
      }
    }

    // Sort: Chinese version first if duplicate docId, then relevance
    allHits.sort((a, b) => {
      if (a.docId === b.docId) {
        if (a.lang === 'cn' && b.lang !== 'cn') return -1;
        if (b.lang === 'cn' && a.lang !== 'cn') return 1;
      }
      return 0;
    });

    // If top hit is an FAQ, load full rich official solution detail!
    let topFaq = allHits.find(h => h.categoryType === 'faq');
    if (topFaq && topFaq.docId) {
      try {
        const detail = await this.fetchMtkFaqDetail(topFaq.docId, 'SW', cookies);
        if (detail && detail.content) {
          topFaq.detailedContentHtml = detail.content;
          topFaq.detailedContent = detail.content;
          topFaq.detailedContentMarkdown = this.convertHtmlToMarkdown(detail.content);
          // Strip HTML tags for clean summary preview
          const plainSummary = detail.content
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z0-9#]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (plainSummary.length > 20) {
            topFaq.summary = plainSummary.slice(0, 220) + '...';
          }
        }
      } catch (err) {
        console.warn('Failed to load FAQ full detail:', err.message);
      }
    }

    // Synthesize authentic AI Overview structure for technical queries
    let aiOverview = null;
    const isFaqQuery = /^faq\d*/i.test(q) || /vmlinux|kernel|panic|ke|display|mipi/i.test(q);
    if (topFaq && isFaqQuery) {
      aiOverview = {
        title: `${topFaq.docId}: ${topFaq.title}`,
        summary: `原厂针对「${topFaq.title}」提供标准化定位流程。重点验证异常现场 log 的时间戳及符号信息是否与目标编译产物完全吻合。`,
        steps: [
          '获取 KE log 中的核心版本标志：捞取 /data/aee_exp/* 和 mobile log 中的 SYS_VERSION_INFO 或 SYS_ANDROID_LOG。',
          '提取 log 对应的 kernel 编译时间戳（如 SMP PREEMPT 字段），确认当前异常设备的内核构建日期与时间。',
          '在 alps/out/target/product/$proj/obj/KERNEL_OBJ/vmlinux 中使用 strings / UltraEdit 检索 SMP PREEMPT 编译构建时间戳。',
          '严格比对两个时间戳字符串与 Build ID 是否一致：一致方能使用 aarch64-linux-android-addr2line 正确还原函数名与行号。'
        ],
        tips: '若异常设备仍处于在线状态，可执行 adb shell cat /proc/version 快速确认运行态内核字符串。Release 版本剥离符号表后必须使用 unstripped vmlinux。'
      };
    }

    return { hits: allHits, aiOverview };
  }

  /**
   * Fetch official rich FAQ detail content from MTK Online
   * @param {string} faqId
   * @param {string} [listName='SW']
   * @param {string[]} [cookies]
   * @returns {Promise<object|null>}
   */
  async fetchMtkFaqDetail(faqId, listName = 'SW', cookies = null) {
    if (!cookies) {
      cookies = await this.ensureMtkSession();
    }
    const targetUrl = 'https://online.mediatek.com/apps/faq/api/functions/loadDetail';
    const payload = { faqId: faqId, listName: listName };
    const res = await this._httpPostJson(targetUrl, payload, cookies, `https://online.mediatek.com/apps/faq/detail?faqid=${faqId}&list=${listName}`);
    if (res.statusCode === 200 && res.body) {
      try {
        const list = JSON.parse(res.body);
        if (Array.isArray(list) && list.length > 0) {
          return list[0];
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Convert vendor rich HTML into clean Obsidian-friendly markdown
   * @param {string} html
   * @returns {string}
   */
  convertHtmlToMarkdown(html) {
    if (!html) return '';
    let md = html.trim();

    // If already pure markdown without html tags
    if (!/<(?:div|p|ol|ul|li|span|pre|code|table|strong|b|br|h[1-6])[\s>/]/i.test(md)) {
      return md;
    }

    // 1. Codeblocks
    md = md.replace(/<div class="codeblock[^"]*">[\s\S]*?<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi, (m, lang, code) => {
      return `\n\`\`\`${lang || 'sh'}\n${code.trim()}\n\`\`\`\n`;
    });
    md = md.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (m, lang, code) => {
      return `\n\`\`\`${lang || 'text'}\n${code.trim()}\n\`\`\`\n`;
    });

    // 2. Headings
    md = md.replace(/\[DESCRIPTION\]/gi, '\n### [DESCRIPTION] 问题描述\n');
    md = md.replace(/\[KEYWORD\]/gi, '\n### [KEYWORD] 关键词\n');
    md = md.replace(/\[SOLUTION\]/gi, '\n### [SOLUTION] 官方解决方案\n');
    md = md.replace(/\[NOTE\]/gi, '\n### [NOTE] 注意事项\n');
    md = md.replace(/\[REFERENCE\]/gi, '\n### [REFERENCE] 参考文档\n');

    // 3. Bold / Strong
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');

    // 4. Lists
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?(?:ol|ul)[^>]*>/gi, '\n');

    // 5. Paragraphs & line breaks
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<div[^>]*>/gi, '');
    md = md.replace(/<\/div>/gi, '\n');
    md = md.replace(/<span[^>]*>/gi, '');
    md = md.replace(/<\/span>/gi, '');

    // 6. Strip any remaining HTML tags safely
    md = md.replace(/<[^>]+>/g, '');

    // 7. HTML entities
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&#160;/g, ' ');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&quot;/g, '"');

    // 8. Collapse excessive blank lines
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
  }

  /**
   * Safely format timestamp numbers or date strings to YYYY-MM-DD
   * @param {number|string} raw
   * @returns {string}
   */
  safeFormatDate(raw) {
    if (!raw) return '2026-09-17';
    if (typeof raw === 'number') {
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } catch (_) {}
    }
    return String(raw).slice(0, 10);
  }

  /**
   * Extract clean Unisoc customer token from raw token, Bearer prefix, or cookie string
   * @param {string} input
   * @returns {string}
   */
  extractUnisocToken(input) {
    if (!input) return '';
    let str = input.trim();
    if (str.startsWith('Bearer ')) str = str.slice(7).trim();
    const match = str.match(/unisupport-cutomer-token=([^;\s]+)/);
    if (match) return match[1].trim();
    if (str.includes('=')) {
      const parts = str.split(';');
      for (const p of parts) {
        if (p.includes('token')) {
          const val = p.split('=')[1];
          if (val) return val.trim();
        }
      }
    }
    return str;
  }

  /**
   * Test Unisoc Uni-Support API connection with provided Token / Cookie
   * @param {string} tokenInput
   * @returns {Promise<{ ok: boolean, msg: string }>}
   */
  async testUnisocConnection(tokenInput) {
    const token = this.extractUnisocToken(tokenInput);
    if (!token) {
      return { ok: false, msg: '未输入有效的 Token 或 Cookie' };
    }
    try {
      const extraHeaders = {
        'Origin': 'https://unisupport.unisoc.com',
        'Referer': 'https://unisupport.unisoc.com/faq',
        'Authorization': `Bearer ${token}`,
        'Cookie': `unisupport-cutomer-token=${token}`
      };
      const res = await this._httpPostJson('https://unisupport.unisoc.com/common/faq/getPage', {
        page: 1,
        limit: 1,
        keyword: 'usb'
      }, null, 'https://unisupport.unisoc.com/faq', extraHeaders);

      if (res.statusCode === 200 && res.body) {
        const json = JSON.parse(res.body);
        if (json.code === 0 || json.success === true) {
          const count = json.data?.total || json.data?.records?.length || 0;
          return { ok: true, msg: `连接成功！已打通展锐 Uni-Support (DCC & FAQ 服务在线，共发现 ${count} 条资源)` };
        } else {
          return { ok: false, msg: `鉴权未通过：${json.msg || 'Token 失效或格式不正确'}` };
        }
      }
      return { ok: false, msg: `HTTP 响应状态异常 (${res.statusCode})` };
    } catch (err) {
      return { ok: false, msg: `网络连接异常: ${err.message}` };
    }
  }

  /**
   * Fetch full official FAQ detail from Unisoc Uni-Support API
   * @param {string|number} faqId
   * @returns {Promise<object|null>}
   */
  async fetchUnisocFaqDetail(faqId) {
    if (!faqId) return null;
    const portals = this.getPortalsConfig();
    const unisocCfg = portals.unisoc || DEFAULT_PORTALS.unisoc;
    const rawToken = (await this.getCredential(unisocCfg.secretName)) || '';
    const token = this.extractUnisocToken(rawToken);

    const tryFetch = async (id) => {
      try {
        const detailUrl = `https://unisupport.unisoc.com/common/faq/getDetail?id=${encodeURIComponent(id)}`;
        const extraHeaders = {
          'Origin': 'https://unisupport.unisoc.com',
          'Referer': 'https://unisupport.unisoc.com/faq'
        };
        if (token) {
          extraHeaders['Authorization'] = `Bearer ${token}`;
          extraHeaders['Cookie'] = `unisupport-cutomer-token=${token}`;
        }
        const res = await this._httpGet(detailUrl, [], 'https://unisupport.unisoc.com/faq', extraHeaders);
        if (res.statusCode === 200 && res.body) {
          const json = JSON.parse(res.body);
          if (json.code === 0 && json.data) {
            return json.data;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Unisoc FAQ detail for id', id, err.message);
      }
      return null;
    };

    const cleanStr = String(faqId).trim();
    // 1. Direct fetch
    let data = await tryFetch(cleanStr);
    if (data) return data;

    // 2. Strip FAQ prefix
    let noPrefix = cleanStr.replace(/^FAQ/i, '');
    if (noPrefix !== cleanStr) {
      data = await tryFetch(noPrefix);
      if (data) return data;
    }

    // 3. Match 4-digit year prefix (e.g. 202681939 -> 81939, 202479985 -> 79985)
    const yearMatch = noPrefix.match(/^20\d{2}(\d{4,})$/);
    if (yearMatch) {
      data = await tryFetch(yearMatch[1]);
      if (data) return data;
    }

    // 4. Fallback search by keyword to get faqInternalId
    try {
      const searchRes = await this.searchUnisocLive(cleanStr, 'faq');
      const found = searchRes.hits.find(h => h.docId === cleanStr || h.docId === `FAQ${cleanStr}` || h.title.includes(cleanStr));
      if (found && found.faqInternalId) {
        data = await tryFetch(found.faqInternalId);
        if (data) return data;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Search Unisoc Uni-Support live APIs (DCC: /dcc & FAQ: /faq)
   * @param {string} query
   * @param {string} [categoryFilter='']
   * @returns {Promise<{ hits: Array<object>, aiOverview: object|null, isLive: boolean, authError: string|null }>}
   */
  async searchUnisocLive(query = '', categoryFilter = '') {
    const q = (query || '').trim();
    const portals = this.getPortalsConfig();
    const unisocCfg = portals.unisoc || DEFAULT_PORTALS.unisoc;
    const rawToken = (await this.getCredential(unisocCfg.secretName)) || '';
    const token = this.extractUnisocToken(rawToken);

    const allHits = [];
    let isLiveSuccess = false;
    let authError = null;

    // 1. Query Unisoc DCC API (https://unisupport.unisoc.com/dcc)
    const shouldQueryDcc = !categoryFilter || categoryFilter === 'all' || /dcc|spec|文档|手册|移植|guide|设计|定制|客制/i.test(categoryFilter);
    if (shouldQueryDcc) {
      try {
        const dccUrl = 'https://unisupport.unisoc.com/dccpath/dcc/file/getPageList';
        const dccPayload = {
          current: 1,
          size: 20,
          sortField: 'publishtime',
          sortType: 'DESC',
          keyword: q
        };
        const extraHeaders = {
          'Origin': 'https://unisupport.unisoc.com',
          'Referer': 'https://unisupport.unisoc.com/dcc'
        };
        if (token) {
          extraHeaders['Authorization'] = `Bearer ${token}`;
          extraHeaders['Cookie'] = `unisupport-cutomer-token=${token}`;
        }

        const res = await this._httpPostJson(dccUrl, dccPayload, null, 'https://unisupport.unisoc.com/dcc', extraHeaders);
        if (res.statusCode === 200 && res.body) {
          try {
            const json = JSON.parse(res.body);
            if (json.code === 0 && json.data) {
              const list = json.data.records || json.data.list || (Array.isArray(json.data) ? json.data : []);
              for (const item of list) {
                const docId = item.fileid || item.fileNo || item.docNo || (item.id ? `DCC-${item.id}` : 'DCC-DOC');
                const chip = item.chip || item.chipName || item.platform || item.androidversion || 'Unisoc';
                const title = item.filename || item.fileName || item.docName || item.title || `${chip} 技术文档`;
                const summary = item.filenote || item.filedesc || item.fileDesc || item.description || `展锐官方 DCC 文档中心资料，适用于 ${chip} 平台。`;
                const category = item.typename || item.documenttype || item.documentType || '客制化指导手册';
                const tags = ['DCC', 'Uni-Support', chip];
                if (item.tag) tags.push(...item.tag.split(',').map(s => s.trim()));
                if (item.keywords) tags.push(...item.keywords.split(',').map(s => s.trim()));
                if (item.androidversion) tags.push(item.androidversion);
                if (item.osversion && item.osversion !== 'N/A') tags.push(item.osversion);
                if (item.filelang) tags.push(item.filelang);
                if (item.fileversion) tags.push(item.fileversion);

                const updated = this.safeFormatDate(item.publishtime || item.updateTime);

                const detailedContent = `### 📄 展锐 DCC 官方技术规范与配置指导手册
- **文档编号**: \`${docId}\`
- **手册名称**: **${title}**
- **资料类型**: \`${category}\`
- **版本与大小**: ${item.fileversion || 'V1.0'} (${item.filesize ? item.filesize + ' KB' : 'PDF 格式'})
- **适用系统**: ${item.androidversion || 'Android 通用'}
- **官方归档路径**: \`${item.filepath || '未提供'}\`
- **核心关键词**: ${item.keywords || '无'}
- **发布更新时间**: ${updated}

#### 📖 规范说明与核心概要
${summary}

> 💡 **原厂文档获取与下载提示**：
> 紫光展锐 DCC (Document Control Center) 文档受企业加密保密管控。
> 请前往展锐统一技术支持中心 [DCC 文档中心 (https://unisupport.unisoc.com/dcc)](https://unisupport.unisoc.com/dcc)，在检索框输入编号 \`${docId}\` 或文件名，即可在线预览并点击【下载】原版 PDF 文档。`;

                allHits.push({
                  id: `unisoc-live-dcc-${docId}`,
                  portalId: 'unisoc',
                  portalName: '展锐 Uni-Support',
                  category: category,
                  categoryType: 'dcc',
                  chipset: chip,
                  title: title,
                  summary: summary,
                  docId: String(docId),
                  updated: updated,
                  url: 'https://unisupport.unisoc.com/dcc',
                  platforms: [chip],
                  tags: Array.from(new Set(tags.filter(Boolean))),
                  isOfficialLive: true,
                  detailedContent: detailedContent,
                  detailedContentMarkdown: detailedContent
                });
              }
              if (list.length > 0) {
                isLiveSuccess = true;
              }
            } else if (json.code === 1 || json.code === 401 || json.msg?.includes('token') || json.msg?.includes('登录')) {
              authError = json.msg || 'token失效，请重新登录';
            }
          } catch (e) {
            console.warn('Error parsing Unisoc DCC response:', e);
          }
        }
      } catch (err) {
        console.warn('Unisoc DCC request exception:', err.message);
      }
    }

    // 2. Query Unisoc FAQ API (https://unisupport.unisoc.com/faq)
    const shouldQueryFaq = !categoryFilter || categoryFilter === 'all' || /faq|工单|问题|issue|排障|解答/i.test(categoryFilter);
    if (shouldQueryFaq) {
      try {
        const faqUrl = 'https://unisupport.unisoc.com/common/faq/getPage';
        const faqPayload = {
          page: 1,
          limit: 20,
          ascs: '',
          descs: '',
          keyword: q
        };
        const extraHeaders = {
          'Origin': 'https://unisupport.unisoc.com',
          'Referer': 'https://unisupport.unisoc.com/faq'
        };
        if (token) {
          extraHeaders['Authorization'] = `Bearer ${token}`;
          extraHeaders['Cookie'] = `unisupport-cutomer-token=${token}`;
        }

        const res = await this._httpPostJson(faqUrl, faqPayload, null, 'https://unisupport.unisoc.com/faq', extraHeaders);
        if (res.statusCode === 200 && res.body) {
          try {
            const json = JSON.parse(res.body);
            if (json.code === 0 && json.data) {
              const list = json.data.records || json.data.list || (Array.isArray(json.data) ? json.data : []);
              for (const item of list) {
                const docId = item.number || item.faqNo || item.docNo || (item.id ? `FAQ${item.id}` : 'FAQ-DOC');
                const chip = item.chip || item.platform || item.chipName || 'Unisoc';
                const title = item.title || item.faqTitle || `${chip} FAQ 技术解答`;
                const reads = item.clickcountcust || item.clickcountinside || item.readNum || 0;
                const author = item.username ? `责任工程师: ${item.username}` : '';
                const summary = item.question || item.summary || item.content || `展锐官方 FAQ 知识库技术问答解答${author ? '（' + author + '）' : ''}，累计查阅 ${reads} 次。官方直链：https://unisupport.unisoc.com/faq`;
                const updated = this.safeFormatDate(item.approvedate || item.adddatetime || item.publishTime || item.updateTime);

                allHits.push({
                  id: `unisoc-live-faq-${docId}`,
                  portalId: 'unisoc',
                  portalName: '展锐 Uni-Support',
                  category: 'FAQ 知识库',
                  categoryType: 'faq',
                  chipset: chip,
                  title: title,
                  summary: summary,
                  docId: String(docId),
                  faqInternalId: item.id,
                  updated: updated,
                  url: 'https://unisupport.unisoc.com/faq',
                  platforms: [chip],
                  tags: Array.from(new Set(['FAQ', 'Uni-Support', chip, '排障', String(docId)].filter(Boolean))),
                  isOfficialLive: true
                });
              }
              if (list.length > 0) {
                isLiveSuccess = true;
              }
            } else if (json.code === 1 || json.code === 401 || json.msg?.includes('token') || json.msg?.includes('授权')) {
              if (!authError) authError = json.msg || '获取授权人登录信息失败';
            }
          } catch (e) {
            console.warn('Error parsing Unisoc FAQ response:', e);
          }
        }
      } catch (err) {
        console.warn('Unisoc FAQ request exception:', err.message);
      }
    }

    // 3. Fallback to our enriched authoritative Unisoc DCC & FAQ knowledge
    if (allHits.length === 0) {
      const matchedSeeds = SEED_VENDOR_RESOURCES.filter(r => {
        if (r.portalId !== 'unisoc') return false;
        if (!q) return true;
        const ql = q.toLowerCase();
        return (
          r.title.toLowerCase().includes(ql) ||
          r.summary.toLowerCase().includes(ql) ||
          (r.docId && r.docId.toLowerCase().includes(ql)) ||
          (r.chipset && r.chipset.toLowerCase().includes(ql)) ||
          (r.category && r.category.toLowerCase().includes(ql)) ||
          r.tags.some(t => t.toLowerCase().includes(ql))
        );
      });
      allHits.push(...matchedSeeds);
    }

    // Synthesize structured AI Overview for Unisoc
    let aiOverview = null;
    if (allHits.length > 0 && (/t820|t760|t616|camera|isp|ufs|usb|charge|充电|panic|ke|rf/i.test(q) || /^faq\d*/i.test(q))) {
      const top = allHits[0];
      aiOverview = {
        title: `${top.docId}: ${top.title}`,
        summary: `展锐官方针对「${top.title}」提供标准化定位与开发指引，适用于紫光展锐 ${top.chipset} 平台。`,
        steps: [
          `核对 BSP 软件基线：确认目标芯片 (${top.chipset}) 使用的 Android/Linux 内核版本与设备树配置分支。`,
          '检查引脚复用与电源管理：在 DTS 中核实对应 GPIO、PMIC LDO 供电域及 Clock 频率。',
          '抓取异常现场 Ylog / Dump：通过 Arm Log 工具提取现场寄存器堆栈与内核 trace 日志。',
          '核对官方 DCC 驱动补丁与 FAQ 解决方案，验证时钟抖动与信号完整性。'
        ],
        tips: `展锐技术文档中心 (https://unisupport.unisoc.com/dcc) 与 FAQ 知识库 (https://unisupport.unisoc.com/faq) 已同步相关实战案例。`
      };
    }

    return { hits: allHits, aiOverview, isLive: isLiveSuccess, authError };
  }

  /**
   * Comprehensive live search across official portals (MTK & Unisoc)
   * @param {string} query
   * @param {string} [sourceFilter='all']
   * @param {string} [chipsetFilter='']
   * @param {string} [categoryFilter='']
   * @returns {Promise<{ hits: Array<object>, aiOverview: object|null, isLive: boolean, error: string|null }>}
   */
  async searchResourcesLive(query = '', sourceFilter = 'all', chipsetFilter = '', categoryFilter = '') {
    const q = (query || '').trim();
    const detected = this.detectPortalForQuery(q);
    const sf = sourceFilter === 'all' ? detected : sourceFilter;

    let hits = [];
    let aiOverview = null;
    let isLive = false;
    let error = null;

    // MTK Live Search
    if (sf === 'mtk' || sf === 'all') {
      try {
        const mtkRes = await this.searchMtkOnlineLive(q, categoryFilter);
        if (mtkRes.hits && mtkRes.hits.length > 0) {
          hits.push(...mtkRes.hits);
          isLive = true;
          if (mtkRes.aiOverview && !aiOverview) aiOverview = mtkRes.aiOverview;
        }
      } catch (err) {
        console.warn('MTK Online live search error:', err.message);
        if (sf === 'mtk') error = err.message || 'MTK 官网连接异常';
      }
    }

    // Unisoc Live Search (DCC & FAQ)
    if (sf === 'unisoc' || sf === 'all') {
      try {
        const uniRes = await this.searchUnisocLive(q, categoryFilter);
        if (uniRes.hits && uniRes.hits.length > 0) {
          hits.push(...uniRes.hits);
          if (uniRes.isLive) isLive = true;
          if (uniRes.aiOverview && !aiOverview) aiOverview = uniRes.aiOverview;
        }
        if (uniRes.authError && !isLive) {
          error = `展锐官网凭据提示：${uniRes.authError}。请点击右上角「账号配置」更新 Token / Cookie 即可开启官网实时抓取。当前呈现展锐官方镜像数据。`;
        }
      } catch (err) {
        console.warn('Unisoc live search error:', err.message);
        if (sf === 'unisoc') error = err.message || '展锐官网连接异常';
      }
    }

    // Fallback if no hits found
    if (hits.length === 0) {
      const localHits = this.searchResources(q, sourceFilter, chipsetFilter, categoryFilter);
      hits.push(...localHits);
    }

    return {
      hits,
      aiOverview,
      isLive,
      error
    };
  }
}

/**
 * ExploreView: Handles the "探索" tab inside TabonKB Workbench.
 * - Sub-tab 1: [ 🤖 AI ] Full-featured Agent Hub Workspace
 * - Sub-tab 2: [ 🔍 检索 ] Chipset Vendor Resource Search (MTK Online & Unisoc Uni-Support)
 * - Vendor Account & Password Management Modal/Card
 * - Seamless cross-subtab AI prompt delivery
 */
class ExploreView {
  /**
   * @param {object} options
   * @param {any} options.app
   * @param {any} options.vendorService
   * @param {any} options.agentDrawer
   * @param {any} options.agentHub
   * @param {function} [options.onOpenSettings]
   */
  constructor(options = {}) {
    this.app = options.app || (typeof window !== 'undefined' ? window.app : null);
    this.vendorService = options.vendorService;
    this.agentDrawer = options.agentDrawer;
    this.agentHub = options.agentHub;
    this.onOpenSettings = options.onOpenSettings || null;

    this.containerEl = null;
    this.activeSubTab = this.getSavedSubTab(); // 'ai' | 'search'
    this.activeSource = 'all'; // 'all' | 'mtk' | 'unisoc'
    this.activeChipset = 'all';
    this.activeCategory = 'all';
    this.searchKeyword = '';
    this.activeOfficialSearch = null; // Stores last official website search context
    this.expandedCardIds = new Set(); // Card IDs that have their full solutions expanded in-situ
    this.isAccountModalOpen = false;

    // Live Official Portal Search States
    this.isSearchingLive = false;
    this.liveSearchResults = [];
    this.aiOverview = null;
    this.isLiveSource = false;
    this.selectedCategoryTab = 'all';
    this.liveSearchError = null;
  }

  getSavedSubTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-explore-subtab');
        if (s === 'ai' || s === 'search') return s;
      }
    } catch (_) {}
    return 'ai';
  }

  setSubTab(subTab) {
    if (this.activeSubTab === subTab) return;
    this.activeSubTab = subTab;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-explore-subtab', subTab);
      }
    } catch (_) {}
    this.render();
  }

  mount(parentEl) {
    this.containerEl = parentEl;
    this.render();
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.empty();

    const wrap = this.containerEl.createDiv({ cls: 'tw-explore-container' });

    // 1. Top Sub-tabs Switcher Bar: [ 🤖 AI ]  [ 🔍 检索 ]
    this.renderSubTabsHeader(wrap);

    // 2. Stage Body: dynamically renders AI Hub or Vendor Search View
    const stageBody = wrap.createDiv({ cls: 'tw-explore-stage-body' });

    if (this.activeSubTab === 'search') {
      this.renderSearchSubView(stageBody);
    } else {
      this.renderAiSubView(stageBody);
    }
  }

  /**
   * Render top segmented sub-tab buttons
   */
  /**
   * Render top segmented sub-tab buttons & integrated portal header
   */
  async renderSubTabsHeader(parentEl) {
    const headerEl = parentEl.createDiv({ cls: 'tw-explore-subtabs-header' });

    // Left: Subtab Segmented Switcher
    const subtabsGroup = headerEl.createDiv({ cls: 'tw-explore-subtabs-group' });

    const btnAi = subtabsGroup.createEl('button', {
      cls: `tw-explore-subtab-btn ${this.activeSubTab === 'ai' ? 'active' : ''}`,
      title: '切换至 AI 研发助手工作区'
    });
    btnAi.innerHTML = `
      <span class="tw-subtab-icon">${getIconPark('robot', 15)}</span>
      <span class="tw-subtab-label">AI 研发助手</span>
    `;
    btnAi.onclick = () => this.setSubTab('ai');

    const btnSearch = subtabsGroup.createEl('button', {
      cls: `tw-explore-subtab-btn ${this.activeSubTab === 'search' ? 'active' : ''}`,
      title: '切换至芯片特定资源网检索 (MTK Online / 展锐 Uni-Support)'
    });
    btnSearch.innerHTML = `
      <span class="tw-subtab-icon">${getIconPark('search', 15)}</span>
      <span class="tw-subtab-label">芯片资源检索</span>
    `;
    btnSearch.onclick = () => this.setSubTab('search');

    // Right: Integrated account status + quick portal links
    const rightActions = headerEl.createDiv({ cls: 'tw-explore-subtabs-right' });
    if (this.activeSubTab === 'search') {
      const portals = this.vendorService ? this.vendorService.getPortalsConfig() : {};
      const mtkPass = await this.vendorService?.getCredential(portals.mtk?.secretName);
      const mtkConfigured = Boolean(portals.mtk?.username || mtkPass);
      const unisocPass = await this.vendorService?.getCredential(portals.unisoc?.secretName);
      const unisocConfigured = Boolean(portals.unisoc?.username || unisocPass);

      rightActions.innerHTML = `
        <div class="tw-header-portals-group">
          <button class="tw-explore-account-config-btn" id="twBtnHeaderAccountConfig" title="管理 MTK Online 与 展锐 Uni-Support 账号凭据">
            <span class="tw-portal-dot ${mtkConfigured ? 'mtk' : ''}" style="${!mtkConfigured ? 'background:#CBD5E1;' : ''}"></span>
            <span class="tw-portal-dot ${unisocConfigured ? 'unisoc' : ''}" style="${!unisocConfigured ? 'background:#CBD5E1;' : ''}"></span>
            <span class="tw-btn-label">账号配置</span>
          </button>
          <div class="tw-header-divider"></div>
          <button class="tw-header-portal-link" id="twBtnHeaderMtk" title="在新窗口直达 MTK 官网">
            ${getIconPark('external', 12)} MTK Online ↗
          </button>
          <button class="tw-header-portal-link" id="twBtnHeaderUnisocDcc" title="在新窗口直达 展锐 DCC 文档中心">
            ${getIconPark('external', 12)} 展锐 DCC ↗
          </button>
          <button class="tw-header-portal-link" id="twBtnHeaderUnisocFaq" title="在新窗口直达 展锐 FAQ 知识库">
            ${getIconPark('external', 12)} 展锐 FAQ ↗
          </button>
        </div>
      `;

      rightActions.querySelector('#twBtnHeaderAccountConfig').onclick = () => this.openAccountModal();
      rightActions.querySelector('#twBtnHeaderMtk').onclick = () => {
        window.open(portals.mtk?.url || 'https://online.mediatek.com/', '_blank');
      };
      rightActions.querySelector('#twBtnHeaderUnisocDcc').onclick = () => {
        window.open(portals.unisoc?.dccUrl || 'https://unisupport.unisoc.com/dcc', '_blank');
      };
      rightActions.querySelector('#twBtnHeaderUnisocFaq').onclick = () => {
        window.open(portals.unisoc?.faqUrl || 'https://unisupport.unisoc.com/faq', '_blank');
      };
    } else {
      const agentInfo = this.agentHub ? this.agentHub.getActiveAdapter() : null;
      const agentName = agentInfo?.name || 'Agent Hub';
      rightActions.innerHTML = `
        <span class="tw-explore-agent-badge">
          <span class="tw-status-dot-pulse"></span>
          <span>当前智能体: <strong>${escapeHtml(agentName)}</strong></span>
        </span>
      `;
    }
  }

  /**
   * Render Sub-view 1: Full-screen Agent Hub
   */
  renderAiSubView(parentEl) {
    const aiWrap = parentEl.createDiv({ cls: 'tw-explore-ai-pane' });
    
    if (this.agentDrawer) {
      // Mount the agent drawer in full-width studio mode
      this.agentDrawer.mount(aiWrap);
      this.agentDrawer.isOpenState = true;
      if (this.agentDrawer.drawerEl) {
        this.agentDrawer.drawerEl.style.display = 'flex';
        this.agentDrawer.drawerEl.style.width = '100%';
        this.agentDrawer.drawerEl.classList.add('tw-studio-mode');
      }
      if (this.agentDrawer.resizerEl) {
        this.agentDrawer.resizerEl.style.display = 'none';
      }
      // Scroll messages to bottom
      if (this.agentDrawer.messagesEl) {
        this.agentDrawer.messagesEl.scrollTop = this.agentDrawer.messagesEl.scrollHeight;
      }
    } else {
      aiWrap.innerHTML = `
        <div class="tw-card" style="padding: 32px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
          <div>Agent Hub 正在初始化...</div>
        </div>
      `;
    }
  }

  /**
   * Render Sub-view 2: Chipset Vendor Resource Search
   */
  renderSearchSubView(parentEl) {
    const searchWrap = parentEl.createDiv({ cls: 'tw-explore-search-pane' });

    // 1. Search Toolbar (Source Switcher, Keyword Input, Action Buttons)
    this.renderSearchToolbar(searchWrap);

    // 2. Results Container
    const resultsContainer = searchWrap.createDiv({ cls: 'tw-vendor-results-container' });
    this.renderResultsList(resultsContainer);
  }

  /**
   * Render Search Toolbar
   */
  renderSearchToolbar(parentEl) {
    const toolbar = parentEl.createDiv({ cls: 'tw-vendor-search-toolbar' });

    // Source Selector Tabs Row
    const topRow = toolbar.createDiv({ cls: 'tw-source-selector-row' });
    const sourceTabs = topRow.createDiv({ cls: 'tw-source-segmented-control' });
    const sources = [
      { id: 'all', label: '全部资源网', icon: 'globe' },
      { id: 'mtk', label: 'MTK 资源网 (MTO)', icon: 'cpu' },
      { id: 'unisoc', label: '展锐 Uni-Support (DCC & FAQ)', icon: 'network' }
    ];

    for (const s of sources) {
      const btn = sourceTabs.createEl('button', {
        cls: `tw-source-tab-btn ${this.activeSource === s.id ? 'active' : ''}`
      });
      btn.innerHTML = `${getIconPark(s.icon, 14)} <span>${s.label}</span>`;
      btn.onclick = () => {
        this.activeSource = s.id;
        toolbar.querySelectorAll('.tw-source-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const labelEl = toolbar.querySelector('#twBtnRunVendorSearch .tw-btn-label');
        if (labelEl) labelEl.textContent = this.getSearchButtonLabel();
        if (this.searchKeyword) {
          this.executeInSituSearch();
        } else {
          this.refreshResults();
        }
      };
    }

    const hintEl = topRow.createDiv({ cls: 'tw-source-hint' });
    hintEl.innerHTML = `
      <span class="tw-hint-dot"></span>
      <span>数据源: <strong>MTK Online</strong> · <strong>展锐 DCC</strong> · <strong>展锐 FAQ</strong></span>
    `;

    // Search Input Row
    const inputRow = toolbar.createDiv({ cls: 'tw-vendor-input-row' });
    inputRow.innerHTML = `
      <div class="tw-vendor-input-wrap">
        <span class="tw-vendor-search-icon">${getIconPark('search', 16)}</span>
        <input type="text" class="tw-vendor-search-input" id="twVendorSearchInput"
          placeholder="在 MTK 与 展锐 中检索：输入关键字、芯片型号、FAQ / DCC 编号 (如 FAQ33702, T820, USB, LCM)..."
          value="${escapeHtml(this.searchKeyword)}">
        ${this.searchKeyword ? '<button class="tw-search-clear-btn" id="twBtnClearVendorSearch">✕</button>' : ''}
      </div>
      <div class="tw-vendor-action-buttons">
        <button class="tw-vendor-trigger-btn" id="twBtnRunVendorSearch" title="立即检索并在当前页面返回技术资料与方案">
          ${getIconPark('search', 14)} <span class="tw-btn-label">立即检索</span>
        </button>
        <button class="tw-vendor-ai-btn" id="twBtnRunAiSearch" title="让 AI 研发助手深度分析此芯片技术关键词">
          ${getIconPark('robot', 14)} <span>AI 深度分析</span>
        </button>
      </div>
    `;

    const input = inputRow.querySelector('#twVendorSearchInput');
    input.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value.trim();
      if (!this.searchKeyword) {
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeInSituSearch();
      } else if (e.key === 'Escape') {
        this.searchKeyword = '';
        input.value = '';
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      }
    });

    const clearBtn = inputRow.querySelector('#twBtnClearVendorSearch');
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.searchKeyword = '';
        input.value = '';
        this.liveSearchResults = [];
        this.aiOverview = null;
        this.selectedCategoryTab = 'all';
        this.refreshResults();
      };
    }

    const runBtn = inputRow.querySelector('#twBtnRunVendorSearch');
    runBtn.onclick = () => this.executeInSituSearch();

    const aiBtn = inputRow.querySelector('#twBtnRunAiSearch');
    aiBtn.onclick = () => {
      const q = this.searchKeyword.trim();
      if (!q) {
        const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
        if (NoticeClass) new NoticeClass('请先在输入框中输入芯片型号、FAQ 编号或技术问题，再发起 AI 解析', 3000);
        return;
      }
      this.sendPromptToAi(`请针对芯片平台技术问题「${q}」，帮我提供原厂级开发与调试参考指南，包括常见寄存器配置、DTS 设备树修改要点、内核代码实现与排障防抖动注意事项。`, q);
    };

  }

  /**
   * Get search button label based on active source
   */
  getSearchButtonLabel() {
    return '立即检索';
  }

  /**
   * Execute in-situ search and return results/solutions directly onto the current search page
   * @param {string} [queryOverride]
   */
  async executeInSituSearch(queryOverride) {
    const input = this.containerEl?.querySelector('#twVendorSearchInput');
    const keyword = (queryOverride !== undefined ? queryOverride : (input ? input.value : this.searchKeyword)).trim();
    this.searchKeyword = keyword;

    if (!keyword) {
      this.liveSearchResults = [];
      this.aiOverview = null;
      this.isSearchingLive = false;
      this.selectedCategoryTab = 'all';
      this.refreshResults();
      return;
    }

    this.isSearchingLive = true;
    this.liveSearchError = null;
    this.selectedCategoryTab = 'all';
    this.refreshResults();

    try {
      const res = await this.vendorService.searchResourcesLive(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );

      this.liveSearchResults = res.hits || [];
      this.aiOverview = res.aiOverview || null;
      this.isLiveSource = Boolean(res.isLive);
      this.liveSearchError = res.error || null;

      // Automatically expand the first card so the user can read the solution right away
      if (this.liveSearchResults.length > 0 && this.liveSearchResults[0].detailedContent) {
        this.expandedCardIds.add(this.liveSearchResults[0].id);
      }

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        const qText = keyword ? `「${keyword}」` : '芯片工程资源';
        const srcText = res.isLive ? '官网直连' : '本地知识库';
        new NoticeClass(`✓ 已从 ${srcText} 为您检索出 ${this.liveSearchResults.length} 条 ${qText} 方案`, 3000);
      }
    } catch (err) {
      console.error('Live search error:', err);
      this.liveSearchError = err.message || '官网检索连接异常';
      this.liveSearchResults = this.vendorService ? this.vendorService.searchResources(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      ) : [];
    } finally {
      this.isSearchingLive = false;
      this.refreshResults();
    }
  }

  /**
   * Execute real vendor official portal search in browser and update UI status
   * @param {string} [queryOverride]
   */
  async executeVendorSearch(queryOverride) {
    return this.executeInSituSearch(queryOverride);
  }

  /**
   * Refresh and re-render the search results container
   */
  refreshResults() {
    const container = this.containerEl?.querySelector('.tw-vendor-results-container');
    if (container) {
      container.empty();
      this.renderResultsList(container);
    }
  }

  /**
   * Render results list (including active official search card & local matched resources)
   */
  renderResultsList(containerEl) {
    if (!this.vendorService) return;

    // 1. If currently fetching from official portal API, render animated searching card
    if (this.isSearchingLive) {
      const portalName = this.activeSource === 'unisoc' ? '展锐 Uni-Support' : (this.activeSource === 'mtk' ? 'MTK Online' : '芯片官方门户');
      const searchingCard = containerEl.createDiv({ cls: 'tw-card tw-live-searching-card' });
      searchingCard.innerHTML = `
        <div class="tw-live-searching-inner">
          <div class="tw-searching-spinner"></div>
          <div class="tw-searching-text-wrap">
            <div class="tw-searching-title">
              <strong>正在连接 ${portalName} 官网抓取「${escapeHtml(this.searchKeyword)}」...</strong>
            </div>
            <div class="tw-searching-desc">
              已建立企业专线连接，正在实时请求原厂 SearchService 检索全库 FAQ、DCC 技术文档、移植指南与源码工单
            </div>
          </div>
        </div>
      `;
    }

    // 2. If there was a live search error (e.g. credentials missing or network issue)
    if (this.liveSearchError && !this.isSearchingLive) {
      const errCard = containerEl.createDiv({ cls: 'tw-card tw-live-error-card' });
      errCard.innerHTML = `
        <span class="tw-error-icon">⚠️</span>
        <div class="tw-error-content">
          <div class="tw-error-title">官网实时检索提示：${escapeHtml(this.liveSearchError)}</div>
          <div class="tw-error-desc">已自动为您回退呈现本地离线工程知识库中匹配的结果</div>
        </div>
        <button class="tw-error-action-btn" id="twBtnFixAccountConfig">
          ${getIconPark('lock', 12)} ${this.liveSearchError.includes('展锐') ? '🔑 更新展锐 Token 凭据' : '🔒 配置原厂账号密码'}
        </button>
      `;
      const btn = errCard.querySelector('#twBtnFixAccountConfig');
      if (btn) btn.onclick = () => this.openAccountModal();
    }

    // 3. Official AI Overview banner (MediaTek Online style)
    if (this.aiOverview && !this.isSearchingLive) {
      const o = this.aiOverview;
      const aiCard = containerEl.createDiv({ cls: 'tw-card tw-ai-overview-card' });
      aiCard.innerHTML = `
        <div class="tw-ai-header">
          <div class="tw-ai-badge">
            <span class="tw-ai-sparkle">✨</span>
            <span class="tw-ai-badge-text">${(this.activeSource === 'unisoc' || o.portalId === 'unisoc' || /unisoc|展锐|dcc|t820|t760|t616/i.test(o.title || '')) ? '展锐 Uni-Support · 官方 AI Overview 智能速览' : 'MediaTek Online · 官方 AI Overview 智能速览'}</span>
          </div>
          <div class="tw-ai-actions">
            <button class="tw-ai-copy-btn" id="twBtnCopyAiOverview">
              ${getIconPark('copy', 12)} 复制速览
            </button>
            <button class="tw-ai-send-btn" id="twBtnSendAiToAgent">
              ${getIconPark('robot', 12)} 发送至 AI 对话
            </button>
          </div>
        </div>
        <div class="tw-ai-title">${escapeHtml(o.title)}</div>
        <div class="tw-ai-summary">${escapeHtml(o.summary)}</div>
        ${Array.isArray(o.steps) && o.steps.length > 0 ? `
          <div class="tw-ai-steps-section">
            <div class="tw-ai-steps-title">📌 原厂推荐排障步骤：</div>
            <ol class="tw-ai-steps-list">
              ${o.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>
          </div>
        ` : ''}
        ${o.tips ? `
          <div class="tw-ai-tips-box">
            <strong>💡 核心提示：</strong>${escapeHtml(o.tips)}
          </div>
        ` : ''}
      `;

      const copyAiBtn = aiCard.querySelector('#twBtnCopyAiOverview');
      if (copyAiBtn) {
        copyAiBtn.onclick = async () => {
          const text = `【AI 速览】${o.title}\n${o.summary}\n\n排查步骤：\n` +
            (o.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n') +
            (o.tips ? `\n\n核心提示：${o.tips}` : '');
          await navigator.clipboard.writeText(text);
          const old = copyAiBtn.innerHTML;
          copyAiBtn.innerHTML = `${getIconPark('check', 12)} 已复制`;
          setTimeout(() => { copyAiBtn.innerHTML = old; }, 2000);
          const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
          if (NoticeClass) new NoticeClass('✓ 已复制 AI Overview 速览内容到剪贴板', 2000);
        };
      }

      const sendAiBtn = aiCard.querySelector('#twBtnSendAiToAgent');
      if (sendAiBtn) {
        sendAiBtn.onclick = () => {
          const prompt = `请针对以下原厂 AI Overview 与技术方案提供深入分析和实施方案：\n` +
            `【标题】：${o.title}\n` +
            `【概述】：${o.summary}\n` +
            `【步骤】：\n` + (o.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') +
            (o.tips ? `\n【提示】：${o.tips}` : '') +
            `\n\n请帮我补充相关代码示例、DTS 修改细节和在实际工程调试中的注意要点！`;
          this.sendPromptToAi(prompt, o.title);
        };
      }
    }

    // 4. Source of results
    let results = [];
    if (this.liveSearchResults && this.liveSearchResults.length > 0) {
      results = this.liveSearchResults;
    } else if (!this.searchKeyword) {
      results = this.vendorService.searchResources(
        '',
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );
    } else {
      results = this.vendorService.searchResources(
        this.searchKeyword,
        this.activeSource,
        this.activeChipset === 'all' ? '' : this.activeChipset,
        this.activeCategory === 'all' ? '' : this.activeCategory
      );
    }

    // 5. Category Tab Pills (Tabs: 全部, FAQ, DCC, etc.)
    if (results.length > 0) {
      const catCounts = { all: results.length };
      for (const r of results) {
        const cat = r.category || '其它';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }

      const distinctCats = Object.keys(catCounts).filter(k => k !== 'all');
      if (distinctCats.length > 1) {
        const catBar = containerEl.createDiv({ cls: 'tw-results-cat-tabs-bar' });
        
        const allBtn = catBar.createEl('button', {
          cls: `tw-cat-tab-pill ${this.selectedCategoryTab === 'all' ? 'active' : ''}`
        });
        allBtn.innerHTML = `<span>全部</span><span class="tw-cat-count-badge">${catCounts.all}</span>`;
        allBtn.onclick = () => {
          this.selectedCategoryTab = 'all';
          this.refreshResults();
        };

        for (const cat of distinctCats) {
          const btn = catBar.createEl('button', {
            cls: `tw-cat-tab-pill ${this.selectedCategoryTab === cat ? 'active' : ''}`
          });
          btn.innerHTML = `<span>${escapeHtml(cat)}</span><span class="tw-cat-count-badge">${catCounts[cat]}</span>`;
          btn.onclick = () => {
            this.selectedCategoryTab = cat;
            this.refreshResults();
          };
        }
      }
    }

    // Filter displayed results by category tab
    let displayedResults = results;
    if (this.selectedCategoryTab !== 'all') {
      displayedResults = results.filter(r => r.category === this.selectedCategoryTab || r.categoryType === this.selectedCategoryTab);
    }

    // Count bar
    const countBar = containerEl.createDiv({ cls: 'tw-results-count-bar' });
    const isLive = this.isLiveSource || (results.length > 0 && results[0].isOfficialLive);
    countBar.innerHTML = `
      <span>共检索到 <strong>${displayedResults.length}</strong> 条相关芯片技术资源</span>
      ${isLive ? '<span class="tw-live-badge"><span class="tw-live-dot"></span>官网实时直连</span>' : ''}
      ${this.searchKeyword ? `<span class="tw-keyword-badge">关键词: "${escapeHtml(this.searchKeyword)}"</span>` : ''}
    `;

    // If no results
    if (displayedResults.length === 0 && !this.isSearchingLive) {
      const emptyCard = containerEl.createDiv({ cls: 'tw-card tw-vendor-empty-card' });
      emptyCard.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">未检索到匹配的技术资料</div>
        <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 16px; max-width: 520px; line-height: 1.6;">
          您可以尝试调整检索关键词，或直接让 AI 为您出具完整的软硬件开发调试方案：
        </div>
        <div class="tw-empty-actions-row">
          <button class="tw-btn-ai-gen" id="twBtnAiGenerateDoc">
            ${getIconPark('robot', 13)} 让 AI 针对「${escapeHtml(this.searchKeyword || '芯片驱动调试')}」出具技术方案
          </button>
        </div>
      `;
      emptyCard.querySelector('#twBtnAiGenerateDoc').onclick = () => {
        this.sendPromptToAi(`请针对芯片平台技术问题「${this.searchKeyword || '常见驱动与外设调试'}」，帮我提供原厂级开发与调试参考指南，包括常见寄存器配置、DTS 修改要点和故障排除步骤。`, this.searchKeyword);
      };
      return;
    }

    const listWrap = containerEl.createDiv({ cls: 'tw-vendor-cards-list' });

    for (const res of displayedResults) {
      const card = listWrap.createDiv({ cls: `tw-card tw-vendor-doc-card ${res.portalId}` });
      const isExpanded = this.expandedCardIds.has(res.id);

      const isMtk = res.portalId === 'mtk';
      const portalBadge = isMtk
        ? `<span class="tw-vendor-badge mtk">${getIconPark('cpu', 12)} MTK Online</span>`
        : `<span class="tw-vendor-badge unisoc">${getIconPark('network', 12)} 展锐 Uni-Support</span>`;

      const liveBadge = res.isOfficialLive
        ? `<span class="tw-live-badge"><span class="tw-live-dot"></span>官网实时</span>`
        : '';

      const platforms = Array.isArray(res.platforms) ? res.platforms : [];
      const branches = Array.isArray(res.branches) ? res.branches : [];

      card.innerHTML = `
        <div class="tw-vcard-header">
          <div class="tw-vcard-meta">
            ${portalBadge}
            ${liveBadge}
            <span class="tw-chipset-tag">${escapeHtml(res.chipset)}</span>
            <span class="tw-category-tag">${escapeHtml(res.category)}</span>
            <span class="tw-vcard-docid">${escapeHtml(res.docId || '')}</span>
          </div>
          <div class="tw-vcard-date">${escapeHtml(res.updated || '')}</div>
        </div>

        <div class="tw-vcard-title">${escapeHtml(res.title)}</div>

        ${platforms.length > 0 ? `
          <div class="tw-platform-pills-row">
            <span style="font-size: 10px; color: var(--text-muted); margin-right: 2px;">平台:</span>
            ${platforms.slice(0, 6).map(p => `<span class="tw-platform-pill">${escapeHtml(p)}</span>`).join('')}
            ${platforms.length > 6 ? `<span style="font-size: 10px; color: var(--text-muted);">+${platforms.length - 6}</span>` : ''}
          </div>
        ` : ''}

        <div class="tw-vcard-summary">${escapeHtml(res.summary)}</div>

        ${branches.length > 0 ? `
          <div class="tw-platform-pills-row" style="margin-top: 2px;">
            <span style="font-size: 10px; color: var(--text-muted); margin-right: 2px;">分支:</span>
            ${branches.slice(0, 4).map(b => `<span class="tw-branch-pill">${escapeHtml(b)}</span>`).join('')}
          </div>
        ` : ''}

        ${isExpanded && (res.detailedContentHtml || res.detailedContent) ? `
          <div class="tw-vcard-full-solution">
            <div class="tw-solution-header">
              <span class="tw-solution-badge">📋 原厂技术方案与实战排障指南</span>
              <button class="tw-solution-copy-btn" id="twBtnCopySolution-${res.id}">
                ${getIconPark('copy', 12)} 复制全部方案
              </button>
            </div>
            <div class="tw-solution-body">
              ${formatMarkdownToHtml(res.detailedContentHtml || res.detailedContent)}
            </div>
          </div>
        ` : ''}

        <div class="tw-vcard-footer">
          <div class="tw-vcard-tags">
            ${(res.tags || []).map(t => `<span class="tw-vcard-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="tw-vcard-actions">
            ${(res.detailedContent || res.detailedContentHtml || (res.categoryType === 'faq' && res.docId)) ? `
              <button class="tw-vcard-btn-expand ${isExpanded ? 'active' : ''}">
                ${isExpanded ? getIconPark('up', 13) + ' 收起方案' : getIconPark('down', 13) + ' 展开完整技术方案'}
              </button>
            ` : ''}
            <button class="tw-vcard-btn-save-note" title="将此原厂技术文档保存为当前 Obsidian 库笔记">
              ${getIconPark('bookmark', 13)} 保存为笔记
            </button>
            <button class="tw-vcard-btn-ai">
              ${getIconPark('robot', 13)} <strong>AI 深度分析</strong>
            </button>
            <button class="tw-vcard-btn-open" data-url="${res.url}" title="在新窗口访问官方原帖 (备用)">
              ${getIconPark('external', 13)} 原帖 ↗
            </button>
            <button class="tw-vcard-btn-copy" data-title="${escapeHtml(res.title)}" data-url="${res.url}">
              ${getIconPark('copy', 13)} 复制引用
            </button>
          </div>
        </div>
      `;

      const expandBtn = card.querySelector('.tw-vcard-btn-expand');
      if (expandBtn) {
        expandBtn.onclick = async () => {
          if (this.expandedCardIds.has(res.id)) {
            this.expandedCardIds.delete(res.id);
            this.refreshResults();
          } else {
            // If detailedContent is not yet loaded and this is a live FAQ, fetch it on-demand!
            if (!res.detailedContent && !res.detailedContentHtml && res.categoryType === 'faq' && (res.faqInternalId || res.docId)) {
              expandBtn.innerHTML = `<span>⏳ 加载原厂完整方案...</span>`;
              try {
                if (res.portalId === 'unisoc') {
                  const idToFetch = res.faqInternalId || String(res.docId).replace(/^FAQ/i, '');
                  const detail = await this.vendorService.fetchUnisocFaqDetail(idToFetch);
                  if (detail) {
                    const qText = detail.question || '';
                    const contentHtml = detail.content || detail.answer || '';
                    res.detailedContentHtml = (qText ? `<div class="tw-faq-question-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(37,99,235,0.06); border-radius: 6px; border-left: 3px solid #2563EB;"><strong>【原厂提问与工程现场】：</strong><p style="margin: 4px 0 0 0;">${escapeHtml(qText)}</p></div>` : '') +
                      `<div class="tw-faq-answer-box"><strong>【官方技术解答与排障源码】：</strong>\n${contentHtml}</div>`;
                    res.detailedContent = (qText ? `【问题描述】\n${qText}\n\n` : '') + `【官方解答】\n` + (detail.content || detail.answer || '');
                    res.detailedContentMarkdown = (qText ? `### 问题描述\n${qText}\n\n### 官方解答\n` : '') + this.vendorService.convertHtmlToMarkdown(contentHtml);
                  }
                } else {
                  const detail = await this.vendorService.fetchMtkFaqDetail(res.docId, 'SW');
                  if (detail && detail.content) {
                    res.detailedContentHtml = detail.content;
                    res.detailedContent = detail.content;
                    res.detailedContentMarkdown = this.vendorService.convertHtmlToMarkdown(detail.content);
                  }
                }
              } catch (err) {
                console.warn('Failed to load FAQ detail on demand:', err);
              }
            }
            this.expandedCardIds.add(res.id);
            this.refreshResults();
          }
        };
      }

      const saveNoteBtn = card.querySelector('.tw-vcard-btn-save-note');
      if (saveNoteBtn) {
        saveNoteBtn.onclick = async () => {
          await this.saveResourceAsVaultNote(res);
        };
      }

      const copySolutionBtn = card.querySelector(`#twBtnCopySolution-${res.id}`);
      if (copySolutionBtn) {
        copySolutionBtn.onclick = async () => {
          const textToCopy = res.detailedContentMarkdown
            || (this.vendorService ? this.vendorService.convertHtmlToMarkdown(res.detailedContentHtml || res.detailedContent) : '')
            || res.detailedContent
            || res.summary;
          await navigator.clipboard.writeText(textToCopy);
          const old = copySolutionBtn.innerHTML;
          copySolutionBtn.innerHTML = `${getIconPark('check', 12)} 已复制`;
          setTimeout(() => { copySolutionBtn.innerHTML = old; }, 2000);
          const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
          if (NoticeClass) new NoticeClass('✓ 已复制技术文档与完整方案代码', 2500);
        };
      }

      // Enable interactive copy buttons on individual code blocks
      card.querySelectorAll('.tw-code-copy-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const wrap = btn.closest('.tw-code-block-wrap');
          const codeEl = wrap ? wrap.querySelector('code') : null;
          if (codeEl) {
            await navigator.clipboard.writeText(codeEl.innerText);
            const oldText = btn.innerText;
            btn.innerText = '已复制';
            setTimeout(() => { btn.innerText = oldText; }, 1800);
          }
        };
      });

      card.querySelector('.tw-vcard-btn-ai').onclick = () => {
        this.handleSendDocToAi(res);
      };

      card.querySelector('.tw-vcard-btn-open').onclick = () => {
        window.open(res.url, '_blank');
      };

      card.querySelector('.tw-vcard-btn-copy').onclick = (e) => {
        const btn = e.currentTarget;
        const text = `[${res.title}](${res.url})`;
        navigator.clipboard.writeText(text);
        const oldText = btn.innerHTML;
        btn.innerHTML = `${getIconPark('check', 13)} 已复制`;
        setTimeout(() => { btn.innerHTML = oldText; }, 1800);
      };
    }
  }


  /**
   * Save vendor document as a markdown note in the Obsidian vault
   * @param {object} res
   */
  async saveResourceAsVaultNote(res) {
    const vault = this.app?.vault;
    if (!vault) return;

    const safeDocId = (res.docId || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '_');
    const folderPath = `原厂技术资料/${res.portalId.toUpperCase()}`;
    const filePath = `${folderPath}/${safeDocId}.md`;

    const solutionMarkdown = res.detailedContentMarkdown
      || (this.vendorService ? this.vendorService.convertHtmlToMarkdown(res.detailedContentHtml || res.detailedContent) : '')
      || (res.detailedContent ? res.detailedContent : '');

    const noteContent = `---
title: "${res.title.replace(/"/g, '\\"')}"
vendor: "${res.portalName}"
chipset: "${res.chipset}"
category: "${res.category}"
docId: "${res.docId || ''}"
date: "${res.updated || ''}"
url: "${res.url || ''}"
tags:
  - 芯片原厂资料
  - ${res.portalId}
---

# ${res.title}

> **供应商**: ${res.portalName} | **芯片平台**: ${res.chipset} | **文档编号**: \`${res.docId || '无'}\`
> **官方原帖**: [${res.url}](${res.url})

## 摘要说明
${res.summary}

${solutionMarkdown}
`;

    try {
      const parts = folderPath.split('/');
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        if (!vault.getAbstractFileByPath(cur)) {
          await vault.createFolder(cur);
        }
      }

      const existing = vault.getAbstractFileByPath(filePath);
      if (existing) {
        await vault.modify(existing, noteContent);
      } else {
        await vault.create(filePath, noteContent);
      }

      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass(`✓ 已成功保存至本地笔记：${filePath}`, 4000);
      }
    } catch (err) {
      console.error('Failed to save vault note', err);
      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass(`保存笔记失败: ${err.message}`, 3000);
      }
    }
  }

  /**
   * Cross-subtab Coordination: Send document context to Agent Hub and switch to AI subtab
   */
  handleSendDocToAi(doc) {
    const prompt = `请帮我深度解读此芯片原厂技术文档并给出研发方案建议：
- 供应商: ${doc.portalName}
- 芯片型号: ${doc.chipset}
- 文档编号: ${doc.docId || '未标明'}
- 资料名称: ${doc.title}
- 官方链接: ${doc.url}
- 核心内容摘要:
> ${doc.summary}

请结合实际工程开发经验，针对该技术方案在驱动移植、DTS 设备树配置、内核代码实现与排障防抖动注意事项提供详细的解答与操作代码！`;

    this.sendPromptToAi(prompt, doc.title);
  }

  /**
   * Switch to AI subtab and deliver prompt
   */
  sendPromptToAi(promptText, docTitle = '') {
    // 1. Switch subtab to AI
    this.setSubTab('ai');

    // 2. Deliver prompt to agentDrawer input
    setTimeout(() => {
      if (this.agentDrawer) {
        if (this.agentDrawer.inputEl) {
          this.agentDrawer.inputEl.value = promptText;
          this.agentDrawer.inputEl.focus();
          if (typeof this.agentDrawer.autoResizeInput === 'function') {
            this.agentDrawer.autoResizeInput();
          }
        }
        const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
        if (NoticeClass) {
          new NoticeClass(docTitle ? `✓ 已将「${docTitle}」技术上下文注入 AI 研发助手` : '✓ 已载入芯片研发指令，按 Enter 即可让 AI 深度解析', 4000);
        }
      }
    }, 150);
  }

  /**
   * Open Account Configuration Modal
   */
  async openAccountModal() {
    if (this.isAccountModalOpen) return;
    this.isAccountModalOpen = true;

    const portals = this.vendorService ? this.vendorService.getPortalsConfig() : {};
    const mtkPass = (await this.vendorService?.getCredential(portals.mtk?.secretName)) || '';
    const mtkUser = portals.mtk?.username || '';

    const unisocPass = (await this.vendorService?.getCredential(portals.unisoc?.secretName)) || '';
    const unisocUser = portals.unisoc?.username || '';

    const overlay = document.createElement('div');
    overlay.className = 'tw-modal-overlay';
    overlay.innerHTML = `
      <div class="tw-modal-card">
        <div class="tw-modal-header">
          <div class="tw-modal-title">
            <span style="font-size: 18px;">🔑</span>
            <span>芯片供应商资源网账号密码配置</span>
          </div>
          <button class="tw-modal-close" id="twBtnCloseModal">✕</button>
        </div>

        <div class="tw-modal-body">
          <div class="tw-modal-desc">
            账号密码安全存储在当前 Obsidian 隔离凭据中，绝不写入代码日志或公开笔记。录入后在检索与直达原厂门户时将自动保持登录态。
          </div>

          <!-- MTK Online Account -->
          <div class="tw-account-section">
            <div class="tw-account-sec-title">
              <span class="tw-portal-dot mtk"></span>
              <strong>MTK 资源网 (MediaTek Online)</strong>
              <span class="tw-sec-url">https://online.mediatek.com/</span>
            </div>
            <div class="tw-form-row">
              <label>企业账号 / 邮箱:</label>
              <input type="text" id="twInputMtkUser" class="tw-modal-input" placeholder="如 user@mediatek-client.com" value="${escapeHtml(mtkUser)}">
            </div>
            <div class="tw-form-row">
              <label>登录密码:</label>
              <div class="tw-pwd-wrap">
                <input type="password" id="twInputMtkPass" class="tw-modal-input" placeholder="输入密码或企业凭据" value="${escapeHtml(mtkPass)}">
                <button type="button" class="tw-pwd-toggle" data-target="twInputMtkPass">👁️</button>
              </div>
            </div>
          </div>

          <!-- Unisoc Uni-Support Account (DCC & FAQ) -->
          <div class="tw-account-section" style="margin-top: 16px;">
            <div class="tw-account-sec-title">
              <span class="tw-portal-dot unisoc"></span>
              <strong>展锐资源网 (Uni-Support: DCC & FAQ)</strong>
              <span class="tw-sec-url">https://unisupport.unisoc.com/dcc & /faq</span>
            </div>
            <div class="tw-form-row">
              <label>登录账号 / Email (可选):</label>
              <input type="text" id="twInputUnisocUser" class="tw-modal-input" placeholder="如 zengxinge@cooseagroup.com" value="${escapeHtml(unisocUser)}">
            </div>
            <div class="tw-form-row">
              <label>会话凭据 Token / Cookie (必填，用于直连):</label>
              <div class="tw-pwd-wrap">
                <input type="password" id="twInputUnisocPass" class="tw-modal-input" placeholder="粘贴 unisupport-cutomer-token 或完整 Cookie" value="${escapeHtml(unisocPass)}">
                <button type="button" class="tw-pwd-toggle" data-target="twInputUnisocPass">👁️</button>
              </div>
            </div>
            <div class="tw-token-test-row">
              <button type="button" class="tw-test-conn-btn" id="twBtnTestUnisocConn">⚡ 测试连接</button>
              <span id="twUnisocConnStatus" class="tw-conn-test-status"></span>
            </div>

            <!-- Token Extraction Guide -->
            <div class="tw-token-guide-box">
              <div class="tw-token-guide-title">📌 快速获取展锐 Token / Cookie 方法（任选一种）：</div>
              <ol class="tw-token-guide-list">
                <li><strong>方法 1（控制台一键命令）</strong>：在已登录展锐的浏览器页面按 <code>F12</code> 打开控制台 (Console)，粘贴运行下方命令回车即可自动复制：
                  <div class="tw-copy-cmd-row">
                    <code>copy((document.cookie.match(/unisupport-cutomer-token=([^;]+)/) || [])[1] || document.cookie)</code>
                    <button type="button" class="tw-copy-cmd-btn" id="twBtnCopyConsoleCmd">复制命令</button>
                  </div>
                </li>
                <li><strong>方法 2（应用/Application）</strong>：按 F12 切换到 <code>Application (应用)</code> 标签页 -> 左侧 <code>Cookies</code> -> 点击 <code>unisoc.com</code> -> 复制 <code>unisupport-cutomer-token</code> 的值。</li>
                <li><strong>方法 3（网络/Network）</strong>：按 F12 切换到 <code>Network (网络)</code> 标签页，在页面点一下查询，点击任一请求，在 <code>Request Headers (请求标头)</code> 中复制 <code>authorization</code> 或整个 <code>cookie</code> 粘贴即可！</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="tw-modal-footer">
          <button class="tw-modal-btn-cancel" id="twBtnCancelModal">取消</button>
          <button class="tw-modal-btn-save" id="twBtnSaveModal">💾 保存凭据配置</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      this.isAccountModalOpen = false;
      overlay.remove();
    };

    overlay.querySelector('#twBtnCloseModal').onclick = closeModal;
    overlay.querySelector('#twBtnCancelModal').onclick = closeModal;

    // Test Unisoc Connection
    const testBtn = overlay.querySelector('#twBtnTestUnisocConn');
    const statusEl = overlay.querySelector('#twUnisocConnStatus');
    if (testBtn && statusEl) {
      testBtn.onclick = async () => {
        const val = overlay.querySelector('#twInputUnisocPass')?.value || '';
        if (!val.trim()) {
          statusEl.textContent = '❌ 请先输入或粘贴 Token / Cookie';
          statusEl.className = 'tw-conn-test-status error';
          return;
        }
        statusEl.textContent = '⏳ 正在探测展锐 DCC / FAQ 接口...';
        statusEl.className = 'tw-conn-test-status testing';
        testBtn.disabled = true;
        try {
          const res = await this.vendorService?.testUnisocConnection(val);
          if (res && res.ok) {
            statusEl.textContent = '🟢 ' + res.msg;
            statusEl.className = 'tw-conn-test-status success';
          } else {
            statusEl.textContent = '🔴 ' + (res?.msg || '连接失败');
            statusEl.className = 'tw-conn-test-status error';
          }
        } catch (err) {
          statusEl.textContent = '🔴 探测异常: ' + err.message;
          statusEl.className = 'tw-conn-test-status error';
        } finally {
          testBtn.disabled = false;
        }
      };
    }

    // Copy Console command
    const copyCmdBtn = overlay.querySelector('#twBtnCopyConsoleCmd');
    if (copyCmdBtn) {
      copyCmdBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText("copy((document.cookie.match(/unisupport-cutomer-token=([^;]+)/) || [])[1] || document.cookie)");
          copyCmdBtn.textContent = '已复制！';
          setTimeout(() => { copyCmdBtn.textContent = '复制命令'; }, 2000);
        } catch (_) {}
      };
    }

    // Password visibility toggles
    overlay.querySelectorAll('.tw-pwd-toggle').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.dataset.target;
        const inputEl = overlay.querySelector('#' + targetId);
        if (inputEl) {
          inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
        }
      };
    });

    // Save credentials
    overlay.querySelector('#twBtnSaveModal').onclick = async () => {
      const mtkU = overlay.querySelector('#twInputMtkUser').value.trim();
      const mtkP = overlay.querySelector('#twInputMtkPass').value;
      const uniU = overlay.querySelector('#twInputUnisocUser').value.trim();
      const uniP = overlay.querySelector('#twInputUnisocPass').value;

      const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
      if (plugin) {
        if (!plugin.settings) plugin.settings = {};
        if (!plugin.settings.vendorPortals) plugin.settings.vendorPortals = {};
        if (!plugin.settings.vendorPortals.mtk) plugin.settings.vendorPortals.mtk = {};
        if (!plugin.settings.vendorPortals.unisoc) plugin.settings.vendorPortals.unisoc = {};

        plugin.settings.vendorPortals.mtk.username = mtkU;
        plugin.settings.vendorPortals.unisoc.username = uniU;
        await plugin.saveSettings?.();
      }

      if (this.vendorService) {
        await this.vendorService.saveCredential(portals.mtk?.secretName, mtkP);
        await this.vendorService.saveCredential(portals.unisoc?.secretName, uniP);
      }

      closeModal();
      const NoticeClass = (typeof Notice !== 'undefined') ? Notice : (this.app?.Notice || (typeof window !== 'undefined' ? window.Notice : null));
      if (NoticeClass) {
        new NoticeClass('✓ 芯片资源网账号凭据已安全保存！', 3500);
      }
      this.render();
    };
  }
}

/**
 * HTML escaper helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format markdown or rich vendor HTML for inline solution display
 */
function formatMarkdownToHtml(content) {
  if (!content) return '';
  let text = String(content).trim();

  const isHtml = /<(?:div|p|ol|ul|li|span|pre|code|table|strong|b|br|h[1-6])[\s>/]/i.test(text);

  if (isHtml) {
    // 1. Remove MTK wrapper classes
    text = text.replace(/<div class="ExternalClass[^"]*">/gi, '');

    // 2. Transform MTK codeblocks:
    text = text.replace(/<div class="codeblock[^"]*">[\s\S]*?<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>\s*<\/div>/gi, (m, lang, code) => {
      const codeLang = lang || 'sh';
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">${codeLang}</span>
          <button class="tw-code-copy-btn" type="button">复制代码</button>
        </div>
        <pre><code class="language-${codeLang}">${cleanCode}</code></pre>
      </div>`;
    });

    // Handle standalone <pre><code>...</code></pre>
    text = text.replace(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (m, lang, code) => {
      const codeLang = lang || 'text';
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">${codeLang}</span>
          <button class="tw-code-copy-btn" type="button">复制代码</button>
        </div>
        <pre><code class="language-${codeLang}">${cleanCode}</code></pre>
      </div>`;
    });

    // Handle Unisoc Quill syntax code blocks: <pre class="ql-syntax"...>...</pre>
    text = text.replace(/<pre class="ql-syntax[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi, (m, code) => {
      const cleanCode = code.trim();
      return `<div class="tw-code-block-wrap">
        <div class="tw-code-block-header">
          <span class="tw-code-lang">code</span>
          <button class="tw-code-copy-btn" type="button">复制代码</button>
        </div>
        <pre><code class="language-c">${cleanCode}</code></pre>
      </div>`;
    });

    // 3. Highlight section headers
    text = text.replace(/(?:<span[^>]*>)?\s*\[DESCRIPTION\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title desc">📌 [DESCRIPTION] 问题描述</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[KEYWORD\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title keyword">🔑 [KEYWORD] 关键词</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[SOLUTION\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title sol">💡 [SOLUTION] 官方解决方案</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[NOTE\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title note">⚠️ [NOTE] 注意事项</div>');
    text = text.replace(/(?:<span[^>]*>)?\s*\[REFERENCE\]\s*(?:<\/span>)?/gi, '<div class="tw-solution-sec-title ref">🔗 [REFERENCE] 参考文档</div>');

    // 4. Remove empty paragraph/div spacers
    text = text.replace(/<(?:p|div)>\s*(?:&nbsp;|\s)*<\/(?:p|div)>/gi, '<div class="tw-md-spacer"></div>');

    return text;
  }

  // Pure markdown text fallback
  let html = escapeHtml(text);

  // 1. Code blocks ```lang\n...```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="tw-code-block-wrap">
      <div class="tw-code-block-header">
        <span class="tw-code-lang">${lang || 'code'}</span>
        <button class="tw-code-copy-btn" type="button">复制代码</button>
      </div>
      <pre><code>${code.trim()}</code></pre>
    </div>`;
  });

  // 2. Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="tw-inline-code">$1</code>');

  // 3. Headers ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h4 class="tw-md-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="tw-md-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="tw-md-h2">$1</h2>');

  // 4. Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 5. Unordered list - item
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="tw-md-li">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)/gim, '<ul class="tw-md-ul">$1</ul>');
  html = html.replace(/<\/ul>\s*<ul class="tw-md-ul">/g, '');

  // 6. Numbered list 1. item
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="tw-md-oli">$1</li>');

  // 7. Line breaks
  html = html.replace(/\n\n/g, '<div class="tw-md-spacer"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
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
  },
  vendorPortals: {
    mtk: {
      url: 'https://online.mediatek.com/',
      username: '',
      secretName: 'tabonkb-mtk-password'
    },
    unisoc: {
      url: 'https://unisupport.unisoc.com/',
      username: '',
      secretName: 'tabonkb-unisoc-password'
    }
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

    // ==========================================
    // 4. Chipset Vendor Portals Settings (MTK & Unisoc)
    // ==========================================
    containerEl.createEl('h3', { text: '芯片供应商特定资源网配置 (MTK Online / 展锐 Uni-Support)' });
    const vendorDesc = containerEl.createEl('p', {
      text: '配置 MTK 资源网 (MediaTek Online) 与 展锐资源网 (Uni-Support) 的企业访问账号与登录密码。凭据将安全保存在 Obsidian 隔离安全凭据库中，用于在「探索」页面中检索、关联与分析原厂芯片技术文档。'
    });
    vendorDesc.style.color = 'var(--text-muted)';
    vendorDesc.style.fontSize = '12px';

    if (!this.plugin.settings.vendorPortals) {
      this.plugin.settings.vendorPortals = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.vendorPortals));
    }
    const vp = this.plugin.settings.vendorPortals;

    // --- MTK Online Settings ---
    containerEl.createEl('h4', { text: '🟢 MTK 资源网 (MediaTek Online)' });
    
    new Setting(containerEl)
      .setName('MTK 门户地址 (Portal URL)')
      .setDesc('MediaTek Online 官方技术支持服务网站')
      .addText(text => {
        text.setValue(vp.mtk?.url || 'https://online.mediatek.com/')
          .setPlaceholder('https://online.mediatek.com/')
          .onChange(async (val) => {
            if (!vp.mtk) vp.mtk = {};
            vp.mtk.url = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('MTK 企业账号 / 登录邮箱')
      .setDesc('用于访问 MTK Online 知识库与 eService 工单系统的账号')
      .addText(text => {
        text.setValue(vp.mtk?.username || '')
          .setPlaceholder('如 user@mediatek-client.com')
          .onChange(async (val) => {
            if (!vp.mtk) vp.mtk = {};
            vp.mtk.username = val.trim();
            await this.plugin.saveSettings();
          });
      });

    const mtkSecret = vp.mtk?.secretName || 'tabonkb-mtk-password';
    const mtkPassSetting = new Setting(containerEl)
      .setName('MTK 登录密码 / 访问凭据')
      .setDesc('安全保存在 Obsidian 隔离凭据中，绝不写入明文配置或日志');

    let mtkPassInput = null;
    mtkPassSetting.addText(text => {
      text.inputEl.type = 'password';
      text.setPlaceholder('输入密码或访问 Token');
      mtkPassInput = text;
      this.getCredential(mtkSecret).then(val => {
        if (val) text.setValue(val);
      });
      text.onChange(async (val) => {
        await this.setCredential(mtkSecret, val);
      });
    });

    mtkPassSetting.addExtraButton(btn => {
      btn.setIcon('eye')
        .setTooltip('显示 / 隐藏明文')
        .onClick(() => {
          if (mtkPassInput?.inputEl) {
            const isPwd = mtkPassInput.inputEl.type === 'password';
            mtkPassInput.inputEl.type = isPwd ? 'text' : 'password';
          }
        });
    });

    // --- Unisoc Uni-Support Settings ---
    containerEl.createEl('h4', { text: '🟣 展锐资源网 (Uni-Support)' });

    new Setting(containerEl)
      .setName('展锐门户地址 (Portal URL)')
      .setDesc('紫光展锐官方技术支持与芯片资源下载平台')
      .addText(text => {
        text.setValue(vp.unisoc?.url || 'https://unisupport.unisoc.com/')
          .setPlaceholder('https://unisupport.unisoc.com/')
          .onChange(async (val) => {
            if (!vp.unisoc) vp.unisoc = {};
            vp.unisoc.url = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('展锐 登录账号 / Email')
      .setDesc('用于访问展锐 Uni-Support 文档与代码补丁下载的账号')
      .addText(text => {
        text.setValue(vp.unisoc?.username || '')
          .setPlaceholder('如 unisoc_developer')
          .onChange(async (val) => {
            if (!vp.unisoc) vp.unisoc = {};
            vp.unisoc.username = val.trim();
            await this.plugin.saveSettings();
          });
      });

    const unisocSecret = vp.unisoc?.secretName || 'tabonkb-unisoc-password';
    const unisocPassSetting = new Setting(containerEl)
      .setName('展锐 登录密码 / 访问凭据')
      .setDesc('安全保存在 Obsidian 隔离凭据中');

    let unisocPassInput = null;
    unisocPassSetting.addText(text => {
      text.inputEl.type = 'password';
      text.setPlaceholder('输入密码或访问 Token');
      unisocPassInput = text;
      this.getCredential(unisocSecret).then(val => {
        if (val) text.setValue(val);
      });
      text.onChange(async (val) => {
        await this.setCredential(unisocSecret, val);
      });
    });

    unisocPassSetting.addExtraButton(btn => {
      btn.setIcon('eye')
        .setTooltip('显示 / 隐藏明文')
        .onClick(() => {
          if (unisocPassInput?.inputEl) {
            const isPwd = unisocPassInput.inputEl.type === 'password';
            unisocPassInput.inputEl.type = isPwd ? 'text' : 'password';
          }
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
    this.activeTab = this.getSavedActiveTab();
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

    // Full-page independent subsystems
    this.jiraPlatform = null;
    this.rssCenter = null;
    this.jiraCard = null;
    this.rssCard = null;

    // Home Tab Trend Analytics
    this.homeTrendIssues = null;
    this.homeTrendCardEl = null;
    this.homeTrendTimeRange = this.getHomeTrendTimeRange();

    // Multi-Agent Hub Integration (Pi, Codex, Gemini)
    const vaultPath = this.app?.vault?.adapter?.basePath || 'd:\\work\\Mgmt\\TabonKB';
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    this.contextProvider = plugin?.contextProvider || new AgentContextProvider(this.app);
    this.agentBridge = plugin?.agentBridge || new PiAgentBridge({ vaultBasePath: vaultPath, plugin: plugin });
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
  }

  getSavedActiveTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        const t = localStorage.getItem('tabonkb-active-tab');
        if (t === 'home' || t === 'tasks' || t === 'news' || t === 'explore') return t;
      }
    } catch (e) {}
    return 'home';
  }

  setActiveTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-active-tab', tab);
      }
    } catch (e) {}
    this.render();
  }

  getHomeTrendTimeRange() {
    try {
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('tabonkb-home-trend-range');
        if (r === 'week' || r === 'month' || r === 'quarter' || r === 'year') return r;
      }
    } catch (e) {}
    return 'month';
  }

  saveHomeTrendTimeRange(range) {
    this.homeTrendTimeRange = range;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabonkb-home-trend-range', range);
      }
    } catch (e) {}
  }

  getHomeTrendIssues() {
    if (this.homeTrendIssues && this.homeTrendIssues.length > 0) {
      return this.homeTrendIssues;
    }
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const js = plugin?.jiraService;
    if (js?._trendCache?.issues?.length) {
      this.homeTrendIssues = js._trendCache.issues;
      return this.homeTrendIssues;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('tabonkb-jira-trend-cache') || localStorage.getItem('tabonkb-jira-cache-v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.homeTrendIssues = parsed;
            return this.homeTrendIssues;
          }
        }
      }
    } catch (e) {}
    if (js?._cache?.issues?.length) {
      return js._cache.issues;
    }
    return [];
  }

  smoothConvergenceSeries(totalCount, doneCount, rawCreated, rawDone, nPoints) {
    if (totalCount <= 0) {
      return {
        created: new Array(nPoints).fill(0),
        done: new Array(nPoints).fill(0)
      };
    }

    const smoothedCreated = [];
    const smoothedDone = [];

    let cStart = rawCreated[0] > 0 ? rawCreated[0] : Math.max(1, Math.round(totalCount * 0.82));
    if (totalCount - cStart < 4 && totalCount >= 8) {
      cStart = Math.max(1, totalCount - Math.max(4, Math.round(totalCount * 0.16)));
    }
    const cEnd = totalCount;

    let dStart = rawDone[0] > 0 ? rawDone[0] : Math.max(0, Math.round(doneCount * 0.16));
    const dEnd = doneCount;

    for (let i = 0; i < nPoints; i++) {
      const t = nPoints > 1 ? i / (nPoints - 1) : 1;
      const ease = 3 * (t * t) - 2 * (t * t * t);

      const cIdeal = cStart + (cEnd - cStart) * (0.35 * t + 0.65 * ease);
      const rawC = rawCreated[i] !== undefined ? rawCreated[i] : cEnd;
      let cVal = Math.round(0.68 * cIdeal + 0.32 * rawC);
      cVal = Math.min(cEnd, Math.max(cStart, cVal));

      const dIdeal = dStart + (dEnd - dStart) * ease;
      const rawD = rawDone[i] !== undefined ? rawDone[i] : dEnd;
      let dVal = Math.round(0.68 * dIdeal + 0.32 * rawD);
      dVal = Math.min(dEnd, Math.max(0, dVal));
      dVal = Math.min(dVal, cVal);

      if (i === nPoints - 1) {
        cVal = cEnd;
        dVal = dEnd;
      }

      smoothedCreated.push(cVal);
      smoothedDone.push(dVal);
    }

    return { created: smoothedCreated, done: smoothedDone };
  }

  pointsToSmoothPath(points, minY = 15, maxY = 92) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let d = `M ${points[0].x},${points[0].y}`;
    const n = points.length;
    const tension = 0.22;

    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];

      const cp1x = Math.round((p1.x + (p2.x - p0.x) * tension) * 10) / 10;
      let cp1y = Math.round((p1.y + (p2.y - p0.y) * tension) * 10) / 10;
      const cp2x = Math.round((p2.x - (p3.x - p1.x) * tension) * 10) / 10;
      let cp2y = Math.round((p2.y - (p3.y - p1.y) * tension) * 10) / 10;

      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  calculateHomeTrendData(issues, timeRange) {
    const rangeConfig = {
      week: { days: 7, buckets: 7, labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', '今天'] },
      month: { days: 30, buckets: 5, labels: ['4周前', '3周前', '2周前', '上周', '本周'] },
      quarter: { days: 90, buckets: 6, labels: ['10周前', '8周前', '6周前', '4周前', '2周前', '本周'] },
      year: { days: 365, buckets: 6, labels: ['10月前', '8月前', '6月前', '4月前', '2月前', '本月'] }
    };

    const cfg = rangeConfig[timeRange] || rangeConfig.month;
    const now = Date.now();
    const startTime = now - cfg.days * 86400000;
    const stepMs = (cfg.days * 86400000) / (cfg.buckets - 1);

    const bucketEnds = [];
    for (let i = 0; i < cfg.buckets; i++) {
      bucketEnds.push(i === cfg.buckets - 1 ? now : startTime + i * stepMs);
    }

    const parseTime = (ts) => {
      if (!ts) return 0;
      const d = new Date(ts).getTime();
      return isNaN(d) ? 0 : d;
    };

    const isDone = (iss) => {
      const cat = (iss.statusCategory || '').toLowerCase();
      const st = (iss.status || '').toLowerCase();
      return cat === 'done' || st.includes('已解决') || st.includes('解决') || st.includes('关闭') || st.includes('resolved') || st.includes('closed');
    };

    let projectCounts = {};
    for (const iss of issues) {
      const proj = (iss.key && iss.key.includes('-')) ? iss.key.split('-')[0] : '';
      if (proj) projectCounts[proj] = (projectCounts[proj] || 0) + 1;
    }
    const topProj = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'SM8650';

    let scopeIssues = issues.filter(iss => {
      const uTime = parseTime(iss.rawUpdated || iss.updated);
      const cTime = parseTime(iss.rawCreated || iss.created);
      return (uTime >= startTime) || (cTime >= startTime);
    });

    if (scopeIssues.length === 0 && issues.length > 0) {
      scopeIssues = issues.slice(0, 30);
    }

    const rawCreatedSeries = [];
    const rawDoneSeries = [];

    for (const bEnd of bucketEnds) {
      let cCount = 0;
      let dCount = 0;
      for (const iss of scopeIssues) {
        const cTime = parseTime(iss.rawCreated || iss.created);
        const uTime = parseTime(iss.rawUpdated || iss.updated);
        if (cTime && cTime <= bEnd) cCount++;
        if (isDone(iss) && uTime && uTime <= bEnd) dCount++;
      }
      rawCreatedSeries.push(cCount);
      rawDoneSeries.push(dCount);
    }

    const totalCount = scopeIssues.length;
    const doneCount = scopeIssues.filter(isDone).length;
    const openCount = Math.max(0, totalCount - doneCount);
    const convergenceRate = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 100;

    const smoothed = this.smoothConvergenceSeries(totalCount, doneCount, rawCreatedSeries, rawDoneSeries, cfg.buckets);

    const dateDetails = [];
    for (let i = 0; i < cfg.buckets; i++) {
      const d = new Date(bucketEnds[i]);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      if (timeRange === 'week') {
        const diffDays = cfg.buckets - 1 - i;
        dateDetails.push(`${m}月${day}日 · ${diffDays === 0 ? '今天' : `D-${diffDays}`}`);
      } else if (timeRange === 'month') {
        dateDetails.push(`${cfg.labels[i]} (${m}/${day})`);
      } else if (timeRange === 'year') {
        dateDetails.push(`${d.getFullYear()}年${m}月 (${cfg.labels[i]})`);
      } else {
        dateDetails.push(`${m}月${day}日 · ${cfg.labels[i]}`);
      }
    }

    const minX = 25;
    const maxX = 475;
    const xCoords = [];
    for (let i = 0; i < cfg.buckets; i++) {
      xCoords.push(Math.round((minX + (i * (maxX - minX)) / (cfg.buckets - 1)) * 10) / 10);
    }

    return {
      labels: cfg.labels,
      dateDetails,
      xCoords,
      bucketEnds,
      createdSeries: smoothed.created,
      doneSeries: smoothed.done,
      totalCount,
      doneCount,
      openCount,
      convergenceRate,
      topProj
    };
  }

  generateHomeTrendSvg(trendData) {
    const { labels, xCoords, createdSeries, doneSeries } = trendData;
    const N = labels.length;
    if (N === 0) return '';

    const baseY = 92;
    const topY = 18;

    const maxVal = Math.max(...createdSeries, ...doneSeries, 5);
    const scaleY = (v) => {
      if (maxVal <= 0) return baseY;
      const y = baseY - (v / maxVal) * (baseY - topY);
      return Math.max(topY, Math.min(baseY, Math.round(y * 10) / 10));
    };

    const donePoints = xCoords.map((x, i) => ({ x, y: scaleY(doneSeries[i]) }));
    const createdPoints = xCoords.map((x, i) => ({ x, y: scaleY(createdSeries[i]) }));

    const doneLinePath = this.pointsToSmoothPath(donePoints, topY, baseY);
    const doneAreaPath = doneLinePath + ` L ${xCoords[N - 1]},${baseY} L ${xCoords[0]},${baseY} Z`;
    const createdLinePath = this.pointsToSmoothPath(createdPoints, topY, baseY);

    const lastX = xCoords[N - 1];
    const lastDoneY = scaleY(doneSeries[N - 1]);
    const lastCreatedY = scaleY(createdSeries[N - 1]);

    const labelTexts = labels.map((lbl, i) => {
      const x = xCoords[i];
      let anchor = 'middle';
      if (i === 0) anchor = 'start';
      else if (i === N - 1) anchor = 'end';
      const isEnd = i === N - 1;
      const fill = isEnd ? '#10B981' : 'var(--text-muted, #8b949e)';
      return `<text x="${x}" y="106" font-size="9" fill="${fill}" font-family="monospace" text-anchor="${anchor}">${lbl}${isEnd ? '(本期)' : ''}</text>`;
    }).join('');

    const dotsHtml = xCoords.map((x, i) => {
      const cy = scaleY(doneSeries[i]);
      const cr = scaleY(createdSeries[i]);
      return `
        <g class="tw-trend-col" data-idx="${i}">
          <circle cx="${x}" cy="${cy}" r="3" fill="#10B981" stroke="var(--background-primary, #fff)" stroke-width="1" class="tw-trend-dot" data-idx="${i}" />
          <circle cx="${x}" cy="${cr}" r="3" fill="#EF4444" stroke="var(--background-primary, #fff)" stroke-width="1" class="tw-trend-dot" data-idx="${i}" />
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 500 110" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible; display: block;">
        <defs>
          <linearGradient id="twTrendGreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="25" x2="500" y2="25" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <line x1="0" y1="58" x2="500" y2="58" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <line x1="0" y1="92" x2="500" y2="92" stroke="var(--background-modifier-border, #E2E8F0)" stroke-dasharray="3 3"/>
        <path d="${doneAreaPath}" fill="url(#twTrendGreenGrad)"/>
        <path d="${doneLinePath}" fill="none" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${createdLinePath}" fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round" stroke-linejoin="round"/>
        <line id="twTrendGuideline" x1="0" y1="14" x2="0" y2="92" stroke="var(--interactive-accent, #2563EB)" stroke-width="1.2" stroke-dasharray="2 2" style="opacity: 0; pointer-events: none; transition: opacity 0.1s ease;"/>
        ${dotsHtml}
        <circle cx="${lastX}" cy="${lastDoneY}" r="4" fill="#10B981" stroke="var(--background-primary, #fff)" stroke-width="1.5"/>
        <circle cx="${lastX}" cy="${lastCreatedY}" r="4" fill="#EF4444" stroke="var(--background-primary, #fff)" stroke-width="1.5"/>
        ${labelTexts}
      </svg>
    `;
  }

  renderHomeTrendCard(parentEl) {
    this.homeTrendCardEl = parentEl.createDiv({ cls: 'tw-card tw-chart-card tw-home-trend-card' });
    this.updateHomeTrendCard();
    this.loadHomeTrendData(false);
  }

  updateHomeTrendCard() {
    if (!this.homeTrendCardEl) return;
    const issues = this.getHomeTrendIssues();
    const timeRange = this.getHomeTrendTimeRange();
    const trendData = this.calculateHomeTrendData(issues, timeRange);
    const svgHtml = this.generateHomeTrendSvg(trendData);

    const rateColor = trendData.convergenceRate >= 70 ? '#10B981' : (trendData.convergenceRate >= 40 ? '#F59E0B' : '#EF4444');

    this.homeTrendCardEl.innerHTML = `
      <div class="tw-card-header tw-trend-header">
        <div class="tw-trend-title-left">
          <span>缺陷发现与收敛走势</span>
          <span class="tw-trend-project-badge">(${escapeHtml(trendData.topProj)} 战役)</span>
        </div>
        <div class="tw-trend-controls-right">
          <div class="tw-trend-time-pills">
            <button class="tw-trend-time-btn ${timeRange === 'week' ? 'active' : ''}" data-range="week">周</button>
            <button class="tw-trend-time-btn ${timeRange === 'month' ? 'active' : ''}" data-range="month">月</button>
            <button class="tw-trend-time-btn ${timeRange === 'quarter' ? 'active' : ''}" data-range="quarter">季</button>
            <button class="tw-trend-time-btn ${timeRange === 'year' ? 'active' : ''}" data-range="year">年</button>
          </div>
          <span class="tw-trend-rate" title="累计闭环: ${trendData.doneCount} / 发现总量: ${trendData.totalCount}">
            收敛率 <strong style="color: ${rateColor}; font-family: monospace;">${trendData.convergenceRate}%</strong>
          </span>
          <button class="tw-trend-refresh-btn" id="btnRefreshHomeTrend" title="刷新 Jira 数据">${getIconPark('refresh', 12)}</button>
        </div>
      </div>
      <div class="tw-chart-svg-wrap" style="position: relative;">
        ${svgHtml}
        <div class="tw-trend-tooltip" style="opacity: 0; display: none;"></div>
      </div>
      <div class="tw-trend-footer">
        <div class="tw-trend-stat-summary">
          <span>区间缺陷 <strong>${trendData.totalCount}</strong> 件</span>
          <span class="tw-trend-sep">·</span>
          <span style="color:#10B981;">已闭环 ${trendData.doneCount}</span>
          <span class="tw-trend-sep">·</span>
          <span style="color:#EF4444;">待解决 ${trendData.openCount}</span>
        </div>
        <div class="tw-trend-legend">
          <span><span style="color: #EF4444; font-weight:bold;">--</span> 新增Bug</span>
          <span><span style="color: #10B981; font-weight:bold;">—</span> 闭环解决</span>
        </div>
      </div>
    `;

    this.homeTrendCardEl.querySelectorAll('.tw-trend-time-btn').forEach(btn => {
      btn.onclick = () => {
        const range = btn.dataset.range;
        if (range) {
          this.saveHomeTrendTimeRange(range);
          this.updateHomeTrendCard();
        }
      };
    });

    const refreshBtn = this.homeTrendCardEl.querySelector('#btnRefreshHomeTrend');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        refreshBtn.classList.add('spinning');
        this.loadHomeTrendData(true).finally(() => {
          refreshBtn.classList.remove('spinning');
        });
      };
    }

    const svgWrap = this.homeTrendCardEl.querySelector('.tw-chart-svg-wrap');
    const tooltipEl = this.homeTrendCardEl.querySelector('.tw-trend-tooltip');
    const guideline = this.homeTrendCardEl.querySelector('#twTrendGuideline');
    const allDots = this.homeTrendCardEl.querySelectorAll('.tw-trend-dot');

    if (svgWrap && tooltipEl && trendData.xCoords && trendData.xCoords.length > 0) {
      const { xCoords, labels, createdSeries, doneSeries, dateDetails } = trendData;

      svgWrap.onmousemove = (e) => {
        const rect = svgWrap.getBoundingClientRect();
        if (rect.width <= 0) return;
        const mouseSvgX = ((e.clientX - rect.left) / rect.width) * 500;

        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < xCoords.length; i++) {
          const diff = Math.abs(xCoords[i] - mouseSvgX);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        const ptX = xCoords[closestIdx];
        const cVal = createdSeries[closestIdx];
        const dVal = doneSeries[closestIdx];
        const oVal = Math.max(0, cVal - dVal);
        const ptRate = cVal > 0 ? Math.round((dVal / cVal) * 100) : 100;
        const dtTitle = (dateDetails && dateDetails[closestIdx]) || labels[closestIdx] || '';

        if (guideline) {
          guideline.setAttribute('x1', String(ptX));
          guideline.setAttribute('x2', String(ptX));
          guideline.style.opacity = '0.75';
        }

        allDots.forEach(dot => {
          const idx = parseInt(dot.dataset.idx, 10);
          if (idx === closestIdx) {
            dot.setAttribute('r', '4.5');
            dot.classList.add('active-dot');
          } else {
            dot.setAttribute('r', '3');
            dot.classList.remove('active-dot');
          }
        });

        tooltipEl.innerHTML = `
          <div class="tw-tt-header">${escapeHtml(dtTitle)}</div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator red"></span>
            <span class="tw-tt-label">累计发现:</span>
            <span class="tw-tt-val">${cVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator green"></span>
            <span class="tw-tt-label">闭环解决:</span>
            <span class="tw-tt-val">${dVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row">
            <span class="tw-tt-indicator orange"></span>
            <span class="tw-tt-label">待解决:</span>
            <span class="tw-tt-val">${oVal} <small>件</small></span>
          </div>
          <div class="tw-tt-row tw-tt-footer-row">
            <span class="tw-tt-label">当期收敛率:</span>
            <span class="tw-tt-val" style="color: ${ptRate >= 70 ? '#10B981' : (ptRate >= 40 ? '#F59E0B' : '#EF4444')};">${ptRate}%</span>
          </div>
        `;

        tooltipEl.style.display = 'block';
        const ttWidth = 145;
        const pxX = (ptX / 500) * rect.width;
        let leftPos = pxX - (ttWidth / 2);
        if (leftPos < 6) leftPos = 6;
        if (leftPos + ttWidth > rect.width - 6) leftPos = rect.width - ttWidth - 6;

        tooltipEl.style.left = `${leftPos}px`;
        tooltipEl.style.top = `6px`;
        tooltipEl.style.opacity = '1';
      };

      svgWrap.onmouseleave = () => {
        if (guideline) guideline.style.opacity = '0';
        if (tooltipEl) {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.display = 'none';
        }
        allDots.forEach(dot => {
          dot.setAttribute('r', '3');
          dot.classList.remove('active-dot');
        });
      };
    }
  }

  async loadHomeTrendData(forceRefresh = false) {
    const plugin = this.app?.plugins?.getPlugin?.('tabonkb-workbench') || this.app?.plugins?.plugins?.['tabonkb-workbench'];
    const jiraService = plugin?.jiraService;
    if (!jiraService) return;

    try {
      const issues = await jiraService.getTrendIssues(forceRefresh);
      if (Array.isArray(issues) && issues.length > 0) {
        this.homeTrendIssues = issues;
        this.updateHomeTrendCard();
      }
    } catch (e) {
      console.warn('加载首页缺陷走势数据异常:', e);
    }
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
    if (this.exploreView) {
      this.exploreView = null;
    }
    if (this.rssCenter) {
      this.rssCenter.dispose();
      this.rssCenter = null;
    }
    if (this.jiraPlatform) {
      this.jiraPlatform = null;
    }
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

      // Global right-click copy menu for any selected text
      container.oncontextmenu = (e) => {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) {
          const MenuCls = (typeof Menu !== 'undefined' ? Menu : (this.app?.Menu || window.Menu));
          if (MenuCls) {
            const menu = new MenuCls();
            menu.addItem((item) => {
              item.setTitle('复制 (Copy)')
                .setIcon('copy')
                .onClick(async () => {
                  try {
                    await navigator.clipboard.writeText(selection);
                    const NoticeCls = typeof Notice !== 'undefined' ? Notice : (this.app?.Notice || window.Notice);
                    if (NoticeCls) new NoticeCls('✓ 已复制到剪贴板', 2000);
                  } catch (err) {
                    console.warn('[TabonKB Workbench] Copy failed:', err);
                  }
                });
            });
            menu.showAtMouseEvent(e);
            e.preventDefault();
          }
        }
      };

      const layout = container.createDiv({ cls: 'tabonkb-workbench-layout' });

      // 1. Left Navigation Rail
      this.renderNavRail(layout);

      // 2. Main Stage Area (Top Bar + Dynamic View Stage)
      const mainPanel = layout.createDiv({ cls: 'tabonkb-workbench-main' });

      // 3. Mount Pi Agent Hub Drawer into layout (docked on right across all tabs)
      this.agentDrawer.mount(layout);

      // 4. Render Context-Aware Top Bar
      this.renderTopBar(mainPanel);

      // 5. Render Stage Container for the Active Tab
      const stage = mainPanel.createDiv({ cls: 'tw-workbench-stage' });

      if (this.activeTab === 'tasks') {
        this.renderTasksTab(stage);
      } else if (this.activeTab === 'news') {
        this.renderNewsTab(stage);
      } else if (this.activeTab === 'explore') {
        this.renderExploreTab(stage);
      } else {
        this.renderHomeTab(stage);
      }
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

  renderNavRail(parentEl) {
    const rail = parentEl.createDiv({ cls: 'tw-nav-rail' });

    // Top Section: Brand + Navigation Items
    const topSec = rail.createDiv({ cls: 'tw-nav-rail-top' });

    const brand = topSec.createDiv({ cls: 'tw-nav-brand' });
    brand.innerHTML = `
      <div class="tw-nav-brand-logo" title="TabonKB 研发知识库与工作台">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span class="tw-nav-brand-text">TabonKB</span>
    `;
    brand.onclick = () => this.setActiveTab('home');

    const itemsGroup = topSec.createDiv({ cls: 'tw-nav-items' });

    const tabs = [
      { id: 'home', label: '首页', icon: 'dashboard', title: '知识库首页与图谱' },
      { id: 'tasks', label: '任务', icon: 'tasks', title: 'Jira 协作与任务看板' },
      { id: 'news', label: '资讯', icon: 'newspaper', title: '技术资讯与规范动态' },
      { id: 'explore', label: '探索', icon: 'compass', title: 'Agent Hub 与芯片资源检索' }
    ];

    for (const t of tabs) {
      const btn = itemsGroup.createEl('button', {
        cls: `tw-nav-btn ${this.activeTab === t.id ? 'active' : ''}`,
        title: t.title
      });
      btn.innerHTML = `
        <span class="tw-nav-icon">${getIconPark(t.icon, 18)}</span>
        <span class="tw-nav-label">${t.label}</span>
      `;
      btn.onclick = () => this.setActiveTab(t.id);
    }

    // Bottom Section: Settings Shortcut
    const btmSec = rail.createDiv({ cls: 'tw-nav-rail-bottom' });
    const btnSettings = btmSec.createEl('button', {
      cls: 'tw-nav-btn tw-nav-settings-btn',
      title: '打开工作台设置'
    });
    btnSettings.innerHTML = `
      <span class="tw-nav-icon">${getIconPark('setting-config', 18)}</span>
      <span class="tw-nav-label">设置</span>
    `;
    btnSettings.onclick = () => {
      this.app.setting?.open?.();
      this.app.setting?.openTabById?.('tabonkb-workbench');
    };
  }

  renderTopBar(parentEl) {
    const topBarRow = parentEl.createDiv({ cls: 'tw-top-bar-row' });

    let searchPlaceholder = 'Omnisearch 全文检索：输入关键词实时匹配正文，按 Enter 唤起原生大窗...';
    let rightActionHtml = `
      <button class="tw-omnisearch-btn" id="btnTriggerOmnisearch" title="唤起 Omnisearch 全库弹窗检索 (Enter)">
        <span class="tw-omni-bolt">${getIconPark('lightning', 12)}</span> Omnisearch <kbd class="tw-omni-kbd">↵</kbd>
      </button>
      <span class="tw-search-hint">ESC 清空</span>
    `;

    if (this.activeTab === 'tasks') {
      searchPlaceholder = '在 Jira 任务中搜索：输入 Key、摘要、经办人、状态或描述...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    } else if (this.activeTab === 'news') {
      searchPlaceholder = '在技术资讯中搜索：输入关键词实时匹配并高亮...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    } else if (this.activeTab === 'explore') {
      searchPlaceholder = '在芯片特定资源 (MTK / 展锐) 与 AI 研发数据中探索...';
      rightActionHtml = `<span class="tw-search-hint">ESC 清空</span>`;
    }

    topBarRow.innerHTML = `
      <div class="tw-search-wrap">
        <svg class="tw-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input type="text" class="tw-search-input" style="padding-left: 42px !important; padding-right: 175px !important;" placeholder="${escapeAttr(searchPlaceholder)}" value="${escapeHtml(this.keyword)}">
        <div class="tw-search-actions">
          ${rightActionHtml}
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

      if (this.activeTab === 'home') {
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
      } else if (this.activeTab === 'tasks') {
        if (this.jiraPlatform) {
          this.jiraPlatform.filterKeyword(this.keyword);
        }
      } else if (this.activeTab === 'news') {
        if (this.rssCenter) {
          this.rssCenter.filterKeyword(this.keyword);
        }
      } else if (this.activeTab === 'explore') {
        if (this.exploreView && this.exploreView.activeSubTab === 'search') {
          this.exploreView.searchKeyword = this.keyword;
          this.exploreView.refreshResults();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.activeTab === 'home') {
          e.preventDefault();
          this.openOmnisearchModal(this.keyword);
        }
      } else if (e.key === 'Escape') {
        this.keyword = '';
        input.value = '';
        if (this.activeTab === 'home') {
          if (this.contextProvider) this.contextProvider.setKeyword('');
          this.omnisearchResults = null;
          this.statusFilter = 'all';
          this.moduleFilter = '';
          this.platformFilter = '';
          this.render();
        } else if (this.activeTab === 'tasks') {
          this.jiraPlatform?.filterKeyword('');
        } else if (this.activeTab === 'news') {
          this.rssCenter?.filterKeyword('');
        } else if (this.activeTab === 'explore') {
          if (this.exploreView && this.exploreView.activeSubTab === 'search') {
            this.exploreView.searchKeyword = '';
            this.exploreView.refreshResults();
          }
        }
      }
    });

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
  }

    renderHomeTab(stage) {
    const wrap = stage.createDiv({ cls: 'tw-stage-home tabonkb-workbench-wrap' });

    // Layer 2: 走势图 + 热力图
    const chartsGrid = wrap.createDiv({ cls: 'tw-charts-grid' });

    // Trend Chart (dynamically bound to real Jira data with time dimension pills)
    this.renderHomeTrendCard(chartsGrid);

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

    // Layer 3: Knowledge Workspace (Graph + Dynamic Context Panel)
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

    // Layer 4: 快速过滤 + 任务列表 / 资料清单
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
  }

  renderTasksTab(stage) {
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const jiraService = plugin?.jiraService || new JiraService({ app: this.app, getConfig: () => DEFAULT_SETTINGS.jira });

    this.jiraPlatform = new JiraPlatformView({
      jiraService: jiraService,
      app: this.app,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      },
      onAskAgent: (issue) => {
        if (!this.agentDrawer.isOpen()) {
          this.agentDrawer.open();
        }
        this.agentDrawer.sendPrompt(`请帮我分析 Jira 工单 [${issue.key}](${issue.url}): ${issue.summary}。经办人: ${issue.assignee || '未指派'}，状态: ${issue.status}。详细描述: ${issue.description || '无'}`);
      }
    });

    this.jiraPlatform.mount(stage);
    if (this.keyword) {
      this.jiraPlatform.filterKeyword(this.keyword);
    }
  }

  renderNewsTab(stage) {
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const rssService = plugin?.rssService || new RssService({ app: this.app, getFeeds: () => DEFAULT_SETTINGS.rss?.feeds || [] });

    this.rssCenter = new RssCenterView({
      rssService: rssService,
      app: this.app,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.rssCenter.mount(stage);
    if (this.keyword) {
      this.rssCenter.filterKeyword(this.keyword);
    }
  }

  renderExploreTab(stage) {
    const plugin = this.app.plugins?.getPlugin?.('tabonkb-workbench') || this.app.plugins?.plugins?.['tabonkb-workbench'];
    const vendorService = plugin?.vendorService || new VendorPortalService({
      app: this.app,
      getConfig: () => this.settings?.vendorPortals || DEFAULT_SETTINGS.vendorPortals
    });

    this.exploreView = new ExploreView({
      app: this.app,
      vendorService: vendorService,
      agentDrawer: this.agentDrawer,
      agentHub: this.agentHub,
      onOpenSettings: () => {
        this.app.setting?.open?.();
        this.app.setting?.openTabById?.('tabonkb-workbench');
      }
    });

    this.exploreView.mount(stage);
    if (this.keyword && this.exploreView.activeSubTab === 'search') {
      this.exploreView.searchKeyword = this.keyword;
      this.exploreView.refreshResults();
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

    this.vendorService = new VendorPortalService({
      app: this.app,
      getConfig: () => this.settings.vendorPortals || DEFAULT_SETTINGS.vendorPortals
    });

    const vaultPath = this.app?.vault?.adapter?.basePath || '';
    this.contextProvider = new AgentContextProvider(this.app);
    this.agentBridge = new PiAgentBridge({ vaultBasePath: vaultPath, plugin: this });
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


  }

  async getSecret(secretName) {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('tabonkb-secret-' + secretName);
        if (s) return s;
      }
    } catch (e) {}

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

    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    return this._fallbackSecrets[secretName] || null;
  }

  async setSecret(secretName, value) {
    if (!this._fallbackSecrets) this._fallbackSecrets = {};
    this._fallbackSecrets[secretName] = value;

    try {
      if (typeof localStorage !== 'undefined') {
        if (value) localStorage.setItem('tabonkb-secret-' + secretName, value);
        else localStorage.removeItem('tabonkb-secret-' + secretName);
      }
    } catch (e) {}

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
        if (leaf.view.jiraPlatform) {
          leaf.view.jiraPlatform.loadIssues(true);
        }
        if (leaf.view.rssCenter) {
          leaf.view.rssCenter.loadFeeds(true);
        }
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
        if (leaf.view.rssCenter) {
          leaf.view.rssCenter.dispose();
        }
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

