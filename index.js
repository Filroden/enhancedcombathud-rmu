// Enhanced Combat HUD — RMU system integration (clean build)

const MODULE_ID = "enhancedcombathud-rmu";

/* ──────────────────────────────────────────────────────────
   Boot logs (safe; no top-level game access)
────────────────────────────────────────────────────────── */
console.info("[ECH-RMU] index.js loaded");
Hooks.once("init",  () => console.info("[ECH-RMU] init"));
Hooks.once("setup", () => console.info("[ECH-RMU] setup"));
Hooks.once("ready", () => console.info("[ECH-RMU] ready"));

/* ──────────────────────────────────────────────────────────
   Settings (lightweight example; expand later if needed)
────────────────────────────────────────────────────────── */
function registerSettings() {
  game.settings.register(MODULE_ID, "showRMUSpecialActions", {
    name: "Show RMU Special Actions",
    hint: "Show common RMU manoeuvre buttons such as Parry/Full Parry/Disengage.",
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
    get classes() {
      return [...super.classes, "rmu"]; // .ech-tooltip.rmu {}
    }
  }

  CoreHUD.defineTooltip(RMUTooltip);
}

/* ──────────────────────────────────────────────────────────
   Portrait Panel (HP / PP / DB)
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
   Supported Actor Types (include both cases just-in-case)
────────────────────────────────────────────────────────── */
function defineSupportedActorTypes(CoreHUD) {
  CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

/* ──────────────────────────────────────────────────────────
   Movement HUD (Argon requires movementMax in squares)
────────────────────────────────────────────────────────── */
function defineMovementHud(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const MovementBase =
    ARGON?.MOVEMENT?.MovementHud ||
    ARGON?.MovementHud ||
    ARGON?.HUD?.MovementHud;

  if (!MovementBase) {
    console.warn("[ECH-RMU] MovementHud base not found; skipping.");
    return;
  }

  class RMUMovementHud extends MovementBase {
    // Selected mode & table access (from RMU)
    get _mv()      { return this.actor?.system?._movementBlock ?? {}; }
    get _modeKey() { return this._mv._selected; }                      // e.g., "Running"
    get _modeTbl() { return this._mv._table?.[this._modeKey] ?? null; }
    get _rates()   { return Array.isArray(this._modeTbl?.paceRates) ? this._modeTbl.paceRates : []; }
    _pace(name)    { return this._rates.find(r => r?.pace?.value === name) ?? null; }

    // BMR in feet per round = Walk perRound of the selected mode
    get baseMovement() {
      const walk = this._pace("Walk");
      return Number(walk?.perRound ?? 0); // e.g., 26
    }

    // Argon consumes movementMax in *squares* (int ≥ 1)
    get movementMax() {
      const feetPerRound = this.baseMovement;
      const gridDist = Number(canvas.scene?.grid?.distance ?? 5);
      const squares = feetPerRound / (gridDist || 5);
      return Math.max(1, Math.round(squares));
    }

    // Nice labels + compatibility aliases
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
   Drawer (placeholder)
────────────────────────────────────────────────────────── */
function defineDrawerPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;

  class RMUDrawer extends ARGON.DRAWER.DrawerPanel {
    get buttons() { return []; }
    get title()   { return "Actions"; }
  }

  CoreHUD.defineDrawerPanel(RMUDrawer);
}

/* ──────────────────────────────────────────────────────────
   Weapon Sets (silent stub removes warnings)
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
   Hook wiring
────────────────────────────────────────────────────────── */
function initConfig() {
  Hooks.on("updateItem", (item) => {
    if (item.parent === ui.ARGON?._actor && ui.ARGON?.rendered) {
      ui.ARGON.components.portrait.refresh();
    }
  });

  Hooks.on("argonInit", (CoreHUD) => {
    // Guard here (never at top level)
    if (game.system.id !== "rmu") return;

    defineTooltip(CoreHUD);
    definePortraitPanel(CoreHUD);
    defineSupportedActorTypes(CoreHUD);
    defineDrawerPanel(CoreHUD);
    defineWeaponSets(CoreHUD);
    defineMovementHud(CoreHUD);
  });
}

/* ──────────────────────────────────────────────────────────
   Boot
────────────────────────────────────────────────────────── */
Hooks.on("setup", () => {
  registerSettings();
  initConfig();
});
