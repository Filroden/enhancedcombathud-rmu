/**
 * Settings menu for mapping individual spells and skills to custom icons.
 *
 * The map is stored in a hidden world setting as { "<name>": "<icon path>" }. Rows are
 * edited in memory (iconRows) and only written to the setting on save. Each row has a
 * random id so its inputs can be told apart in the form even when names are blank or
 * duplicated while the GM is still editing.
 */

import { MODULE_ID, MODULE_PATH, SETTING_KEYS } from "../constants.js";

/** Delay before the page reloads after saving, so the "saved" notification can be seen. */
const RELOAD_DELAY_MS = 500;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class RMUCustomIconsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        const savedIcons = game.settings.get(MODULE_ID, SETTING_KEYS.customUserIcons) || {};
        this.iconRows = Object.entries(savedIcons).map(([name, path]) => ({
            id: foundry.utils.randomID(),
            name,
            path,
        }));
    }

    static DEFAULT_OPTIONS = {
        id: "rmu-custom-icons",
        window: {
            title: "Custom Spell & Skill Icons",
            icon: "fas fa-images",
            resizable: true,
        },
        position: { width: 550, height: "auto" },
        actions: {
            addRow: RMUCustomIconsMenu._onAddRow,
            deleteRow: RMUCustomIconsMenu._onDeleteRow,
            pickFile: RMUCustomIconsMenu._onPickFile,
            cancel: RMUCustomIconsMenu._onCancel,
            save: RMUCustomIconsMenu._onSave,
        },
    };

    static PARTS = {
        form: {
            template: `${MODULE_PATH}/templates/rmu-custom-icons.hbs`,
        },
    };

    async _prepareContext(_options) {
        return {
            icons: this.iconRows,
        };
    }

    /**
     * Copies the current form inputs back into iconRows.
     * Must run before any re-render (add or delete row) or save, otherwise text typed since
     * the last render would be lost when the template is redrawn from iconRows.
     */
    _syncState() {
        if (!this.element) return;
        const form = this.element.querySelector("form");
        if (!form) return;

        const formData = new FormData(form);
        this.iconRows = (this.iconRows || []).map((row) => ({
            id: row.id,
            name: formData.get(`name_${row.id}`)?.trim() || "",
            path: formData.get(`path_${row.id}`)?.trim() || "",
        }));
    }

    // --- Action Handlers ---

    static async _onAddRow(_event, _target) {
        this._syncState();
        this.iconRows.push({ id: foundry.utils.randomID(), name: "", path: "" });
        this.render();
    }

    static async _onDeleteRow(_event, target) {
        this._syncState();
        const rowId = target.closest(".form-group").dataset.rowId;
        this.iconRows = this.iconRows.filter((r) => r.id !== rowId);
        this.render();
    }

    static async _onPickFile(_event, target) {
        const targetName = target.dataset.target;
        const input = this.element.querySelector(`input[name="${targetName}"]`);
        if (!input) return;

        new foundry.applications.apps.FilePicker({
            type: "image",
            current: input.value,
            callback: (path) => {
                input.value = path;
            },
        }).render(true);
    }

    static async _onCancel(_event, _target) {
        this.close();
    }

    static async _onSave(event, _target) {
        // The buttons are type="button", but this guards against a native form submission
        // reloading the page before the setting is written.
        event.preventDefault();

        this._syncState();

        const newIcons = {};
        for (const row of this.iconRows) {
            // Half-filled rows are dropped rather than saved with a missing name or path.
            if (row.name && row.path) {
                newIcons[row.name] = row.path;
            }
        }

        await game.settings.set(MODULE_ID, SETTING_KEYS.customUserIcons, newIcons);
        ui.notifications.info("Custom icons saved. Reloading...");
        this.close();

        // Icons are read when the HUD's buttons are built, so a reload is the simplest way to
        // make every open HUD pick up the new map.
        setTimeout(() => globalThis.location.reload(), RELOAD_DELAY_MS);
    }
}
