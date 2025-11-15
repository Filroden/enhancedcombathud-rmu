/**
 * RMUCore.js
 *
 * Contains shared utilities, core Argon integration points, UI guards,
 * and the general reusable search logic used by multiple panels.
 * This file also defines and attaches global utilities (ICONS, RMUUtils, etc.)
 * to the window object.
 */

// -----------------------------------------------------------------------------
// I. Constants & Icon Definitions
// -----------------------------------------------------------------------------

const MODULE_ID = "enhancedcombathud-rmu";

/**
 * Route helper for module icons.
 * @param {string} file - The icon file name (e.g., "sword-brandish.svg").
 * @returns {string} The web path to the icon file.
 */
const MOD_ICON = (file) =>
  (foundry?.utils?.getRoute
    ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`)
    : `modules/${MODULE_ID}/icons/${file}`);

/**
 * Global icon definitions for the RMU HUD.
 * @global
 */
const ICONS = {
  // Main
  melee: MOD_ICON("sword-brandish.svg"),
  ranged: MOD_ICON("high-shot.svg"),
  natural: MOD_ICON("fist.svg"),
  shield: MOD_ICON("vibrating-shield.svg"),
  skills: MOD_ICON("skills.svg"),
  spells: MOD_ICON("spell-book.svg"),
  combat: MOD_ICON("skip-next-circle.svg"),
  rest: MOD_ICON("rest.svg"),
  special: MOD_ICON("hazard-sign.svg"),
  endurance: MOD_ICON("mountain-climbing.svg"),
  concentration: MOD_ICON("meditation.svg"),
  star: MOD_ICON("star.svg"),
  instant: MOD_ICON("asterisk.svg"),
  subconscious: MOD_ICON("airline_seat_flat.svg"),
  close: MOD_ICON("clear-text.svg"),
  search: MOD_ICON("search.svg"),
  beam: MOD_ICON("ringed-beam.svg"),
  scroll: MOD_ICON("scroll-unfurled.svg"),
  explosion: MOD_ICON("bright-explosion.svg"),
  equip_closed: MOD_ICON("back_hand_closed.svg"),
  equip_open: MOD_ICON("back_hand_open.svg"),

  // Resistances
  panel: MOD_ICON("resistance-panel.svg"),
  Channeling: MOD_ICON("resistance-channeling.svg"),
  Essence: MOD_ICON("resistance-essence.svg"),
  Mentalism: MOD_ICON("resistance-mentalism.svg"),
  Physical: MOD_ICON("resistance-physical.svg"),
  Fear: MOD_ICON("resistance-fear.svg")
};

/**
 * Map of spell base names to their Foundry icon paths.
 * @global
 */
const SPELL_ATTACK_ICONS = {
  "Acidic Bolt": "icons/magic/acid/projectile-smoke-glowing.webp",
  "Bolt of Fire": "icons/magic/fire/beam-jet-stream-embers.webp",
  // ... (all other spell icons) ...
  "Shock Ball": "icons/magic/lightning/orb-ball-blue.webp",
};

// -----------------------------------------------------------------------------
// II. Core Utilities (Reusable logic, API wrappers, Formatting)
// -----------------------------------------------------------------------------

/**
 * Debounce utility to prevent a function from firing too rapidly.
 * @param {function} func - The function to debounce.
 * @param {number} [delay=150] - The delay in milliseconds.
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

/**
 * Formats a number as a string with a leading plus sign for positive values.
 * @param {*} n - The number or string to format.
 * @returns {string|*} The formatted string, or the original value if not a number.
 */
function formatBonus(n) {
  if (n === null || n === undefined) return n;
  const s = String(n).trim();
  if (s === '') return s;
  const num = Number(s);
  if (isNaN(num)) return n;
  return num > 0 ? `+${num}` : String(num);
}

/**
 * A collection of shared utility functions for the RMU HUD.
 * @global
 */
const RMUUtils = {
  /**
   * Formats tooltip detail values, applying bonus formatting to most.
   * @param {Array<object>} details - Array of {label, value} objects.
   * @returns {Array<object>} The formatted array.
   */
  formatTooltipDetails(details) {
    const excludedLabels = ["Ranks", "Total ranks", "Culture ranks", "Fumble", "Level"];
    return details.map(detail => {
      if (excludedLabels.includes(detail.label)) {
        return detail;
      }
      return { ...detail, value: formatBonus(detail.value) };
    });
  },

  /**
   * Mounts a translucent value overlay onto an action button.
   * @param {HTMLElement} buttonEl - The button's DOM element.
   * @param {string|number} [number=""] - The main number to display (e.g., "+10").
   * @param {string} [labelText="Total"] - The small label (e.g., "Total", "SCR").
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
      const formattedNumber = formatBonus(number);
      n.textContent = formattedNumber;
      txt.appendChild(n);
    }

    root.appendChild(txt);
    host.appendChild(root);
  },

  /**
   * Centralized utility to call an RMU system API function robustly.
   * Ensures a token is selected and handles API errors gracefully.
   * @param {Token} token - The token to perform the action on.
   * @param {string} apiFunctionName - The name of the function on `game.system.api`.
   * @param {...*} args - Arguments to pass to the API function.
   * @returns {Promise<boolean>} True if the API call succeeded, false otherwise.
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
      // Ensure the token is controlled before acting, if possible
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

/**
 * A collection of utilities to manage user input focus and
 * prevent unwanted event propagation (e.g., hotkeys firing).
 * @global
 */
const UIGuards = {
  /**
   * Attaches aggressive event stoppers to a panel to prevent
   * focus/click/key events from bubbling *out* of the panel.
   * This is used for panels that contain interactive inputs like search bars.
   * @param {ButtonPanel} panel - The Argon ButtonPanel instance.
   */
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

        // This guard is designed to *stop* interaction.
        // It is now only used where we explicitly want to block inputs.
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

  /**
   * Installs a global, aggressive keydown guard to prevent
   * canvas hotkeys (like WSAD) from firing while the HUD is open
   * AND the user is not interacting with a designated input field.
   */
  installGlobalHudInputGuard: () => {
    const guardHandler = (event) => {
      // Only run if Argon is open
      if (!ui.ARGON?.isOpen) return;

      const target = event.target;
      const targetTag = target.tagName;

      // Check for standard form elements OR our manual guard attribute
      if (
        targetTag === "INPUT" ||
        targetTag === "SELECT" ||
        targetTag === "TEXTAREA" ||
        target.closest('[data-argon-input-guard="true"]')
      ) {
        return; // Let the key event proceed to the input
      }

      // Block the keypress to prevent token movement, etc.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.body.addEventListener("keydown", guardHandler, true);
    console.log("[ECH-RMU] Global HUD input guard installed.");
  },

  /**
   * Attaches simple event stoppers to a panel to prevent
   * events from propagating *through* it to the canvas.
   * This is a "lighter" guard for non-interactive panels.
   * @param {ButtonPanel} panel - The Argon ButtonPanel instance.
   */
  attachPanelInteractionGuards(panel) {
    const tryAttach = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(tryAttach);
      const stop = (e) => { e.stopPropagation(); };
      // This list is non-capturing and just stops bubbling.
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
 * Installs a general-purpose search/filter bar onto a panel.
 * @param {ButtonPanel} panel - The Argon panel instance.
 * @param {string} tileSelector - CSS selector for filterable items (e.g., ".rmu-skill-tile").
 * @param {string} headerSelector - CSS selector for headers to hide when empty.
 * @param {string} logPrefix - Logging prefix (e.g., "skill", "spell").
 * @param {object} [options={}] - Configuration options.
 * @param {Array<object>} [options.filters=[]] - Array of filter definitions.
 * Each object: { id: string, dataKey: string, icon: string, tooltip: string }
 * @global
 */
function installListSearch(panel, tileSelector, headerSelector, logPrefix, options = {}) {
  // 1. Get options
  const { filters = [] } = options;
  const panelId = panel.id;
  if (!panelId) {
    console.error("[ECH-RMU] installListSearch failed: Panel has no 'id' property.", panel);
    return;
  }

  // 2. State & Helpers
  let tiles = [];
  let headers = [];
  const log = (msg) => console.log(`[ECH-RMU] [${logPrefix}] ${msg}`);

  // 3. Main Filter Logic
  const filter = (text) => {
    const terms = text.normalize("NFKC").trim().toLowerCase().split(" ").filter(Boolean);
    const bar = panel?.element?.querySelector(".rmu-search-bar");
    if (!bar) return;

    // Find the summary element
    const summaryEl = bar.querySelector(".rmu-search-summary");

    const activeFilters = filters.filter(f => {
      return bar.querySelector(`#rmu-filter-${panelId}-${f.id}`)?.classList.contains("active");
    });

    // Check Tile Visibility
    const visibleTiles = [];
    tiles.forEach(tile => {
      const name = tile.dataset.nameNorm || "";
      const textMatch = (terms.length === 0 || terms.every(t => name.includes(t)));
      const filterMatch = activeFilters.length === 0 || activeFilters.every(f => {
        return tile.dataset[f.dataKey] === "true";
      });
      const isVisible = textMatch && filterMatch;
      tile.style.display = isVisible ? "" : "none";
      if (isVisible) visibleTiles.push(tile);
    });

    // Header Visibility
    showHeaders(visibleTiles, headers);

    // Update Summary Text
    if (summaryEl) {
      const total = tiles.length;
      const visible = visibleTiles.length;
      const isFiltered = (terms.length > 0 || activeFilters.length > 0);

      if (isFiltered) {
        summaryEl.textContent = `Showing ${visible} of ${total}`;
        summaryEl.style.display = "";
      } else {
        summaryEl.textContent = "";
        summaryEl.style.display = "none";
      }
    }
  };

  // 4. Header Hiding Logic
  const showHeaders = (visibleTiles, headers) => {
    headers.forEach(h => {
      const key = h.dataset.catKey || h.dataset.listTypeKey || h.dataset.listNameKey;
      if (!key) { h.style.display = ""; return; }
      const hasVisibleChild = visibleTiles.some(t => t.dataset.catKey === key || t.dataset.listNameKey === key || t.dataset.listTypeKey === key);
      h.style.display = hasVisibleChild ? "" : "none";
    });
  };

  // 5. DOM Mounting
  const waitAndMount = () => {
    const el = panel?.element;
    if (!el) return requestAnimationFrame(waitAndMount);

    tiles = Array.from(el.querySelectorAll(tileSelector));
    if (!tiles.length) {
      return requestAnimationFrame(waitAndMount);
    }
    if (el.querySelector(".rmu-search-bar")) return;

    log("Mounting search bar...");
    headers = Array.from(el.querySelectorAll(headerSelector));

    // A. Create Search Bar container
    const searchBar = document.createElement("div");
    searchBar.className = "rmu-search-bar";

    // B. Create Text Input
    const search = document.createElement("input");
    search.className = "rmu-search-input";
    search.type = "text";
    search.placeholder = "Filter...";
    search.dataset.argonInputGuard = "true"; // For global guard

    // Stop keydown events from bubbling to global guard (e.g., "Enter")
    search.addEventListener("keydown", (e) => {
      e.stopPropagation();
    }, true);

    // Search on "Enter" key (in capture phase)
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        filter(search.value);
      }
    }, true);

    // C. Create Search Icon
    const searchIcon = document.createElement("a");
    searchIcon.className = "rmu-search-icon";
    searchIcon.innerHTML = `<img src="${ICONS.search}" alt="Search">`;
    searchIcon.addEventListener("click", (e) => {
      e.preventDefault();
      filter(search.value);
    });

    // D. Create "Clear" Button
    const clearBtn = document.createElement("a");
    clearBtn.className = "rmu-search-clear rmu-filter-button";
    clearBtn.title = "Clear search and filters";
    clearBtn.innerHTML = `<img src="${ICONS.close}" alt="Clear">`;

    // E. Create Filter Button Container
    const filterContainer = document.createElement("div");
    filterContainer.className = "rmu-search-filters";

    // F. Create all filter buttons
    for (const f of filters) {
      const btn = document.createElement("a");
      const btnId = `rmu-filter-${panelId}-${f.id}`;
      btn.className = "rmu-filter-button";
      btn.id = btnId;
      btn.title = f.tooltip;
      btn.innerHTML = `<img src="${f.icon}" alt="${f.tooltip}">`;
      if (RMUData.getFilterActive(panelId, f.id)) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const isActive = e.currentTarget.classList.toggle("active");
        RMUData.setFilterActive(panelId, f.id, isActive);
        filter(search.value); // Re-run filter on click
      });
      filterContainer.appendChild(btn);
    }

    // G. Clear Button Click Event
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      search.value = "";
      RMUData.clearAllFilters(panelId);
      filterContainer.querySelectorAll(".rmu-filter-button").forEach(b => {
        b.classList.remove("active");
      });
      filter(""); // Re-run filter
    });

    // H. Create Summary Text Element
    const summaryText = document.createElement("div");
    summaryText.className = "rmu-search-summary";
    summaryText.style.display = "none"; // Hide it by default

    // I. Append elements
    searchBar.appendChild(filterContainer); // 1. Filters
    searchBar.appendChild(search);          // 2. Input
    searchBar.appendChild(searchIcon);      // 3. Search Icon
    searchBar.appendChild(clearBtn);        // 4. Clear Button
    searchBar.appendChild(summaryText);     // 5. Summary
    
    el.prepend(searchBar);
  };

  requestAnimationFrame(waitAndMount);
}

