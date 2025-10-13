// Enhanced Combat HUD — RMU integration
// Portrait + Movement + (MAIN) "Attacks" panel grouped into Melee/Ranged/Natural/Shield

const MODULE_ID = "enhancedcombathud-rmu";

/* ──────────────────────────────────────────────────────────
   Boot logs
────────────────────────────────────────────────────────── */
console.info("[ECH-RMU] index.js loaded");
Hooks.once("init",  () => console.info("[ECH-RMU] init"));
Hooks.once("setup", () => console.info("[ECH-RMU] setup"));
Hooks.once("ready", () => {
  console.info("[ECH-RMU] ready");
  // Add a page-scope class so CSS never leaks elsewhere
  document.body.classList.add("enhancedcombathud-rmu");
});

/* ──────────────────────────────────────────────────────────
   Settings (minimal)
────────────────────────────────────────────────────────── */
function registerSettings() {
  game.settings.register(MODULE_ID, "showRMUSpecialActions", {
    name: "Show RMU Special Actions",
    hint: "Show common RMU manoeuvre buttons such as Parry/Full Parry/Disengage (future).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => ui.ARGON?.refresh()
  });
}

/* ──────────────────────────────────────────────────────────
   Tooltip
────────────────────────────────────────────────────────── */
function defineTooltip(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  class RMUTooltip extends ARGON.CORE.Tooltip {
    get classes() { return [...super.classes, "rmu"]; }
  }
  CoreHUD.defineTooltip(RMUTooltip);
}

/* ──────────────────────────────────────────────────────────
   Portrait Panel (HP / PP / DB summary)
────────────────────────────────────────────────────────── */
function definePortraitPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
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

/* ──────────────────────────────────────────────────────────
   Supported Actor Types
────────────────────────────────────────────────────────── */
function defineSupportedActorTypes(CoreHUD) {
  CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

/* ──────────────────────────────────────────────────────────
   Movement HUD (RMU → Argon squares)
────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────
   Weapon Sets (quiet stub)
────────────────────────────────────────────────────────── */
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

  class RMUWeaponSets extends Base {
    get sets() { return []; }
    _onSetChange(_id) { /* no-op */ }
  }

  CoreHUD.defineWeaponSets(RMUWeaponSets);
}

/* ──────────────────────────────────────────────────────────
   Helpers used by Attacks
────────────────────────────────────────────────────────── */
// Route helper for module icons
const MOD_ICON = (file) =>
  (foundry?.utils?.getRoute
    ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`)
    : `modules/${MODULE_ID}/icons/${file}`);

// Default icons per category
const DEFAULT_ICONS = {
  melee:   MOD_ICON("sword-brandish.svg"),
  ranged:  MOD_ICON("high-shot.svg"),
  natural: MOD_ICON("fist.svg"),
  shield:  MOD_ICON("vibrating-shield.svg"),
};

function asBool(v) { return !!(v === true || v === "true" || v === 1); }

async function ensureExtendedTokenData() {
  const token = ui.ARGON?._token;
  const doc = token?.document ?? token;
  if (doc && typeof doc.hudDeriveExtendedData === "function") {
    try { await doc.hudDeriveExtendedData(); } catch (e) { console.warn("[ECH-RMU] hudDeriveExtendedData failed:", e); }
  }
}

function getTokenAttacks() {
  const a = ui.ARGON?._actor;
  const list = a?.system?._attacks;
  return Array.isArray(list) ? list : [];
}

// Bucket by skill first
function bucketOf(att) {
  const sName = String(att?.skill?.name ?? "").toLowerCase();
  const sSpec = String(att?.skill?.specialization ?? att?.skill?.specialisation ?? "").toLowerCase();
  const type  = String(att?.subType ?? att?.type ?? att?.category ?? att?.attackType ?? "").toLowerCase();
  const incs  = att?.rangeInrements ?? att?.rangeIncrements ?? null;

  if (sName.includes("shield") || sSpec.includes("shield") || type.includes("shield")) return "shield";

  // Unarmed / Natural (Strikes)
  if (
    sName.includes("unarmed") || sName.includes("strikes") || sSpec.includes("unarmed") || sSpec.includes("strikes") ||
    type.includes("natural") || att?.isNatural === true
  ) return "natural";

  // Missile / Ranged
  if (sName.includes("missile") || sName.includes("ranged") || type.includes("ranged") || sSpec.includes("thrown")) {
    return "ranged";
  }

  // Heuristic fallback: only treat as ranged if an increment with a real distance exists
  if (Array.isArray(incs) && incs.some(x => Number(x?.distInFt ?? x?.dist ?? 0) > 0)) {
    return "ranged";
  }

  // Default → Melee
  return "melee";
}

// Short range extractor
function getShortRange(arr) {
  if (!Array.isArray(arr)) return "—";
  const short = arr.find(r => String(r.label).toLowerCase() === "short");
  if (!short) return "—";
  const dist = short.distance || (short.distInFt != null ? `${short.distInFt}'` : short.dist ?? "");
  return dist ? `${dist}` : "—";
}

