# Uninstall C7N Codex on Windows

1. Quit C7N Codex from its system-tray menu.
2. Open **Settings > Apps > Installed apps**.
3. Find **C7N Codex**, open its menu, and select **Uninstall**.
4. Complete the NSIS uninstaller.

The uninstaller removes the application files. It keeps Taskboard issues,
attachments, settings, logs, the independent Codex profile, and the bundled
Skill so that a later installation can reuse them.

To remove that retained data, close C7N Codex and delete these directories
for the current Windows user:

- `%APPDATA%\Codex Taskboard`
- `%LOCALAPPDATA%\Codex Taskboard`
- `%USERPROFILE%\.agents\skills\manage-taskboard`

Removing the first directory permanently deletes local Taskboard issues and
attachments. It does not remove the official Codex application, the user's
normal Codex profile, or Codex projects.
