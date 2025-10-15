/**
 * Enhanced Combat HUD — RMU extension
 *
 * Purpose: Wires Rolemaster Unified (RMU) data into Argon HUD Core.
 * Features: Portrait, movement, attacks, resistances, skills, rest, and drawer panels.
 * Policy: Avoid side-effects outside of Argon hooks and UI events.
 */

const MODULE_ID = "enhancedcombathud-rmu";

console.info(`[ECH-RMU] Module loaded`);
Hooks.once("init",  () => console.info(`[ECH-RMU] Initializing RMU extension`));
Hooks.once("setup", () => console.info(`[ECH-RMU] Setting up RMU extension hooks`));
Hooks.once("ready", () => console.info(`[ECH-RMU] RMU extension is ready`));

// -----------------------------------------------------------------------------
// I. Constants & Icon Definitions
// -----------------------------------------------------------------------------

/** @type {(file: string) => string} Route helper for module icons. */
const MOD_ICON = (file) =>
  (foundry?.utils?.getRoute
    ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`)
    : `modules/${MODULE_ID}/icons/${file}`);

const DEFAULT_ICONS = {
  melee:   MOD_ICON("sword-brandish.svg"),
  ranged:  MOD_ICON("high-shot.svg"),
  natural: MOD_ICON("fist.svg"),
  shield:  MOD_ICON("vibrating-shield.svg"),
};

const RESISTANCE_ICONS = {
  panel:      MOD_ICON("resistance-panel.svg"),
  Channeling: MOD_ICON("resistance-channeling.svg"),
  Essence:    MOD_ICON("resistance-essence.svg"),
  Mentalism:  MOD_ICON("resistance-mentalism.svg"),
  Physical:   MOD_ICON("resistance-physical.svg"),
  Fear:       MOD_ICON("resistance-fear.svg")
};

const SKILLS_ICON = MOD_ICON("skills.svg");
const SPECIAL_CHECKS_ICON = MOD_ICON("hazard-sign.svg");
const ENDURANCE_ICON = MOD_ICON("mountain-climbing.svg");
const CONCENTRATION_ICON = MOD_ICON("meditation.svg");
const REST_ICON = MOD_ICON("rest.svg");

// -----------------------------------------------------------------------------
// II. Core Utilities (Reusable logic, API wrappers)
// -----------------------------------------------------------------------------

const RMUUtils = {

  /** Converts a common value to a boolean, robustly. */
  asBool(v) { return !!(v === true || v === "true" || v === 1); },

  /**
   * Mounts a translucent overlay containing a number and label inside an action button.
   * This is used to display the total bonus for skills and resistances.
   * @param {HTMLElement} buttonEl - The root button element.
   * @param {string | number} [number=""] - The main value to display (e.g., skill bonus).
   * @param {string} [labelText="Total"] - The label below the number.
   */
  applyValueOverlay(buttonEl, number = "", labelText = "Total") {
    if (!buttonEl) return;

    // Find a likely image container used by Argon/ECH buttons
    const img = buttonEl.querySelector(".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image");
    const host = img || buttonEl;
    host.classList.add("rmu-button-relative", "rmu-overflow-hidden");

    // Clear any prior overlay
    host.querySelector(".rmu-value-overlay")?.remove();

    // Build overlay (blur + text stack)
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
      n.textContent = String(number);
      txt.appendChild(n);
    }

    root.appendChild(txt);
    host.appendChild(root);
  },

  /**
   * Centralized utility to call an RMU system API function robustly.
   * This removes boilerplate token checks, API availability checks, and error handling
   * from every single action button class, reducing redundancy.
   * @param {Token | null} token - The active token document or instance.
   * @param {string} apiFunctionName - The name of the API function to call (e.g., 'rmuTokenSkillAction').
   * @param {...any} args - Arguments to pass to the API function (e.g., skill object, options).
   * @returns {Promise<boolean>} True if the API call succeeded, false otherwise.
   */
  async rmuTokenActionWrapper(token, apiFunctionName, ...args) {
    if (!token) {
      ui.notifications?.error?.("No active token for HUD.");
      return false;
    }
    const api = game.system?.api?.[apiFunctionName];
    if (typeof api !== "function") {
      ui.notifications?.error?.(`RMU API function not available: ${apiFunctionName}`);
      return false;
    }

    try {
      // Ensure the token is controlled before action (RMU API may rely on this)
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
// III. Data Access and Processing (RMU System Specific)
// -----------------------------------------------------------------------------

const RMUData = {

  /** Ensures RMU HUD data is derived on the selected token/actor (once per actor). */
  async ensureExtendedTokenData() {
    const token = ui.ARGON?._token;
    const doc = token?.document ?? token;
    if (doc && typeof doc.hudDeriveExtendedData === "function") {
      try { await doc.hudDeriveExtendedData(); } catch (e) { console.warn("[ECH-RMU] hudDeriveExtendedData failed:", e); }
    }
  },

  /** Checks if actor data has been pre-derived for the HUD. */
  async ensureRMUReady() {
    const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!actor) return;
    if (actor.system?._hudInitialized === true) return; // already derived
    await RMUData.ensureExtendedTokenData(); // system-provided derivation
  },

  /** @returns {Array<object>} The actor's raw attack list. */
  getTokenAttacks() {
    const a = ui.ARGON?._actor;
    const list = a?.system?._attacks;
    return Array.isArray(list) ? list : [];
  },

  /** @returns {Array<object>} The actor's raw resistance list. */
  getTokenResistances() {
    const a = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!a) return [];
    const block = a.system?._resistanceBlock;
    const list =
      block?._resistances ??
      block?.resistances ??
      a.system?._resistances ??
      a.system?.resistances;
    return Array.isArray(list) ? list : [];
  },

  /**
   * Creates a stable unique key for an attack object, prioritizing system IDs.
   * @param {object} att - The raw attack object.
   * @returns {string} A stable key.
   */
  attackKey(att) {
    return att?.itemId ?? att?.id ?? att?._id ?? [
      (att?.attackName ?? att?.name ?? "attack"),
      (att?.chart?.name ?? ""),
      (att?.size ?? ""),
      (att?.attackId ?? "")
    ].join("::");
  },

  /**
   * Resolves the "live" attack object from the actor's current state by unique key.
   * This ensures the HUD uses up-to-date data (e.g., equipped status).
   * @param {object} srcAttack - The potentially stale attack object reference.
   * @returns {object} The live attack object from the actor, or the source if not found.
   */
  getLiveAttack(srcAttack) {
    const token = ui.ARGON?._token;
    const list = token?.actor?.system?._attacks ?? [];
    const key = RMUData.attackKey(srcAttack);
    return list.find(a => RMUData.attackKey(a) === key) || srcAttack;
  },

  /**
   * Categorizes an attack into one of the HUD buckets: melee, ranged, natural, or shield.
   * @param {object} att - The raw attack object.
   * @returns {"melee" | "ranged" | "natural" | "shield"} The determined category key.
   */
  bucketOf(att) {
    const sName = String(att?.skill?.name ?? "").toLowerCase();
    const sSpec = String(att?.skill?.specialization ?? att?.skill?.specialisation ?? "").toLowerCase();
    const type  = String(att?.subType ?? att?.type ?? att?.category ?? att?.attackType ?? "").toLowerCase();
    const incs  = att?.rangeInrements ?? att?.rangeIncrements ?? null;

    if (sName.includes("shield") || sSpec.includes("shield") || type.includes("shield")) return "shield";

    if (
      sName.includes("unarmed") || sName.includes("strikes") || sSpec.includes("unarmed") || sSpec.includes("strikes") ||
      type.includes("natural") || att?.isNatural === true
    ) return "natural";

    if (sName.includes("missile") || sName.includes("ranged") || type.includes("ranged") || sSpec.includes("thrown")) {
      return "ranged";
    }

    // Heuristic fallback: only treat as ranged if an increment with a real distance exists
    if (Array.isArray(incs) && incs.some(x => Number(x?.distInFt ?? x?.dist ?? 0) > 0)) {
      return "ranged";
    }

    return "melee";
  },

  /**
   * Extracts the 'Short' range distance from an RMU range increments array.
   * @param {Array<object>} arr - The range increments array.
   * @returns {string} The short range distance or "—".
   */
  getShortRange(arr) {
    if (!Array.isArray(arr)) return "—";
    const short = arr.find(r => String(r.label).toLowerCase() === "short");
    if (!short) return "—";
    const dist = short.distance || (short.distInFt != null ? `${short.distInFt}'` : short.dist ?? "");
    return dist ? `${dist}` : "—";
  },

  /**
   * Flattens and normalizes RMU skills from actor data, handling paged groups.
   * @param {Actor} actor - The actor instance.
   * @returns {Array<object>} A flat array of all skill objects.
   */
  getAllActorSkills(actor) {
    const src = actor?.system?._skills;
    if (!src) return [];

    const out = [];

    const pushMaybe = (v) => {
      if (!v) return;
      if (Array.isArray(v)) {
        for (const it of v) pushMaybe(it);
      } else if (typeof v === "object") {
        if (v.system && (typeof v.system === "object")) out.push(v);
        else {
          for (const val of Object.values(v)) pushMaybe(val);
        }
      }
    };

    pushMaybe(src);
    return out;
  },

  /**
   * Normalizes a raw skill object into a standardized display entry for HUD tiles.
   * @param {object} sk - The raw skill object (often a skill document).
   * @returns {object} The display skill object.
   */
  toDisplaySkill(sk) {
    const s = sk?.system ?? {};
    return {
      key: `${s.name ?? "Skill"}::${s.specialization ?? ""}`,
      name: s.name ?? "",
      spec: s.specialization ?? "",
      category: s.category ?? "Other",
      total: s._bonus,
      favorite: !!s.favorite,
      disabledBySystem: s._disableSkillRoll === true,
      raw: sk
    };
  },

  /**
   * Finds a skill by name within an actor's skill list.
   * This centralizes the lookup logic used by Special Checks.
   * @param {Actor} actor - The actor instance.
   * @param {string} name - The name of the skill to find (e.g., "Body Development").
   * @returns {object | null} The raw skill object if found.
   */
  getSkillByName(actor, name) {
    const list = RMUData.getAllActorSkills(actor);
    return list.find(s => (s?.system?.name ?? s?.name) === name);
  },

  /**
   * Fetches, transforms, and groups all skills for the HUD's accordion panel.
   * @returns {Map<string, Array<object>>} A map of category names to skill display objects.
   */
  getGroupedSkillsForHUD_All() {
    const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!actor) return new Map();

    const all = RMUData.getAllActorSkills(actor)
      .map(RMUData.toDisplaySkill)
      .filter(Boolean);

    const groups = new Map();
    for (const sk of all) {
      if (!groups.has(sk.category)) groups.set(sk.category, []);
      groups.get(sk.category).push(sk);
    }

    // Sort alpha by display name within each category
    for (const [cat, list] of groups.entries()) {
      list.sort((a, b) => {
        const da = a.spec ? `${a.name} (${a.spec})` : a.name;
        const db = b.spec ? `${b.name} (${b.spec})` : b.name;
        return da.localeCompare(db);
      });
    }
    return groups;
  }
};

