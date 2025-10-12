// Enhanced Combat HUD — RMU integration
// Portrait + Movement + (MAIN) "Attacks" panel grouped into Melee/Ranged/Natural/Shield

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
// Route helper for core icons (works under sub-path deployments)
const CORE_ICON = (p) => (foundry?.utils?.getRoute ? foundry.utils.getRoute(p) : p);

// Default icons per category (core Foundry)
const DEFAULT_ICONS = {
  melee:   CORE_ICON("icons/skills/melee/maneuver-sword-katana-yellow.webp"),
  ranged:  CORE_ICON("icons/skills/ranged/person-archery-bow-attack-orange.webp"),
  natural: CORE_ICON("icons/skills/melee/unarmed-punch-fist-yellow-red.webp"),
  shield:  CORE_ICON("icons/skills/melee/shield-block-gray-yellow.webp")
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

// Bucket by **skill first** (fixes melee showing as ranged)
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
   MAIN — "Attacks" panel (to the right of the portrait)
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
  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey; // "melee" | "ranged" | "natural" | "shield"
    }

    get label() {
      return this.attack?.attackName ?? this.attack?.name ?? "Attack";
    }

    get icon() {
      // Attack image or category default
      return this.attack?.img || DEFAULT_ICONS[this._catKey] || CORE_ICON("icons/svg/sword.svg");
    }

    get _equipped() {
      const a = this.attack ?? {};
      return asBool(a.isEquipped ?? a.readyState ?? a.equipped ?? a.isReady);
    }

    get classes() {
      const c = super.classes.slice();
      // Only disable when NOT equipped
      if (!this._equipped) c.push("disabled");
      return c;
    }

    // Keep the tile clickable even if theme CSS tries to block it
    async _renderInner() {
      await super._renderInner();
      if (this.element) this.element.style.pointerEvents = "auto";
    }

    get hasTooltip() { return true; }
    async getTooltipData() {
      const a = this.attack ?? {};
      const shortRange = getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range);

      // Only provide the structured details (lets Argon render the designed block)
      const details = [
        { label: "Specialization",   value: a.skill?.specialization },
        { label: "Size",             value: a.size },
        { label: "Chart",            value: a.chart?.name },
        { label: "Fumble",           value: a.fumble },
        { label: "Melee reach",      value: a.meleeRange },         // exact path you provided
        { label: "Range (short)",    value: shortRange },
        { label: "Item Strength",    value: a.itemStrength },
        { label: "Ranks",            value: a.skill?.ranks },
        { label: "Combat Training",  value: a.skill?.name },
        { label: "2H",               value: (Number(a.twoHandedBonus) === 10 ? "Yes" : "No") },
        { label: "Bonus OB",         value: a.itemBonus },
        { label: "Total OB",         value: a.totalBonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return { title: this.label, subtitle: a.skill?.name ?? "", details };
    }

    // Trigger ONCE: mousedown only (prevents double API calls)
    async _onMouseDown(event) {
      if (event.button !== 0) return; // only left
      event.preventDefault();
      event.stopPropagation();
      await this._invokeAttack();
    }

    // Do not trigger on mouseup anymore (prevents duplicate rolls)
    async _onLeftClick(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      // no-op
    }

    async _invokeAttack() {
      try {
        // Require target (RMU usually needs it)
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

        // Re-grab a LIVE attack entry from the token array (avoid stale refs)
        const list = token?.actor?.system?._attacks ?? [];
        const live =
          list.find(a => a === this.attack) ||
          list.find(a => a.attackName === this.attack?.attackName) ||
          this.attack;

        // If not equipped, stop here (after deriving so state is fresh)
        if (!this._equipped) {
          ui.notifications?.warn?.(`${this.label} is not equipped.`);
          return;
        }

        // Only Melee / Ranged confirmed supported right now
        const supported = ["melee", "ranged"];
        const api = game.system?.api?.rmuTokenAttackAction;
        if (!supported.includes(this._catKey) || typeof api !== "function") {
          ui.notifications?.info?.(`[RMU] Attack not supported yet for "${this._catKey}".`);
          return;
        }

        await api(token, live);
      } catch (err) {
        console.error("[ECH-RMU] Attack API error:", err);
        ui.notifications?.error?.(`Attack failed: ${err?.message ?? err}`);
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

    // Attacks as a MAIN panel (to the right of the portrait)
    defineAttacksMain(CoreHUD);

    // Simple Drawer (no buttons for now)
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
