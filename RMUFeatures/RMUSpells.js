/**
 * RMUFeatures/RMUSpells.js
 * Defines the main Spellcasting panel (3-Level Nested Accordion)
 * Implements "Combo" buttons that transition from Casting (SCR) to Attacking (OB).
 */

import { ICONS, SPELL_ATTACK_ICONS, RMUUtils, installListSearch, UIGuards, formatBonus } from '../RMUCore.js';
import { RMUData } from '../RMUData.js';

// Global state helpers
const getOpenSpellState = RMUData.getOpenSpellState;
const setOpenSpellState = RMUData.setOpenSpellState;

/**
 * MODULE-LEVEL STATE:
 * Tracks which spells are currently "Armed" (Casting complete, ready to Attack).
 * Key Format: "TokenID::SpellName"
 */
const SPELL_ARMED_STATE = new Map();

/**
 * MODULE-LEVEL STATE:
 * Tracks which Area Spells are currently in "Template Placement" mode.
 * Key Format: "TokenID::SpellName"
 */
const SPELL_TEMPLATE_STATE = new Map();

function getSpellStateKey(spell) {
  const tokenId = ui.ARGON?._token?.id ?? "no-token";
  return `${tokenId}::${spell?.name}`;
}

/**
 * Applies visibility to the 3-level accordion based on global state.
 */
