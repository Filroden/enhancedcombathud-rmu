// Enhanced Combat HUD — RMU integration
// Portrait + Movement + (NEW) MAIN "Attacks" action panel grouped into Melee/Ranged/Natural/Shield

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
   NEW — MAIN "Attacks" Action Panel (appears to the right of the portrait)
   Pattern mirrors DnD: an ActionPanel that returns category buttons,
   and each category button opens a small panel of action buttons.
────────────────────────────────────────────────────────── */
function defineAttacksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel, ACCORDION } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;
  const { AccordionPanel, AccordionPanelCategory } = ACCORDION;

  // ---------- helpers ----------
  const asBool = (v) => !!(v === true || v === "true" || v === 1);

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

  function bucketOf(att) {
    const sName = String(att?.skill?.name ?? "").toLowerCase();
    const sSpec = String(att?.skill?.specialization ?? att?.skill?.specialisation ?? "").toLowerCase();
    const sType = String(att?.subType ?? att?.type ?? att?.category ?? att?.attackType ?? "").toLowerCase();

    const hasRangeField =
      !!(att?.range?.short || att?.range?.max || att?.usage?.range || att?.rangeInterval);

    // Shield (explicit)
    if (sName.includes("shield") || sSpec.includes("shield") || sType.includes("shield")) return "shield";

    // Natural / Unarmed (Strikes)
    if (
      sName.includes("strike") || sSpec.includes("strike") ||
      sName.includes("unarmed") || sSpec.includes("unarmed") ||
      sType.includes("natural") || att?.isNatural === true
    ) return "natural";

    // Ranged (range field OR common keywords)
    if (
      hasRangeField ||
      sName.includes("ranged") || sType.includes("ranged") ||
      sName.includes("missile") || sType.includes("missile") ||
      sName.includes("thrown")  || sType.includes("thrown")  ||
      sName.includes("bow")     || sType.includes("bow")     ||
      sName.includes("crossbow")|| sType.includes("crossbow")||
      sName.includes("sling")   || sType.includes("sling")   ||
      sName.includes("dart")    || sType.includes("dart")
    ) return "ranged";

    // Default
    return "melee";
  }

  function getShortRange(arr) {
    if (!Array.isArray(arr)) return "—";
    // find the "Short" entry (case-insensitive)
    const short = arr.find(r => String(r.label).toLowerCase() === "short");
    if (!short) return "—";
    const dist = short.distance || (short.distInFt != null ? `${short.distInFt}'` : short.dist ?? "");
    return dist ? `${dist}` : "—";
  }

  // Route helper (handles sub-path deployments too)
  const CORE_ICON = (p) => (foundry?.utils?.getRoute ? foundry.utils.getRoute(p) : p);

  // Default icons per category (from Foundry core)
  const DEFAULT_ICONS = {
    melee:   CORE_ICON("icons/skills/melee/maneuver-sword-katana-yellow.webp"),
    ranged:  CORE_ICON("icons/skills/ranged/person-archery-bow-attack-orange.webp"),
    natural: CORE_ICON("icons/skills/melee/unarmed-punch-fist-yellow-red.webp"),
    shield:  CORE_ICON("icons/skills/melee/shield-block-gray-yellow.webp")
  };

  const CATS = [
    { key: "melee",   label: "Melee",   icon: DEFAULT_ICONS.melee   },
    { key: "ranged",  label: "Ranged",  icon: DEFAULT_ICONS.ranged  },
    { key: "natural", label: "Natural", icon: DEFAULT_ICONS.natural },
    { key: "shield",  label: "Shield",  icon: DEFAULT_ICONS.shield  }
  ];

  // ---------- attack tile ----------
  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey; // "melee" | "ranged" | "natural" | "shield"
    }

    get label() { return this.attack?.attackName ?? this.attack?.name ?? "Attack"; }

    get icon() { return this.attack?.img || DEFAULT_ICONS[this._catKey] || CORE_ICON("icons/svg/sword.svg"); }

    get _equipped() {
      const a = this.attack ?? {};
      return asBool(a.isEquipped ?? a.readyState ?? a.equipped ?? a.isReady);
    }
    get classes() {
      const c = super.classes.slice();
      if (!this._equipped) c.push("disabled");
      return c;
    }

    get hasTooltip() { return true; }
    async getTooltipData() {
      const a = this.attack ?? {};
      const shortRange = getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range);
      const kv = [
        ["Specialisation", a.specialization],
        ["Size",           a.sizeAdjustment],
        ["Chart",          a.chart?.name],
        ["Fumble",         a.fumble],
        ["Melee reach",    a.meleeRange],
        ["Range interval", shortRange],
        ["STR",            a.itemStrength],
        ["Ranks",          a.skill?.ranks],
        ["2H",             (Number(a.twoHandedBonus) === 10 ? "Yes" : "No")],
        ["Bonus OB",       a.itemBonus],
        ["Total OB",       a.totalBonus]
      ].filter(([,v]) => v !== undefined && v !== null && v !== "");

      const details = kv.map(([label, value]) => ({ label, value }));

      const description =
        `<table class="rmu-tt"><tbody>` +
        kv.map(([k,v]) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`).join("") +
        `</tbody></table>`;

      return {
        title: this.label,
        subtitle: a.skill?.name ?? "",
        description,  // HTML block (nice on desktop)
        details       // also provide structured details to match tooltip API
      };
    }


    async _onLeftClick(event) {
      if (!this._equipped) return ui.notifications?.warn?.(`${this.label} is not equipped.`);
      ui.notifications?.info?.(`[RMU] Rolling "${this.label}" coming soon.`);
      // TODO: replace with real roll API when the system exposes it
      // await game.system.rmu.rollAttack({ token: ui.ARGON._token, attack: this.attack });
    }
  }

  // ---------- category buttons (each opens a small panel) ----------
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
      // Build the attack action buttons for this category.
      const buttons = this._attacks.map(a => new RMUAttackActionButton(a, this.key));
      return new ButtonPanel({
        id: `rmu-attacks-${this.key}`,
        buttons
      });
    }
  }


  // ---------- MAIN action panel ----------
  class RMUAttacksActionPanel extends ActionPanel {
    get label() { return "Attacks"; }
    get maxActions() { return null; }
    get currentActions() { return null; }

    async _getButtons() {
      // Ensure token has extended fields (async derive) before reading _attacks
      await ensureExtendedTokenData();
      const all = getTokenAttacks();

      // bucket attacks
      const buckets = new Map(CATS.map(c => [c.key, []]));
      for (const atk of all) {
        const key = bucketOf(atk);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(atk);
      }

      // sort each bucket: equipped first, then name
      for (const [k, list] of buckets.entries()) {
        list.sort((a,b) => {
          const ea = asBool(a.isEquipped ?? a.readyState);
          const eb = asBool(b.isEquipped ?? b.readyState);
          if (ea !== eb) return ea ? -1 : 1;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });
      }

      // build 4 category buttons (only ones with contents will render)
      const buttons = CATS.map(c =>
        new RMUAttackCategoryButton({
          key: c.key,
          label: c.label,
          icon: c.icon,
          attacks: buckets.get(c.key) || []
        })
      );

      // Filter empty categories so we don't show dead toggles
      return buttons.filter(b => b.hasContents);
    }
  }

  // Register this MAIN panel so it renders to the right of the portrait
  CoreHUD.defineMainPanels([RMUAttacksActionPanel]);
}

/* ──────────────────────────────────────────────────────────
   Drawer Panel (kept simple; Attacks live in MAIN now)
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

    // NEW: Attacks as a MAIN panel (to the right of the portrait)
    defineAttacksMain(CoreHUD);

    // Keep a simple Drawer (no Attacks in drawer)
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
