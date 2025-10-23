# Argon Combat HUD extension for Rolemaster Unified (RMU)

This project is a Foundry VTT module that integrates the "Argon - Combat HUD" module with the "Rolemaster Unified" (RMU) system. Its purpose is to provide a customized combat HUD for RMU that displays system-specific information and actions.

The module is written in JavaScript and uses the Foundry VTT API, the Argon Core HUD API and the RMU API.

## Features
Key features include:

*   A customised portrait panel showing HP, Power Points, and Defensive Bonus and with buttons to open character sheet and to roll initiative.
*   Integration with the RMU movement system.
*   Categorised attack buttons for Melee, Ranged, Natural, and Shield attacks.
*   Panels for Resistance Rolls, Skill Rolls, and Endurance Checks (Physical/Mental).
*   A "Rest" button to open the RMU rest dialog.
*   A search tool for skills. Just start typing and it will show any skills matching your text and the number of skillsfound on the right of the search bar. Click the clear icon in the search bar to reset the filter. There is a favourites toggle which will, when active, will only show skills marked as your favourites.
*   A combat panel to end turn when in combat.

It lets players and the GM do many actions without opening the character or creature sheet. Each action button has a rich tooltip showing the same data available in the sheet.

| Version   | Changes |
| :--- | :--- |
| **0.4.4** | *   Added leading + to positive bonus values<br>*   Added tooltips to Endurance buttons |
| **0.4.3** | *   Minor CSS change to consolidate styles |
| **0.4.2** | *   Added favourite toggle in the skills search bar<br>*   Added a favourite “chip” on all skill buttons that are marked as favourite on the actor skills tab |
| **0.4.1** | *   Added combat panel with an end turn button visible only when the token is in combat and it is their turn<br>*   Fixed missing CSS styles for skill category buttons introduced in v0.4.0<br>*   Verified roll initiative button works (in portrait panel)<br>*   Changed clear icon in the skills search bar and made it visible only when there is a filter applied |
| **0.4.0** | Code and CSS refactor |
| **0.3.2** | Minor code cleanup |
| **0.3.1** | The REST button now hides during combat (still accessible via the character sheet) |
| **0.3.0** | *   Added skill manoeuvre rolls (found in the skills panel on the bottom bar; expand a category to see its skills)<br>*   Added a custom search bar to find skills (shows matches count; clear icon resets filter)<br>*   Added endurance rolls (physical and mental)<br>*   Updated several icons |
| **0.2.0** | Includes attack buttons, resistance rolls, and the rest action |


## Roadmap
*   Spells (waiting on a system dependency)
*   Items (waiting on a system dependency)
*   Movement improvements to account for phased combat, show smaller units (1'), add additional colour breaks to allow for walk, jog, run, sprint and dash