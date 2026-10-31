/**

 * Defines utility panels for the Enhanced Combat HUD (Rolemaster Unified):
 * - Portrait
 * - WeaponSets (Hidden stub)
 * - Resistance Rolls
 * - Special Checks (Endurance/Concentration)
 * - Rest & Combat Turn Management
 * - Macro Drawer
 *
 * @module RMUOther
 */

import { ICONS } from "../icons.js";
import { t, tf, term } from "../i18n.js";
import { applyValueOverlay } from "../ui/dom.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { DETAIL_FORMAT, buildTooltip } from "../ui/tooltip.js";
import { escapeHTML } from "../format.js";
import { hudActor, hudToken } from "../argon.js";
import { callHudTokenAction, callTokenAction } from "../system/api.js";
import { ensureRMUReady } from "../system/derive.js";
import { getActorResistances } from "../system/resistances.js";
import { getEnduranceValues, getSkillByName, skillTooltipDetails } from "../system/skills.js";
import { getPortraitData } from "../system/portrait.js";

// -----------------------------------------------------------------------------
// Portrait
// -----------------------------------------------------------------------------

export function definePortraitPanel(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.PORTRAIT?.PortraitPanel;

    if (!Base) {
        console.warn("[ECH-RMU] PortraitPanel base not found; skipping.");
        return;
    }

    class RMUPortraitPanel extends Base {
        /**
         * CORE debounces refresh by 100 ms (its constructor wraps this method), and its
         * updateActor hook calls it on every actor change. If the HUD is unbound inside that
         * window (for example the token is deselected straight after its HP is edited), the
         * delayed render runs with no actor and CORE's own name getter throws. Checking
         * here runs at the moment the debounced call fires, so a stale refresh is skipped.
         * @override
         */
        refresh() {
            if (!this.actor) return;
            super.refresh();
        }

        /** @override */
        get description() {
            if (!this.actor) return "";
            const { level, profession } = getPortraitData(this.actor);
            const levelText = level == null ? null : tf("ECH-RMU.Portrait.Level", { level });
            return [levelText, profession].filter(Boolean).join(" · ");
        }

        /** @override */
        get isDead() {
            return this.isDying;
        }

        /** @override */
        get isDying() {
            return getPortraitData(this.actor).hp.value <= 0;
        }

        /**
         * CORE draws each block as coloured text spans. The HP colours come from the module
         * theme, because CORE 5 no longer defines success or danger colours; PP and DB use
         * CORE's own movement colour.
         * @override
         */
        async getStatBlocks() {
            const { hp, pp, db } = getPortraitData(this.actor);
            const hpColor = hp.value <= 0 ? "var(--filroden-color-danger)" : "var(--filroden-color-success)";
            return [
                [{ text: `${hp.value}`, color: hpColor }, { text: "/" }, { text: `${hp.max}`, color: "var(--filroden-color-text-main-solid)" }, { text: term("HP") }],
                [{ text: term("PP") }, { text: `${pp.value}/${pp.max}`, color: "var(--ech-movement-baseMovement-background)" }],
                [{ text: term("DB") }, { text: `${db}`, color: "var(--ech-movement-baseMovement-background)" }],
            ];
        }
    }
    CoreHUD.definePortraitPanel(RMUPortraitPanel);
}

// -----------------------------------------------------------------------------
// Movement HUD (Invisible Spacer)
// -----------------------------------------------------------------------------

export function defineMovementHud(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.MovementHud;

    if (!Base) return;

    class RMUMovementHud extends Base {
        get visible() {
            return true;
        }

        async _renderInner() {
            if (this.element) {
                this.element.innerHTML = "";
            }
        }

        updateMovement() {}
    }

    CoreHUD.defineMovementHud(RMUMovementHud);
}

// -----------------------------------------------------------------------------
// Weapon Sets (Hidden Stub)
// -----------------------------------------------------------------------------

export function defineWeaponSets(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.WeaponSets;
    if (!Base) {
        console.warn("[ECH-RMU] WeaponSets base not found; skipping.");
        return;
    }

    class RMUWeaponSets extends Base {
        get sets() {
            return [];
        }
        _onSetChange(_id) {}
        get visible() {
            return false;
        }
    }
    CoreHUD.defineWeaponSets(RMUWeaponSets);
}

// -----------------------------------------------------------------------------
// Resistance Rolls
// -----------------------------------------------------------------------------

