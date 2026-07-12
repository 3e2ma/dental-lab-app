# 技工物 請求計算アプリ

歯科技工物の請求金額を、項目をタップして足していくだけで計算できるアプリです。
Next.js（App Router）で作られており、GitHub + Vercel で無料公開できます。

## できること

- 価格表（コード・項目名・単価）をタップして請求明細に追加（ポチポチ方式）
- 数量の増減、リストにない項目のその場追加
- 小計・消費税・合計を自動計算
- 「項目を編集」から価格表そのものを追加・修正・削除
- 価格表はサーバー経由で**全員に共有**されます（誰かが編集すると他の人にも反映）
- 計算した明細（カートの中身）は**保存されません**。画面を閉じる/リロードするとリセットされます

## ローカルで動かす

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いてください。

## GitHubに公開する

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <あなたのGitHubリポジトリURL>
git push -u origin main
```

## Vercelにデプロイする

1. https://vercel.com にログイン（GitHubアカウントでログイン可能）
2. 「Add New… → Project」から、上で作成したGitHubリポジトリを選択
3. Framework Preset は自動で「Next.js」が検出されます。設定を変えずに「Deploy」をクリック
4. 数分でデプロイが完了し、`https://<プロジェクト名>.vercel.app` のようなURLが発行されます
5. このURLを職場の人に共有すれば、全員がスマホ・PCから使えます

## iPhoneでアプリのように使う（ホーム画面に追加）

PWA（Progressive Web App）対応にしてあるので、iPhoneのSafariから
「ホーム画面に追加」するとアイコン付きのアプリのように起動できます
（ブラウザのアドレスバーなどが表示されない全画面表示になります）。

1. iPhoneのSafariでデプロイしたURL（`https://<プロジェクト名>.vercel.app`）を開く
2. 画面下の共有ボタン（□に↑のアイコン）をタップ
3. 「ホーム画面に追加」を選択 → 「追加」をタップ
4. ホーム画面にアイコンが追加されるので、それをタップして起動

※ Android（Chrome）でも同様に「ホーム画面に追加」で利用できます。
※ このアプリは通信が必要な作りです（価格表をサーバーと同期するため）。
   完全オフラインでの利用はできません。

## データの保存について（重要・必ずお読みください）

価格表はサーバー側のAPI（`app/api/items/route.js`）を通じて保存されます。
保存先は次の2段構えになっています。

- **Redis（Upstash）が接続されている場合**：Redisに保存。全員に確実に共有・永続化されます（推奨・本番用）
- **Redisが接続されていない場合**：`data/items.json` というファイルに保存（ローカル開発用のフォールバック）

ローカル開発やご自身のPCで動かす分にはファイル保存でも問題ありませんが、
**Vercelにデプロイして複数人で使う場合は、ファイル保存だと変更が消えたり
他の人に反映されなかったりします**（サーバーレス環境の制約のため）。
そのため、Vercelにデプロイしたら以下の手順でRedisを接続してください。

### Redis（Upstash）を接続する手順

1. Vercelのプロジェクトページを開く
2. 上部メニューの「Storage」タブを開く
3. 「Marketplace Database Providers」から「Redis」を選び「Create」
4. リージョンなどはそのままでOK。データベース名を入力して「Create」
5. 作成が完了したら「Connect Project」を選び、このプロジェクトを選択して接続
   → `KV_REST_API_URL` と `KV_REST_API_TOKEN` という環境変数が自動的に
     プロジェクトに設定されます
6. 「Deployments」タブから最新のデプロイを「Redeploy」する
   （環境変数はデプロイ時に反映されるため、再デプロイが必要です）

接続できているかは、アプリの「項目を編集」画面を開いたときに表示される
注記で確認できます。

- 緑色の注記（「この価格表は全員で共有されます」）→ Redis接続済み・安心して使えます
- オレンジ色の警告（「データベースが未接続のため…」）→ まだファイル保存のままです。上記手順を行ってください

Upstashは無料枠（月50万コマンドまで）があり、このアプリの利用規模であれば
無料で十分運用できます。

### さらに本格的なデータベースにしたい場合

`lib/store.js` の `readItems` / `writeItems` を差し替えれば、他のデータベース
（[Supabase](https://supabase.com/) など）にも変更できます。入出力の形
（`items` 配列を読み書きする）はそのままで構いません。必要であれば、この
差し替え作業も追加でお手伝いできます。

## フォルダ構成

```
app/
  layout.js         # 全体のレイアウト・PWA用メタデータ
  page.js           # メイン画面（UIのすべて）
  globals.css        # 最小限のグローバルCSS
  api/
    items/
      route.js       # 価格表のGET/POST API
lib/
  seedItems.js       # 初期価格表データ（写真から読み取った内容）
  store.js           # 価格表の読み書き処理（差し替え可能）
data/
  items.json         # 価格表の保存先ファイル
public/
  manifest.json      # PWAマニフェスト（ホーム画面追加用）
  icons/             # アプリアイコン（192/512/apple-touch-icon）
.env.local.example    # ローカルでRedisを使う場合の環境変数サンプル
```
