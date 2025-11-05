/**
 * RMUFeatures/RMUSkills.js
 * Defines the main Skills panel, using an accordion and the shared search filter.
 */

const { ICONS, RMUUtils, RMUData, installListSearch } = window;

function catKeyOf(s) {
  return String(s ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

// Global state helpers retrieved from RMUData
const getOpenSkillsCategory = () => RMUData.getOpenSkillsCategory();
const setOpenSkillsCategory = (catOrNull) => RMUData.setOpenSkillsCategory(catOrNull);


export function defineSkillsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  // ── Header (category) tile ───────────────────────────────
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

      const headers = this._panelEl.querySelectorAll(".rmu-skill-header");
      headers.forEach(h => {
        const key = h.dataset.catKey || "";
        h.classList.toggle("open",   key === openKey);
        h.classList.toggle("closed", key !== openKey);
      });

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
        // ** RESTORED: Original Skill Tooltip **
        const sys = this.entry?.raw?.system ?? {};
        const details = [
          { label: "Total ranks",      value: sys._totalRanks },
          { label: "Rank bonus",       value: sys._rankBonus },
          { label: "Culture ranks",    value: sys.cultureRanks },
          { label: "Stat",             value: sys.stat },
          { label: "Stat bonus",       value: sys._statBonus },
          { label: "Prof bonus",       value: sys._professionalBonus }, // Corrected from original typo
          { label: "Knack",            value: sys._knack },
          { label: "Total bonus",      value: sys._bonus }
        ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");
        
        return {
          title: this.label,
          subtitle: sys.category ?? "",
          description: sys.description,
          details: RMUUtils.formatTooltipDetails(details) 
        };
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

        const sys = this.entry?.raw?.system ?? {};
        const isFav = (sys.favorite === true) || (this.entry?.favorite === true);
        this.element.dataset.favorite = isFav ? "true" : "false";
        if (isFav) {
          const chip = document.createElement("div");
          chip.className = "rmu-fav-chip";
          chip.title = "Favorite";
          this.element.classList.add("rmu-button-relative");
          this.element.appendChild(chip);
        }

        if (this._startHidden) this.element.style.display = "none";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0 || this.disabled) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /** Rolls the skill using the centralized API wrapper. (Used for Spell Mastery!) */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSkillAction",
        this.entry?.raw,
        undefined
      );
    }
  }

  // ── SKILLS category button (opens the accordion panel) ───
  class RMUSkillsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SKILLS";
      this._icon = ICONS.skills;
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
        UIGuards.attachPanelInteractionGuards(panel);
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
      UIGuards.attachPanelInteractionGuards(panel);
      UIGuards.attachPanelInputGuards(panel); 
      
      // Use the generalized search function for the Skills panel
      installListSearch(panel, ".rmu-skill-tile", ".rmu-skill-header", "skill");

      headerInstances.forEach(h => h._bindPanel(panel));

      setOpenSkillsCategory(null);
      requestAnimationFrame(() => {
        const el = panel.element;
        if (!el) return;
        el.querySelectorAll(".rmu-skill-tile").forEach(t => t.style.display = "none");
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