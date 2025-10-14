// Enhanced Combat HUD — RMU integration
// Portrait + Movement + (MAIN) "Attacks" panel grouped into Melee/Ranged/Natural/Shield + Resistance Rolls

const MODULE_ID = "enhancedcombathud-rmu";

/* ──────────────────────────────────────────────────────────
   Boot logs
────────────────────────────────────────────────────────── */
console.info("[ECH-RMU] index.js loaded");
Hooks.once("init",  () => console.info("[ECH-RMU] init"));
Hooks.once("setup", () => console.info("[ECH-RMU] setup"));
Hooks.once("ready", () => console.info("[ECH-RMU] ready"));

/* ──────────────────────────────────────────────────────────
   Settings (minimal)
────────────────────────────────────────────────────────── */
function registerSettings() {
  game.settings.register(MODULE_ID, "skillsFavoritesOnly", {
    name: "Skills: show only favorites",
    hint: "If enabled, only show skills marked as Favorite on the actor.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.ARGON?.refresh()
  });

  game.settings.register(MODULE_ID, "skillsRollableOnly", {
    name: "Skills: show only rollable",
    hint: "If enabled, hide skills that cannot be rolled (system flag disables them).",
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

// Return a stable unique key for an attack (prefer the system's itemId)
function attackKey(att) {
  return att?.itemId ?? att?.id ?? att?._id ?? [
    (att?.attackName ?? att?.name ?? "attack"),
    (att?.chart?.name ?? ""),
    (att?.size ?? ""),
    (att?.attackId ?? "")
  ].join("::");
}

// Resolve the "live" attack object from the actor by unique key
function getLiveAttack(srcAttack) {
  const token = ui.ARGON?._token;
  const list = token?.actor?.system?._attacks ?? [];
  const key = attackKey(srcAttack);
  return list.find(a => attackKey(a) === key) || srcAttack;
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

const SKILLS_ICON = MOD_ICON("skills.svg");

const REST_ICON = MOD_ICON("rest.svg");

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

/** Ensure RMU HUD data is derived on the selected actor (once per actor). */
async function ensureRMUReady() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return;
  if (actor.system?._hudInitialized === true) return; // already derived
  await ensureExtendedTokenData(); // system-provided derivation
}

/* Mount the value overlay inside the tile's image container (not the full button) */
function applyValueOverlay(buttonEl, number = "", labelText = "Total") {
  if (!buttonEl) return;

  // Find a likely image container used by Argon/ECH buttons
  const img = buttonEl.querySelector(".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image");
  const host = img || buttonEl;           // fallback to full button if no image node
  host.style.position = host.style.position || "relative";
  host.style.overflow = "hidden";         // important: clip the blur to the image box

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
}

/** Flatten RMU skills from actor.system._skills (handles paged groups). */
function getAllActorSkills(actor) {
  const src = actor?.system?._skills;
  if (!src) return [];

  const out = [];

  const pushMaybe = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const it of v) pushMaybe(it);
    } else if (typeof v === "object") {
      // If it looks like a skill document (has .system), push
      if (v.system && (typeof v.system === "object")) out.push(v);
      else {
        // Otherwise, iterate its values (handles { "0_99": [skills], "100_126": [skills] })
        for (const val of Object.values(v)) pushMaybe(val);
      }
    }
  };

  pushMaybe(src);
  return out;
}


/** Build a normalized display entry for tiles (filters applied later). */
function toDisplaySkill(sk) {
  const s = sk?.system ?? {};
  // For testing: show everything (no exclusions)
  const name = s.name ?? "";
  const spec = s.specialization ?? "";
  const category = s.category ?? "Other";

  return {
    key: `${name}::${spec}`,
    name, spec, category,
    total: s._bonus,
    favorite: !!s.favorite,
    disabledBySystem: s._disableSkillRoll === true,
    raw: sk
  };
}