// -----------------------------------------------------------------------------
// IV. UI Guards (Interaction Protection)
// -----------------------------------------------------------------------------

const UIGuards = {
  /**
   * Attaches aggressive event listeners to a panel element to prevent Argon's
   * global outside-click closer from firing when interacting with inputs inside it.
   * It relies on using 'capture: true' to intercept events early.
   * @param {ArgonPanel|ArgonButtonPanel} panel - The panel instance to guard.
   */
  attachPanelInputGuards(panel) {
    const arm = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(arm);

      const cap = { capture: true };
      const stopIfControl = (ev) => {
        const t = ev.target;
        if (t?.closest?.(".rmu-skill-search__clear") && ev.type === "click") {
          return; // let the clear button's own click handler run
        }
        if (ev.type === "input") return;
        if (!t) return;
        // Target form controls and RMU specific search components
        if (t.closest("input, textarea, select, .rmu-skill-search, .rmu-skill-search__input, .rmu-skill-search__clear")) {
          // Be aggressive on “down” events so Argon’s closer never sees them
          if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") {
            ev.preventDefault();
          }
          ev.stopImmediatePropagation();
          ev.stopPropagation();
        }
      };

      [
        "pointerdown","pointerup",
        "mousedown","mouseup","click",
        "touchstart","touchend",
        "contextmenu","wheel",
        "focus","focusin","focusout","blur",
        "keydown","keyup"
      ].forEach(type => el.addEventListener(type, stopIfControl, cap));
    };
    requestAnimationFrame(arm);
  },

  /**
   * Installs an ultra-aggressive global capture guard to ensure interactions
   * within critical HUD elements (like the Skills search bar) do not close the HUD.
   * This is necessary because some HUD elements are dynamically appended and need
   * an explicit 'capture' listener registered early on the window/document.
   */
  installGlobalHudInputGuard() {
    const cap = { capture: true, passive: false };

    // Selectors for critical interactive elements we must protect
    const SEARCH_SELECTORS =
          ".rmu-skill-search, .rmu-skill-search__input, .rmu-skill-search__clear, .rmu-skill-search__count, .argon-interactive, .argon-no-close, [data-argon-interactive='true']";

    const isSearch = (t) => !!(t && t.closest?.(SEARCH_SELECTORS));

    const guard = (ev) => {
      const t = ev.target;
      // Allow the clear button's own click handler to run
      if (t?.closest?.(".rmu-skill-search__clear") && ev.type === "click") {
        return;
      }
      if (!t || !isSearch(t)) return;

      // Stop Argon's outside-click closer as early as possible.
      if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") {
        ev.preventDefault();
      }
      ev.stopImmediatePropagation();
      ev.stopPropagation();

      // Ensure the input still focuses even though we prevented default on pointerdown.
      if (t.matches?.(".rmu-skill-search__input")) {
        setTimeout(() => t.focus?.(), 0);
      }
    };

    // Register broadly, at capture phase, once.
    [
      "pointerdown","pointerup","pointercancel",
      "mousedown","mouseup","click","dblclick",
      "touchstart","touchend",
      "contextmenu","wheel",
      "focus","focusin","focusout","blur"
    ].forEach(type => {
      // window first (earliest), then document as a fallback
      window.addEventListener(type, guard, cap);
      document.addEventListener(type, guard, cap);
    });
  },

  /**
   * Keep HUD open while clicking inside skills panel (bubble-phase).
   * This is a second layer of defense, stopping propagation on the panel element itself.
   * @param {ArgonPanel|ArgonButtonPanel} panel - The panel instance to guard.
   */
  attachSkillsPanelGuards(panel) {
    const tryAttach = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(tryAttach);
      // Stops the click from bubbling up to parents that might close the HUD.
      const stop = (e) => { e.stopPropagation(); };
      ["pointerdown","pointerup","mousedown","mouseup","click","touchstart","touchend","contextmenu","wheel","focusin","focusout","blur","keydown","keyup"].forEach(type => {
        el.addEventListener(type, stop, { capture: false });
      });
    };
    requestAnimationFrame(tryAttach);
  },
};


