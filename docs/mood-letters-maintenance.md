# 星辰馬卡龍球：心情信維護說明

## 1) 放檔位置
- 請把新信件（`.docx` / `.txt`）放到：
  - `參考資料/codex/心情信`
- 不需要先手動轉 TXT，腳本會自動解析 `.docx` 並產生可讀取的 `.txt` 內容檔。

## 2) 產生心情索引
- 在專案根目錄執行：
```bash
npm run build:mood-letters
```
- 會自動更新三個檔案：
  - `public/data/mood-letters/index.json`
  - `public/data/mood-letters/overrides.json`
  - `public/data/mood-letters/review.json`

## 3) 自動分類規則
- 腳本會用檔名關鍵字自動判斷心情（可多標籤）：
  - `longing` 想你抱抱
  - `low` 難過低潮
  - `anxious` 焦慮不安
  - `night` 失眠夜晚
  - `health` 身體不適
  - `calm` 平靜放空
  - `travel` 旅行出發
  - `festival` 節日紀念
  - `daily` 生活日常
  - `support` 特別叮嚀

## 4) 人工修正分類（推薦）
- 若某封信分類不準，請改：
  - `public/data/mood-letters/overrides.json`
- 用 `displayName`（完整檔名）當 key，填 mood id 陣列。

範例：
```json
{
  "overrides": {
    "📮 給突然想哭的老婆.docx": ["low", "longing"],
    "🌙 時光信 08｜主旨：老婆，這天我想晚一點放妳睡.docx": ["night", "longing"]
  }
}
```

## 5) 看哪些要人工確認
- `public/data/mood-letters/review.json` 會列出目前沒命中規則、建議手動標註的信件。

## 6) 建議新增命名方式（可選）
- 你現在的命名已可用，不必重命名。
- 若未來要更穩定分類，建議在檔名主旨加關鍵字（例：`想哭`、`睡不著`、`生病`、`旅行`）。

## 7) 心情星球本機設定與收藏（v2）
- 心情星球小設定儲存在：
  - `memorial-mood-letters-prefs-v1`
- 心情星球收藏（星號）儲存在：
  - `memorial-mood-letters-favorites-v1`

### 要重置心情星球
1. 打開瀏覽器 DevTools（F12）→ Console。
2. 執行：
```js
localStorage.removeItem('memorial-mood-letters-prefs-v1');
localStorage.removeItem('memorial-mood-letters-favorites-v1');
```
3. 重新整理頁面。
