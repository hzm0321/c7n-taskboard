#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
import sys
import time
import plistlib


def get_size_mb(path):
    total = 0
    if os.path.isdir(path):
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
    else:
        total = os.path.getsize(path)
    return max(int(total / (1024 * 1024)) + 50, 100)


def unmount_volume(vol_name):
    vol_path = f"/Volumes/{vol_name}"
    if os.path.exists(vol_path):
        subprocess.run(["diskutil", "eject", vol_path], capture_output=True)
        time.sleep(1)


def main():
    parser = argparse.ArgumentParser(description="Build macOS DMG installer with custom background and layout")
    parser.add_argument("--app", required=True, help="Path to .app bundle")
    parser.add_argument("--output", required=True, help="Output .dmg path")
    parser.add_argument("--volname", required=True, help="Volume name")
    parser.add_argument("--background", required=True, help="Path to background.tiff or background.png")
    parser.add_argument("--icon", default=None, help="Volume icon .icns")
    parser.add_argument("--window-size", nargs=2, type=int, default=[752, 436], help="Window width and height")
    parser.add_argument("--app-pos", nargs=2, type=int, default=[212, 155], help="App icon x and y")
    parser.add_argument("--drop-link-pos", nargs=2, type=int, default=[537, 155], help="Drop link x and y")
    parser.add_argument("--icon-size", type=int, default=160, help="Icon size")
    parser.add_argument("--text-size", type=int, default=16, help="Text size (10-16)")
    args = parser.parse_args()

    app_path = os.path.abspath(args.app)
    app_name = os.path.basename(app_path)
    output_path = os.path.abspath(args.output)
    bg_path = os.path.abspath(args.background)
    vol_name = args.volname

    window_w, window_h = args.window_size
    app_x, app_y = args.app_pos
    drop_x, drop_y = args.drop_link_pos
    icon_size = args.icon_size
    # Finder only supports font sizes 10..16. Larger values trigger AppleEvent error -10000.
    text_size = max(10, min(16, args.text_size))

    size_mb = get_size_mb(app_path) + 80

    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    temp_dmg = os.path.join(output_dir, f".temp_{int(time.time())}_{os.path.basename(output_path)}")
    if os.path.exists(temp_dmg):
        os.remove(temp_dmg)

    unmount_volume(vol_name)

    # 1. Create writable DMG
    subprocess.check_call([
        "hdiutil", "create",
        "-size", f"{size_mb}m",
        "-fs", "HFS+",
        "-volname", vol_name,
        temp_dmg,
    ])

    # 2. Attach DMG
    attach_out = subprocess.check_output([
        "hdiutil", "attach",
        "-readwrite",
        "-nobrowse",
        "-plist",
        temp_dmg,
    ])
    plist = plistlib.loads(attach_out)
    mount_point = None
    for entity in plist.get("system-entities", []):
        if "mount-point" in entity:
            mount_point = entity["mount-point"]
            break

    if not mount_point:
        raise RuntimeError("Failed to mount temporary DMG")

    try:
        # 3. Copy .app bundle
        target_app = os.path.join(mount_point, app_name)
        subprocess.check_call(["cp", "-a", app_path, target_app])

        # 4. Create Applications symlink
        os.symlink("/Applications", os.path.join(mount_point, "Applications"))

        # 5. Copy background image into hidden .background directory
        bg_dir = os.path.join(mount_point, ".background")
        os.makedirs(bg_dir, exist_ok=True)
        bg_filename = os.path.basename(bg_path)
        shutil.copy(bg_path, os.path.join(bg_dir, bg_filename))
        # If TIFF, also copy companion PNGs if present
        bg_base = os.path.splitext(bg_path)[0]
        for ext in [".png", "@2x.png"]:
            comp = bg_base + ext
            if os.path.exists(comp):
                shutil.copy(comp, os.path.join(bg_dir, os.path.basename(comp)))

        # 6. Volume icon
        if args.icon and os.path.exists(args.icon):
            target_icon = os.path.join(mount_point, ".VolumeIcon.icns")
            shutil.copy(args.icon, target_icon)
            subprocess.call(["/usr/bin/SetFile", "-c", "icnC", target_icon])
            subprocess.call(["/usr/bin/SetFile", "-a", "C", mount_point])

        # 7. Hide .app extension
        subprocess.call(["/usr/bin/SetFile", "-a", "E", target_app])

        # 8. Configure Finder layout via AppleScript
        # macOS title bar height is ~28pt. Outer window bounds height must be window_h + 28
        # so that the inner content area exactly matches the 752x436 background image.
        script = f'''
        tell application "Finder"
            tell disk "{vol_name}"
                open
                set current view of container window to icon view
                set toolbar visible of container window to false
                set statusbar visible of container window to false
                try
                    set pathbar visible of container window to false
                end try
                set the bounds of container window to {{160, 120, 160 + {window_w}, 120 + {window_h} + 28}}
                set opts to the icon view options of container window
                tell opts
                    set icon size to {icon_size}
                    set text size to {text_size}
                    set arrangement to not arranged
                end tell
                set background picture of opts to file ".background:{bg_filename}"
                set position of item "{app_name}" to {{{app_x}, {app_y}}}
                set position of item "Applications" to {{{drop_x}, {drop_y}}}
                update without registering applications
                delay 2
                close
            end tell
        end tell
        '''
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=30)
        if res.returncode != 0:
            print(f"Warning: Finder AppleScript returned code {res.returncode}: {res.stderr.strip()}", file=sys.stderr)
        else:
            time.sleep(2)

        # 9. Sync filesystem writes before unmounting
        subprocess.call(["sync", "--file-system", mount_point])
    finally:
        subprocess.call(["diskutil", "eject", mount_point])
        time.sleep(1)

    # 10. Convert to compressed readonly UDZO DMG
    if os.path.exists(output_path):
        os.remove(output_path)

    subprocess.check_call([
        "hdiutil", "convert",
        temp_dmg,
        "-format", "UDZO",
        "-imagekey", "zlib-level=9",
        "-o", output_path,
    ])

    if os.path.exists(temp_dmg):
        os.remove(temp_dmg)

    print(f"Successfully built DMG: {output_path}")


if __name__ == "__main__":
    main()