/* ──────────────────────────────────────────────────────────
   Shared visual overlay (blurred icon + "Total" + number)
────────────────────────────────────────────────────────── */
function applyValueOverlay(element, value) {
  if (!element) return;
  element.querySelector(".rmu-value-overlay")?.remove();

  const ov = document.createElement("div");
  ov.className = "rmu-value-overlay";
  ov.innerHTML = `
    <div class="rmu-value-overlay-blur"></div>
    <div class="rmu-value-overlay-text">
      <div class="rmu-value-overlay-label">Total</div>
      <div class="rmu-value-overlay-number">${value ?? ""}</div>
    </div>
  `;
  element.classList.add("rmu-button-relative");
  element.appendChild(ov);
}

/* ──────────────────────────────────────────────────────────
   ATTACK ROLLS - categories + attack buttons
────────────────────────────────────────────────────────── */
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

  // Attack tile
  // Track “armed” (template placement) per token+attack so the UI can show state
  const TEMPLATE_STATE = new Map(); // key: `${tokenId}::${attackName}` -> boolean

  function tplKeyFor(token, attack) {
    const id = token?.id ?? ui.ARGON?._token?.id ?? "no-token";
    const name = attack?.attackName ?? attack?.name ?? "attack";
    return `${id}::${name}`;
  }

  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey; // "melee" | "ranged" | "natural" | "shield"
    }

    // Is this attack currently “armed” (waiting for second click)?
    get _armed() {
      const token = ui.ARGON?._token;
      return TEMPLATE_STATE.get(tplKeyFor(token, this.attack)) === true;
    }

    set _armed(v) {
      const token = ui.ARGON?._token;
      TEMPLATE_STATE.set(tplKeyFor(token, this.attack), !!v);
      // If we’re already in the DOM, update visuals immediately
      if (this.element) {
        this._applyArmedVisual();
        this._updateBadge();
        // Re-render the label so it shows "Place: …"
        this.refresh?.();
      }
    }

    get label() {
      const name = this.attack?.attackName ?? this.attack?.name ?? "Attack";
      return this._armed ? `Place: ${name}` : name;
    }

    get icon() {
      // Attack image or category default
      return this.attack?.img || DEFAULT_ICONS[this._catKey] || MOD_ICON("sword-brandish.svg");
    }

    get _equipped() {
      const a = this.attack ?? {};
      return !!(a.isEquipped ?? a.readyState ?? a.equipped ?? a.isReady);
    }

    get classes() {
      const c = super.classes.slice();
      if (!this._equipped) c.push("disabled");
      if (this._armed) c.push("armed");
      c.push("rmu-attack-tile");          // ← add this
      return c;
    }

    // Keep the tile clickable even if theme CSS tries to block it; also apply armed visuals
    async _renderInner() {
      await super._renderInner();
      this.element?.classList.add("rmu-button-relative");
      if (this.element) this.element.style.pointerEvents = "auto";
      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();   // NEW: add this line
      applyValueOverlay(this.element, this.attack?.totalBonus ?? "");
    }

    set _armed(v) {
      const token = ui.ARGON?._token;
      TEMPLATE_STATE.set(tplKeyFor(token, this.attack), !!v);
      if (this.element) {
        this._applyArmedVisual();
        this._updateBadge();
        this._updateOverlay();  // NEW: add this line
        applyValueOverlay(this.element, this.attack?.totalBonus ?? "");
        this.refresh?.();
      }
    }

    // Stronger visual: outline + title hint
    _applyArmedVisual() {
      if (!this.element) return;
      this.element.title = this._armed
        ? "Template active: place it on the scene, then click this attack again to resolve."
        : "";
    }

    // Big “PLACE TEMPLATE” badge
    _updateBadge() {
      if (!this.element) return;
      this.element.querySelector(".rmu-place-badge")?.remove();
      if (!this._armed) return;
      const b = document.createElement("div");
      b.className = "rmu-place-badge";
      b.textContent = "PLACE TEMPLATE";
      this.element.classList.add("rmu-button-relative");
      this.element.appendChild(b);
    }


    // NEW: add an orange overlay so background visibly changes without touching global CSS
    _updateOverlay() {
      if (!this.element) return;
      this.element.querySelector(".rmu-armed-overlay")?.remove();
      if (!this._armed) return;
      const ov = document.createElement("div");
      ov.className = "rmu-armed-overlay";
      this.element.classList.add("rmu-button-relative");
      this.element.appendChild(ov);
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
        // Conditionally include Melee reach
        ...( ["melee","natural","shield"].includes(this._catKey)
            ? [{ label: "Melee reach", value: a.meleeRange }]
            : [] ),
        // Conditionally include Range (short)
        ...( this._catKey === "ranged"
            ? [{ label: "Range (short)", value: getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }]
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
    // Trigger ONCE on mousedown (prevents double API calls)
    async _onMouseDown(event) {
      if (event.button !== 0) return; // only left
      event.preventDefault();
      event.stopPropagation();
      await this._invokeAttack();
    }

    // Mouseup is a no-op (prevents duplicates)
    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      // no-op
    }

    async _invokeAttack() {
      try {
        // Require a target
        const targets = game.user?.targets ?? new Set();
        if (!targets.size) {
          ui.notifications?.warn?.("Select at least one target before attacking.");
          return;
        }

        const token = ui.ARGON?._token;
        const doc = token?.document ?? token;
        if (!token) {
          ui.notifications?.error?.("No active token for HUD.");
          return;
        }

        // Ensure _attacks exist on the token
        if (typeof doc?.hudDeriveExtendedData === "function") {
          await doc.hudDeriveExtendedData();
        }

        // Re-grab a LIVE attack entry (avoid stale refs)
        const list = token?.actor?.system?._attacks ?? [];
        const live =
          list.find(a => a === this.attack) ||
          list.find(a => a.attackName === this.attack?.attackName) ||
          this.attack;

        // If not equipped, stop here
        if (!this._equipped) {
          ui.notifications?.warn?.(`${(this.attack?.attackName ?? this.label).replace(/^Place:\s*/, "")} is not equipped.`);
          return;
        }

        const api = game.system?.api?.rmuTokenAttackAction;
        if (typeof api !== "function") {
          ui.notifications?.error?.("RMU attack API not available.");
          return;
        }

        const needsTemplate = live?.isAoE === true; // per-attack flag

        // If we're already armed, this is the *second* click → resolve and clear state.
        if (this._armed) {
          await api(token, live);    // resolve after the template has been placed
          this._armed = false;       // clear glow/label
          return;
        }

        // First click
        if (needsTemplate) {
          // Arm, refresh visuals immediately, toast, then start placement via API.
          this._armed = true;               // sets state + refreshes visuals/label
          ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
          await api(token, live);           // starts the placement workflow
          return;                           // stay armed until next click
        }

        // Normal (non-template) attack: single call
        await api(token, live);

      } catch (err) {
        console.error("[ECH-RMU] Attack API error:", err);
        ui.notifications?.error?.(`Attack failed: ${err?.message ?? err}`);
        this._armed = false; // don’t leave the button stuck in “armed” state on error
      }
    }
  }


  // Category button (opens a small panel of attack tiles)
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

    async _getPanel() {
      const buttons = this._attacks.map(a => new RMUAttackActionButton(a, this.key));
      return new ButtonPanel({
        id: `rmu-attacks-${this.key}`,
        buttons
      });
    }
  }

  // MAIN panel visible to the right of the portrait
  class RMUAttacksActionPanel extends ActionPanel {
    get label() { return "Attacks"; }
    get maxActions() { return null; }
    get currentActions() { return null; }

    async _getButtons() {
      await ensureExtendedTokenData();
      const all = getTokenAttacks();

      // bucket attacks
      const buckets = new Map(CATS.map(c => [c.key, []]));
      for (const atk of all) {
        const key = bucketOf(atk);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(atk);
      }

      // sort each bucket: equipped first, then name shown on the tile
      for (const [k, list] of buckets.entries()) {
        list.sort((a,b) => {
          const ea = asBool(a.isEquipped ?? a.readyState);
          const eb = asBool(b.isEquipped ?? b.readyState);
          if (ea !== eb) return ea ? -1 : 1;
          return String(a.attackName ?? a.name ?? "").localeCompare(String(b.attackName ?? b.name ?? ""));
        });
      }

      // Build 4 category buttons (skip empties)
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

/* ──────────────────────────────────────────────────────────
   RESISTANCE ROLLS — category + 5 buttons
────────────────────────────────────────────────────────── */

/** Extract RMU resistances from the same source used for Attacks, with fallbacks */
async function getTokenResistances() {
  await ensureExtendedTokenData();

  // Mirror the Attacks approach first (this is how your attacks getter works)
  const a = ui.ARGON?._actor;
  const candidates = [];

  // Candidate paths to try (array or map)
  const tryPaths = [
    ["system","_resistanceBlock","_resistances"],
    ["system","resistanceBlock","_resistances"],
    ["system","_resistances"],
    ["system","resistances"]
  ];

  function getByPath(obj, path) {
    return path.reduce((o,k) => (o && k in o ? o[k] : undefined), obj);
  }

  // 1) Try ui.ARGON._actor (preferred, same as attacks)
  if (a) {
    for (const p of tryPaths) {
      const v = getByPath(a, p);
      if (Array.isArray(v)) { candidates.push(v); break; }
      if (v && typeof v === "object") { candidates.push(Object.values(v)); break; }
    }
  }

  // 2) Fallback to the live token’s actor
  if (!candidates.length) {
    const tokenActor = ui.ARGON?._token?.actor;
    if (tokenActor) {
      for (const p of tryPaths) {
        const v = getByPath(tokenActor, p);
        if (Array.isArray(v)) { candidates.push(v); break; }
        if (v && typeof v === "object") { candidates.push(Object.values(v)); break; }
      }
    }
  }

  // 3) Final fallback to whatever was on _actor via ID (unlikely needed)
  if (!candidates.length && a?.id) {
    const byId = game.actors?.get(a.id);
    if (byId) {
      for (const p of tryPaths) {
        const v = getByPath(byId, p);
        if (Array.isArray(v)) { candidates.push(v); break; }
        if (v && typeof v === "object") { candidates.push(Object.values(v)); break; }
      }
    }
  }

  const list = candidates[0] ?? [];
  console.debug("[ECH-RMU] Resistances found:", {
    actor: a?.name ?? ui.ARGON?._token?.actor?.name ?? "(none)",
    count: Array.isArray(list) ? list.length : 0
  });

  return Array.isArray(list) ? list : [];
}


/** A very simple inline SVG icon */
const RESISTANCE_ICON = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs><style>
      .a{fill:#000000;opacity:.9;}   /* ← black background */
      .b{fill:#ffffff;opacity:.95;}
    </style></defs>
    <rect rx="10" ry="10" x="4" y="4" width="56" height="56" class="a"/>
    <path class="b" d="M32 7l9 13h-7l7 12h-8l6 12h-6l5 13-21-25h8l-7-12h10l-6-13z"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();

function defineResistancesMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

  /** Individual roll button */
  class RMUResistanceActionButton extends ActionButton {
    constructor(resist) {
      super();
      this.resist = resist;
    }

    get label() {
      return this.resist?.name || "Resistance";
    }

    get icon() {
      return RESISTANCE_ICON;
    }

    async _renderInner() {
      await super._renderInner();
      applyValueOverlay(this.element, this.resist?.total ?? "");
    }

    get hasTooltip() { return true; }
    async getTooltipData() {
      const r = this.resist ?? {};
      const details = [
        { label: "Stat",            value: r.statShortName },
        { label: "Stat Bonus",      value: r.statBonus },
        { label: "Level Bonus",     value: r.levelBonus },
        { label: "Racial Bonus",    value: r.racialBonus },
        { label: "Special Bonus",   value: r.specialBonus },
        { label: "Armour Bonus",    value: r.armorBonus },
        { label: "Helmet Bonus",    value: r.helmetBonus },
        { label: "Same Realm",      value: r.sameRealmBonus },
        { label: "Total",           value: r.total }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      const subtitle = [
        (r.statShortName || "").toUpperCase(),
        (r.total != null ? `Total ${r.total}` : null)
      ].filter(Boolean).join(" · ");

      return { title: this.label, subtitle, details };
    }

    async _onMouseDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      await this._roll();
    }

    async _onLeftClick(_event) { /* handled by _onMouseDown */ }

    async _roll() {
      try {
        const token = ui.ARGON?._token;
        if (!token) { ui.notifications?.error?.("No active token for HUD."); return; }
        const api = game.system?.api?.rmuTokenResistanceRollAction;
        if (typeof api !== "function") {
          ui.notifications?.error?.("RMU resistance roll API not available."); return;
        }
        const tokenName  = token.name ?? token?.document?.name;
        const resistName = this.resist?.name;
        if (!resistName) { ui.notifications?.warn?.("Resistance type missing."); return; }
        await api(tokenName, resistName);
      } catch (err) {
        console.error("[ECH-RMU] Resistance roll error:", err);
        ui.notifications?.error?.(`Resistance roll failed: ${err?.message ?? err}`);
      }
    }
  }

  /** The category toggle button that opens a panel of 5 resistance buttons */
  class RMUResistanceCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "RESISTANCE ROLLS";
      this._icon = RESISTANCE_ICON;
    }

    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }

    async _renderInner() {
      await super._renderInner();
      try {
        const list = await getTokenResistances();
        if (!this.element) return;
        this.element.classList.add("rmu-button-relative");
        this.element.querySelector(".rmu-count-badge")?.remove();
        const b = document.createElement("div");
        b.className = "rmu-count-badge";
        b.textContent = String(list.length ?? 0);
        this.element.appendChild(b);
      } catch (e) { /* ignore */ }
    }

    async _getPanel() {
      const resistances = await getTokenResistances();

      if (!resistances.length) {
        const empty = new (class NoResistButton extends ActionButton {
          get label() { return "No resistances"; }
          get icon()  { return RESISTANCE_ICON; }
          get classes() { return [...super.classes, "disabled"]; }
        })();

        return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
      }

      const buttons = resistances.map(r => new RMUResistanceActionButton(r));
      return new ButtonPanel({ id: "rmu-resistances", buttons });
    }
  }

  /** A small ActionPanel which contributes the single “RESISTANCE ROLLS” button */
  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; } // short, matches ATTACKS pattern
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUResistanceCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

