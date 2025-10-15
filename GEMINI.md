## Project Overview

This project is a Foundry VTT module that integrates the "Argon - Combat HUD" with the "Rolemaster Unified" (RMU) system. Its purpose is to provide a customized combat HUD for RMU that displays system-specific information and actions.

The module is written in JavaScript and uses the Foundry VTT API and the Argon Core HUD API.

Key features include:
*   A customized portrait panel showing HP, Power Points, and Defensive Bonus.
*   Integration with the RMU movement system.
*   Categorized attack buttons for Melee, Ranged, Natural, and Shield attacks.
*   Panels for Resistance Rolls, Skill Rolls, and Special Checks (Endurance/Concentration).
*   A "Rest" button to open the RMU rest dialog.
*   Settings to customize the display of skills.

## Building and Running

This project uses Node.js for dependency management and scripting.

**Installation:**
To install the development dependencies, run:
```bash
npm install
```

**Scripts:**

*   `npm run pack`: Packages the module for distribution.
*   `npm run foundry-id`: A script related to the Foundry VTT module ID.

To use the module, you still need to have it in the `modules` directory of your Foundry VTT installation and enable it in your world. The `unpack` script might handle the linking for development.

## Development Conventions

The code is organized into sections using comments. It uses modern JavaScript features and follows a class-based approach for defining HUD components. The code is well-commented, explaining the purpose of different functions and classes.

The project uses a `.github/workflows/auto-release.yaml` file, which suggests that releases are automated through GitHub Actions. The addition of `package.json` and scripts in the `scripts` directory indicates a move towards a more structured development and packaging process.