// -----------------------------------------------------------------------------
// V. Feature Definitions (Refactored to use Utilities)
// -----------------------------------------------------------------------------

/** Hook-in: registers RMU tooltip class with Argon Core. */
function defineTooltip(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  /** @augments ARGON.CORE.Tooltip */
  class RMUTooltip extends ARGON.CORE.Tooltip {
    get classes() { return [...super.classes, "rmu"]; }
  }
  CoreHUD.defineTooltip(RMUTooltip);
}

/** Hook-in: sets the Portrait panel implementation for RMU. */
function definePortraitPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  /** @augments ARGON.PORTRAIT.PortraitPanel */
  class RMUPortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
    get description() {
      const a = this.actor;
      if (!a) return "";
      const level = a.system?.level ?? a.system?.details?.level;
      const prof  = a.system?.profession ?? a.system?.details?.profession;
      return [level != null ? `Lvl ${level}` : null, prof].filter(Boolean).join(" · ");
    }
    get isDead()  { return this.isDying; }
    get isDying() {
      const hp = this.actor?.system?.health?.hp;
      return Number(hp?.value ?? 0) <= 0;
    }
    async getStatBlocks() {
      const hpVal = Number(this.actor?.system?.health?.hp?.value ?? 0);
      const hpMax = Number(this.actor?.system?.health?.hp?.max ?? 0);
      const ppVal = Number(this.actor?.system?.health?.power?.value ?? 0);
      const ppMax = Number(this.actor?.system?.health?.power?.max ?? 0);
      const dbTot = Number(this.actor?.system?._dbBlock?.totalDB ?? 0);
      return [
        [
          { text: `${hpVal}`, color: hpVal <= 0 ? "var(--ech-danger)" : "var(--ech-success)" },
          { text: "/" },
          { text: `${hpMax}`, color: "var(--ech-fore)" },
          { text: "HP" }
        ],
        [
          { text: "PP" },
          { text: `${ppVal}/${ppMax}`, color: "var(--ech-movement-baseMovement-background)" }
        ],
        [
          { text: "DB" },
          { text: `${dbTot}`, color: "var(--ech-movement-baseMovement-background)" }
        ]
      ];
    }
  }
  CoreHUD.definePortraitPanel(RMUPortraitPanel);
}

