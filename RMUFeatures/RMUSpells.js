/**
 * RMUFeatures/RMUSpells.js
 * Defines the main Spellcasting panel (3-Level Nested Accordion)
 */

const { ICONS, RMUUtils, RMUData, installListSearch } = window;

const getOpenSpellState = RMUData.getOpenSpellState;
const setOpenSpellState = RMUData.setOpenSpellState;

/**
 * SHARED VISIBILITY LOGIC
 * This function is now defined once and passed to the headers.
 * This fixes the bug where L2 headers would hide on click.
 */
function applyAccordionVisibility(panelEl) {
  if (!panelEl) return;
  const { type: openType, name: openName } = getOpenSpellState();

  // L1 Headers (Spell Types)
  panelEl.querySelectorAll(`.rmu-spell-type-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const isOpen = (hType === openType);
    h.classList.toggle("open", isOpen);
    h.classList.toggle("closed", !isOpen);
  });
  
  // L2 Headers (Spell Lists)
  panelEl.querySelectorAll(`.rmu-spell-list-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const hName = h.dataset.listNameKey || "";
    
    const isMyParentOpen = (hType === openType);
    const isMeOpen = (isMyParentOpen && hName === openName);

    h.style.display = isMyParentOpen ? "" : "none"; 
    h.classList.toggle("open", isMeOpen);
    h.classList.toggle("closed", !isMeOpen);
  });

  // L3 Tiles (Spells)
  panelEl.querySelectorAll(`.rmu-spell-tile`).forEach(t => {
    const tType = t.dataset.listTypeKey || "";
    const tName = t.dataset.listNameKey || "";
    
    // Show only if my Type and Name both match the open state
    const visible = (tType === openType && tName === openName) && !t.classList.contains("hidden");
    t.style.display = visible ? "" : "none";
  });
}


