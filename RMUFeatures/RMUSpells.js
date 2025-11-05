/**
 * RMUFeatures/RMUSpells.js
 * Defines the main Spellcasting panel, using a two-level accordion and a shared search filter.
 */

const { ICONS, RMUUtils, RMUData, installListSearch } = window;

// Main function to define the Spells panel
export function defineSpellsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  const getOpenSpellState = RMUData.getOpenSpellState;
  const setOpenSpellState = RMUData.setOpenSpellState;

  // ──── Level 3: Individual Spell Tile (SCR Roll) ──────────────────────────
  class RMUSpellActionButton extends ActionButton {
    constructor(spell, startHidden = false) {
      super();
      this.spell = spell;
      this._startHidden = !!startHidden;
      if (spell) {
        this._listKey = spell._rawListInfo.listKey;
        this._listTypeKey = spell._rawListInfo.listType;
      }
    }
    
    get label() { return `${this.spell.name} (Lvl ${this.spell.level})`; }
    
    get icon() { return ICONS.spells; }
    
    get isInteractive() { return true; }
    get classes() {
      if (this.spell && this.spell.spellAttack) return [...super.classes, "rmu-spell-tile", "hidden"];
      return [...super.classes, "rmu-spell-tile"];
    }

  get hasTooltip() { return true; }
    async getTooltipData() {
      const s = this.spell;
      if (!s) return { title: "Spell", subtitle: "", details: [] };

      // 1. Special fallback for Duration (handles inconsistent data structure)
      const duration = s._modifiedDuration?.duration || s._modifiedDuration?.dur?.duration || s.duration;

      // 2. Standard fallbacks for AoE and Range
      const aoe = s._modifiedAoE?.aoe || s.aoe;
      const range = s._modifiedRange?.range || s.range;

      const details = [
        { label: "List type",   value: s.listType },
        { label: "Realm(s)",    value: s.realms },
        { label: "AoE",         value: aoe },
        { label: "Duration",    value: duration },
        { label: "Range",       value: range },
        { label: "Spell type",  value: s.spellType },
        { label: "SCR",         value: s.scr }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== ""); // Filters out any empty fields

      return { 
        title: s.name, 
        subtitle: `Lvl ${s.level} - ${s.spellList}`, 
        description: s.description,
        details: RMUUtils.formatTooltipDetails(details) // Calls the core formatter
      };
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;
      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = "pointer";
      
      RMUUtils.applyValueOverlay(this.element, this.spell.scr ?? "", "SCR");

      const s = this.spell;
      const listInfo = s._rawListInfo || {};
      const nameNorm = (`${s.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${s.level}`).toLowerCase();
      
      this.element.dataset.listTypeKey = this._listTypeKey;
      this.element.dataset.listNameKey = this._listKey;
      this.element.dataset.nameNorm = nameNorm;
      this.element.dataset.favorite = s.favorite === true ? "true" : "false"; 

      // ** CRITICAL FIX (Bug 2): Set the catKey to match the header's key **
      this.element.dataset.catKey = this._listKey;

      // Favorite chip
      if (s.favorite === true) {
        const chip = document.createElement("div");
        chip.className = "rmu-fav-chip";
        chip.title = "Favorite";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(chip);
      }
      
      if (this._startHidden) {
        this.element.style.display = "none";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /** Rolls the Spell Casting Roll (SCR) using the centralized API wrapper. */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSCRAction",
        this.spell
      );
      if (typeof game.system?.api?.rmuTokenSCRAction !== "function") {
         ui.notifications?.info?.(`Spell Casting Roll for ${this.spell.name} triggered (rmuTokenSCRAction API TBD).`);
      }
    }
  }

  // ──── Level 2: Spell List Header (Accordion) ──────────────────────────
  class RMUSpellListButton extends ActionButton {
    constructor(listKey, spells, listTypeKey) {
      super();
      this._listKey = listKey;
      this._spells = spells;
      this._listTypeKey = listTypeKey;
      this._panelEl = null; 
    }

    get label() { return this._listKey; }

    get icon() { return ""; }

    get isInteractive() { return true; }
    get classes() {
      const { type: openType, name: openName } = getOpenSpellState();
      const isOpen = openType === this._listTypeKey && openName === this._listKey;
      return [...super.classes, "rmu-skill-header", "rmu-spell-list-header", isOpen ? "open" : "closed"];
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
      const { type: openType, name: openName } = getOpenSpellState();
      
      const headers = this._panelEl.querySelectorAll(`[data-list-type-key="${this._listTypeKey}"].rmu-spell-list-header`);
      headers.forEach(h => {
        const key = h.dataset.listNameKey || "";
        h.classList.toggle("open", key === openName);
        h.classList.toggle("closed", key !== openName);
      });

      const tiles = this._panelEl.querySelectorAll(`[data-list-type-key="${this._listTypeKey}"].rmu-spell-tile`);
      tiles.forEach(t => {
        const key = t.dataset.listNameKey || "";
        const visible = !!openName && (key === openName) && !t.classList.contains("hidden");
        t.style.display = visible ? "" : "none";
      });
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listTypeKey;
        this.element.dataset.listNameKey = this._listKey;
        this.element.dataset.nameNorm = (this._listKey + " " + this._listTypeKey).toLowerCase();
        
        // ** CRITICAL FIX (Bug 2): Set the catKey to the unique list name **
        this.element.dataset.catKey = this._listKey;
        
        this.element.dataset.favorite = "false"; 
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { type: openType, name: openName } = getOpenSpellState();
      
      const isOpen = openType === this._listTypeKey && openName === this._listKey;
      setOpenSpellState(isOpen ? this._listTypeKey : this._listTypeKey, isOpen ? null : this._listKey);
      this._applyVisibility();
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  // ──── Level 1: List Type Button (Main Panel Header) ──────────────────────────
  class RMUSpellListTypeButton extends ButtonPanelButton {
    constructor(listTypeKey, groupedSpells) {
      super();
      this.listTypeKey = listTypeKey;
      this.title = `${listTypeKey.toUpperCase()} SPELLS`;
      this._icon = ICONS.spells;
      this._groupedSpells = groupedSpells;
      this.spellListsCount = groupedSpells.size;
    }

    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return this.spellListsCount > 0; }
    get isInteractive() { return true; }

    async _getPanel() {
      const allButtons = [];
      const headerInstances = [];

      const sortedListNames = Array.from(this._groupedSpells.keys()).sort((a,b) => a.localeCompare(b));

      for (const listKey of sortedListNames) {
        const spells = this._groupedSpells.get(listKey);
        
        const header = new RMUSpellListButton(listKey, spells, this.listTypeKey);
        headerInstances.push(header);
        allButtons.push(header);

        for (const spell of spells) {
          allButtons.push(new RMUSpellActionButton(spell, true));
        }
      }
      
      const panel = new ButtonPanel({ id: `rmu-spells-${this.listTypeKey}`, buttons: allButtons });
      UIGuards.attachPanelInteractionGuards(panel); 
      UIGuards.attachPanelInputGuards(panel); 
      
      // Use the generalized search function
      installListSearch(panel, ".rmu-spell-tile", ".rmu-spell-list-header", "spell");

      headerInstances.forEach(h => h._bindPanel(panel));

      // Initial state management
      setOpenSpellState(this.listTypeKey, null);
      requestAnimationFrame(() => {
        const el = panel.element;
        if (!el) return;
        
        el.querySelectorAll(".rmu-spell-tile").forEach(t => t.style.display = "none");

        el.querySelectorAll(".rmu-spell-list-header").forEach(h => {
          h.classList.remove("open");
          h.classList.add("closed");
        });
      });

      return panel;
    }
  }

  class RMUSpellsActionPanel extends ActionPanel {
    get label() { return "SPELLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() {
      await RMUData.ensureRMUReady();
      const allSpellsByListType = RMUData.getGroupedSpellsForHUD();

      const buttons = [];
      for (const [listType, groupedSpells] of allSpellsByListType.entries()) {
        if (groupedSpells.size > 0) {
          buttons.push(new RMUSpellListTypeButton(listType, groupedSpells));
        }
      }
      
      buttons.sort((a, b) => {
        const order = ["Base", "Open", "Closed", "Arcane", "Restricted"];
        return order.indexOf(a.listTypeKey) - order.indexOf(b.listTypeKey);
      });
      
      return buttons;
    }
  }

  CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}