/** Policy: allow Argon HUD for RMU "Character" and "Creature" actor types only. */
function defineSupportedActorTypes(CoreHUD) {
  CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

/** Hook-in: movement tracker binding. Reads token moves and shows bars; resets on round/encounter end. */
function defineMovementHud(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base =
    ARGON?.MOVEMENT?.MovementHud ||
    ARGON?.MovementHud ||
    ARGON?.HUD?.MovementHud;

  if (!Base) {
    console.warn("[ECH-RMU] MovementHud base not found; skipping.");
    return;
  }

  /** @augments Base */
  class RMUMovementHud extends Base {
    get _mv()      { return this.actor?.system?._movementBlock ?? {}; }
    get _modeKey() { return this._mv._selected; }
    get _modeTbl() { return this._mv._table?.[this._modeKey] ?? null; }
    get _rates()   { return Array.isArray(this._modeTbl?.paceRates) ? this._modeTbl.paceRates : []; }
    _pace(name)    { return this._rates.find(r => r?.pace?.value === name) ?? null; }

    get baseMovement() {
      const walk = this._pace("Walk");
      return Number(walk?.perRound ?? 0); // feet / round
    }

    get movementMax() {
      const feetPerRound = this.baseMovement;
      const gridDist = Number(canvas.scene?.grid?.distance ?? 5);
      const squares = feetPerRound / (gridDist || 5);
      return Math.max(1, Math.round(squares));
    }

    get baseLabel()    { return "Move"; }
    get currentSpeed() { return this.baseMovement; }
    get maxSpeed()     { return this.baseMovement; }
    get speed()        { return this.currentSpeed; }
    get value()        { return this.currentSpeed; }

    async getData(...args) {
      const data = await super.getData?.(...args) ?? {};
      data.current = this.currentSpeed;
      data.max     = this.maxSpeed;
      data.base    = this.baseMovement;
      return data;
    }
  }

  CoreHUD.defineMovementHud(RMUMovementHud);
}

/** Hook-in: enables weapon-set swapping. UI-only; actor flags hold state. (RMU usually does not use this, so it's a no-op). */
function defineWeaponSets(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base =
    ARGON?.WEAPONS?.WeaponSets ||
    ARGON?.WeaponSets ||
    ARGON?.HUD?.WeaponSets;

  if (!Base) {
    console.warn("[ECH-RMU] WeaponSets base not found; skipping.");
    return;
  }

  /** @augments Base */
  class RMUWeaponSets extends Base {
    get sets() { return []; }
    _onSetChange(_id) { /* no-op in RMU */ }
  }

  CoreHUD.defineWeaponSets(RMUWeaponSets);
}


/** Main panel: builds Melee/Ranged/Natural/Shield attack buttons. */
function defineAttacksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

  const CATS = [
    { key: "melee",   label: "Melee",   icon: DEFAULT_ICONS.melee   },
    { key: "ranged",  label: "Ranged",  icon: DEFAULT_ICONS.ranged  },
    { key: "natural", label: "Natural", icon: DEFAULT_ICONS.natural },
    { key: "shield",  label: "Shield",  icon: DEFAULT_ICONS.shield  }
  ];

  // Attack tile armed state (for template placement)
  const TEMPLATE_STATE = new Map(); // key: `${tokenId}::${attackName}` -> boolean

  function tplKeyFor(token, attack) {
    const id = token?.id ?? ui.ARGON?._token?.id ?? "no-token";
    return `${id}::${RMUData.attackKey(attack)}`;
  }

  /** @augments ActionButton */
  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey;
    }

    _updateDisabledPill() {
      if (!this.element) return;
      const existing = this.element.querySelector(".rmu-disabled-pill");
      if (!this._equipped) {
        if (!existing) {
          const pill = document.createElement("div");
          pill.className = "rmu-disabled-pill";
          pill.textContent = "NOT EQUIPPED";
          this.element.classList.add("rmu-button-relative");
          this.element.appendChild(pill);
        }
      } else {
        existing?.remove();
      }
    }

    get isInteractive() { return true; }

    get disabled() {
      return !this._equipped;
    }

    get _armed() {
      const token = ui.ARGON?._token;
      return TEMPLATE_STATE.get(tplKeyFor(token, this.attack)) === true;
    }

    set _armed(v) {
      const token = ui.ARGON?._token;
      TEMPLATE_STATE.set(tplKeyFor(token, this.attack), !!v);
      if (this.element) {
        this._applyArmedVisual();
        this._updateBadge();
        this._updateOverlay();
        this.refresh?.();
      }
    }

    get label() {
      const live = RMUData.getLiveAttack(this.attack);
      const name = live?.attackName ?? live?.name ?? "Attack";
      return this._armed ? `Place: ${name}` : name;
    }

    get icon() {
      const live = RMUData.getLiveAttack(this.attack);
      return live?.img || DEFAULT_ICONS[this._catKey] || MOD_ICON("sword-brandish.svg");
    }

    get _equipped() {
      const a = RMUData.getLiveAttack(this.attack);
      return !!(a?.isEquipped ?? a?.readyState ?? false);
    }

    get classes() {
      const c = super.classes.slice().filter(cls => cls !== "disabled");
      if (!this._equipped) c.push("disabled");
      if (this._armed) c.push("armed");
      return c;
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.classList.add("rmu-interactive-button");
      }

      this.element?.classList.toggle("disabled", !this._equipped);

      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();
      RMUUtils.applyValueOverlay(this.element, this.attack?.totalBonus ?? "", "Total");

      this._updateDisabledPill?.();
    }

    _applyArmedVisual() {
      if (!this.element) return;
      if (this._armed) {
        this.element.title = "AoE Template active: adjust its position using the chat card controls, then click this attack again to resolve.";
      } else {
        this.element.title = "";
      }
    }

    _updateBadge() {
      if (!this.element) return;
      const old = this.element.querySelector(".rmu-place-badge");
      if (old) old.remove();

      if (this._armed) {
        const b = document.createElement("div");
        b.className = "rmu-place-badge";
        b.textContent = "PLACE TEMPLATE";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(b);
      }
    }

    _updateOverlay() {
      if (!this.element) return;
      const old = this.element.querySelector(".rmu-armed-overlay");
      if (old) old.remove();

      if (this._armed) {
        const ov = document.createElement("div");
        ov.className = "rmu-armed-overlay";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(ov);
      }
    }

    /* ───────── Tooltip ───────── */
    get hasTooltip() { return true; }
    async getTooltipData() {
      const a = this.attack ?? {};
      const details = [
        { label: "Specialization",   value: a.skill?.specialization },
        { label: "Size",             value: a.size },
        { label: "Chart",            value: a.chart?.name },
        { label: "Fumble",           value: a.fumble },
        ...( ["melee","natural","shield"].includes(this._catKey)
            ? [{ label: "Melee reach", value: a.meleeRange }]
            : [] ),
        ...( this._catKey === "ranged"
            ? [{ label: "Range (short)", value: RMUData.getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }]
            : [] ),
        { label: "Item Strength",    value: a.itemStrength },
        { label: "Ranks",            value: a.skill?.ranks },
        { label: "Combat Training",  value: a.skill?.name },
        { label: "2H",               value: (Number(a.twoHandedBonus) === 10 ? "Yes" : "No") },
        { label: "Bonus OB",         value: a.itemBonus },
        { label: "Total OB",         value: a.totalBonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return { title: this.label, subtitle: a.skill?.name ?? "", details };
    }

    /* ───────── Clicks ───────── */
    async _onMouseDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      await this._invokeAttack();
    }
    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }

    /** Handles the dual-click logic for template placement (if needed) or direct roll. */
    async _invokeAttack() {
      const token = ui.ARGON?._token;

      // Require a target
      const targets = game.user?.targets ?? new Set();
      if (!targets.size) {
        ui.notifications?.warn?.("Select at least one target before attacking.");
        return;
      }

      await RMUData.ensureExtendedTokenData();

      // Re-grab a LIVE attack entry (avoids stale equipped status)
      const live = RMUData.getLiveAttack(this.attack);

      if (!this._equipped) {
        ui.notifications?.warn?.(`${(live?.attackName ?? this.label).replace(/^Place:\s*/, "")} is not equipped.`);
        return;
      }

      const needsTemplate = live?.isAoE === true; // per-attack flag

      // If we're already armed, this is the *second* click → resolve and clear state.
      if (this._armed) {
        // Use the centralized wrapper utility
        await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
        this._armed = false;
        return;
      }

      // First click
      if (needsTemplate) {
        this._armed = true;
        ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
        // Use the centralized wrapper utility (starts placement and returns)
        await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
        return;
      }

      // Normal (non-template) attack: single call
      await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
    }
  }

  /** @augments ButtonPanelButton */
  class RMUAttackCategoryButton extends ButtonPanelButton {
    constructor({ key, label, icon, attacks }) {
      super();
      this.key = key;
      this.title = label;
      this._icon = icon;
      this._attacks = Array.isArray(attacks) ? attacks : [];
    }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return this._attacks.length > 0; }
    get isInteractive() { return true; }

    async _getPanel() {
      const buttons = (this._attacks || []).map(a => new RMUAttackActionButton(a, this.key));
      const panel = new ButtonPanel({ id: `rmu-attacks-${this.key}`, buttons });
      UIGuards.attachPanelInputGuards(panel);
      return panel;
    }
  }

  /** @augments ActionPanel */
  class RMUAttacksActionPanel extends ActionPanel {
    get label() { return "Attacks"; }
    get maxActions() { return null; }
    get currentActions() { return null; }

    async _getButtons() {
      await RMUData.ensureRMUReady();
      const all = RMUData.getTokenAttacks();

      const buckets = new Map(CATS.map(c => [c.key, []]));
      for (const atk of all) {
        const key = RMUData.bucketOf(atk);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(atk);
      }

      // Sort each bucket: equipped first (LIVE), then by the label
      for (const [k, list] of buckets.entries()) {
        list.sort((a, b) => {
          const la = RMUData.getLiveAttack(a);
          const lb = RMUData.getLiveAttack(b);
          const ea = !!(la?.isEquipped ?? la?.readyState ?? false);
          const eb = !!(lb?.isEquipped ?? lb?.readyState ?? false);
          if (ea !== eb) return ea ? -1 : 1;

          const na = String(la?.attackName ?? la?.name ?? "");
          const nb = String(lb?.attackName ?? lb?.name ?? "");
          return na.localeCompare(nb);
        });
      }

      const buttons = CATS.map(c =>
        new RMUAttackCategoryButton({
          key: c.key,
          label: c.label,
          icon: c.icon,
          attacks: buckets.get(c.key) || []
        })
      ).filter(b => b.hasContents);

      return buttons;
    }
  }

  CoreHUD.defineMainPanels([RMUAttacksActionPanel]);
}