/**
 * Defines the main Resistance Rolls panel.
 * Dynamically generates buttons based on the actor's configured resistances.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineResistancesMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUEmptyButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    class RMUResistanceActionButton extends RMUActionButton {
        constructor(resist) {
            super();
            this.resist = resist;
        }
        get label() {
            return this.resist?.name || t("ECH-RMU.Fallback.Resistance");
        }
        get icon() {
            // Icon settings are keyed by the system's untranslated resistance identifier.
            return ICONS[this.resist?.value ?? this.resist?.name] || ICONS.panel;
        }
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const r = this.resist ?? {};
            const { BONUS } = DETAIL_FORMAT;
            return buildTooltip({
                title: this.label,
                subtitle: r.statShortName,
                details: [
                    { label: term("StatBonus"), value: r.statBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.LevelBonus"), value: r.levelBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.RacialBonus"), value: r.racialBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.SpecialBonus"), value: r.specialBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.ArmorBonus"), value: r.armorBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.HelmetBonus"), value: r.helmetBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.SameRealm"), value: r.sameRealmBonus, format: BONUS },
                    { label: term("Total"), value: r.total, format: BONUS },
                ],
            });
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            applyValueOverlay(this.element, this.resist?.total ?? "", term("Total"));
        }

        async _onActivate() {
            await callHudTokenAction("rmuTokenResistanceRollAction", this.resist?.name);
        }
    }

    class RMUResistanceCategoryButton extends ButtonPanelButton {
        get label() {
            return t("ECH-RMU.Panel.ResistanceRolls");
        }
        get icon() {
            return ICONS.panel;
        }
        get hasContents() {
            return true;
        }
        get isInteractive() {
            return true;
        }

        async _getPanel() {
            await ensureRMUReady();
            const list = getActorResistances();
            const buttons = list.length ? list.map((r) => new RMUResistanceActionButton(r)) : [new RMUEmptyButton("No resistances", ICONS.panel)];
            return createGuardedPanel("ech-rmu-resistances", buttons);
        }
    }

    class RMUResistanceActionPanel extends RMUActionPanel {
        get label() {
            return t("ECH-RMU.Panel.Resistances");
        }
        async _getButtons() {
            return [new RMUResistanceCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

// -----------------------------------------------------------------------------
// Special Checks (Endurance/Concentration)
// -----------------------------------------------------------------------------

/**
 * Configuration of the two special check buttons. Each rolls a skill with the system's
 * "special manoeuvre" option, which turns the skill roll into an Endurance or Concentration
 * check.
 */
const SPECIAL_CHECKS = Object.freeze([
    { labelKey: "ECH-RMU.Endurance.Physical", checkKey: "ECH-RMU.Endurance.PhysicalCheck", iconKey: "endurance", skillName: "Body Development", rollOption: "Endurance", injuryKey: "_endurance" },
    { labelKey: "ECH-RMU.Endurance.Mental", checkKey: "ECH-RMU.Endurance.MentalCheck", iconKey: "concentration", skillName: "Mental Focus", rollOption: "Concentration", injuryKey: "_concentration" },
]);

