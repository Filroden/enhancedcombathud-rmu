/**
 * RMUFeatures/RMUSpells.js
 * Defines the main Spellcasting panel, using a single-level accordion and a shared search filter
 * to allow for global spell searching.
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

  // ──── Level 2: Individual Spell Tile (SCR Roll) ──────────────────────────
  // (This class remains unchanged from your version)
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
    get icon() { return ""; }
    get isInteractive() { return true; }
    
    get classes() {
      if (this.spell && this.spell.spellAttack) return [...super.classes, "rmu-list-item", "hidden"];
      return [...super.classes, "rmu-list-item"];
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
        { label: "SCR",         value: s.scr }
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
      const scr = this.spell.scr ?? "";
      RMUUtils.applyValueOverlay(this.element, `SCR: ${window.formatBonus(scr)}`, null);
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
    }
  }

  // ──── Level 1: Spell List Header (Accordion) ──────────────────────────
  class RMUSpellListButton extends ActionButton {
    constructor(listKey, spells, listTypeKey) {
      super();
      this._listKey = listKey;
      this._spells = spells;
      this._listTypeKey = listTypeKey;
      this._panelEl = null; 
    }

    /** UPDATED: Label is now prefixed with the list type */
    get label() { return `${this._listTypeKey}: ${this._listKey}`; }

    get icon() { return ""; }
    get isInteractive() { return true; }
    get hasTooltip() { return false; }

    get classes() {
      const { type: openType, name: openName } = getOpenSpellState();
      const isOpen = openType === this._listTypeKey && openName === this._listKey;
      return [...super.classes, "rmu-skill-header", "rmu-spell-list-header", isOpen ? "open" : "closed"];
    }

    _bindPanel(panel) {
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        this._applyVisibility_GLOBAL(); // Use global updater
      };
      requestAnimationFrame(tryBind);
    }
    
    /** NEW: Global visibility updater for the single unified panel */
    _applyVisibility_GLOBAL() {
      if (!this._panelEl) return;
      const { type: openType, name: openName } = getOpenSpellState();

      // Update ALL headers in the panel
      const headers = this._panelEl.querySelectorAll(`.rmu-spell-list-header`);
      headers.forEach(h => {
        const hType = h.dataset.listTypeKey || "";
        const hName = h.dataset.listNameKey || "";
        const isOpen = (hType === openType && hName === openName);
        h.classList.toggle("open", isOpen);
        h.classList.toggle("closed", !isOpen);
      });

      // Update ALL spell tiles in the panel
      const tiles = this._panelEl.querySelectorAll(`.rmu-list-item`);
      tiles.forEach(t => {
        const tType = t.dataset.listTypeKey || "";
        const tName = t.dataset.listNameKey || "";
        // Show tile if its keys match the *single* open header
        const visible = (tType === openType && tName === openName) && !t.classList.contains("hidden");
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
        // Use the new prefixed label for search normalization
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listKey;
        this.element.dataset.favorite = "false"; 
      }
    }

    /** UPDATED: Click logic for a single unified panel */
    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { type: openType, name: openName } = getOpenSpellState();
      
      const isOpen = openType === this._listTypeKey && openName === this._listKey;
      
      // Set state to this button's keys, or null if closing
      setOpenSpellState(isOpen ? null : this._listTypeKey, isOpen ? null : this._listKey);
      
      // Apply visibility update to all items in the panel
      this._applyVisibility_GLOBAL();
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  // ──── DELETED: RMUSpellListTypeButton (Level 1) class is removed ────

  // ──── NEW: "Spells (SCR)" category button (opens the single panel) ───
  class RMUAllSpellsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SPELLS (SCR)"; // New title
      this._icon = ICONS.spells;
    }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      await RMUData.ensureRMUReady();
      // Fetches Map<ListType, Map<ListName, Spells>>
      const allSpellsByListType = RMUData.getGroupedSpellsForHUD(); 

      // 1. Flatten the data structure into a single array
      const flatSpellLists = [];
      for (const [listType, groupedSpells] of allSpellsByListType.entries()) {
        for (const [listName, spells] of groupedSpells.entries()) {
          if (spells.length > 0) {
            flatSpellLists.push({
              listKey: listName,
              listType: listType,
              spells: spells
            });
          }
        }
      }

      // Handle case with no spells
      if (!flatSpellLists.length) {
        const empty = new (class NoSpellsButton extends ActionButton {
          get label() { return "No spells known"; }
          get icon()  { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        const panel = new ButtonPanel({ id: "rmu-spells-all", buttons: [empty] });
        UIGuards.attachPanelInteractionGuards(panel);
        return panel;
      }

      // 2. **CUSTOM SORTING LOGIC**
      // This answers your primary question.
      const listOrder = { "Base": 1, "Open": 2, "Closed": 3, "Arcane": 4, "Restricted": 5 };
      
      flatSpellLists.sort((a, b) => {
        const rankA = listOrder[a.listType] || 99; // Get rank or assign 99 for fallbacks
        const rankB = listOrder[b.listType] || 99;

        if (rankA !== rankB) {
          return rankA - rankB; // Sort by type order (Base, Open, etc.)
        }
        
        // If types are the same, sort alphabetically by list name
        return a.listKey.localeCompare(b.listKey); 
      });

      // 3. Build the buttons from the sorted flat list
      const allButtons = [];
      const headerInstances = [];

      for (const list of flatSpellLists) {
        // Create the Lvl 1 header (e.g., "Base: Blood Mastery")
        const header = new RMUSpellListButton(list.listKey, list.spells, list.listType);
        headerInstances.push(header);
        allButtons.push(header);

        // Create all Lvl 2 spell tiles for that list
        for (const spell of list.spells) {
          allButtons.push(new RMUSpellActionButton(spell, true)); // Start hidden
        }
      }

      // 4. Create the panel
      const panel = new ButtonPanel({ id: "rmu-spells-all", buttons: allButtons });
      UIGuards.attachPanelInteractionGuards(panel); 
      UIGuards.attachPanelInputGuards(panel); 
      
      // 5. Install the *global* search bar
      installListSearch(panel, ".rmu-list-item", ".rmu-spell-list-header", "spell");

      // 6. Bind panels and set initial state
      headerInstances.forEach(h => h._bindPanel(panel));
      setOpenSpellState(null, null); // Start with all accordions closed
      
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

  // ──── DELETED: RMUSpellsActionPanel is replaced ────

  // ──── NEW: ActionPanel (the entry point) ──────────────────────────
  class RMUSpellsActionPanel extends ActionPanel {
    get label() { return "SPELLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    // Returns the single "SPELLS (SCR)" button
    async _getButtons() { return [ new RMUAllSpellsCategoryButton() ]; }
  }

  // Re-define the main panel with the new structure
  CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}