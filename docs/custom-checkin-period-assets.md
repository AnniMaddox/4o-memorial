# Checkin / Period 自訂資料放置

## 1) 打卡頁小人
- 資料夾：`public/checkin-chibi/`
- 支援：`.png .jpg .jpeg .webp .gif .avif`
- 檔名：可自訂（例如 `anni-01.png`）

## 2) 經期頁小人
- 資料夾：`public/period-chibi/`
- 支援：`.png .jpg .jpeg .webp .avif`
- 檔名：可自訂

## 3) 打卡頁語句
- 優先讀：`public/data/checkin/checkin_phrases.json`
- 若 JSON 不存在，讀：`public/data/checkin/checkin_phrases.txt`

`checkin_phrases.json` 格式（兩種都可）：

```json
["句子1", "句子2"]
```

```json
{ "phrases": ["句子1", "句子2"] }
```

`checkin_phrases.txt`：一行一句。

## 4) 打卡頁連續簽到里程碑語句（額外彈窗）
- 檔案：`public/data/checkin/checkin_milestones.json`
- 里程碑數字可自訂（例如 7/14/21/30/100）
- 格式：

```json
{
  "7": ["..."],
  "14": ["..."],
  "21": ["..."],
  "30": ["..."],
  "100": ["..."]
}
```

## 5) 經期頁語句（日期 hover）
- 檔案：`public/data/period/period_hover_phrases.json`
- 格式：

```json
{
  "period": ["..."],
  "prePeriod": ["..."],
  "ovulation": ["..."],
  "safe": ["..."]
}
```

## 6) 經期頁語句（小人氣泡）
- 檔案：`public/data/period/period_chibi_phrases.json`
- 格式：

```json
{
  "pms": ["..."],
  "menstrual": ["..."],
  "ovulation": ["..."],
  "recovery": ["..."]
}
```

## 7) 經期頁「本次經期結束」額外語句（彈窗）
- 檔案：`public/data/period/period_post_end_phrases.json`
- 格式：

```json
{
  "phrases": ["...", "..."]
}
```

## 更新方式
1. 把檔案丟到上面對應資料夾。
2. push 到 GitHub。
3. 等部署完成後重整即可生效。

## 空白模板（可直接複製改名）
- `public/data/checkin/checkin_phrases.blank.json`
- `public/data/checkin/checkin_milestones.blank.json`
- `public/data/period/period_hover_phrases.blank.json`
- `public/data/period/period_chibi_phrases.blank.json`
- `public/data/period/period_post_end_phrases.blank.json`