/**
 * Defines the main Special Checks panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSpecialChecksMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * One special check button (Physical or Mental), configured by an entry of SPECIAL_CHECKS.
     */
    class RMUSpecialCheckButton extends RMUActionButton {
        constructor(config) {
            super();
            this._config = config;
            this._skill = null;
        }

        get label() {
            return t(this._config.labelKey);
        }
        get icon() {
            return ICONS[this._config.iconKey];
        }
        get hasTooltip() {
            return true;
        }

        /**
         * The skill's breakdown, followed by the racial modifier when there is one, so the
         * total matches the character sheet's Physical or Mental Endurance.
         */
        async getTooltipData() {
            const { total, skillBonus, racial } = this._values ?? {};
            const { BONUS } = DETAIL_FORMAT;
            let details = skillTooltipDetails(this._skill);
            if (racial) {
                details = [
                    ...details.filter((d) => d.id !== "totalBonus"),
                    { label: t("ECH-RMU.Tooltip.SkillBonus"), value: skillBonus, format: BONUS },
                    { label: t("ECH-RMU.Tooltip.RacialBonus"), value: racial, format: BONUS },
                    { label: term("TotalBonus"), value: total, format: BONUS },
                ];
            }
            return buildTooltip({
                title: this.label,
                subtitle: this._skill?.system?.name ?? t(this._config.checkKey),
                details,
            });
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            const actor = hudActor();
            this._skill = actor ? getSkillByName(actor, this._config.skillName) : null;
            this._values = getEnduranceValues(actor, this._config.injuryKey, this._skill);
            applyValueOverlay(this.element, this._values.total ?? "", term("Total"));
        }

        async _onActivate() {
            await ensureRMUReady();
            const token = hudToken();
            const actor = token?.actor;
            if (!actor) {
                ui.notifications?.error?.("No active token for HUD.");
                return;
            }
            const skill = this._skill ?? getSkillByName(actor, this._config.skillName);
            if (!skill) {
                ui.notifications?.warn?.(`Skill not found: ${this._config.skillName}`);
                return;
            }
            await callTokenAction(token, "rmuTokenSkillAction", skill, { specialManeuver: this._config.rollOption });
        }
    }

    class RMUSpecialChecksCategoryButton extends ButtonPanelButton {
        get label() {
            return term("Endurance");
        }
        get icon() {
            return ICONS.special;
        }
        get isInteractive() {
            return true;
        }
        async _getPanel() {
            await ensureRMUReady();
            const buttons = SPECIAL_CHECKS.map((config) => new RMUSpecialCheckButton(config));
            return createGuardedPanel("ech-rmu-special-checks", buttons);
        }
    }

    class RMUSpecialChecksActionPanel extends RMUActionPanel {
        get label() {
            return term("Endurance");
        }
        async _getButtons() {
            return [new RMUSpecialChecksCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

// -----------------------------------------------------------------------------
// Rest & Combat Actions
// -----------------------------------------------------------------------------

/**
 * Returns true when the token currently bound to the HUD is the active combatant.
 * Matches by token id, so two tokens of the same unlinked actor are told apart.
 * @returns {boolean}
 */
function isHudTokenActiveCombatant() {
    const tokenId = hudToken()?.id;
    const c = game.combat;
    if (!c?.started || !tokenId) return false;
    const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
    return activeId === tokenId;
}

/**
 * Defines the main Rest panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineRestMain(CoreHUD) {
    const { RMUActionButton, RMUActionPanel } = createBaseClasses(CoreHUD.ARGON);

    class RMURestActionButton extends RMUActionButton {
        get label() {
            return term("Rest");
        }
        get icon() {
            return ICONS.rest;
        }
        get visible() {
            return !game.combat?.started;
        }
        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            return buildTooltip({
                title: term("Rest"),
                subtitle: t("ECH-RMU.Rest.Subtitle"),
                details: [{ label: t("ECH-RMU.Rest.InfoLabel"), value: t("ECH-RMU.Rest.Info") }],
            });
        }
        async _onActivate() {
            await callHudTokenAction("rmuTokenRestAction");
        }
    }

    class RMURestActionPanel extends RMUActionPanel {
        get label() {
            return term("Rest");
        }
        async _getButtons() {
            return [new RMURestActionButton()];
        }
    }
    CoreHUD.defineMainPanels([RMURestActionPanel]);
}

/**
 * Defines the main Combat (End Turn) panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineCombatMain(CoreHUD) {
    const { RMUActionButton, RMUActionPanel } = createBaseClasses(CoreHUD.ARGON);

    class RMUEndTurnActionButton extends RMUActionButton {
        get label() {
            return t("ECH-RMU.Button.EndTurn");
        }
        get icon() {
            return ICONS.combat;
        }
        get hasTooltip() {
            return true;
        }
        get visible() {
            return isHudTokenActiveCombatant();
        }

        async _onActivate() {
            const c = game.combat;
            if (!c?.started) return;

            try {
                if (typeof c.nextTurn === "function") await c.nextTurn();
                else if (typeof c.advanceTurn === "function") await c.advanceTurn();
                else ui.notifications?.error?.("Combat API does not support advancing turns.");
            } catch (e) {
                console.error("[ECH-RMU] End Turn failed:", e);
            }
        }
    }

    class RMUCombatActionPanel extends RMUActionPanel {
        get label() {
            return t("ECH-RMU.Panel.Combat");
        }
        /**
         * Shown on the HUD token's turn. Also shown when the active combatant is the same
         * actor (for example the GM selected another token of a linked actor), so the turn can
         * still be ended from the HUD.
         */
        get visible() {
            const c = game.combat;
            const isActorMatch = c?.started && c.combatant?.actorId && c.combatant.actorId === hudToken()?.actor?.id;
            return isHudTokenActiveCombatant() || Boolean(isActorMatch);
        }
        async _getButtons() {
            return [new RMUEndTurnActionButton()];
        }
    }
    CoreHUD.defineMainPanels([RMUCombatActionPanel]);
}

// -----------------------------------------------------------------------------
// Macro Drawer
// -----------------------------------------------------------------------------

/**
 * Defines the custom Drawer panel which mirrors the Foundry Hotbar macros.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineDrawerPanel(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const BaseDrawer = ARGON?.DRAWER?.DrawerPanel;
    const BaseDrawerButton = ARGON?.DRAWER?.DrawerButton;

    if (!BaseDrawer || !BaseDrawerButton) {
        console.warn("[ECH-RMU] DrawerPanel or DrawerButton base not found; skipping macro drawer.");
        return;
    }

    /**
     * One hotbar macro. CORE's drawer button handles the click (including positioning any
     * dialog the macro opens next to the drawer) and applies the category's column and
     * alignment settings.
     */
    class RMUMacroDrawerButton extends BaseDrawerButton {
        constructor(macro) {
            // Macro names are typed by users and CORE inserts them as raw HTML.
            super([{ label: escapeHTML(macro.name), onClick: () => macro.execute() }]);
            this.macro = macro;
        }
    }

    class RMUDrawer extends BaseDrawer {
        get title() {
            return "Macros";
        }

        get categories() {
            const hotbarMacros = Object.values(game.user.hotbar)
                .map((id) => game.macros.get(id))
                .filter(Boolean);

            let macroButtons;
            if (hotbarMacros.length) {
                macroButtons = hotbarMacros.map((macro) => new RMUMacroDrawerButton(macro));
            } else {
                const emptyButtonPart = [{ label: "No Macros in Hotbar" }];
                macroButtons = [new BaseDrawerButton(emptyButtonPart)];
            }

            return [
                {
                    gridCols: "1fr",
                    // CORE applies this as an inline text-align; "start" follows the text direction.
                    captions: [{ label: "Hotbar Macros", align: "start" }],
                    buttons: macroButtons,
                },
            ];
        }
    }

    CoreHUD.defineDrawerPanel(RMUDrawer);
}
