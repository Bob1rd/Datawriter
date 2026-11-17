const DCF_I18N = (() => {
  /*TABLES*/
  const NAMES = { en: 'English', es: 'Español', zh_CN: '中文' };
  let lang = 'en';
  // Any Chinese variant maps to Simplified Chinese; any Spanish variant to Spanish; everything else to English.
  function pick(code) {
    const c = String(code || '').replace('-', '_');
    if (/^zh/i.test(c)) return 'zh_CN';
    if (/^es/i.test(c)) return 'es';
    return 'en';
  }
  function resolve(override) {
    if (override && TABLES[override]) return override;
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) return pick(chrome.i18n.getUILanguage());
    return pick(navigator.language);
  }
  // The stored override (dcfLang) wins over the browser's language. Returns the chosen code.
  async function init() {
    let saved;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try { saved = (await chrome.storage.local.get('dcfLang')).dcfLang; } catch { saved = undefined; }
    }
    lang = resolve(saved);
    return lang;
  }
  function fill(s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
  }
  function tIn(code, key, vars) {
    const table = TABLES[code] || TABLES.en;
    const s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : Object.prototype.hasOwnProperty.call(TABLES.en, key) ? TABLES.en[key] : key;
    return fill(s, vars);
  }
  const t = (key, vars) => tIn(lang, key, vars);
  // Fills [data-i18n] elements: text keys set textContent; keys with {slots} are rebuilt from the
  // children marked data-i18n-slot="name". data-i18n-placeholder, -title and -aria-label fill attributes.
  function applyI18n(root) {
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const s = t(el.dataset.i18n);
      if (/\{\w+\}/.test(s)) {
        const slots = {};
        for (const c of el.querySelectorAll('[data-i18n-slot]')) slots[c.dataset.i18nSlot] = c.outerHTML;
        el.innerHTML = s.replace(/\{(\w+)\}/g, (m, k) => (k in slots ? slots[k] : m));
      } else el.textContent = s;
    }
    const ATTRS = [['placeholder', 'i18n-placeholder', 'i18nPlaceholder'], ['title', 'i18n-title', 'i18nTitle'], ['aria-label', 'i18n-aria-label', 'i18nAriaLabel']];
    for (const [attr, data, prop] of ATTRS) for (const el of root.querySelectorAll('[data-' + data + ']')) el.setAttribute(attr, t(el.dataset[prop]));
    if (root === document) {
      document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : lang;
      const title = document.querySelector('title[data-i18n]');
      if (title) document.title = t(title.dataset.i18n);
    }
  }
  const locale = () => (lang === 'zh_CN' ? 'zh-CN' : lang === 'es' ? 'es' : 'en-US');
  return { init, t, tIn, applyI18n, pick, locale, NAMES, get lang() { return lang; }, set lang(v) { lang = TABLES[v] ? v : 'en'; }, get langs() { return Object.keys(TABLES); } };
})();
const t = DCF_I18N.t;