import js from "@eslint/js";
import globals from "globals";

export default [
    // dist is a build copy of the source; design holds internal notes, fixtures and test tools
    // that run in other environments (for example Foundry macros), so neither is linted.
    { ignores: ["dist/**", "design/**", "node_modules/**"] },
    js.configs.recommended,
    {
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                // Foundry VTT globals used by this module.
                foundry: "readonly",
                game: "readonly",
                canvas: "readonly",
                ui: "readonly",
                Actor: "readonly",
                Hooks: "readonly",
                CONFIG: "readonly",
                Handlebars: "readonly",
                fromUuid: "readonly",
                fromUuidSync: "readonly",
            },
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-debugger": "warn",
            "no-console": "off",
        },
    },
    // Node build scripts run outside the browser.
    {
        files: ["scripts/**/*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
