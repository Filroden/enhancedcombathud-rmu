# Argon Combat HUD extension for Rolemaster Unified (RMU)

This project is a Foundry VTT module that integrates the "Argon - Combat HUD" module with the "Rolemaster Unified" (RMU) system. Its purpose is to provide a customized combat HUD for RMU that displays system-specific information and actions.

The module is written in JavaScript and uses the Foundry VTT API, the Argon Core HUD API and the RMU API.

## Features

Key features include:

* A customised portrait panel showing HP, Power Points, and Defensive Bonus and with buttons to open character sheet and to roll initiative.
* Integration with the RMU movement system.
* Categorised attack buttons for Melee, Ranged, Natural (including innate magic), Shield and Spell attacks.
* Panels for Spell Casting Rolls, Resistance Rolls, Skill Manueovre Rolls (includng Spell Mastery), and Endurance Checks (Physical/Mental).
* A "Rest" button to open the RMU rest dialog.
* A search tool for spells and skills. Just start typing and it will show any spells or skills matching your text and the number found on the right of the search bar. Click the clear icon in the search bar to reset the filter. There is a favourites toggle which will, when active, will only show those marked as your favourites.
* A combat panel to end turn when in combat.

It lets players and the GM do many actions without opening the character or creature sheet. Each action button has a rich tooltip showing the same data available in the sheet.

## Version History

[Version History](VERSION.md)

## Roadmap

* Spells (waiting on a system dependency)
* Items (waiting on a system dependency)
* Movement improvements to account for phased combat, show smaller units (1'), add additional colour breaks to allow for walk, jog, run, sprint and dash