/* ──────────────────────────────────────────────────────────
   Drawer Panel (kept simple)
────────────────────────────────────────────────────────── */
function defineDrawerPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  class RMUDrawer extends ARGON.DRAWER.DrawerPanel {
    get title()   { return "Actions"; }
    get buttons() { return []; }
  }
  CoreHUD.defineDrawerPanel(RMUDrawer);
}

/* ──────────────────────────────────────────────────────────
   Hooks & wiring
────────────────────────────────────────────────────────── */
function initConfig() {
  // Refresh portrait when items on the selected actor change
  Hooks.on("updateItem", (item) => {
    if (item.parent === ui.ARGON?._actor && ui.ARGON?.rendered) {
      ui.ARGON.components.portrait?.refresh?.();
    }
  });

  Hooks.on("argonInit", (CoreHUD) => {
    if (game.system.id !== "rmu") return;

    defineTooltip(CoreHUD);
    definePortraitPanel(CoreHUD);
    defineSupportedActorTypes(CoreHUD);
    defineWeaponSets(CoreHUD);
    defineMovementHud(CoreHUD);
    defineAttacksMain(CoreHUD);
    defineResistancesMain(CoreHUD);
    defineDrawerPanel(CoreHUD);
  });
}

/* ──────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────── */
Hooks.on("setup", () => {
  registerSettings();
  initConfig();
});