/* DSLogic T1 smoke: ToolsView multi-tool registry / switching / popover contract.
   Run: node docs/dslogic-t1.test.js
   Uses a minimal DOM stub — verifies destroy() on switch, persistence,
   external-button visibility, and popover placement (right-cascade -6px,
   direction by anchor half: upper->downward / lower->upward, always in-viewport). */

const path = require('path');
const PLUGIN = path.dirname(__dirname);

// ---------- minimal DOM stub ----------
const listeners = { doc: { add: 0, remove: 0 } };
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    style: {},
    cls: '',
    _listeners: {},
    className: '',
    set classList(cls) { this.className = cls; },
    get classList() {
      const self = this;
      const set = new Set((self.className || '').split(/\s+/).filter(Boolean));
      return {
        add: (...c) => { c.forEach(x => set.add(x)); self.className = [...set].join(' '); },
        remove: (...c) => { c.forEach(x => set.delete(x)); self.className = [...set].join(' '); },
        contains: (c) => set.has(c),
        toggle: (c) => { set.has(c) ? set.delete(c) : set.add(c); self.className = [...set].join(' '); }
      };
    },
    set class(v) { this.className = v; },
    get offsetWidth() { return 160; },
    innerHTML: '',
    title: '',
    setAttribute() {},
    appendChild(c) { this.children.push(c); c.parentEl = this; return c; },
    remove() { if (this.parentEl) this.parentEl.children = this.parentEl.children.filter(x => x !== this); },
    empty() { this.children = []; this.innerHTML = ''; },
    contains(t) {
      if (t === this) return true;
      return this.children.some(c => c.contains(t));
    },
    createDiv(o) { const d = makeEl('div'); if (o && o.cls) d.className = o.cls; this.appendChild(d); return d; },
    createEl(t2, o) { const d = makeEl(t2); if (o && o.cls) d.className = o.cls; if (o && o.title) d.title = o.title; this.appendChild(d); return d; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) { const l = this._listeners[ev] || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    dispatch(ev, arg) { (this._listeners[ev] || []).slice().forEach(f => f(arg || { target: this, stopPropagation() {} })); },
    getBoundingClientRect() { return this._rect || { left: 40, top: 100, right: 260, bottom: 132, width: 220, height: 32 }; },
    setRect(r) { this._rect = r; },
    onclick: null, onmouseenter: null,
    querySelector() { return null; }
  };
  return el;
}

const bodyEl = makeEl('body');
global.document = {
  createElement: (t) => makeEl(t),
  body: bodyEl,
  addEventListener: (ev, fn, cap) => { listeners.doc.add++; (global.document._l = global.document._l || {})[ev + cap] = fn; },
  removeEventListener: (ev, fn, cap) => { listeners.doc.remove++; },
  _l: {}
};
global.window = { innerWidth: 1280, innerHeight: 900 };
const _ls = {};
global.localStorage = {
  getItem: k => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; }
};
global.Notice = class { constructor(msg) { (global._notices = global._notices || []).push(msg); } };

// ---------- load module ----------
const { ToolsView } = require(path.join(PLUGIN, 'components', 'tools-view.js'));

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(detail).slice(0, 400)));
  if (!cond) fails++;
}

function makeSpyView(tag) {
  return class {
    constructor(app, el, opts) { this.el = el; this.opts = opts; this.mounted = 0; this.destroyed = 0; this.tag = tag; }
    mount() { this.mounted++; this.el._mountedTag = this.tag; }
    destroy() { this.destroyed++; }
  };
}

// ---------- tests ----------
const parent = makeEl('div');
const tv = new ToolsView({ app: null, plugin: null });

check('registry has charger+logic', tv.tools.length === 2 && tv.tools[0].id === 'battery-charger' && tv.tools[1].id === 'logic');
check('tool labels <=6 chars', tv.tools.every(t => t.name.length <= 6 && t.fullName.length <= 6), tv.tools.map(t => [t.name, t.fullName]));

// inject spy view classes (real ChargerToolView needs Obsidian DOM)
const ChargerSpy = makeSpyView('charger');
const LogicSpy = makeSpyView('logic');
tv.tools[0].viewClass = ChargerSpy;
tv.tools[1].viewClass = LogicSpy;

