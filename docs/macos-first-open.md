## macOS 首次安装与打开 / First launch

本项目的 macOS App 和 DMG 使用 **Ad-hoc 签名，未经过 Apple 公证**。支持 macOS 14 及以上的 Apple Silicon 和 Intel Mac，首次打开时可能被 Gatekeeper 拦截。Tauri 更新包另有独立签名，用于验证更新来源，不代表 Apple 公证。

请从 [hzm0321/c7n-taskboard 的 GitHub Releases](https://github.com/hzm0321/c7n-taskboard/releases) 下载 DMG，打开后将 App 拖入「应用程序」。以下步骤仅适用于你确认来源可信的安装包。

### 方式 A：系统设置放行（macOS 15 及以上推荐）

1. 打开「应用程序」中的 C7N Codex；若被阻止，关闭提示框。
2. 打开「系统设置 → 隐私与安全性」，找到底部「安全性」区域。
3. 在对应的 C7N Codex 提示旁点击「仍要打开」，按系统提示输入密码或使用 Touch ID，再确认打开。

### 方式 B：右键打开（macOS 14）

按住 Control 点击 App，选择「打开」，然后在确认框中再次选择「打开」。如果没有放行选项，使用方式 A。

### 方式 C：仅移除该 App 的下载隔离属性

“应用已损坏”也可能表示下载不完整、签名无效或文件被修改，不能一概归因于隔离属性。请先重新下载并确认来源；也可以用以下命令检查已安装 App 的签名：

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/C7N Codex.app"
```

确认来源可信、签名检查通过，但仍因下载隔离被阻止时，退出 App 后执行：

```bash
xattr -dr com.apple.quarantine "/Applications/C7N Codex.app"
```

只有在提示权限不足时才在命令前加 `sudo`。安装 Beta 版时，将路径中的名称替换为 `C7N Codex Beta.app`。此命令只移除指定 App 的隔离属性，不清除其他扩展属性，也不关闭系统 Gatekeeper。

### English

The macOS App and DMG are **ad-hoc signed and not notarized by Apple**. They support macOS 14 or later on Apple Silicon and Intel. Download only from the repository's Releases page above, then drag the App into Applications. Tauri updater signatures verify update authenticity; they are separate from Apple notarization.

- **macOS 15 or later:** try opening the App, dismiss the warning, then go to **System Settings → Privacy & Security → Open Anyway** for this App and authenticate.
- **macOS 14:** Control-click the App, choose **Open**, then confirm **Open**. Use System Settings if this option is unavailable.
- **If macOS reports that the App is damaged:** download it again and verify its source and code signature using the command above. If the signature is valid and quarantine is still the cause, remove only this App's quarantine attribute using the `xattr -dr com.apple.quarantine` command above. Add `sudo` only if permissions require it. For Beta builds, use `C7N Codex Beta.app` in the path. Do not disable Gatekeeper globally.
