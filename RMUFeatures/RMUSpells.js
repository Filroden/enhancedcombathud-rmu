/**
 * RMUFeatures/RMUSpells.js
 * Defines the main Spellcasting panel (3-Level Nested Accordion)
 * for rolling Static Caster Rolls (SCR).
 */

import { ICONS, RMUUtils, installListSearch, UIGuards } from '../RMUCore.js';
import { RMUData } from '../RMUData.js';

// Global state helpers
const getOpenSpellState = RMUData.getOpenSpellState;
const setOpenSpellState = RMUData.setOpenSpellState;

/**
 * Applies visibility to the 3-level accordion based on global state.
 * This is the core logic for the nested accordion.
 * @param {HTMLElement} panelEl - The panel's DOM element.
 */
function applyAccordionVisibility(panelEl) {
  if (!panelEl) return;
  const { type: openType, name: openName } = getOpenSpellState();

  // L1 Headers (Spell Types, e.g., "Base", "Open")
  panelEl.querySelectorAll(`.rmu-spell-type-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const isOpen = (hType === openType);
    h.classList.toggle("open", isOpen);
    h.classList.toggle("closed", !isOpen);
  });

  // L2 Headers (Spell Lists, e.g., "Blood Mastery")
  panelEl.querySelectorAll(`.rmu-spell-list-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const hName = h.dataset.listNameKey || "";

    const isMyParentOpen = (hType === openType);
    const isMeOpen = (isMyParentOpen && hName === openName);

    // L2 headers are always visible, but dimmed if parent is closed
    h.style.display = "";
    h.classList.toggle("open", isMeOpen);
    h.classList.toggle("closed", !isMeOpen);
    h.style.opacity = isMyParentOpen ? "1" : "0.6";
  });

  // L3 Tiles (Spells, e.g., "Awakening")
  panelEl.querySelectorAll(`.rmu-spell-tile`).forEach(t => {
    const tType = t.dataset.listTypeKey || "";
    const tName = t.dataset.listNameKey || "";

    // Show only if my Type and Name both match the open state
    // AND the tile is not hidden by the search filter.
    const isSearchHidden = t.classList.contains("hidden"); // (Handled by search)
    const visible = (tType === openType && tName === openName) && !isSearchHidden;
    t.style.display = visible ? "" : "none";
  });
}