export function defineSpellsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  // ──── L3: Individual Spell Tile (SCR Roll) ──────────────────────────
  class RMUSpellActionButton extends ActionButton {
    constructor(spell) {
      super();
      this.spell = spell;
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
      const duration = s._modifiedDuration?.duration || s._modifiedDuration?.dur?.duration || s.duration;
      const aoe = s._modifiedAoE?.aoe || s.aoe;
      const range = s._modifiedRange?.range || s.range;
      const details = [
        { label: "List type",   value: s.listType },
        { label: "Realm(s)",    value: s.realms },
        { label: "AoE",         value: aoe },
        { label: "Duration",    value: duration },
        { label: "Range",       value: range },
        { label: "Spell type",  value: s.spellType },
        { label: "SCR",         value: s.scr },
        { label: "Level",       value: s.level }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return { 
        title: s.name, 
        subtitle: `Lvl ${s.level} - ${s.spellList}`, 
        description: s.description,
        details: RMUUtils.formatTooltipDetails(details)
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
      this.element.dataset.catKey = this._listKey;

      if (s.favorite === true) {
        const chip = document.createElement("div");
        chip.className = "rmu-fav-chip";
        chip.title = "Favorite";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(chip);
      }
      
      this.element.style.display = "none";
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSCRAction",
        this.spell
      );
    }
  }

  // ──── L2: Spell List Name Header (e.g., "Blood Mastery") ──────────────────
  class RMUSpellListButton extends ActionButton {
    constructor(listName, spells, listTypeKey) {
      super();
      this._listName = listName;
      this._spells = spells;
      this._listTypeKey = listTypeKey;
      this._panelEl = null; 
    }

    get label() { return this._listName; }
    get icon() { return ""; }
    get isInteractive() { return true; }
    get hasTooltip() { return false; }

    get classes() {
      const { type: openType, name: openName } = getOpenSpellState();
      const isOpen = openType === this._listTypeKey && openName === this._listName;
      return [...super.classes, "rmu-skill-header", "rmu-spell-list-header", isOpen ? "open" : "closed"];
    }

    _bindPanel(panel) {
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        applyAccordionVisibility(this._panelEl); 
      };
      requestAnimationFrame(tryBind);
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listTypeKey;
        this.element.dataset.listNameKey = this._listName;
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listName;
        this.element.dataset.favorite = "false";
        this.element.style.display = "none";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { name: openName } = getOpenSpellState();
      const isOpen = openName === this._listName;
      
      setOpenSpellState(this._listTypeKey, isOpen ? null : this._listName);
      
      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  // ──── L1: Spell List Type Header (e.g., "Base") ───────────────────────
  class RMUSpellListTypeButton extends ActionButton {
    constructor(listType) {
      super();
      this._listType = listType;
      this._panelEl = null;
    }
    
    get label() { return this._listType; }
    get icon() { return ""; }
    get isInteractive() { return true; }
    get hasTooltip() { return false; }
    
    get classes() {
      const { type: openType } = getOpenSpellState();
      const isOpen = openType === this._listType;
      return [...super.classes, "rmu-skill-header", "rmu-spell-type-header", isOpen ? "open" : "closed"];
    }
    
    _bindPanel(panel) {
      // ** FIX 1: Simplified bind. No longer errors.**
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        applyAccordionVisibility(this._panelEl);
      };
      requestAnimationFrame(tryBind);
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listType;
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listType;
        this.element.dataset.favorite = "false";
      }
    }
    
    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { type: openType } = getOpenSpellState();
      const isOpen = openType === this._listType;
      
      setOpenSpellState(isOpen ? null : this._listType, null);
      
      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }


  // ──── "Spells (SCR)" category button (The main L0 entry point) ───
  class RMUAllSpellsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SPELLS (SCR)";
      this._icon = ICONS.spells;
    }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      // 1. Set the initial state to fully closed.
      setOpenSpellState(null, null); 

      await RMUData.ensureRMUReady();
      const allSpellsByListType = RMUData.getGroupedSpellsForHUD();

      if (!allSpellsByListType.size) {
        const empty = new (class NoSpellsButton extends ActionButton {
          get label() { return "No spells known"; }
          get icon()  { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        return new ButtonPanel({ id: "rmu-spells-all", buttons: [empty] });
      }

      const listOrder = { "Base": 1, "Open": 2, "Closed": 3, "Arcane": 4, "Restricted": 5 };
      const sortedListTypes = Array.from(allSpellsByListType.keys()).sort((a, b) => {
        const rankA = listOrder[a] || 99;
        const rankB = listOrder[b] || 99;
        return rankA - rankB;
      });

      const allButtons = [];

      for (const listType of sortedListTypes) {
        const listMap = allSpellsByListType.get(listType);
        allButtons.push(new RMUSpellListTypeButton(listType));
        const sortedListNames = Array.from(listMap.keys()).sort((a,b) => a.localeCompare(b));
        for (const listName of sortedListNames) {
          const spells = listMap.get(listName);
          allButtons.push(new RMUSpellListButton(listName, spells, listType));
          for (const spell of spells) {
            allButtons.push(new RMUSpellActionButton(spell));
          }
        }
      }

      const panel = new ButtonPanel({ id: "rmu-spells-all", buttons: allButtons });
      UIGuards.attachPanelInteractionGuards(panel); 
      UIGuards.attachPanelInputGuards(panel); 
      
      // 2. Install search (this will incorrectly set L2 headers to display: "")
      installListSearch(panel, ".rmu-spell-tile", ".rmu-spell-type-header, .rmu-spell-list-header", "spell");

      // 3. ** Force the panel to render its DOM *now* by accessing .element **
      const panelEl = panel.element;
      
      // 4. Manually bind all headers to the panel element.
      const allHeaderInstances = allButtons.filter(b => 
        b instanceof RMUSpellListTypeButton || b instanceof RMUSpellListButton
      );
      allHeaderInstances.forEach(h => h._panelEl = panelEl);
      
      // 5. Run the visibility logic *synchronously*.
      applyAccordionVisibility(panelEl);
      
      return panel;
    }
  }

  // ──── ActionPanel (the entry point) ──────────────────────────
  class RMUSpellsActionPanel extends ActionPanel {
    get label() { return "SPELLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUAllSpellsCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}