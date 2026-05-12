---
description: shared runner repo-local 自律実行の正規ルート
---

# Miyabi Auto App

この repo は shared runner を使って自律実行する。

## 既定コマンド

```bash
npx -y @takahiro-shimizu-1/automation-runner@0.1.14 dispatch --auto
```

## 初回 setup

- ローカルで shared runner package を引くなら `.npmrc.example` を `.npmrc` にコピーする
- `.env.example` を `.env` にコピーする
- GitHub token は `docs/GITHUB_TOKEN_SETUP.md` を見る
- まず status を見たいときは `/miyabi-status`

## 補足

- この command は repo-local の app repo を対象にする
- 共有 runtime の source of truth は app repo の外にある
- 実行 profile は `config/shared-runner-profile-manifest.json` を truth とする
