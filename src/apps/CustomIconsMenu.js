/**
 * Settings menu for mapping individual spells and skills to custom icons.
 *
 * The map is stored in a hidden world setting as { "<name>": "<icon path>" }. Rows are
 * edited in memory (iconRows) and only written to the setting when the form is submitted. Each row has a
 * random id so its inputs can be told apart in the form even when names are blank or
 * duplicated while the GM is still editing.
 */

import { MODULE_ID, MODULE_PATH, SETTING_KEYS } from "../constants.js";

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
        id: "ech-rmu-custom-icons",
        // The application element is the form itself, so Foundry handles submission (the
        // Save button is type="submit") and calls the handler below.
        tag: "form",
        form: {
            handler: RMUCustomIconsMenu._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true,
        },
        window: {
            // A language key: ApplicationV2 localises the window title itself.
            title: "ECH-RMU.CustomIcons.Title",
            icon: "fas fa-images",
            resizable: true,
        },
        position: { width: 550, height: "auto" },
        actions: {
            addRow: RMUCustomIconsMenu._onAddRow,
            deleteRow: RMUCustomIconsMenu._onDeleteRow,
            pickFile: RMUCustomIconsMenu._onPickFile,
            cancel: RMUCustomIconsMenu._onCancel,
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

        const formData = new FormData(this.element);
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

    /**
     * Form submission handler: saves complete rows and offers a reload.
     * Icons are read when the HUD's buttons are built, so the new map only takes effect
     * after a reload. Foundry's own prompt is used; with world: true, a GM who accepts also
     * reloads every connected client, so players see the new icons too.
     */
    static async _onSubmit(_event, _form, _formData) {
        this._syncState();

        const newIcons = {};
        for (const row of this.iconRows) {
            // Half-filled rows are dropped rather than saved with a missing name or path.
            if (row.name && row.path) {
                newIcons[row.name] = row.path;
            }
        }

        await game.settings.set(MODULE_ID, SETTING_KEYS.customUserIcons, newIcons);
        await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
    }
}
