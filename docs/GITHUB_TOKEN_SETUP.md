# GitHub Token Setup

## まず分けて考える

この repo では token の役割が 2 つあります。

- GitHub API 用
  - issue / PR / Actions / contents を触る token
  - local `.env` の `GITHUB_TOKEN` や、GitHub Actions の `github.token`
- package install 用
  - shared runner package `@takahiro-shimizu-1/automation-runner` を取る token
  - repo secret / local 環境変数 `AUTOMATION_RUNNER_PACKAGE_TOKEN`

## GitHub Actions で package を取るとき

generated workflow は次を前提にしています。

- `actions/setup-node` で package scope と registry を設定する
- `permissions: packages: read` を宣言する
- `NODE_AUTH_TOKEN=${{ secrets.AUTOMATION_RUNNER_PACKAGE_TOKEN || github.token }}` を使う
- `wait-for-check` を使う PR workflow では `permissions: actions: read` も宣言する
- `pr-review-gate` / `pr-auto-merge` を使う workflow では `permissions: checks: read` も宣言する

つまり通常は app repo の `GITHUB_TOKEN` を先に使い、それで package を読めないときだけ `AUTOMATION_RUNNER_PACKAGE_TOKEN` を追加します。

### `AUTOMATION_RUNNER_PACKAGE_TOKEN` が必要なケース

- package repo と app repo の owner が違う
- private package への read access を app repo の `GITHUB_TOKEN` が持っていない
- GitHub Packages の granular permission を明示的に分けている

この token は **classic PAT** を使い、最低でも `read:packages` を付けます。
別 owner / private repo では、対象 app repo 側の repo secret に `AUTOMATION_RUNNER_PACKAGE_TOKEN` を追加します。
token なしで `npm view @takahiro-shimizu-1/automation-runner --registry=https://npm.pkg.github.com` が `401 Unauthorized` になる場合、それは expected failure です。

## ローカルで package を取るとき

いちばん簡単なのは `.npmrc.example` を `.npmrc` にコピーすることです。

この repo の shared runner install 設定は次です。

```ini
@takahiro-shimizu-1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${AUTOMATION_RUNNER_PACKAGE_TOKEN}
```

そのうえで shell に token を入れます。

```bash
export AUTOMATION_RUNNER_PACKAGE_TOKEN=ghp_replace_me
```

source of truth は `config/shared-runner-profile-manifest.json` の `runnerPackage` です。

## GitHub Actions runtime 用 token

issue / PR / contents を触る runtime step では、shared runner が次の優先順で token を使います。

1. `GH_PROJECT_TOKEN`
2. `GITHUB_TOKEN` (`github.token`)

`review-and-pr` で remote branch / remote PR を作り、その後にこの repo 側の `push` / `pull_request` workflow も続けて動かしたい場合は、repo secret `GH_PROJECT_TOKEN` を設定してください。`github.token` だけでも remote PR 自体は作れますが、GitHub の既定制約でその PR から後続 workflow が起動しないことがあります。

## ローカル runtime 用 `GITHUB_TOKEN`

package install token と、runtime が GitHub API を叩く token は別物として扱います。

`GITHUB_TOKEN` は local `.env` に入れます。

```bash
GITHUB_TOKEN=ghp_replace_me
```

こちらは fine-grained token でも classic token でもよいですが、profile に応じて必要権限を満たしてください。

### `planning-only`

- Issues: read / write
- Pull requests: read / write
- Actions: read / write
- Contents: read

### `review-and-pr`

- `planning-only` に加えて
- Contents: write

### `deploy-enabled`

- `review-and-pr` に加えて
- Pages: write
- ID token: write
- provider 固有の権限

## 補足

- `.npmrc` は commit しません
- `.gitnexus/` は GitNexus が repo を解析して作る generated state なので commit しません
- `.claude/skills/gitnexus/` は GitNexus analyze が生成する補助 skill なので、必要ならローカルで再生成して使います
- Project 連携が必要なら `GH_PROJECT_TOKEN` を別で持つ
- local package install は `AUTOMATION_RUNNER_PACKAGE_TOKEN`、local GitHub API 実行は `.env` の `GITHUB_TOKEN` を使い分ける
- GitHub Actions の runtime では `GH_PROJECT_TOKEN` があればそれを優先し、未設定なら `github.token` を使う
- custom workflow で shared runner package を直接呼ぶ場合も、同じく `permissions: packages: read` を付ける
- owner が違う repo では `AUTOMATION_RUNNER_PACKAGE_TOKEN` を repo secret に入れる
- token なしの `401 Unauthorized` は package auth 未設定として切り分ける

## GitNexus generated state

GitNexus は repo ごとに実行します。
この repo で `automation-runner gitnexus-bootstrap` や `gitnexus analyze` を実行すると、解析結果として `.gitnexus/` が作られます。

これは source code ではなく、その時点の解析結果です。
複数 repo をまとめて見る場合も、各 repo の `.gitnexus/` を commit して共有するのではなく、中央 runtime 側の GitNexus registry / group で束ねます。

commit するもの:

- app code
- `.github/workflows/`
- `config/shared-runner-profile-manifest.json`
- `docs/GITHUB_TOKEN_SETUP.md`

commit しないもの:

- `.gitnexus/`
- `.claude/skills/gitnexus/`
- `.ai/`
- `.npmrc`

## GitNexus portfolio 参加

app repo は repo-local GitNexus を持ちます。
複数 repo を横断して見る場合は、app repo の `config/shared-runner-profile-manifest.json` の `gitnexus` block を central runtime 側の `config/gitnexus-portfolios.json` に対応させます。

重要な点:

- app repo には GitNexus 本体をコピーしません
- app repo 側は `automation-runner gitnexus-bootstrap` で自分の `.gitnexus/` を作ります
- central runtime は対象 repo を local clone として見られる必要があります
- portfolio への反映は real-time ではなく、automation-hub central runtime 側で `automation-runner gitnexus-portfolio-sync <portfolio>` を実行する explicit sync です
- `gitnexus.registryName` は GitNexus registry の exact name です。local folder name ではありません
- `gitnexus.repoSlug` は local git remote と一致している必要があります
- `gitnexus.portfolios` は、実際に portfolio に参加させる段階で追加します
- cross-repo contract を使う場合は `config/gitnexus-contracts.json` に provider / consumer を宣言します

どこに何を書くか:

- app repo: 自分が提供する contract と、自分が使う contract を `config/gitnexus-contracts.json` に書きます
- automation-hub: どの repo を同じ portfolio として見るかを `config/gitnexus-portfolios.json` に書きます
- central runtime: `~/.gitnexus/groups/<portfolio>/group.yaml` は sync 時に生成されます。手で育てるファイルではありません
- GitNexus generated state: `.gitnexus/`, `~/.gitnexus/registry.json`, `~/.gitnexus/groups/` は実行結果なので app repo に commit しません

例:

```json
{
  "gitnexus": {
    "registryName": "clean-arch-billing-service-validation",
    "repoSlug": "takahiro-shimizu-1/clean-arch-billing-service-validation",
    "portfolios": [
      {
        "name": "clean-arch-local",
        "groupPath": "commerce/billing",
        "role": "app"
      }
    ]
  }
}
```