function applyAccordionVisibility(panelEl) {
  if (!panelEl) return;
  const { type: openType, name: openName } = getOpenSpellState();

  // L1 Headers
  panelEl.querySelectorAll(`.rmu-spell-type-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const isOpen = (hType === openType);
    h.classList.toggle("open", isOpen);
    h.classList.toggle("closed", !isOpen);
  });

  // L2 Headers
  panelEl.querySelectorAll(`.rmu-spell-list-header`).forEach(h => {
    const hType = h.dataset.listTypeKey || "";
    const hName = h.dataset.listNameKey || "";
    const isMyParentOpen = (hType === openType);
    const isMeOpen = (isMyParentOpen && hName === openName);

    h.style.display = "";
    h.classList.toggle("open", isMeOpen);
    h.classList.toggle("closed", !isMeOpen);
    h.style.opacity = isMyParentOpen ? "1" : "0.6";
  });

  // L3 Tiles
  panelEl.querySelectorAll(`.rmu-spell-tile`).forEach(t => {
    const tType = t.dataset.listTypeKey || "";
    const tName = t.dataset.listNameKey || "";
    const isSearchHidden = t.classList.contains("hidden"); 
    const visible = (tType === openType && tName === openName) && !isSearchHidden;
    t.style.display = visible ? "" : "none";
  });
}

export function defineSpellsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

  /**
   * L3: An action button for a single spell.
   * Handles both SCR (Casting) and Spell Attacks (via state toggle).
   */
  class RMUSpellActionButton extends ActionButton {
    constructor(spell) {
      super();
      this.spell = spell;
      if (spell) {
        this._listKey = spell._rawListInfo.listKey;
        this._listTypeKey = spell._rawListInfo.listType;
      }
      this._relatedAttack = this._findRelatedAttack();
    }

    /**
     * Finds the attack data.
     */
    _findRelatedAttack() {
      if (!this.spell) return null;
      const attacks = RMUData.getDirectedSpellAttacks(); 
      return attacks.find(a => (a.name === this.spell.name));
    }

    /** Getter/Setter for Armed State (Ready to Attack) */
    get _isArmed() {
      return SPELL_ARMED_STATE.get(getSpellStateKey(this.spell)) === true;
    }
    set _isArmed(value) {
      const key = getSpellStateKey(this.spell);
      if (value) SPELL_ARMED_STATE.set(key, true);
      else SPELL_ARMED_STATE.delete(key);
    }

    /** Getter/Setter for Template Active State (Placing AoE) */
    get _isTemplateActive() {
      return SPELL_TEMPLATE_STATE.get(getSpellStateKey(this.spell)) === true;
    }
    set _isTemplateActive(value) {
      const key = getSpellStateKey(this.spell);
      if (value) SPELL_TEMPLATE_STATE.set(key, true);
      else SPELL_TEMPLATE_STATE.delete(key);
    }

    get label() { 
      if (this._isTemplateActive) return `Place: ${this.spell.name}`;
      if (this._isArmed) return `Attack: ${this.spell.name}`;
      return `${this.spell.name} (Lvl ${this.spell.level})`; 
    }

    get icon() { 
      if (this._isArmed) {
          if (this._relatedAttack?.baseName && SPELL_ATTACK_ICONS[this._relatedAttack.baseName]) {
              return SPELL_ATTACK_ICONS[this._relatedAttack.baseName];
          }
          if (this._relatedAttack?.isAoE) {
              return ICONS.explosion;
          }
          return ICONS.beam;
      }
      return ICONS.spells_muted; 
    }

    get isInteractive() { return true; }

    get classes() {
      const c = [...super.classes, "rmu-spell-tile"];
      if (this._isArmed) c.push("spell-armed");
      if (this._isTemplateActive) c.push("template-active");
      return c;
    }

    get hasTooltip() { return true; }

    async getTooltipData() {
      const s = this.spell;
      const a = this._relatedAttack; 

      // --- 1. BASE SPELL DETAILS (SCR) ---
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
      ];

      // --- 2. COMBO ATTACK DETAILS (If applicable) ---
      if (a) {
        const attackDetails = [
            { label: "Attack Type", value: a.attack },
            { label: "Specialization", value: a.spellAttack?.specialization },
            { label: "Size", value: a.spellAttack?.size },
            { label: "Chart", value: a.spellAttack?.chart?.name },
            { label: "Fumble", value: a.spellAttack?.fumble },
            { label: "Range (interval)", value: a._modifiedRange?.range || a.range },
            { label: "AoE", value: a._modifiedAoE?.range || a.AoE },
            { label: "Targets", value: a._modifiedAoE?.targets },
            { label: "Total OB", value: a._totalBonus ?? a.totalBonus }
        ];

        details.push(...attackDetails);
      }

      // --- 3. INSTRUCTIONS ---
      let helpText = "";
      if (this._isTemplateActive) {
          helpText = "<br><br><b>Template Active!</b><br>Position the template, then <b>Left-Click</b> here to resolve.";
      } else if (this._isArmed) {
          helpText = "<br><br><b>Left-Click:</b> Roll Attack<br><b>Right-Click:</b> Cancel Attack";
      } else if (this._relatedAttack) {
          helpText = "<br><br><b>Left-Click:</b> Cast Spell (SCR)";
      }

      return {
        title: this.label,
        subtitle: `Lvl ${s.level} - ${s.spellList}`,
        description: (s.description || "") + helpText,
        details: RMUUtils.formatTooltipDetails(details.filter(x => x.value !== undefined && x.value !== null && x.value !== ""))
      };
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;

      this.element.classList.add("rmu-button-relative");
      this.element.dataset.tooltipDirection = "UP";

      // Chips
      const modifiersStr = this.spell.modifiers || "";
      const isInstant = modifiersStr.includes("*");
      const isSubconscious = (this.spell.spellType || "").substring(1).includes("s");
      const chips = [];
      if (isInstant) chips.push({ class: "rmu-instant-chip", title: "Instantaneous" });
      if (isSubconscious) chips.push({ class: "rmu-subconscious-chip", title: "Sub-conscious" });
      RMUUtils.buildChipContainer(this.element, chips);

      // --- COMBO OVERLAY ---
      if (this._relatedAttack) {
         const scrVal = formatBonus(this.spell.scr);
         const rawOb = this._relatedAttack._totalBonus ?? this._relatedAttack.totalBonus;
         const obVal = formatBonus(rawOb);
         
         if (this._isArmed) {
             RMUUtils.applyValueOverlay(this.element, obVal, "Attack OB");
         } else {
             RMUUtils.applyValueOverlay(this.element, `${scrVal} / ${obVal}`, "SCR / OB");
             this.element.classList.add("rmu-combo-spell");
         }
      } else {
         const scrVal = formatBonus(this.spell.scr);
         RMUUtils.applyValueOverlay(this.element, scrVal ?? "", "SCR");
      }

      // --- TEMPLATE BADGE ---
      if (this._isTemplateActive) {
        const badge = document.createElement("div");
        badge.className = "rmu-place-badge";
        badge.textContent = "PLACE TEMPLATE";
        this.element.appendChild(badge);
      }

      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = "pointer";

      // Attributes
      const listInfo = this.spell._rawListInfo || {};
      const nameNorm = (`${this.spell.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${this.spell.level}`).toLowerCase();

      this.element.dataset.listTypeKey = this._listTypeKey;
      this.element.dataset.listNameKey = this._listKey;
      this.element.dataset.nameNorm = nameNorm;
      this.element.dataset.catKey = this._listKey;
      
      const { type: openType, name: openName } = getOpenSpellState();
      const isVisible = (this._listTypeKey === openType && this._listKey === openName);
      this.element.style.display = isVisible ? "" : "none";
    }

    async _onMouseDown(event) {
      // 1. Right Click (Cancel)
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        if (this._isArmed) {
            this._isArmed = false;
            this._isTemplateActive = false;
            this.render(); 
        }
        return;
      }

      // 2. Left Click (Action)
      if (event.button === 0) {
        event.preventDefault(); 
        event.stopPropagation();
        
        // --- A) ALREADY ARMED (Attack / Resolve Template) ---
        if (this._isArmed && this._relatedAttack) {
            
            // For RESOLVING attacks (Directed OR Area final step), check targets
            const targets = game.user?.targets ?? new Set();
            if (!targets.size) {
                 ui.notifications?.warn?.("Select at least one target before resolving the attack.");
                 return; 
            }

            // Resolve the attack
            await RMUUtils.markActionTaken(ui.ARGON?._token);
            const success = await RMUUtils.rmuTokenActionWrapper(
                ui.ARGON?._token,
                "rmuTokenSpellAttackAction", 
                this._relatedAttack
            );

            // If successful, reset all states
            if (success) {
                this._isTemplateActive = false;
                this._isArmed = false;
                this.render();
            }
            return;
        }

        // --- B) NOT ARMED (Cast SCR -> Transition) ---
        await this._roll(); 
        
        // Transition to Armed
        if (this._relatedAttack) {
            this._isArmed = true;

            // AREA SPELL: Auto-trigger template placement
            if (this._relatedAttack.isAoE) {
                this._isTemplateActive = true;
                this.render(); // Update UI immediately (Badge + Gold + Orange)
                
                ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
                
                // Call API to init placement ghost immediately
                await RMUUtils.rmuTokenActionWrapper(
                    ui.ARGON?._token,
                    "rmuTokenSpellAttackAction", 
                    this._relatedAttack
                );
                return; // Stop here, user must interact with template then click again
            }

            // DIRECTED SPELL: Just arm and wait for click
            this.render();
        }
      }
    }

    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    async _roll() {
      await RMUUtils.markActionTaken(ui.ARGON?._token);
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSCRAction",
        this.spell
      );
    }
  }

  // --- Accordion Headers (Standard) ---
  class RMUSpellListButton extends ActionButton {
    constructor(listName, listTypeKey) {
      super();
      this._listName = listName;
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
    _bindPanel(panelEl) { this._panelEl = panelEl; }
    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listTypeKey;
        this.element.dataset.listNameKey = this._listName;
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listName;
      }
    }
    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const { name: openName } = getOpenSpellState();
      const isOpen = openName === this._listName;
      setOpenSpellState(this._listTypeKey, isOpen ? null : this._listName);
      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

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
    _bindPanel(panelEl) { this._panelEl = panelEl; }
    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.listTypeKey = this._listType;
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.catKey = this._listType;
      }
    }
    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const { type: openType } = getOpenSpellState();
      const isOpen = openType === this._listType;
      setOpenSpellState(isOpen ? null : this._listType, null);
      applyAccordionVisibility(this._panelEl);
    }
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  class RMUAllSpellsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SPELLS";
      this._icon = ICONS.spells;
    }
    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      setOpenSpellState(null, null);
      await RMUData.ensureRMUReady();
      const allSpellsByListType = RMUData.getGroupedSpellsForHUD();

      if (!allSpellsByListType.size) {
        const empty = new (class NoSpellsButton extends ActionButton {
          get label() { return "No spells known"; }
          get icon() { return ""; }
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
      const allHeaderInstances = [];

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

      const spellFilters = [
        { id: "instant", dataKey: "isInstant", icon: ICONS.instant, tooltip: "Show Only Instantaneous Spells" },
        { id: "subcon", dataKey: "isSubconscious", icon: ICONS.subconscious, tooltip: "Show Only Sub-conscious Spells" }
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
            setOpenSpellState(null, null);
            applyAccordionVisibility(panelEl);
            const summaryEl = panelEl.querySelector(".rmu-search-summary");
            if (summaryEl) summaryEl.style.display = "none";
          }
        }
      );

      const panelEl = panel.element;
      allHeaderInstances.forEach(h => h._bindPanel(panelEl));
      applyAccordionVisibility(panelEl);

      return panel;
    }
  }

  class RMUSpellsActionPanel extends ActionPanel {
    get label() { return "SPELLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMUAllSpellsCategoryButton()]; }
  }

  CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}