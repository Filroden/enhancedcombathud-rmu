/**
 * RMUCore.js
 * Contains shared utilities, core Argon integration points, UI guards,
 * and the general reusable search logic used by multiple large panels.
 */

// -----------------------------------------------------------------------------
// I. Constants & Icon Definitions (MOVED HERE FROM index.js)
// -----------------------------------------------------------------------------

const MODULE_ID = "enhancedcombathud-rmu";

/** @type {(file: string) => string} Route helper for module icons. */
const MOD_ICON = (file) =>
  (foundry?.utils?.getRoute
    ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`)
    : `modules/${MODULE_ID}/icons/${file}`);

const ICONS = {
  // Main
  melee:   MOD_ICON("sword-brandish.svg"),
  ranged:  MOD_ICON("high-shot.svg"),
  natural: MOD_ICON("fist.svg"),
  shield:  MOD_ICON("vibrating-shield.svg"),
  skills:  MOD_ICON("skills.svg"),
  spells:  MOD_ICON("spell-book.svg"),
  combat:  MOD_ICON("skip-next-circle.svg"),
  rest:    MOD_ICON("rest.svg"),
  special: MOD_ICON("hazard-sign.svg"),
  endurance: MOD_ICON("mountain-climbing.svg"),
  concentration: MOD_ICON("meditation.svg"),
  star:    MOD_ICON("star.svg"),
  wand:    MOD_ICON("wand.svg"),
  scroll:  MOD_ICON("scroll-unfurled.svg"),
  bolt:    MOD_ICON("lightning-bolt.svg"),
  
  // Resistances
  panel: MOD_ICON("resistance-panel.svg"),
  Channeling: MOD_ICON("resistance-channeling.svg"),
  Essence:    MOD_ICON("resistance-essence.svg"),
  Mentalism:  MOD_ICON("resistance-mentalism.svg"),
  Physical:   MOD_ICON("resistance-physical.svg"),
  Fear:       MOD_ICON("resistance-fear.svg")
};

// -----------------------------------------------------------------------------
// II. Core Utilities (Reusable logic, API wrappers, Formatting)
// -----------------------------------------------------------------------------

/**
 * Debounce utility to prevent a function from firing too rapidly.
 * @param {function} func - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay = 150) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// ** CRITICAL FIX: formatBonus is a standalone function **
/**
 * Formats a number as a string with a leading plus sign for positive values.
 */
function formatBonus(n) {
  if (n === null || n === undefined) return n;
  const s = String(n).trim();
  if (s === '') return s; 
  const num = Number(s);
  if (isNaN(num)) return n;
  return num > 0 ? `+${num}` : String(num);
}

const RMUUtils = {
  /**
   * Formats tooltip detail values.
   */
  formatTooltipDetails(details) {
    const excludedLabels = ["Ranks", "Total ranks", "Culture ranks", "Fumble"];
    return details.map(detail => {
      if (excludedLabels.includes(detail.label)) {
        return detail;
      }
      // ** CRITICAL FIX: Calls standalone formatBonus() **
      return { ...detail, value: formatBonus(detail.value) };
    });
  },
  
  /**
   * Mounts a translucent overlay containing a number and label inside an action button.
   */
  applyValueOverlay(buttonEl, number = "", labelText = "Total") {
    if (!buttonEl) return;
    const host = buttonEl.querySelector(".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image") || buttonEl;
    host.classList.add("rmu-button-relative", "rmu-overflow-hidden");
    host.querySelector(".rmu-value-overlay")?.remove();

    const root = document.createElement("div");
    root.className = "rmu-value-overlay";
    const txt = document.createElement("div");
    txt.className = "rmu-value-overlay-text";

    if (labelText) {
      const t = document.createElement("div");
      t.className = "rmu-value-overlay-label";
      t.textContent = labelText;
      txt.appendChild(t);
    }

    if (number !== "" && number !== null && number !== undefined) {
      const n = document.createElement("div");
      n.className = "rmu-value-overlay-number";
      // ** CRITICAL FIX: Calls standalone formatBonus() **
      const formattedNumber = formatBonus(number);
      n.textContent = formattedNumber;
      txt.appendChild(n);
    }

    root.appendChild(txt);
    host.appendChild(root);
  },

  /**
   * Centralized utility to call an RMU system API function robustly.
   */
  async rmuTokenActionWrapper(token, apiFunctionName, ...args) {
    if (!token) {
      ui.notifications?.error?.("No active token for HUD.");
      return false;
    }
    const api = game.system?.api?.[apiFunctionName];
    if (typeof api !== "function") {
      console.warn(`[ECH-RMU] RMU API function not available: ${apiFunctionName}`);
      ui.notifications?.warn?.(`RMU API function not available: ${apiFunctionName}. Action simulated.`);
      return false;
    }

    try {
      if (!token.controlled && typeof token.control === "function") {
        await token.control({ releaseOthers: true });
      }
    } catch (_) { /* non-fatal if control fails */ }

    try {
      await api(token, ...args);
      return true;
    } catch (err) {
      console.error(`[ECH-RMU] ${apiFunctionName} error:`, err);
      ui.notifications?.error?.(`${apiFunctionName} failed: ${err?.message ?? err}`);
      return false;
    }
  }
};

// -----------------------------------------------------------------------------
// III. UI Guards (Interaction Protection)
// -----------------------------------------------------------------------------

const UIGuards = {
  attachPanelInputGuards(panel) {
    const arm = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(arm);

      const cap = { capture: true };
      const stopIfControl = (ev) => {
        const t = ev.target;
        if (t?.closest?.(".rmu-skill-search__fav, .rmu-skill-search__clear")) return;
        if (ev.type === "input") return;
        if (!t) return;

        if (t.closest("input, textarea, select, .rmu-skill-search, .rmu-skill-search__input, .rmu-skill-search__clear")) {
          if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") {
            ev.preventDefault();
          }
          ev.stopImmediatePropagation();
          ev.stopPropagation();
        }
      };
      ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focus", "focusin", "focusout", "blur", "keydown", "keyup"].forEach(type => el.addEventListener(type, stopIfControl, cap));
    };
    requestAnimationFrame(arm);
  },

  installGlobalHudInputGuard() {
    const cap = { capture: true, passive: false };
    const SEARCH_SELECTORS = ".rmu-skill-search, .rmu-skill-search__input, .rmu-skill-search__clear, .rmu-skill-search__count, .argon-interactive, .argon-no-close, [data-argon-interactive='true']";
    const isSearch = (t) => !!(t && t.closest?.(SEARCH_SELECTORS));
    const guard = (ev) => {
      const t = ev.target;
      if (t?.closest?.(".rmu-skill-search__clear, .rmu-skill-search__fav")) { return; }
      if (!t || !isSearch(t)) return;

      if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") {
        ev.preventDefault();
      }
      ev.stopImmediatePropagation();
      ev.stopPropagation();

      if (t.matches?.(".rmu-skill-search__input")) {
        setTimeout(() => t.focus?.(), 0);
      }
    };
    ["pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend", "contextmenu", "wheel", "focus", "focusin", "focusout", "blur"].forEach(type => {
      window.addEventListener(type, guard, cap);
      document.addEventListener(type, guard, cap);
    });
  },

  attachPanelInteractionGuards(panel) {
    const tryAttach = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(tryAttach);
      const stop = (e) => { e.stopPropagation(); };
      ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focusin", "focusout", "blur", "keydown", "keyup"].forEach(type => {
        el.addEventListener(type, stop, { capture: false });
      });
    };
    requestAnimationFrame(tryAttach);
  },
};


// -----------------------------------------------------------------------------
// III. General Search Feature (Reusable)
// -----------------------------------------------------------------------------

/**
 * Installs and manages a functional search bar at the top of a panel.
 */
function installListSearch(panel, tileSelector, headerSelector, countLabel) {
  // Use globally imported RMUData/RMUUtils
  const { RMUData, RMUUtils } = window;
  const getFavOnly = RMUData.getFavOnly;
  const setFavOnly = RMUData.setFavOnly;

  const makeBar = () => {
    const bar = document.createElement("div");
    bar.className = "rmu-skill-search argon-interactive argon-no-close";
    bar.setAttribute("data-argon-interactive", "true");
    bar.setAttribute("data-tooltip", "");
    bar.innerHTML = `
      <div class="rmu-skill-search__icon argon-interactive argon-no-close" data-argon-interactive="true"><i class="rmu-mdi rmu-mdi-magnify" aria-hidden="true"></i></div>
      <input type="text" class="rmu-skill-search__input argon-interactive argon-no-close" data-argon-interactive="true" placeholder="Search ${countLabel}s…">
      <button type="button" class="rmu-skill-search__fav argon-interactive argon-no-close" data-argon-interactive="true" aria-pressed="false" title="Only favorites"></button>
      <button type="button" class="rmu-skill-search__clear argon-interactive argon-no-close" data-argon-interactive="true" aria-label="Clear"></button>
      <div class="rmu-skill-search__count argon-interactive argon-no-close" data-argon-interactive="true"></div>
    `;
    return bar;
  };

  const waitAndMount = (tries = 0) => {
    const root = panel?.element;
    if (!root?.isConnected) {
      if (tries < 180) return requestAnimationFrame(() => waitAndMount(tries + 1));
      return;
    }

    if (root.querySelector(".rmu-skill-search")) return;
    const bar = makeBar();
    root.prepend(bar);

    const mo = new MutationObserver(() => {
      if (root.isConnected && !root.contains(bar)) {
        root.prepend(bar);
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    const input = bar.querySelector(".rmu-skill-search__input");
    const clear = bar.querySelector(".rmu-skill-search__clear");
    const count = bar.querySelector(".rmu-skill-search__count");
    const fav = bar.querySelector(".rmu-skill-search__fav");
    
    const applyFavUI = () => {
      const on = getFavOnly();
      fav.classList.toggle("active", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
    };
    fav.addEventListener("pointerdown", (ev) => {
      ev.stopImmediatePropagation(); ev.stopPropagation(); ev.preventDefault();
      setFavOnly(!getFavOnly());
      applyFavUI();
      input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }, { capture: true, passive: false });
    applyFavUI();

    const toggleClearVisibility = () => {
      clear.style.visibility = input.value ? "visible" : "hidden";
    };
    input.addEventListener("input", toggleClearVisibility);
    toggleClearVisibility();

    const PROTECTED_EVENTS = ["pointerdown", "pointercancel", "mousedown", "mouseup", "touchstart", "touchcancel", "focus", "focusin", "focusout", "blur"];
    const ultraGuard = (ev) => {
      const t = ev.target;
      if (t?.closest?.(".rmu-skill-search__fav, .rmu-skill-search__clear")) return;
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      if (["pointerdown", "mousedown", "touchstart"].includes(ev.type)) { ev.preventDefault(); }
    };
    PROTECTED_EVENTS.forEach(type => {
      bar.addEventListener(type, ultraGuard, { capture: true, passive: false });
      input.addEventListener(type, ultraGuard, { capture: true, passive: false });
      clear.addEventListener(type, ultraGuard, { capture: true, passive: false });
      count.addEventListener(type, ultraGuard, { capture: true, passive: false });
    });
    ["pointerdown", "mousedown", "touchstart"].forEach(type => {
      input.addEventListener(type, (ev) => {
        ev.stopImmediatePropagation(); ev.stopPropagation(); ev.preventDefault();
        requestAnimationFrame(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
      }, { capture: true, passive: false });
    });
    clear.addEventListener("click", (ev) => {
      ev.stopImmediatePropagation(); ev.stopPropagation(); ev.preventDefault();
      input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      toggleClearVisibility(); requestAnimationFrame(() => input.focus());
    }, { capture: true });

    // Filtering logic
    const getTiles = () => Array.from(root.querySelectorAll(tileSelector));
    const getHeaders = () => Array.from(root.querySelectorAll(headerSelector));
    const buildIndex = () => getTiles().map(el => ({
      el,
      text: (el.dataset.nameNorm || "").toLowerCase(),
      cat:  (el.dataset.catKey || "").toLowerCase(),
      fav:  el.dataset.favorite === "true"
    }));
    
    const filter = (qRaw) => {
      const q = String(qRaw || "").toLowerCase().trim();
      const tiles = getTiles();
      const headers = getHeaders();
      const isSpellSearch = tileSelector.includes("spell-tile");

      // When query is empty, use default accordion/visibility rules
      if (!q) {
        const favOnly = getFavOnly();
        
        if (isSpellSearch || !favOnly) {
            tiles.forEach(t => t.style.display = "none");
            headers.forEach(h => {
              h.style.display = "";
              h.classList.remove("open");
              h.classList.add("closed");
            });
            count.textContent = "";

            if (isSpellSearch) { RMUData.setOpenSpellState(null, null); } 
            else { RMUData.setOpenSkillsCategory(null); }
            
            if (favOnly && !isSpellSearch) {
                const index = buildIndex();
                let hits = index.filter(e => e.fav).length;
                count.textContent = hits ? `${hits} favorite ${countLabel}${hits === 1 ? "" : "s"}` : `0 favorite ${countLabel}s`;
            }
            
            return;
        }

        const index = buildIndex();
        let hits = 0;
        index.forEach(e => {
          const match = e.fav;
          e.el.style.display = match ? "" : "none";
          if (match) hits++;
        });
        count.textContent = hits ? `${hits} favorite ${countLabel}${hits === 1 ? "" : "s"}` : `0 favorite ${countLabel}s`;
        
        const visibleCats = new Set(
          getTiles().filter(t => t.style.display !== "none").map(t => t.dataset.catKey)
        );
        
        headers.forEach(h => {
          const key = h.dataset.catKey || "";
          const show = visibleCats.has(key);
          h.style.display = show ? "" : "none";
          h.classList.toggle("open", show);
          h.classList.toggle("closed", !show);
        });
        
        RMUData.setOpenSkillsCategory(null);
        return;
      }

      // Search in effect (query is not empty):
      const index = buildIndex();
      let hits = 0;
      index.forEach(e => {
        const favOnly = getFavOnly();
        const match = (e.text.includes(q) || e.cat.includes(q)) && (!favOnly || e.fav);
        e.el.style.display = match ? "" : "none";
        if (match) hits++;
      });

      count.textContent = `${hits} ${countLabel}${hits === 1 ? "" : "s"} match${hits === 1 ? "" : "es"}`;
      
      const visibleCats = new Set(
        getTiles().filter(t => t.style.display !== "none").map(t => t.dataset.catKey)
      );

      headers.forEach(h => {
        const key = h.dataset.catKey || "";
        const show = visibleCats.has(key);
        h.style.display = show ? "" : "none";
        h.classList.toggle("open", show); 
        h.classList.toggle("closed", !show);
      });

      if (isSpellSearch) { RMUData.setOpenSpellState(null, null); } 
      else { RMUData.setOpenSkillsCategory(null); }
    };

    input.addEventListener("input", debounce(() => filter(input.value), 200), { passive: true });
    
    setTimeout(() => filter(""), 50);
  };

  requestAnimationFrame(waitAndMount);
}

// -----------------------------------------------------------------------------
// V. Core Argon Definitions (Non-feature logic)
// -----------------------------------------------------------------------------

function defineTooltip(CoreHUD) {  
  const ARGON = CoreHUD.ARGON;
  
  // Reverted to ARGON.CORE.Tooltip, matching original index.js
  const BaseTooltip = ARGON.CORE.Tooltip;

  if (!BaseTooltip) {
      console.warn("[ECH-RMU] Argon CORE.Tooltip base class not found; skipping custom tooltip.");
      return;
  }
  
  class RMUTooltip extends BaseTooltip {
    get classes() { return [...super.classes, "rmu"]; }
  }

  CoreHUD.defineTooltip(RMUTooltip);
}

function defineSupportedActorTypes(CoreHUD) {
  CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

// -----------------------------------------------------------------------------
// VI. Attach to Window & Export
// -----------------------------------------------------------------------------

// Attach all utilities to the window object for other modules to use
window.ICONS = ICONS;
window.RMUUtils = RMUUtils;
window.UIGuards = UIGuards;
window.installListSearch = installListSearch;
// ** CRITICAL FIX: Export formatBonus to the window **
window.formatBonus = formatBonus; 

export { RMUUtils, UIGuards, installListSearch, defineTooltip, defineSupportedActorTypes };