/** Main panel: resistance rolls. */
function defineResistancesMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

  /** @augments ActionButton */
  class RMUResistanceActionButton extends ActionButton {
    constructor(resist) {
      super();
      this.resist = resist;
    }

    get label() { return this.resist?.name || "Resistance"; }
    get icon()  { return RESISTANCE_ICONS[this.resist?.name] || RESISTANCE_ICONS.panel; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const r = this.resist ?? {};
      const details = [
        { label: "Stat",           value: r.statShortName },
        { label: "Stat Bonus",     value: r.statBonus },
        { label: "Level Bonus",    value: r.levelBonus },
        { label: "Racial Bonus",   value: r.racialBonus },
        { label: "Special Bonus",  value: r.specialBonus },
        { label: "Armour Bonus",   value: r.armorBonus },
        { label: "Helmet Bonus",   value: r.helmetBonus },
        { label: "Same Realm",     value: r.sameRealmBonus },
        { label: "Total",          value: r.total }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      const subtitle = [
        r.statShortName ? r.statShortName.toUpperCase() : null,
        (r.total != null ? `Total ${r.total}` : null)
      ].filter(Boolean).join(" · ");

      return { title: this.label, subtitle, details };
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        RMUUtils.applyValueOverlay(this.element, this.resist?.total ?? "", "Total");
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      await this._roll();
    }

    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }

    /** Rolls the resistance using the centralized API wrapper. */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenResistanceRollAction",
        this.resist?.name // Passes the resistance name string
      );
    }
  }

  /** @augments ButtonPanelButton */
  class RMUResistanceCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "RESISTANCE ROLLS";
      this._icon = RESISTANCE_ICONS.panel;
    }

    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      await RMUData.ensureRMUReady();
      const list = RMUData.getTokenResistances();

      if (!list.length) {
        const empty = new (class NoResistButton extends ActionButton {
          get label() { return "No resistances"; }
          get icon()  { return RESISTANCE_ICONS.panel; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
      }

      const buttons = list.map(r => new RMUResistanceActionButton(r));
      const panel = new ButtonPanel({ id: "rmu-resistances", buttons });
      UIGuards.attachPanelInputGuards(panel);
      return panel;
    }
  }

  /** @augments ActionPanel */
  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() {
      await RMUData.ensureRMUReady();
      return [ new RMUResistanceCategoryButton() ];
    }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

/** Main panel: skills accordion + search. */
function defineSkillsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

  // ── Accordion open-state per token ───────────────────────
  const SKILLS_OPEN_CAT = new Map(); // tokenId -> string | null
  function getOpenSkillsCategory() {
    const tokenId = ui.ARGON?._token?.id ?? "no-token";
    return SKILLS_OPEN_CAT.get(tokenId) ?? null;
  }
  function setOpenSkillsCategory(catOrNull) {
    const tokenId = ui.ARGON?._token?.id ?? "no-token";
    if (catOrNull) SKILLS_OPEN_CAT.set(tokenId, String(catOrNull));
    else SKILLS_OPEN_CAT.delete(tokenId);
  }

  // Normalize a category name to a stable key
  const catKeyOf = (s) => String(s ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  /** Installs and manages the functional skill search bar at the top of the panel. */
  function installSkillsSearch(panel) {
    const makeBar = () => {
      const bar = document.createElement("div");
      bar.className = "rmu-skill-search argon-interactive argon-no-close";
      bar.setAttribute("data-argon-interactive", "true");
      bar.setAttribute("data-tooltip", "");
      bar.innerHTML = `
        <div class="rmu-skill-search__icon argon-interactive argon-no-close" data-argon-interactive="true"><i class="rmu-mdi rmu-mdi-magnify" aria-hidden="true"></i></div>
        <input type="text" class="rmu-skill-search__input argon-interactive argon-no-close" data-argon-interactive="true" placeholder="Search skills…">
        <button type="button" class="rmu-skill-search__clear argon-interactive argon-no-close" data-argon-interactive="true">×</button>
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

      // Re-assert the search bar if the panel re-renders
      const mo = new MutationObserver(() => {
        if (root.isConnected && !root.contains(bar)) {
          root.prepend(bar);
        }
      });
      mo.observe(root, { childList: true, subtree: true });

      const input = bar.querySelector(".rmu-skill-search__input");
      const clear = bar.querySelector(".rmu-skill-search__clear");
      const count = bar.querySelector(".rmu-skill-search__count");

      // CRITICAL: Install local guards *inside* the skill search bar for max robustness
      const PROTECTED_EVENTS = [
        "pointerdown", "pointercancel",
        "mousedown", "mouseup",
        "touchstart", "touchcancel",
        "focus", "focusin", "focusout", "blur"
      ];

      const ultraGuard = (ev) => {
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        if (["pointerdown", "mousedown", "touchstart"].includes(ev.type)) {
          ev.preventDefault();
        }
      };

      PROTECTED_EVENTS.forEach(type => {
        bar.addEventListener(type, ultraGuard, { capture: true, passive: false });
        input.addEventListener(type, ultraGuard, { capture: true, passive: false });
        clear.addEventListener(type, ultraGuard, { capture: true, passive: false });
        count.addEventListener(type, ultraGuard, { capture: true, passive: false });
      });

      // Special handler for input to ensure it can focus
      ["pointerdown", "mousedown", "touchstart"].forEach(type => {
        input.addEventListener(type, (ev) => {
          ev.stopImmediatePropagation();
          ev.stopPropagation();
          ev.preventDefault();
          requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          });
        }, { capture: true, passive: false });
      });

      // Clear button handler
      clear.addEventListener("click", (ev) => {
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        ev.preventDefault();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        requestAnimationFrame(() => input.focus());
      }, { capture: true });

      // Filtering logic
      const getTiles   = () => Array.from(root.querySelectorAll(".rmu-skill-tile"));
      const getHeaders = () => Array.from(root.querySelectorAll(".rmu-skill-header"));
      const buildIndex = () => getTiles().map(el => ({
        el,
        text: (el.dataset.nameNorm || "").toLowerCase(),
        cat:  (el.dataset.catKey  || "").toLowerCase()
      }));

      const filter = (qRaw) => {
        const q = String(qRaw || "").toLowerCase().trim();
        const tiles   = getTiles();
        const headers = getHeaders();

        if (!q) {
          tiles.forEach(t => t.style.display = "none");
          headers.forEach(h => {
            h.style.display = "";
            h.classList.remove("open");
            h.classList.add("closed");
          });
          count.textContent = "";
          return;
        }

        const index = buildIndex();
        let hits = 0;
        index.forEach(e => {
          const match = e.text.includes(q) || e.cat.includes(q);
          e.el.style.display = match ? "" : "none";
          if (match) hits++;
        });

        count.textContent = `${hits} match${hits === 1 ? "" : "es"}`;

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

        setOpenSkillsCategory(null);
      };

      input.addEventListener("input", () => filter(input.value), { passive: true });

      // Initial state
      filter("");
    };

    requestAnimationFrame(waitAndMount);
  }

  // ── Header (category) tile ───────────────────────────────
  /** @augments ActionButton */
  class RMUSkillHeaderButton extends ActionButton {
    constructor(title) {
      super();
      this._title = title;
      this._catKey = catKeyOf(title);
      this._panelEl = null;
    }
    get label() { return this._title; }
    get icon()  { return ""; }
    get isInteractive() { return true; }
    get classes() {
      const open = getOpenSkillsCategory() === this._catKey;
      return [...super.classes, "rmu-skill-header", open ? "open" : "closed"];
    }
    get hasTooltip() { return false; }

    /** Binds the panel DOM element for internal header state management. */
    _bindPanel(panel) {
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        this._applyVisibility();
      };
      requestAnimationFrame(tryBind);
    }

    _applyVisibility() {
      if (!this._panelEl) return;
      const openKey = getOpenSkillsCategory();

      // Toggle header open/closed classes for all headers
      const headers = this._panelEl.querySelectorAll(".rmu-skill-header");
      headers.forEach(h => {
        const key = h.dataset.catKey || "";
        h.classList.toggle("open",   key === openKey);
        h.classList.toggle("closed", key !== openKey);
      });

      // Show only tiles whose normalized key matches the open key
      const tiles = this._panelEl.querySelectorAll(".rmu-skill-tile");
      tiles.forEach(t => {
        const key = t.dataset.catKey || "";
        const visible = !!openKey && (key === openKey);
        t.style.display = visible ? "" : "none";
      });
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.catKey = this._catKey;
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const openKey = getOpenSkillsCategory();
      const isOpen = openKey === this._catKey;
      setOpenSkillsCategory(isOpen ? null : this._catKey);
      this._applyVisibility();
    }

    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }


  // ── Skill (text-only) tile ───────────────────────────────
  /** @augments ActionButton */
  class RMUSkillActionButton extends ActionButton {
    constructor(entry, startHidden = false) {
      super();
      this.entry = entry;
      this._startHidden = !!startHidden;
    }
    get label() {
      const e = this.entry;
      return e?.spec ? `${e.name} (${e.spec})` : e?.name ?? "Skill";
    }
    get icon()  { return ""; }
    get isInteractive() { return true; }
    get disabled() { return !!this.entry?.disabledBySystem; }
    get classes() {
      const c = super.classes.slice().filter(cls => cls !== "disabled");
      if (this.disabled) c.push("disabled");
      c.push("rmu-skill-tile");
      return c;
    }

    get hasTooltip() { return true; }
    async getTooltipData() {
      const sys = this.entry?.raw?.system ?? {};
      const details = [
        { label: "Name",             value: sys.name },
        { label: "Specialization",   value: sys.specialization },
        { label: "Category",         value: sys.category },
        { label: "Total ranks",      value: sys._totalRanks },
        { label: "Rank bonus",       value: sys._rankBonus },
        { label: "Culture ranks",    value: sys.cultureRanks },
        { label: "Stat",             value: sys.stat },
        { label: "Stat bonus",       value: sys._statBonus },
        { label: "Prof bonus",       value: sys._professsionalBonus },
        { label: "Knack",            value: sys._knack },
        { label: "Total bonus",      value: sys._bonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");
      return { title: this.label, subtitle: sys.category ?? "", details };
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = this.disabled ? "not-allowed" : "pointer";
        RMUUtils.applyValueOverlay(this.element, this.entry?.total ?? "", "Total");

        const label = this.label || "";
        const cat   = this.entry?.category || "";
        const spec  = this.entry?.spec || "";
        const norm  = (label + " " + cat + " " + spec).toLowerCase();

        this.element.dataset.catKey   = catKeyOf(cat);
        this.element.dataset.name     = label;
        this.element.dataset.nameNorm = norm;

        if (this._startHidden) this.element.style.display = "none";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0 || this.disabled) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /** Rolls the skill using the centralized API wrapper. */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSkillAction",
        this.entry?.raw, // Passes the raw skill object
        undefined
      );
    }
  }

  // ── SKILLS category button (opens the accordion panel) ───
  /** @augments ButtonPanelButton */
  class RMUSkillsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SKILLS";
      this._icon = SKILLS_ICON;
    }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }
    async _getPanel() {
      await RMUData.ensureRMUReady();
      const groups = RMUData.getGroupedSkillsForHUD_All();
      const buttons = [];

      if (!groups.size) {
        const empty = new (class NoSkillsButton extends ActionButton {
          get label() { return "No skills"; }
          get icon()  { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        const panel = new ButtonPanel({ id: "rmu-skills", buttons: [empty] });
        UIGuards.attachSkillsPanelGuards(panel);
        return panel;
      }

      const cats = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b));

      const headerInstances = [];
      for (const cat of cats) {
        const header = new RMUSkillHeaderButton(cat);
        headerInstances.push(header);
        buttons.push(header);
        for (const entry of groups.get(cat)) {
          buttons.push(new RMUSkillActionButton(entry, true));
        }
      }

      const panel = new ButtonPanel({ id: "rmu-skills", buttons });
      UIGuards.attachSkillsPanelGuards(panel);
      UIGuards.attachPanelInputGuards(panel); // For general form controls inside the panel
      installSkillsSearch(panel);

      headerInstances.forEach(h => h._bindPanel(panel));

      setOpenSkillsCategory(null);
      requestAnimationFrame(() => {
        const el = panel.element;
        if (!el) return;
        const tiles = el.querySelectorAll(".rmu-skill-tile");
        tiles.forEach(t => t.style.display = "none");
      });

      return panel;
    }
  }

  /** @augments ActionPanel */
  class RMUSkillsActionPanel extends ActionPanel {
    get label() { return "SKILLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUSkillsCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUSkillsActionPanel]);
}

/** Main panel: endurance (Body Development) and concentration (Mental Focus) checks. */
function defineSpecialChecksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel, BUTTONS } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = BUTTONS;

  /**
   * Helper function to roll a specific skill with the "specialManeuver" option.
   * Uses the new centralized wrapper.
   * @param {Token | null} token - The active token.
   * @param {object} skillObj - The raw skill object.
   * @param {string} optionText - The option to pass (e.g., "Endurance").
   */
  async function rollSkillWithOption(token, skillObj, optionText) {
    await RMUUtils.rmuTokenActionWrapper(
      token,
      "rmuTokenSkillAction",
      skillObj,
      { specialManeuver: optionText }
    );
  }

  /** @augments ActionButton */
  class RMUSpecialCheck_Endurance extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "PHYSICAL"; }
    get icon()  { return ENDURANCE_ICON; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
        // Omitted for brevity, assumed to be same as full skill tooltip logic
        { label: "Roll Type", value: "Body Development (Endurance)" }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");
      return { title: this.label, subtitle: sys.category ?? "Endurance Check", details };
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;
      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = "pointer";

      const actor = ui.ARGON?._token?.actor;
      // Use the centralized skill data helper
      this._skill = actor ? RMUData.getSkillByName(actor, "Body Development") : null;

      const total = this._skill?.system?._bonus ?? "";
      RMUUtils.applyValueOverlay(this.element, total, "Total");
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      await RMUData.ensureRMUReady();
      const token = ui.ARGON?._token;
      const actor = token?.actor;
      if (!actor) { ui.notifications?.error?.("No active token for HUD."); return; }

      // Use cached skill or re-find with centralized helper
      const skill = this._skill ?? RMUData.getSkillByName(actor, "Body Development");
      if (!skill) { ui.notifications?.warn?.("Skill not found: Body Development"); return; }
      await rollSkillWithOption(token, skill, "Endurance");
    }

    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /** @augments ActionButton */
  class RMUSpecialCheck_Concentration extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "MENTAL"; }
    get icon()  { return CONCENTRATION_ICON; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
        // Omitted for brevity, assumed to be same as full skill tooltip logic
        { label: "Roll Type", value: "Mental Focus (Concentration)" }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");
      return { title: this.label, subtitle: sys.category ?? "Concentration Check", details };
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;
      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = "pointer";

      const actor = ui.ARGON?._token?.actor;
      this._skill = actor ? RMUData.getSkillByName(actor, "Mental Focus") : null;

      const total = this._skill?.system?._bonus ?? "";
      RMUUtils.applyValueOverlay(this.element, total, "Total");
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      await RMUData.ensureRMUReady();
      const token = ui.ARGON?._token;
      const actor = token?.actor;
      if (!actor) { ui.notifications?.error?.("No active token for HUD."); return; }

      const skill = this._skill ?? RMUData.getSkillByName(actor, "Mental Focus");
      if (!skill) { ui.notifications?.warn?.("Skill not found: Mental Focus"); return; }
      await rollSkillWithOption(token, skill, "Concentration");
    }

    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /** @augments ButtonPanelButton */
  class RMUSpecialChecksCategoryButton extends ButtonPanelButton {
    get label() { return "ENDURANCE"; }
    get icon()  { return SPECIAL_CHECKS_ICON; }
    get isInteractive() { return true; }
    async _getPanel() {
      await RMUData.ensureRMUReady();
      const buttons = [
        new RMUSpecialCheck_Endurance(),
        new RMUSpecialCheck_Concentration(),
      ];
      const panel = new ButtonPanel({ id: "rmu-special-checks", buttons });
      UIGuards.attachPanelInputGuards(panel);
      return panel;
    }
  }

  /** @augments ActionPanel */
  class RMUSpecialChecksActionPanel extends ActionPanel {
    get label() { return "ENDURANCE"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUSpecialChecksCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

/** Main panel: rest actions. */
function defineRestMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  /** @augments ActionButton */
  class RMURestActionButton extends ActionButton {
    get label() { return "REST"; }
    get icon()  { return REST_ICON; }
    get visible() { return !game.combat?.started; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }
    async getTooltipData() {
      return {
        title: "Rest",
        subtitle: "Recover resources",
        details: [
          { label: "Info", value: "Open the rest dialog to recover Fatigue, Hit Points, and/or Power Points based on type and duration." }
        ]
      };
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      await this._run();
    }

    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }

    /** Runs the rest action using the centralized API wrapper. */
    async _run() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenRestAction"
      );
    }
  }

  /** @augments ActionPanel */
  class RMURestActionPanel extends ActionPanel {
    get label() { return "REST"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMURestActionButton() ]; }
  }

  CoreHUD.defineMainPanels([RMURestActionPanel]);
}

/** Drawer: secondary actions menu. */
function defineDrawerPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  /** @augments ARGON.DRAWER.DrawerPanel */
  class RMUDrawer extends ARGON.DRAWER.DrawerPanel {
    get title()   { return "Actions"; }
    get buttons() { return []; }
  }
  CoreHUD.defineDrawerPanel(RMUDrawer);
}

// -----------------------------------------------------------------------------
// VI. Initialization and Hooks
// -----------------------------------------------------------------------------

function initConfig() {
  // Refresh portrait when items on the selected actor change
  Hooks.on("updateItem", (item) => {
    if (item.parent === ui.ARGON?._actor && ui.ARGON?.rendered) {
      ui.ARGON.components.portrait?.refresh?.();
    }
  });

  // Refresh entire HUD when the selected actor changes
  Hooks.on("updateActor", (actor) => {
    if (actor === ui.ARGON?._actor && ui.ARGON?.rendered) ui.ARGON.refresh();
  });

  // Also refresh when the active token changes (e.g. user clicked a different token)
  Hooks.on("argonInit", (CoreHUD) => {
    if (game.system.id !== "rmu") return;

    // A. UI Basics
    defineTooltip(CoreHUD);
    defineSupportedActorTypes(CoreHUD);

    // B. Portrait/Movement
    definePortraitPanel(CoreHUD);
    defineMovementHud(CoreHUD);
    defineWeaponSets(CoreHUD); // No-op, but registered

    // C. Main Panels
    defineAttacksMain(CoreHUD);
    defineResistancesMain(CoreHUD);
    defineSkillsMain(CoreHUD);
    defineSpecialChecksMain(CoreHUD);
    defineRestMain(CoreHUD);

    // D. Drawer
    defineDrawerPanel(CoreHUD);
  });
}

// Register settings and init config early (Argon may init before ready)
Hooks.on("setup", () => {
  initConfig();
  // Install the aggressive, global guard once.
  UIGuards.installGlobalHudInputGuard();
});

// Add a special class to <body> so CSS can be scoped to RMU + ECH
Hooks.once("ready", () => {
  const body = document.body;
  if (!body.classList.contains("enhancedcombathud-rmu")) {
    body.classList.add("enhancedcombathud-rmu");
    console.info("[ECH-RMU] Added .enhancedcombathud-rmu to <body> for scoped CSS");
  }
});

// Clean up on shutdown
Hooks.once("shutdown", () => {
  document.body.classList.remove("enhancedcombathud-rmu");
});

// Update visibility of REST button when combat starts/ends
Hooks.on("updateCombat", () => ui.ARGON?.components?.main?.forEach(c => c.updateVisibility?.()));
Hooks.on("deleteCombat", () => ui.ARGON?.components?.main?.forEach(c => c.updateVisibility?.()));