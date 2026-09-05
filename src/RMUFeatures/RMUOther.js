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

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { RMUData } from "../RMUData.js";

// -----------------------------------------------------------------------------
// Portrait
// -----------------------------------------------------------------------------

export function definePortraitPanel(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.PORTRAIT?.PortraitPanel || ARGON?.HUD?.PortraitPanel || ARGON?.PortraitPanel;

    if (!Base) {
        console.warn("[ECH-RMU] PortraitPanel base not found; skipping.");
        return;
    }

    class RMUPortraitPanel extends Base {
        /** @override */
        get description() {
            const a = this.actor;
            if (!a) return "";
            const level = a.system?.level ?? a.system?.details?.level;
            const prof = a.system?.profession ?? a.system?.details?.profession;
            return [level == null ? null : `Lvl ${level}`, prof].filter(Boolean).join(" · ");
        }

        /** @override */
        get isDead() {
            return this.isDying;
        }

        /** @override */
        get isDying() {
            const hp = this.actor?.system?.health?.hp;
            return Number(hp?.value ?? 0) <= 0;
        }

        /** @override */
        async getStatBlocks() {
            const hpVal = Number(this.actor?.system?.health?.hp?.value ?? 0);
            const hpMax = Number(this.actor?.system?.health?.hp?.max ?? 0);
            const ppVal = Number(this.actor?.system?.health?.power?.value ?? 0);
            const ppMax = Number(this.actor?.system?.health?.power?.max ?? 0);
            const dbTot = Number(this.actor?.system?._dbBlock?.totalDB ?? 0);

            return [
                [{ text: `${hpVal}`, color: hpVal <= 0 ? "var(--ech-danger)" : "var(--ech-success)" }, { text: "/" }, { text: `${hpMax}`, color: "var(--ech-fore)" }, { text: "HP" }],
                [{ text: "PP" }, { text: `${ppVal}/${ppMax}`, color: "var(--ech-movement-baseMovement-background)" }],
                [{ text: "DB" }, { text: `${dbTot}`, color: "var(--ech-movement-baseMovement-background)" }],
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
    const Base = ARGON?.HUD?.MovementHud || ARGON?.MovementHud;

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
    const Base = ARGON?.WEAPONS?.WeaponSets || ARGON?.WeaponSets || ARGON?.HUD?.WeaponSets;
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
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    class RMUResistanceActionButton extends ActionButton {
        constructor(resist) {
            super();
            this.resist = resist;
        }
        get label() {
            return this.resist?.name || "Resistance";
        }
        get icon() {
            return ICONS[this.resist?.name] || ICONS.panel;
        }
        get isInteractive() {
            return true;
        }
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const r = this.resist ?? {};
            const details = [
                { label: "Stat Bonus", value: r.statBonus },
                { label: "Level Bonus", value: r.levelBonus },
                { label: "Racial Bonus", value: r.racialBonus },
                { label: "Special Bonus", value: r.specialBonus },
                { label: "Armour Bonus", value: r.armorBonus },
                { label: "Helmet Bonus", value: r.helmetBonus },
                { label: "Same Realm", value: r.sameRealmBonus },
                { label: "Total", value: r.total },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: r.statShortName,
                details: RMUUtils.formatTooltipDetails(details),
            };
        }

        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.style.pointerEvents = "auto";
                this.element.style.cursor = "pointer";
                RMUUtils.applyValueOverlay(this.element, this.resist?.total ?? "", "Total");
            }
        }
        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this._roll();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
        async _roll() {
            await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenResistanceRollAction", this.resist?.name);
        }
    }

    class RMUResistanceCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "RESISTANCE ROLLS";
            this._icon = ICONS.panel;
        }
        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return true;
        }
        get isInteractive() {
            return true;
        }

        async _getPanel() {
            await RMUData.ensureRMUReady();
            const list = RMUData.getTokenResistances();
            if (!list.length) {
                const empty = new (class NoResistButton extends ActionButton {
                    get label() {
                        return "No resistances";
                    }
                    get icon() {
                        return ICONS.panel;
                    }
                    get classes() {
                        return [...super.classes, "disabled"];
                    }
                })();
                return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
            }
            const buttons = list.map((r) => new RMUResistanceActionButton(r));
            const panel = new ButtonPanel({ id: "rmu-resistances", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            return panel;
        }
    }

    class RMUResistanceActionPanel extends ActionPanel {
        get label() {
            return "RESISTANCES";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            await RMUData.ensureRMUReady();
            return [new RMUResistanceCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

// -----------------------------------------------------------------------------
// Special Checks (Endurance/Concentration)
// -----------------------------------------------------------------------------

/**
 * Defines the main Special Checks panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSpecialChecksMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel, BUTTONS } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = BUTTONS;

    /**
     * Factory function to create Special Check classes dynamically.
     */
    function createSpecialCheckClass(className, config) {
        // Using computed properties ensures the generated class has the correct 'name'
        const ClassFactory = {
            [className]: class extends ActionButton {
                constructor() {
                    super();
                    this._skill = null;
                }

                get label() {
                    return config.label;
                }
                get icon() {
                    return config.icon;
                }
                get isInteractive() {
                    return true;
                }
                get hasTooltip() {
                    return true;
                }

                async getTooltipData() {
                    const title = this.label;
                    const subtitle = this._skill?.system?.name ?? `${config.rollOption} Check`;
                    return RMUUtils.buildSkillTooltip(this._skill, title, subtitle);
                }

                async _renderInner() {
                    await super._renderInner();
                    if (!this.element) return;
                    this.element.style.pointerEvents = "auto";
                    this.element.style.cursor = "pointer";
                    const actor = ui.ARGON?._token?.actor;
                    this._skill = actor ? RMUData.getSkillByName(actor, config.skillName) : null;
                    RMUUtils.applyValueOverlay(this.element, this._skill?.system?._bonus ?? "", "Total");
                }

                async _onMouseDown(event) {
                    if (event?.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    await RMUData.ensureRMUReady();
                    const token = ui.ARGON?._token;
                    const actor = token?.actor;
                    if (!actor) {
                        ui.notifications?.error?.("No active token for HUD.");
                        return;
                    }
                    const skill = this._skill ?? RMUData.getSkillByName(actor, config.skillName);
                    if (!skill) {
                        ui.notifications?.warn?.(`Skill not found: ${config.skillName}`);
                        return;
                    }
                    await rollSkillWithOption(token, skill, config.rollOption);
                }

                async _onLeftClick(e) {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                }
            },
        };

        return ClassFactory[className];
    }

    // Generate specific classes using the factory
    const RMUSpecialCheckEndurance = createSpecialCheckClass("RMUSpecialCheckEndurance", {
        label: "PHYSICAL",
        icon: ICONS.endurance,
        skillName: "Body Development",
        rollOption: "Endurance",
    });

    const RMUSpecialCheckConcentration = createSpecialCheckClass("RMUSpecialCheckConcentration", {
        label: "MENTAL",
        icon: ICONS.concentration,
        skillName: "Mental Focus",
        rollOption: "Concentration",
    });

    class RMUSpecialChecksCategoryButton extends ButtonPanelButton {
        get label() {
            return "ENDURANCE";
        }
        get icon() {
            return ICONS.special;
        }
        get isInteractive() {
            return true;
        }
        async _getPanel() {
            await RMUData.ensureRMUReady();
            const buttons = [new RMUSpecialCheckEndurance(), new RMUSpecialCheckConcentration()];
            const panel = new ButtonPanel({ id: "rmu-special-checks", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            return panel;
        }
    }

    class RMUSpecialChecksActionPanel extends ActionPanel {
        get label() {
            return "ENDURANCE";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
        async _getButtons() {
            return [new RMUSpecialChecksCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

async function rollSkillWithOption(token, skillObj, optionText) {
    await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSkillAction", skillObj, { specialManeuver: optionText });
}

// -----------------------------------------------------------------------------
// Rest & Combat Actions
// -----------------------------------------------------------------------------

/**
 * Defines the main Rest panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineRestMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ActionButton } = ARGON.MAIN.BUTTONS;

    class RMURestActionButton extends ActionButton {
        get label() {
            return "REST";
        }
        get icon() {
            return ICONS.rest;
        }
        get visible() {
            return !game.combat?.started;
        }
        get isInteractive() {
            return true;
        }
        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            return { title: "Rest", subtitle: "Recover resources", details: [{ label: "Info", value: "Open the rest dialog." }] };
        }
        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.style.pointerEvents = "auto";
                this.element.style.cursor = "pointer";
            }
        }
        async _onMouseDown(event) {
            if (event?.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            await this._run();
        }
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
        async _run() {
            await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenRestAction");
        }
    }

    class RMURestActionPanel extends ActionPanel {
        get label() {
            return "REST";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
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
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ActionButton } = ARGON.MAIN.BUTTONS;

    class RMUEndTurnActionButton extends ActionButton {
        get label() {
            return "End Turn";
        }
        get icon() {
            return ICONS.combat;
        }
        get isInteractive() {
            return true;
        }
        get hasTooltip() {
            return true;
        }
        get visible() {
            const tokenId = ui.ARGON?._token?.id;
            const c = game.combat;
            if (!c?.started || !tokenId) return false;
            const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
            return activeId === tokenId;
        }

        async _onLeftClick(event) {
            event.preventDefault();
            event.stopPropagation();

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

    class RMUCombatActionPanel extends ActionPanel {
        get label() {
            return "COMBAT";
        }
        get visible() {
            const c = game.combat;
            const tokenId = ui.ARGON?._token?.id;
            if (!c?.started || !tokenId) return false;
            const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
            const isActorMatch = c.combatant?.actorId && c.combatant.actorId === ui.ARGON?._token?.actor?.id;
            return activeId === tokenId || isActorMatch;
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
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
    const BaseDrawer = ARGON?.DRAWER?.DrawerPanel || ARGON?.HUD?.DrawerPanel || ARGON?.DrawerPanel;
    const BaseDrawerButton = ARGON?.DRAWER?.DrawerButton || ARGON?.HUD?.DrawerButton || ARGON?.DrawerButton;

    if (!BaseDrawer || !BaseDrawerButton) {
        console.warn("[ECH-RMU] DrawerPanel or DrawerButton base not found; skipping macro drawer.");
        return;
    }

    class RMUMacroDrawerButton extends BaseDrawerButton {
        constructor(macro) {
            const buttonParts = [
                {
                    label: macro.name,
                    onClick: (e) => {
                        if (this.interceptDialogs) ui.ARGON.interceptNextDialog(e.currentTarget.closest(".ability"));
                        macro.execute();
                    },
                },
            ];
            super(buttonParts);
            this.macro = macro;
        }

        async getData() {
            const data = await super.getData();
            const part = data.buttons[0];
            if (part) {
                part.label = this.macro.name;
            }
            return data;
        }

        setGrid(gridCols) {
            this.element.style.gridTemplateColumns = "1fr";
        }

        setAlign(align) {
            this._textAlign = ["left"];
            this.setTextAlign();
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
                    captions: [{ label: "Hotbar Macros", align: "left" }],
                    align: ["left"],
                    buttons: macroButtons,
                },
            ];
        }
    }

    CoreHUD.defineDrawerPanel(RMUDrawer);
}
