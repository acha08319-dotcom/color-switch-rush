# Manual Playables certification tracking

## Goal
Add a debug-panel control to record and review Playables certification information manually.

## Changes
- Add a compact certification section with a status selector, review date, and portal-notes field.
- Save changes in browser local storage and restore them when reopening the panel or returning later.
- Label the information as manually entered so it is not mistaken for a live portal status.
- Keep the existing Playables checks and reports unchanged.

## Technical details
- Implement the storage helpers and form in `PlayablesDebugPanel` using the existing browser-local persistence pattern.
- Validate that status, date, and notes persist and that the updated preview builds cleanly.