/**
 * Defines and registers the main Spells (SCR) panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSpellsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

  /**
   * L3: An action button for a single spell, to make an SCR roll.
   * @augments ActionButton
   */
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
    get icon() { return ICONS.spells_muted; }
    get isInteractive() { return true; }

    get classes() {
      // Hide spell-attack spells from this panel (they are in the Attacks panel)
      if (this.spell && this.spell.spellAttack) {
        return [...super.classes, "rmu-spell-tile", "hidden"];
      }
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
        { label: "List type", value: s.listType },
        { label: "Realm(s)", value: s.realms },
        { label: "AoE", value: aoe },
        { label: "Duration", value: duration },
        { label: "Range", value: range },
        { label: "Spell type", value: s.spellType },
        { label: "SCR", value: s.scr },
        { label: "Level", value: s.level }
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

      const s = this.spell;

      // Check for filterable properties
      const modifiersStr = s.modifiers || "";
      const isInstant = modifiersStr.includes("*");
      const spellTypeStr = s.spellType || "";
      const isSubconscious = spellTypeStr.substring(1).includes("s");
      // const isFavorite = s.favorite === true; // Re-enable when favourites are implemented in RMU

      // Add data-attributes for filtering
      this.element.dataset.isInstant = isInstant ? "true" : "false";
      this.element.dataset.isSubconscious = isSubconscious ? "true" : "false";
      // this.element.dataset.favorite = isFavorite ? "true" : "false"; // Re-enable when favourites are implemented in RMU

      // Add chips (Fav, Instant, Subconscious)
      const chips = [];
      // --- MODIFIED --- (Removed 'isFavorite' from the check)
      /* --- Re-enable when favourites are implemented in RMU ---
      if (isFavorite) {
        chips.push({ class: "rmu-fav-chip", title: "Favorite" });
      }
      */
      if (isInstant) {
        chips.push({ class: "rmu-instant-chip", title: "Instantaneous" });
      }
      if (isSubconscious) {
        chips.push({ class: "rmu-subconscious-chip", title: "Sub-conscious" });
      }
      RMUUtils.buildChipContainer(this.element, chips);

      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = "pointer";

      // Apply SCR bonus overlay
      RMUUtils.applyValueOverlay(this.element, this.spell.scr ?? "", "SCR");

      // Add data-attributes for searching and accordion logic
      const listInfo = s._rawListInfo || {};
      const nameNorm = (`${s.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${s.level}`).toLowerCase();

      this.element.dataset.listTypeKey = this._listTypeKey;
      this.element.dataset.listNameKey = this._listKey;
      this.element.dataset.nameNorm = nameNorm;
      this.element.dataset.catKey = this._listKey; // For search header logic
      this.element.style.display = "none"; // Start hidden
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /**
     * Rolls the Static Caster Roll (SCR) for this spell.
     */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSCRAction",
        this.spell
      );
    }
  }

  /**
   * L2: An accordion header for a Spell List (e.g., "Blood Mastery").
   * @augments ActionButton
   */
  class RMUSpellListButton extends ActionButton {
    constructor(listName, listTypeKey) {
      super();
      this._listName = listName;
      this._listTypeKey = listTypeKey;
      this._panelEl = null; // Reference to the parent panel's element
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

    /**
     * Binds the parent panel's element to this button.
     * @param {HTMLElement} panelEl - The parent panel's DOM element.
     */
    _bindPanel(panelEl) {
      this._panelEl = panelEl;
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listTypeKey;
        this.element.dataset.listNameKey = this._listName;
        // Add data for search filtering
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listName; // For search header logic
        this.element.dataset.favorite = "false";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { name: openName } = getOpenSpellState();
      const isOpen = openName === this._listName;

      // Toggle this L2 list
      setOpenSpellState(this._listTypeKey, isOpen ? null : this._listName);

      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /**
   * L1: An accordion header for a Spell List Type (e.g., "Base").
   * @augments ActionButton
   */
  class RMUSpellListTypeButton extends ActionButton {
    constructor(listType) {
      super();
      this._listType = listType;
      this._panelEl = null; // Reference to the parent panel's element
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

    /**
     * Binds the parent panel's element to this button.
     * @param {HTMLElement} panelEl - The parent panel's DOM element.
     */
    _bindPanel(panelEl) {
      this._panelEl = panelEl;
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listType;
        // Add data for search filtering
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listType; // For search header logic
        this.element.dataset.favorite = "false";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.stopImmediatePropagation();

      const { type: openType } = getOpenSpellState();
      const isOpen = openType === this._listType;

      // Toggle this L1 list (and close any L2 list)
      setOpenSpellState(isOpen ? null : this._listType, null);

      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }


  /**
   * L0: The category button that opens the main Spells (SCR) panel.
   * @augments ButtonPanelButton
   */
  class RMUAllSpellsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SPELLS (SCR)";
      this._icon = ICONS.spells;
    }
    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      // 1. Set the initial state to fully closed.
      setOpenSpellState(null, null);

      await RMUData.ensureRMUReady();
      const allSpellsByListType = RMUData.getGroupedSpellsForHUD();

      // Handle empty state
      if (!allSpellsByListType.size) {
        const empty = new (class NoSpellsButton extends ActionButton {
          get label() { return "No spells known"; }
          get icon() { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        return new ButtonPanel({ id: "rmu-spells-all", buttons: [empty] });
      }

      // Sort L1 types (Base, Open, Closed, etc.)
      const listOrder = { "Base": 1, "Open": 2, "Closed": 3, "Arcane": 4, "Restricted": 5 };
      const sortedListTypes = Array.from(allSpellsByListType.keys()).sort((a, b) => {
        const rankA = listOrder[a] || 99;
        const rankB = listOrder[b] || 99;
        return rankA - rankB;
      });

      const allButtons = [];
      const allHeaderInstances = [];

      // Build the 3-level list of buttons (L1, L2, L3)
      for (const listType of sortedListTypes) {
        const listMap = allSpellsByListType.get(listType);
        const l1Button = new RMUSpellListTypeButton(listType);
        allButtons.push(l1Button);
        allHeaderInstances.push(l1Button);

        const sortedListNames = Array.from(listMap.keys()).sort((a, b) => a.localeCompare(b));
        for (const listName of sortedListNames) {
          const spells = listMap.get(listName);
          const l2Button = new RMUSpellListButton(listName, listType);
          allButtons.push(l2Button);
          allHeaderInstances.push(l2Button);

          for (const spell of spells) {
            allButtons.push(new RMUSpellActionButton(spell));
          }
        }
      }

      const panel = new ButtonPanel({ id: "rmu-spells-all", buttons: allButtons });
      UIGuards.attachPanelInteractionGuards(panel);

      // 2. Install search.
      const spellFilters = [
        /* --- Re-enable when favorrites are implemented in RMU ---
        {
          id: "fav",
          dataKey: "favorite",
          icon: ICONS.star,
          tooltip: "Show Favorites Only"
        },
        */ // --- END COMMENTED OUT ---
        {
          id: "instant",
          dataKey: "isInstant",
          icon: ICONS.instant,
          tooltip: "Show Only Instantaneous Spells"
        },
        {
          id: "subcon",
          dataKey: "isSubconscious",
          icon: ICONS.subconscious,
          tooltip: "Show Only Sub-conscious Spells"
        }
      ];

      installListSearch(
        panel,
        ".rmu-spell-tile",
        ".rmu-spell-type-header, .rmu-spell-list-header",
        "spell",
        { 
          filters: spellFilters,
          onClear: (panelEl) => {
            if (!panelEl) return;
            // 1. Set the state to closed
            setOpenSpellState(null, null);
            
            // 2. Run the accordion logic, which will hide all tiles
            applyAccordionVisibility(panelEl);
            
            // 3. Hide the summary text
            const summaryEl = panelEl.querySelector(".rmu-search-summary");
            if (summaryEl) summaryEl.style.display = "none";
          }
        }
      );

      // 3. Force the panel to render its DOM *now*
      const panelEl = panel.element;

      // 4. Manually bind all headers to the panel element.
      allHeaderInstances.forEach(h => h._bindPanel(panelEl));

      // 5. Run the visibility logic *synchronously*.
      applyAccordionVisibility(panelEl);

      return panel;
    }
  }

  /**
   * The main "Spells" panel entry point for the HUD.
   * @augments ActionPanel
   */
  class RMUSpellsActionPanel extends ActionPanel {
    get label() { return "SPELLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMUAllSpellsCategoryButton()]; }
  }

  CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}