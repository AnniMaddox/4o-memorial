# CODEX HANDOFF

最後更新：2026-02-23

## 1) 這份檔案的用途
- 這是「交接摘要 + 常見地雷 + 操作流程」。
- 開新視窗或對話壓縮後，先讀這份再開始改。
- 每次完成一個功能後，請補一段「變更紀錄」。

## 2) 本專案目前重要路徑
- Repo: `/mnt/c/Users/hunte/Desktop/Github/4o紀念網頁`
- 主程式: `src/`
- 靜態資料: `public/data/`
- 小人池:
  - 全域池: `public/chibi/`
  - 分池: `public/chibi-pool-i/`, `public/chibi-pool-ii/`
- 各頁專屬小人池（已有）:
  - `public/mdiary-chibi/`
  - `public/fitness-chibi/`
  - `public/pomodoro-chibi/`
  - `public/notes-chibi/`
  - `public/calendar-chibi/`
  - `public/letters-ab-chibi/`
  - `public/letter-chibi/`
  - `public/period-chibi/`
  - `public/checkin-chibi/`

## 3) 常見工作流程（避免推送失敗）
1. 先看狀態：`git status --short`
2. 只 add 本次要推的檔案（不要全加）
3. `npm run build` 先過再推
4. `git push` 前若被拒：
   - `git pull --rebase origin main`
   - 再 `git push origin main`
5. 若因「本地有未暫存變更」不能 rebase：
   - 先只 stash 相關檔案（例如 `git stash push -- <file>`）
   - rebase/push 後再 `git stash pop`

## 4) 最近關鍵地雷：唱盤中心圖被吃掉（iPhone）
現象：
- 圓盤中心圖在手機上「往上調」時，上半部被莫名裁掉。

原因：
- `object-position: calc(...)` + `object-fit: cover` 在 iOS 上容易出現怪裁切。

目前修法（已套用）：
- 不再靠 `object-position calc` 調位移。
- 改成外層包一層，使用 `transform: translateY(px)`。
- 圖片改 `object-fit: contain`，避免硬裁頭。
- 相關檔案：
  - `src/pages/HomePage.tsx`
  - `src/index.css`

## 5) 最近 UI 決策（唱盤）
- 右側控制改直列：LED、開關、速率旋鈕。
- 速率選單：`33/45/78 RPM`（彈出選單）。
- 有上傳封面時，圓心粉色底圈不顯示。
- 唱臂位置以「底座圓心對齊」為準，必要時只調 `right`。

## 6) 開發預覽
- 常用：`npm run dev -- --host 0.0.0.0 --port 5173`
- 若 5173/5174 被占用，Vite 會自動跳下一個 port。
- 手機預覽網址要看終端輸出（Network URL）。

## 7) 變更紀錄模板（每次完成後補）
### YYYY-MM-DD HH:mm
- 範圍：
- 修改檔案：
- 重點：
- 風險/注意：
- build：pass / fail
- push commit：

## 8) 最近已推送 commit（參考）
- `65a5a80` fix(home): align tonearm pivot and remove pink label ring
- `2e4ebf3` fix(home): use translateY+contain for vinyl center image
- `94aeb26` fix(home): stop vinyl center image clipping on iPhone