tv.mount(parent);
check('default tool = charger', tv.activeToolId === 'battery-charger');
check('charger mounted via viewClass', tv.activeView instanceof ChargerSpy && tv.activeView.mounted === 1);
check('external btn visible for charger', tv.btnExternal.style.display !== 'none');

// open switcher popover
tv.brandEl.dispatch('click');
const pop = tv.switchPopoverEl;
check('switcher popover opens', !!pop && bodyEl.children.includes(pop));
check('popover right-cascade -6px', pop && parseInt(pop.style.left) === 260 - 6, pop && pop.style.left);
// R4: 锚点 bottom=132 在 900px 上半屏 -> 向下展开 (top=132-4, bottom auto, top>=0 且 bottom<=innerHeight)
check('popover upper-half anchor opens downward', pop && parseInt(pop.style.top) === 132 - 4 && pop.style.bottom === 'auto',
      pop && { top: pop.style.top, bottom: pop.style.bottom });
check('popover items = tools', pop && pop.children.length === 2);
const labelsOk = pop && pop.children.every(c => c.innerHTML.includes('tw-tools-switch-name'));
check('popover items render labels', !!labelsOk);

// select logic -> switch + close + persist
const chgInst = tv.activeView;
pop.children[1].onclick();
check('select -> popover closed', tv.switchPopoverEl === null);
check('switch mounted logic', tv.activeView instanceof LogicSpy && tv.activeView.mounted === 1);
check('charger destroy() called on switch', chgInst.destroyed === 1, { destroyed: chgInst.destroyed });
check('persist activeToolId', _ls['tabonkb-tools-active'] === 'logic');
check('external btn hidden for logic', tv.btnExternal.style.display === 'none');

// switch back to charger, verify old logic view destroyed
const logicInst = tv.activeView;
tv.switchTool('battery-charger');
check('logic destroy() called on switch', logicInst.destroyed === 1);
check('charger remounted', tv.activeView instanceof ChargerSpy);

// reloadTool keeps same tool
tv.reloadTool();
check('reload remounts charger', tv.activeView instanceof ChargerSpy && tv.activeView.mounted === 1);

// persistence across instances: a fresh ToolsView restores localStorage choice
const tv2 = new ToolsView({ app: null, plugin: null });
tv2.tools[0].viewClass = ChargerSpy;
tv2.tools[1].viewClass = LogicSpy;
tv2.mount(makeEl('div'));
check('restored persisted tool after reopen', tv2.activeToolId === _ls['tabonkb-tools-active'],
      { ls: _ls['tabonkb-tools-active'], active: tv2.activeToolId });
tv2.dispose();

// flip-left when right edge overflows
tv.switchTool('logic');
tv.brandEl.setRect({ left: 1180, top: 100, right: 1260, bottom: 132, width: 80, height: 32 });
tv.openSwitcher();
const pop2 = tv.switchPopoverEl;
check('overflow flips left', pop2 && parseInt(pop2.style.left) === 1180 + 6 - 160, pop2 && pop2.style.left);
tv.closeSwitcher();

// R4: 锚点在下半屏 -> 向上生长且仍在视口内
tv.brandEl.setRect({ left: 40, top: 800, right: 260, bottom: 832, width: 220, height: 32 });
tv.openSwitcher();
const pop3 = tv.switchPopoverEl;
check('popover lower-half anchor opens upward', pop3 && pop3.style.top === 'auto' && parseInt(pop3.style.bottom) === 900 - 832,
      pop3 && pop3.style.bottom);
check('popover maxHeight bounded', pop3 && parseInt(pop3.style.maxHeight) <= 300);
tv.closeSwitcher();
tv.brandEl.setRect({ left: 40, top: 100, right: 260, bottom: 132, width: 220, height: 32 });

// dispose: active view destroyed + doc listeners removed
const logicInst2 = tv.activeView;
tv.dispose();
check('dispose destroys active view', logicInst2.destroyed === 1);
check('dispose removes doc listeners', listeners.doc.remove >= 2, listeners.doc);

console.log('\n' + fails + ' failure(s)');
process.exit(fails ? 1 : 0);