// -----------------------------------------------------------------------------
// V. Core Argon Definitions (Non-feature logic)
// -----------------------------------------------------------------------------

/**
 * Defines a custom tooltip class for the RMU HUD.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineTooltip(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const BaseTooltip = ARGON.CORE.Tooltip;

  if (!BaseTooltip) {
    console.warn("[ECH-RMU] Argon CORE.Tooltip base class not found; skipping custom tooltip.");
    return;
  }

  /** @augments BaseTooltip */
  class RMUTooltip extends BaseTooltip {
    get classes() { return [...super.classes, "rmu"]; }
  }

  CoreHUD.defineTooltip(RMUTooltip);
}

/**
 * Defines the actor types that the RMU HUD will activate for.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineSupportedActorTypes(CoreHUD) {
  CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

// -----------------------------------------------------------------------------
// VI. Attach to Window & Export
// -----------------------------------------------------------------------------

// Attach all utilities to the window object for other modules to use
window.ICONS = ICONS;
window.SPELL_ATTACK_ICONS = SPELL_ATTACK_ICONS;
window.RMUUtils = RMUUtils;
window.UIGuards = UIGuards;
window.installListSearch = installListSearch;
window.formatBonus = formatBonus;

export { RMUUtils, UIGuards, installListSearch, defineTooltip, defineSupportedActorTypes };