/** Group ALL skills (no module filters for now). */
function getGroupedSkillsForHUD_All() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return new Map();

  const all = getAllActorSkills(actor)
    .map(toDisplaySkill)
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
    return `${id}::${attackKey(attack)}`;
  }

  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey; // "melee" | "ranged" | "natural" | "shield"
    }

    _updateDisabledPill() {
      if (!this.element) return;
      const existing = this.element.querySelector(".rmu-disabled-pill");
      if (!this._equipped) {
        if (!existing) {
          const pill = document.createElement("div");
          pill.className = "rmu-disabled-pill";
          pill.textContent = "NOT EQUIPPED";
          this.element.style.position = "relative";
          this.element.appendChild(pill);
        }
      } else {
        existing?.remove();
      }
    }

    get disabled() {
      // Argon uses this to decide whether to add its own "disabled" class
      return !this._equipped;
    }

    // Is this attack currently “armed” (waiting for second click)?
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
        this.refresh?.(); // Re-render the label so it shows "Place: …"
      }
    }

    get label() {
      const live = getLiveAttack(this.attack);
      const name = live?.attackName ?? live?.name ?? "Attack";
      return this._armed ? `Place: ${name}` : name;
    }

    get icon() {
      const live = getLiveAttack(this.attack);
      return live?.img || DEFAULT_ICONS[this._catKey] || MOD_ICON("sword-brandish.svg");
    }

    get _equipped() {
      const a = getLiveAttack(this.attack);
      return !!(a?.isEquipped ?? a?.readyState ?? false);
    }

    get classes() {
      // Start from super, but remove any pre-set "disabled"
      const c = super.classes.slice().filter(cls => cls !== "disabled");
      if (!this._equipped) c.push("disabled");
      if (this._armed) c.push("armed");
      return c;
    }

    // Keep the tile clickable even if theme CSS tries to block it; also apply armed visuals
    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
      }

      // NEW: ensure the DOM class matches live equip state (overrides any base default)
      this.element?.classList.toggle("disabled", !this._equipped);

      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();
      applyValueOverlay(this.element, this.attack?.totalBonus ?? "", "Total");

      // A tiny “NOT EQUIPPED” pill
      this._updateDisabledPill?.();
    }

    // Stronger visual: outline + title hint
    _applyArmedVisual() {
      if (!this.element) return;
      if (this._armed) {
        this.element.style.outline = "2px solid rgba(255,165,0,0.95)";
        this.element.title = "Template active: place it on the scene, then click this attack again to resolve.";
      } else {
        this.element.style.outline = "";
        this.element.title = "";
      }
    }

    // Big “PLACE TEMPLATE” badge
    _updateBadge() {
      if (!this.element) return;
      const old = this.element.querySelector(".rmu-place-badge");
      if (old) old.remove();

      if (this._armed) {
        const b = document.createElement("div");
        b.className = "rmu-place-badge";
        b.textContent = "PLACE TEMPLATE";
        Object.assign(b.style, {
          position: "absolute",
          top: "4px",
          right: "6px",
          padding: "2px 6px",
          fontSize: "10px",
          fontWeight: "800",
          letterSpacing: "0.5px",
          borderRadius: "6px",
          background: "rgba(255,165,0,0.95)",
          color: "#000",
          textShadow: "none",
          pointerEvents: "none",
          zIndex: "3"
        });
        this.element.style.position = "relative";
        this.element.appendChild(b);
      }
    }

    // Orange overlay when armed so background visibly changes without touching global CSS
    _updateOverlay() {
      if (!this.element) return;

      // Remove any previous overlay
      const old = this.element.querySelector(".rmu-armed-overlay");
      if (old) old.remove();

      if (this._armed) {
        const ov = document.createElement("div");
        ov.className = "rmu-armed-overlay";
        Object.assign(ov.style, {
          position: "absolute",
          inset: "0",
          background: "rgba(255,165,0,0.30)",       // orange tint
          mixBlendMode: "multiply",                   // boosts visibility over the icon
          borderRadius: "10px",
          pointerEvents: "none",
          zIndex: "2"
        });
        // Ensure the button can hold absolutely positioned children
        this.element.style.position = "relative";
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
      await ensureRMUReady();
      const all = getTokenAttacks();

      // bucket attacks
      const buckets = new Map(CATS.map(c => [c.key, []]));
      for (const atk of all) {
        const key = bucketOf(atk);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(atk);
      }

      // sort each bucket: equipped first (LIVE), then by the label
      for (const [k, list] of buckets.entries()) {
        list.sort((a, b) => {
          const la = getLiveAttack(a);
          const lb = getLiveAttack(b);
          const ea = !!(la?.isEquipped ?? la?.readyState ?? false);
          const eb = !!(lb?.isEquipped ?? lb?.readyState ?? false);
          if (ea !== eb) return ea ? -1 : 1;

          const na = String(la?.attackName ?? la?.name ?? "");
          const nb = String(lb?.attackName ?? lb?.name ?? "");
          return na.localeCompare(nb);
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
   RESISTANCE ROLLS — category + 5 buttons (static for now)
────────────────────────────────────────────────────────── */

// File-based resistance icons
const RESISTANCE_ICONS = {
  panel:      MOD_ICON("resistance-panel.svg"),
  Channeling: MOD_ICON("resistance-channeling.svg"),
  Essence:    MOD_ICON("resistance-essence.svg"),
  Mentalism:  MOD_ICON("resistance-mentalism.svg"),
  Physical:   MOD_ICON("resistance-physical.svg"),
  Fear:       MOD_ICON("resistance-fear.svg")
};

/** Get the live resistances array from the selected actor.
 * Supports both `_resistances` and `resistances` just in case.
 */
function getTokenResistances() {
  const a = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!a) return [];
  const block = a.system?._resistanceBlock;
  const list =
    block?._resistances ??
    block?.resistances ??
    a.system?._resistances ??
    a.system?.resistances;

  return Array.isArray(list) ? list : [];
}

function defineResistancesMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

/** Individual roll button (dynamic, with tooltip + total overlay) */
class RMUResistanceActionButton extends ActionButton {
  constructor(resist) {
    super();
    this.resist = resist;
  }

  get label() { return this.resist?.name || "Resistance"; }
  get icon()  { return RESISTANCE_ICONS[this.resist?.name] || RESISTANCE_ICONS.panel; }

  get hasTooltip() { return true; }
  async getTooltipData() {
    const r = this.resist ?? {};
    // Show the classic RMU breakdown you shared earlier
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
      // Show total on the tile, like attacks do
      applyValueOverlay(this.element, this.resist?.total ?? "", "Total");
    }
  }

  async _onMouseDown(event) {
    if (event?.button !== 0) return; // left only
    event.preventDefault();
    event.stopPropagation();
    await this._roll();
  }

  async _onLeftClick(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    // no-op (avoid double fire)
  }

  async _roll() {
    try {
      const token = ui.ARGON?._token;
      if (!token) { ui.notifications?.error?.("No active token for HUD."); return; }
      const api = game.system?.api?.rmuTokenResistanceRollAction;
      if (typeof api !== "function") {
        ui.notifications?.error?.("RMU resistance roll API not available."); return;
      }
      const resistName = this.resist?.name;
      if (!resistName) { ui.notifications?.warn?.("Resistance type missing."); return; }

      await api(token, resistName); // dev-confirmed: token object + plain string
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
      this._icon = RESISTANCE_ICONS.panel;
    }

    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }

    async _getPanel() {
      await ensureRMUReady();
      const list = getTokenResistances();

      if (!list.length) {
        const empty = new (class NoResistButton extends ActionButton {
          get label() { return "No resistances"; }
          get icon()  { return RESISTANCE_ICONS.panel; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
      }

      const buttons = list.map(r => new RMUResistanceActionButton(r));
      return new ButtonPanel({ id: "rmu-resistances", buttons });
    }
  }

  /** A small ActionPanel which contributes the single “RESISTANCE ROLLS” button */
  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; } // short, matches ATTACKS pattern
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() {
      await ensureRMUReady();
      return [ new RMUResistanceCategoryButton() ];
    }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

/* ──────────────────────────────────────────────────────────
   SKILLS — button → accordion (headers first; click to expand one)
────────────────────────────────────────────────────────── */
function defineSkillsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

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

  // Keep HUD open while clicking inside skills panel (bubble-phase)
  function attachSkillsPanelGuards(panel) {
    const tryAttach = () => {
      const el = panel?.element;
      if (!el) return requestAnimationFrame(tryAttach);
      const stop = (e) => { e.stopPropagation(); }; // allow clicks, just stop bubbling
      ["pointerdown","mousedown","click","mouseup"].forEach(type => {
        el.addEventListener(type, stop, { capture: false }); // bubble phase
      });
    };
    requestAnimationFrame(tryAttach);
  }

  // ── Data helpers (show EVERYTHING for now) ───────────────
  function getAllActorSkills(actor) {
    const src = actor?.system?._skills;
    if (!src) return [];
    const out = [];
    const pushMaybe = (v) => {
      if (!v) return;
      if (Array.isArray(v)) for (const it of v) pushMaybe(it);
      else if (typeof v === "object") {
        if (v.system && typeof v.system === "object") out.push(v);
        else for (const val of Object.values(v)) pushMaybe(val);
      }
    };
    pushMaybe(src);
    return out;
  }

  function toDisplaySkill(sk) {
    const s = sk?.system ?? {};
    // For testing: include everything (even parents & undeveloped) to verify coverage
    const name = s.name ?? "";
    const spec = s.specialization ?? "";
    const category = s.category ?? "Other";
    return {
      key: `${name}::${spec}`,
      name, spec, category,
      total: s._bonus,
      disabledBySystem: s._disableSkillRoll === true,
      raw: sk
    };
  }

  function getGroupedSkillsForHUD_All() {
    const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!actor) return new Map();

    const all = getAllActorSkills(actor).map(toDisplaySkill).filter(Boolean);

    const groups = new Map();
    for (const sk of all) {
      if (!groups.has(sk.category)) groups.set(sk.category, []);
      groups.get(sk.category).push(sk);
    }

    for (const [cat, list] of groups.entries()) {
      list.sort((a, b) => {
        const da = a.spec ? `${a.name} (${a.spec})` : a.name;
        const db = b.spec ? `${b.name} (${b.spec})` : b.name;
        return da.localeCompare(db);
      });
    }
    return groups;
  }

  // Normalize a category name to a stable key
  const catKeyOf = (s) => String(s ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  // ── Header (category) tile ───────────────────────────────
  class RMUSkillHeaderButton extends ActionButton {
    constructor(title) { 
      super(); 
      this._title = title; 
      this._catKey = catKeyOf(title);
      this._panelEl = null; // set later by _bindPanel
    }
    get label() { return this._title; }
    get icon()  { return ""; } // IMPORTANT: empty string (not null) to avoid /null 404
    get classes() {
      const open = getOpenSkillsCategory() === this._catKey;
      return [...super.classes, "rmu-skill-header", open ? "open" : "closed"];
    }
    get hasTooltip() { return false; }

    // Called by the category button after the panel is created so we can toggle DOM
    _bindPanel(panel) {
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        // After binding, apply the current visibility
        this._applyVisibility();
      };
      requestAnimationFrame(tryBind);
    }

    _applyVisibility() {
      if (!this._panelEl) return;
      const openKey = getOpenSkillsCategory(); // normalized key, or null

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
        // Store the category name on the header element (optional, for debug/selector)
        this.element.dataset.catKey = this._catKey;
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation(); // stop any global close handler

      const openKey = getOpenSkillsCategory();
      const isOpen = openKey === this._catKey;
      setOpenSkillsCategory(isOpen ? null : this._catKey);

      // Update visibility in-place (no Argon refresh needed)
      this._applyVisibility();
    }

    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }


  // ── Skill (text-only) tile ───────────────────────────────
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
    get icon()  { return ""; } // IMPORTANT: empty string

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
        applyValueOverlay(this.element, this.entry?.total ?? "", "Total");
        this.element.dataset.catKey = catKeyOf(this.entry?.category || "");
        if (this._startHidden) this.element.style.display = "none";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0 || this.disabled) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    async _roll() {
      try {
        const token = ui.ARGON?._token;
        if (!token) { ui.notifications?.error?.("No active token for HUD."); return; }
        const api = game.system?.api?.rmuTokenSkillAction;
        if (typeof api !== "function") {
          ui.notifications?.error?.("RMU skill API not available."); return;
        }
        const skillObj = this.entry?.raw;

        // Ensure the token is controlled (the API warns if not)
        try {
          if (!token.controlled && typeof token.control === "function") {
            await token.control({ releaseOthers: true });
          }
        } catch (_) { /* non-fatal if control fails */ }
        await api(token, skillObj, undefined);
      } catch (err) {
        console.error("[ECH-RMU] Skill roll error:", err);
        ui.notifications?.error?.(`Skill roll failed: ${err?.message ?? err}`);
      }
    }
  }

  // ── SKILLS category button (opens the accordion panel) ───
  class RMUSkillsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SKILLS";
      this._icon = SKILLS_ICON; // you added this earlier
    }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }

    async _getPanel() {
      await ensureRMUReady();
      const groups = getGroupedSkillsForHUD_All();
      const buttons = [];

      if (!groups.size) {
        const empty = new (class NoSkillsButton extends ActionButton {
          get label() { return "No skills"; }
          get icon()  { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        const panel = new ButtonPanel({ id: "rmu-skills", buttons: [empty] });
        attachSkillsPanelGuards(panel);
        return panel;
      }

      const cats = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b));

      // Build headers, then ALL their skill tiles (we'll hide/show via header)
      const headerInstances = [];
      for (const cat of cats) {
        const header = new RMUSkillHeaderButton(cat);
        headerInstances.push(header);
        buttons.push(header);
        for (const entry of groups.get(cat)) {
          buttons.push(new RMUSkillActionButton(entry, true)); // start hidden
        }
      }

      const panel = new ButtonPanel({ id: "rmu-skills", buttons });
      attachSkillsPanelGuards(panel);

      // Bind headers to the real panel DOM so they can toggle visibility
      headerInstances.forEach(h => h._bindPanel(panel));

      // Start collapsed (only headers visible)
      setOpenSkillsCategory(null);
      // Apply collapsed state once the DOM is ready
      requestAnimationFrame(() => {
        const el = panel.element;
        if (!el) return;
        const tiles = el.querySelectorAll(".rmu-skill-tile");
        tiles.forEach(t => t.style.display = "none");
      });

      return panel;
    }
  }

  class RMUSkillsActionPanel extends ActionPanel {
    get label() { return "SKILLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUSkillsCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUSkillsActionPanel]);
}



/* ──────────────────────────────────────────────────────────
   REST — single action button (far right)
────────────────────────────────────────────────────────── */
function defineRestMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  class RMURestActionButton extends ActionButton {
    get label() { return "REST"; }
    get icon()  { return REST_ICON; }

    // Optional short tooltip (remove these two methods if you truly want none)
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
      if (event?.button !== 0) return; // left only
      event.preventDefault();
      event.stopPropagation();
      await this._run();
    }

    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      // no-op (avoid double fire)
    }

    async _run() {
      try {
        const token = ui.ARGON?._token;
        if (!token) { ui.notifications?.error?.("No active token for HUD."); return; }
        const api = game.system?.api?.rmuTokenRestAction;
        if (typeof api !== "function") {
          ui.notifications?.error?.("RMU rest API not available.");
          return;
        }
        await api(token); // opens the rest dialog
      } catch (err) {
        console.error("[ECH-RMU] Rest API error:", err);
        ui.notifications?.error?.(`Rest failed: ${err?.message ?? err}`);
      }
    }
  }

  class RMURestActionPanel extends ActionPanel {
    get label() { return "REST"; } // appears as the group label
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMURestActionButton() ]; }
  }

  CoreHUD.defineMainPanels([RMURestActionPanel]);
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

  // Refresh entire HUD when the selected actor changes (e.g. new token selected)
  Hooks.on("updateActor", (actor) => {
    if (actor === ui.ARGON?._actor && ui.ARGON?.rendered) ui.ARGON.refresh();
  });

  // Also refresh when the active token changes (e.g. user clicked a different token)
  Hooks.on("argonInit", (CoreHUD) => {
    if (game.system.id !== "rmu") return;

    defineTooltip(CoreHUD);
    definePortraitPanel(CoreHUD);
    defineSupportedActorTypes(CoreHUD);
    defineWeaponSets(CoreHUD);
    defineMovementHud(CoreHUD);
    defineAttacksMain(CoreHUD);
    defineResistancesMain(CoreHUD);
    defineSkillsMain(CoreHUD);
    defineRestMain(CoreHUD);
    defineDrawerPanel(CoreHUD);
  });
}

// Register settings and init config early (Argon may init before ready)
Hooks.on("setup", () => {
  registerSettings();
  initConfig();
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