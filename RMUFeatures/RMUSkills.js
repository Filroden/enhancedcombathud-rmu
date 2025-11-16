/**
 * RMUFeatures/RMUSkills.js
 * Defines the main Skills panel, using an accordion and the shared search filter.
 */

import { ICONS, RMUUtils, installListSearch, UIGuards } from '../RMUCore.js';
import { RMUData } from '../RMUData.js';

/**
 * Normalizes a category string into a key.
 * @param {string} s - The category name.
 * @returns {string} The normalized key.
 */
function catKeyOf(s) {
  return String(s ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

// Global state helpers retrieved from RMUData
const getOpenSkillsCategory = () => RMUData.getOpenSkillsCategory();
const setOpenSkillsCategory = (catOrNull) => RMUData.setOpenSkillsCategory(catOrNull);

/**
 * Defines and registers the main Skills panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSkillsMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

  /**
   * An accordion header button for a skill category (e.g., "Awareness").
   * @augments ActionButton
   */
  class RMUSkillHeaderButton extends ActionButton {
    constructor(title) {
      super();
      this._title = title;
      this._catKey = catKeyOf(title);
      this._panelEl = null; // Reference to the parent panel's element
    }
    get label() { return this._title; }
    get icon() { return ""; }
    get isInteractive() { return true; }
    get classes() {
      const open = getOpenSkillsCategory() === this._catKey;
      return [...super.classes, "rmu-skill-header", open ? "open" : "closed"];
    }
    get hasTooltip() { return false; }

    /**
     * Binds the parent panel's element to this button for accordion logic.
     * @param {ButtonPanel} panel - The parent panel.
     */
    _bindPanel(panel) {
      const tryBind = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(tryBind);
        this._panelEl = el;
        this._applyVisibility();
      };
      requestAnimationFrame(tryBind);
    }

    /**
     * Applies visibility to all headers and tiles in the panel
     * based on the currently open category.
     */
    _applyVisibility() {
      if (!this._panelEl) return;
      const openKey = getOpenSkillsCategory();

      // Toggle 'open'/'closed' classes on all headers
      const headers = this._panelEl.querySelectorAll(".rmu-skill-header");
      headers.forEach(h => {
        const key = h.dataset.catKey || "";
        h.classList.toggle("open", key === openKey);
        h.classList.toggle("closed", key !== openKey);
      });

      // Show/hide skill tiles
      const tiles = this._panelEl.querySelectorAll(".rmu-skill-tile");
      tiles.forEach(t => {
        const key = t.dataset.catKey || "";
        // Only show if it's not hidden by search AND its category is open
        const isSearchHidden = t.style.display === "none" && key !== openKey;
        const visible = !!openKey && (key === openKey) && !isSearchHidden;
        t.style.display = visible ? "" : "none";
      });
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        this.element.dataset.catKey = this._catKey;
        // Add data for search filtering
        this.element.dataset.nameNorm = (this.label).toLowerCase();
        this.element.dataset.favorite = "false";
      }
    }

    async _onMouseDown(event) {
      if (event?.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const openKey = getOpenSkillsCategory();
      const isOpen = openKey === this._catKey;
      setOpenSkillsCategory(isOpen ? null : this._catKey); // Toggle
      this._applyVisibility();
    }

    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /**
   * An action button for a single skill (e.g., "Perception").
   * @augments ActionButton
   */
  class RMUSkillActionButton extends ActionButton {
    /**
     * @param {object} entry - The display-ready skill object from RMUData.
     * @param {boolean} [startHidden=false] - Whether the tile should start hidden.
     */
    constructor(entry, startHidden = false) {
      super();
      this.entry = entry;
      this._startHidden = !!startHidden;
    }
    get label() {
      const e = this.entry;
      return e?.spec ? `${e.name} (${e.spec})` : e?.name ?? "Skill";
    }
    get icon() { return ICONS.skills_muted; }
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
      const sys = this.entry?.raw?.system ?? {};
      const skill = this.entry?.raw;

      // 1. Get the standard details
      const details = [
        { label: "Total ranks", value: sys._totalRanks },
        { label: "Rank bonus", value: sys._rankBonus },
        { label: "Culture ranks", value: sys.cultureRanks },
        { label: "Stat", value: sys.stat },
        { label: "Stat bonus", value: sys._statBonus },
        { label: "Prof bonus", value: sys._professionalBonus },
        { label: "Knack", value: sys._knack },
        { label: "Total bonus", value: sys._bonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      // 2. Get skill description via RMU API
      let description = "";
      const api = game.system?.api?.rmuGetSkillDescription;
      if (typeof api === "function" && skill) {
        try {
          description = (await api(skill)) ?? "";
        } catch (err) {
          console.error("[ECH-RMU] rmuGetSkillDescription API call FAILED!", err);
          description = "Error loading description.";
        }
      }

      // 3. Return the tooltip data
      return {
        title: this.label,
        subtitle: sys.category ?? "",
        description: description,
        details: RMUUtils.formatTooltipDetails(details)
      };
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;

      this.element.style.pointerEvents = "auto";
      this.element.style.cursor = this.disabled ? "not-allowed" : "pointer";

      // Apply total bonus overlay
      RMUUtils.applyValueOverlay(this.element, this.entry?.total ?? "", "Total");

      // Add data-attributes for searching and filtering
      const label = this.label || "";
      const cat = this.entry?.category || "";
      const spec = this.entry?.spec || "";
      const norm = (label + " " + cat + " " + spec).toLowerCase();

      this.element.dataset.catKey = catKeyOf(cat);
      this.element.dataset.name = label;
      this.element.dataset.nameNorm = norm;

      const sys = this.entry?.raw?.system ?? {};
      const isFav = (sys.favorite === true) || (this.entry?.favorite === true);
      this.element.dataset.favorite = isFav ? "true" : "false";

      // Add "Favorite" chip
      const chips = [];
      if (isFav) {
        chips.push({
          class: "rmu-fav-chip",
          title: "Favorite"
        });
      }
      RMUUtils.buildChipContainer(this.element, chips);

      if (this._startHidden) this.element.style.display = "none";
    }

    async _onMouseDown(event) {
      if (event?.button !== 0 || this.disabled) return;
      event.preventDefault(); event.stopPropagation();
      await this._roll();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /**
     * Rolls the skill using the centralized API wrapper.
     */
    async _roll() {
      await RMUUtils.rmuTokenActionWrapper(
        ui.ARGON?._token,
        "rmuTokenSkillAction",
        this.entry?.raw,
        undefined // No special options needed
      );
    }
  }

  /**
   * The category button that opens the main Skills panel accordion.
   * @augments ButtonPanelButton
   */
  class RMUSkillsCategoryButton extends ButtonPanelButton {
    constructor() {
      super();
      this.title = "SKILLS";
      this._icon = ICONS.skills;
    }
    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      await RMUData.ensureRMUReady();
      const groups = RMUData.getGroupedSkillsForHUD_All();
      const buttons = [];

      // Handle empty state
      if (!groups.size) {
        const empty = new (class NoSkillsButton extends ActionButton {
          get label() { return "No skills"; }
          get icon() { return ""; }
          get classes() { return [...super.classes, "disabled"]; }
        })();
        const panel = new ButtonPanel({ id: "rmu-skills", buttons: [empty] });
        UIGuards.attachPanelInteractionGuards(panel);
        return panel;
      }

      const cats = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

      // Build headers and tiles
      const headerInstances = [];
      for (const cat of cats) {
        const header = new RMUSkillHeaderButton(cat);
        headerInstances.push(header);
        buttons.push(header);
        for (const entry of groups.get(cat)) {
          buttons.push(new RMUSkillActionButton(entry, true)); // Start hidden
        }
      }

      const panel = new ButtonPanel({ id: "rmu-skills", buttons });
      UIGuards.attachPanelInteractionGuards(panel);

      // Install the search/filter bar
      const skillFilters = [
        {
          id: "fav",
          dataKey: "favorite",
          icon: ICONS.star,
          tooltip: "Show Favorites Only"
        }
      ];

      installListSearch(
        panel,
        ".rmu-skill-tile",
        ".rmu-skill-header",
        "skill",
        { 
          filters: skillFilters,
          onClear: (panelEl) => {
            if (!panelEl) return;
            // 1. Set the state to closed
            setOpenSkillsCategory(null);
            
            // 2. Manually hide all tiles and close all headers
            panelEl.querySelectorAll(".rmu-skill-tile").forEach(t => {
              t.style.display = "none";
            });
            panelEl.querySelectorAll(".rmu-skill-header").forEach(h => {
              h.classList.remove("open");
              h.classList.add("closed");
            });
            
            // 3. Hide the summary text
            const summaryEl = panelEl.querySelector(".rmu-search-summary");
            if (summaryEl) summaryEl.style.display = "none";
          }
        }
      );

      // Bind all headers to the panel
      headerInstances.forEach(h => h._bindPanel(panel));

      // Start with all categories closed
      setOpenSkillsCategory(null);
      requestAnimationFrame(() => {
        const el = panel.element;
        if (!el) return;
        el.querySelectorAll(".rmu-skill-tile").forEach(t => t.style.display = "none");
      });

      return panel;
    }
  }

  /**
   * The main "Skills" panel entry point for the HUD.
   * @augments ActionPanel
   */
  class RMUSkillsActionPanel extends ActionPanel {
    get label() { return "SKILLS"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMUSkillsCategoryButton()]; }
  }

  CoreHUD.defineMainPanels([RMUSkillsActionPanel]);
}