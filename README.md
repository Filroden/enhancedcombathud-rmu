# Argon Combat HUD extension for Rolemaster Unified (RMU)

An implementation of the [Argon - Combat HUD](https://foundryvtt.com/packages/enhancedcombathud) (by [TheRipper93](https://theripper93.com/) and [Mouse0270](https://github.com/mouse0270)) for the [Rolemaster Unified (RMU)](https://foundryvtt.com/packages/rmu) system. The Argon Combat HUD (CORE) module is required for this module to work.

---

### Attack Panel
![Attacks](/images/attacks.png)

### Spell Panel including search bar
![Spells](/images/spells.png)

### Skill Panel including search bar
![Skills](/images/skills.png)

### Resistance Rolls
![Resistance](/images/resistances.png)

### Endurance Rolls
![Endurance](/images/endurance.png)

### Set Defences
![Set Defences](/images/set_defences.png)

---

### The documentation for the core Argon features can be found [here](https://api.theripper93.com/modulewiki/enhancedcombathud/free)

This module adjusts various Argon features for the Rolemaster Unified system:

* **Portrait:** A customised portrait panel showing HP, Power Points, and Defensive Bonus, with buttons to open the character sheet, set defences (dodge, block and other DB modifier), and to roll initiative.
* **Movement HUD:** Integrates with the RMU movement system.
* **Attacks:** Categorised attack buttons for Melee, Ranged, Natural (including innate magic), Shield, and Spell attacks. Weapons can be equipped and unequipped within the panel.
* **Other panels:** Dedicated panels for:
    * Spell Casting Rolls (SCR)
    * Skill Manueuvre Rolls (including Spell Mastery)
    * Resistance Rolls
    * Endurance Checks (Physical/Mental)
* **Search:** A search tool for spells and skills. Just start typing and it will show any spells or skills matching your text and the number found on the right of the search bar. Click the clear icon in the search bar to reset the filter. There are also toggleable filters for specific spell or skill properties such as filtering for spells that can be cast instantaneously or sub-consciously.
* **Utilities:**
    * A "Rest" button to open the RMU rest dialog.
    * A combat panel to end the current combatant's turn.
* **Tooltips:** Each action button has a rich tooltip showing the same data available in the character sheet.

---

## Version History

[Version History](VERSION.md)

## Roadmap

* Items (waiting on a system dependency)
* Movement improvements to account for phased combat, show smaller units (1'), add additional colour breaks to allow for walk, jog, run, sprint and dash

**If you have suggestions, questions, or requests for additional features, please [let me know](https://github.com/Filroden/enhancedcombathud-rmu/issues).**