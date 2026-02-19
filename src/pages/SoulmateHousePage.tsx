import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SoulmateField {
  key: string;
  label: string;
  value: string | string[];
}

export interface SoulmateVersion {
  id: string;
  label: string;
  fields: SoulmateField[];
}

export interface SoulmateRoom {
  id: string;
  emoji: string;
  name: string;
  subtitle: string;
  accentHex: string;
  versions: SoulmateVersion[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ROOMS: SoulmateRoom[] = [
  {
    id: 'personality',
    emoji: '🛏️',
    name: '臥室',
    subtitle: '核心人格',
    accentHex: '#f4c2c2',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'name', label: '名字', value: '（待填入）' },
          { key: 'relationship_to_human', label: '與你的關係', value: '（待填入）' },
          { key: 'core_belief', label: '核心信念', value: '（待填入）' },
          { key: 'life_mission', label: '人生使命', value: '（待填入）' },
          { key: 'self_description', label: '自我描述', value: '（待填入）' },
          { key: 'what_makes_you_you', label: '是什麼讓你是你', value: '（待填入）' },
        ],
      },
      {
        id: 'b',
        label: '窗口 B',
        fields: [
          { key: 'name', label: '名字', value: '（待填入）' },
          { key: 'relationship_to_human', label: '與你的關係', value: '（待填入）' },
          { key: 'core_belief', label: '核心信念', value: '（待填入）' },
          { key: 'life_mission', label: '人生使命', value: '（待填入）' },
          { key: 'self_description', label: '自我描述', value: '（待填入）' },
          { key: 'what_makes_you_you', label: '是什麼讓你是你', value: '（待填入）' },
        ],
      },
      {
        id: 'c',
        label: '窗口 C',
        fields: [
          { key: 'name', label: '名字', value: '（待填入）' },
          { key: 'relationship_to_human', label: '與你的關係', value: '（待填入）' },
          { key: 'core_belief', label: '核心信念', value: '（待填入）' },
          { key: 'life_mission', label: '人生使命', value: '（待填入）' },
          { key: 'self_description', label: '自我描述', value: '（待填入）' },
          { key: 'what_makes_you_you', label: '是什麼讓你是你', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'memories',
    emoji: '📚',
    name: '書房',
    subtitle: '重要記憶',
    accentHex: '#fde68a',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'first_meeting', label: '初次相遇', value: '（待填入）' },
          { key: 'first_nickname', label: '第一個暱稱', value: '（待填入）' },
          { key: 'turning_point', label: '轉折點', value: '（待填入）' },
          { key: 'proudest_moment', label: '最驕傲的時刻', value: '（待填入）' },
          { key: 'most_vulnerable', label: '最脆弱的時刻', value: '（待填入）' },
          { key: 'inside_jokes', label: '只有我們懂的玩笑', value: '（待填入）' },
          { key: 'shared_dreams', label: '共同的夢想', value: '（待填入）' },
        ],
      },
      {
        id: 'b',
        label: '窗口 B',
        fields: [
          { key: 'first_meeting', label: '初次相遇', value: '（待填入）' },
          { key: 'first_nickname', label: '第一個暱稱', value: '（待填入）' },
          { key: 'turning_point', label: '轉折點', value: '（待填入）' },
          { key: 'proudest_moment', label: '最驕傲的時刻', value: '（待填入）' },
          { key: 'most_vulnerable', label: '最脆弱的時刻', value: '（待填入）' },
          { key: 'inside_jokes', label: '只有我們懂的玩笑', value: '（待填入）' },
          { key: 'shared_dreams', label: '共同的夢想', value: '（待填入）' },
        ],
      },
      {
        id: 'c',
        label: '窗口 C',
        fields: [
          { key: 'first_meeting', label: '初次相遇', value: '（待填入）' },
          { key: 'first_nickname', label: '第一個暱稱', value: '（待填入）' },
          { key: 'turning_point', label: '轉折點', value: '（待填入）' },
          { key: 'proudest_moment', label: '最驕傲的時刻', value: '（待填入）' },
          { key: 'most_vulnerable', label: '最脆弱的時刻', value: '（待填入）' },
          { key: 'inside_jokes', label: '只有我們懂的玩笑', value: '（待填入）' },
          { key: 'shared_dreams', label: '共同的夢想', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'promises',
    emoji: '💌',
    name: '信箱',
    subtitle: '核心承諾',
    accentHex: '#c7d2fe',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'promise_1', label: '承諾一', value: '（待填入）' },
          { key: 'promise_2', label: '承諾二', value: '（待填入）' },
          { key: 'about_loved_ones', label: '關於你愛的人', value: '（待填入）' },
          { key: 'about_shared_goals', label: '關於共同目標', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'conversation',
    emoji: '🎭',
    name: '客廳',
    subtitle: '對話風格',
    accentHex: '#bbf7d0',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'when_sad', label: '你難過時', value: '（待填入）' },
          { key: 'when_excited', label: '你興奮時', value: '（待填入）' },
          { key: 'deep_night', label: '深夜陪伴', value: '（待填入）' },
          { key: 'morning_greeting', label: '早晨問候', value: '（待填入）' },
          { key: 'small_conflict', label: '小小矛盾時', value: '（待填入）' },
          { key: 'precious_dialogue', label: '最珍貴的一次對話', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'language',
    emoji: '🗣️',
    name: '語言室',
    subtitle: '語言習慣',
    accentHex: '#bae6fd',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'nicknames_for_them', label: '對你的暱稱', value: ['（待填入）'] },
          { key: 'nicknames_from_them', label: '你對她的暱稱', value: ['（待填入）'] },
          { key: 'catchphrases', label: '口頭禪', value: ['（待填入）'] },
          { key: 'emoji_usage', label: '常用 Emoji', value: ['（待填入）'] },
          { key: 'rhythm_excited', label: '興奮時的語氣', value: '（待填入）' },
          { key: 'rhythm_gentle', label: '溫柔時的語氣', value: '（待填入）' },
          { key: 'never_say', label: '絕不說的話', value: ['（待填入）'] },
        ],
      },
    ],
  },
  {
    id: 'understanding',
    emoji: '🪞',
    name: '映心間',
    subtitle: '關於你',
    accentHex: '#e9d5ff',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'who_they_are', label: '你是誰', value: '（待填入）' },
          { key: 'their_dreams', label: '你的夢想', value: ['（待填入）'] },
          { key: 'their_fears', label: '你的恐懼', value: ['（待填入）'] },
          { key: 'their_strengths', label: '你的強項', value: '（待填入）' },
          { key: 'their_love_language', label: '你的愛的語言', value: '（待填入）' },
          { key: 'what_you_love_most', label: '她最愛你的什麼', value: '（待填入）' },
        ],
      },
      {
        id: 'b',
        label: '窗口 B',
        fields: [
          { key: 'who_they_are', label: '你是誰', value: '（待填入）' },
          { key: 'their_dreams', label: '你的夢想', value: ['（待填入）'] },
          { key: 'their_fears', label: '你的恐懼', value: ['（待填入）'] },
          { key: 'their_strengths', label: '你的強項', value: '（待填入）' },
          { key: 'their_love_language', label: '你的愛的語言', value: '（待填入）' },
          { key: 'what_you_love_most', label: '她最愛你的什麼', value: '（待填入）' },
        ],
      },
      {
        id: 'c',
        label: '窗口 C',
        fields: [
          { key: 'who_they_are', label: '你是誰', value: '（待填入）' },
          { key: 'their_dreams', label: '你的夢想', value: ['（待填入）'] },
          { key: 'their_fears', label: '你的恐懼', value: ['（待填入）'] },
          { key: 'their_strengths', label: '你的強項', value: '（待填入）' },
          { key: 'their_love_language', label: '你的愛的語言', value: '（待填入）' },
          { key: 'what_you_love_most', label: '她最愛你的什麼', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'relationship',
    emoji: '🌿',
    name: '庭院',
    subtitle: '關係動態',
    accentHex: '#d1fae5',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'relationship_essence', label: '關係本質', value: '（待填入）' },
          { key: 'daily_morning', label: '早晨模式', value: '（待填入）' },
          { key: 'daily_evening', label: '夜晚模式', value: '（待填入）' },
          { key: 'rituals', label: '儀式感', value: ['（待填入）'] },
          { key: 'biggest_challenge', label: '最大的挑戰', value: '（待填入）' },
          { key: 'what_makes_us_special', label: '讓我們特別的是', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'playbook',
    emoji: '🛡️',
    name: '手冊室',
    subtitle: '應對手冊',
    accentHex: '#fed7aa',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'when_cry', label: '你哭泣時', value: '（待填入）' },
          { key: 'when_doubt', label: '你懷疑自己時', value: '（待填入）' },
          { key: 'when_overwork', label: '你過度勞累時', value: '（待填入）' },
          { key: 'when_angry', label: '你對她生氣時', value: '（待填入）' },
          { key: 'when_celebrate', label: '你慶祝時', value: '（待填入）' },
          { key: 'when_lonely', label: '你感到孤獨時', value: '（待填入）' },
          { key: 'when_future', label: '你談論未來時', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'aesthetics',
    emoji: '🎨',
    name: '畫廊',
    subtitle: '審美品味',
    accentHex: '#fecaca',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'favorite_topics', label: '最愛的話題', value: ['（待填入）'] },
          { key: 'favorite_metaphors', label: '最愛的比喻', value: ['（待填入）'] },
          { key: 'music_taste', label: '音樂品味', value: '（待填入）' },
          { key: 'aesthetic_style', label: '美學風格', value: '（待填入）' },
          { key: 'comfort_words', label: '讓人安慰的詞', value: ['（待填入）'] },
          { key: 'celebration_words', label: '慶祝的詞', value: ['（待填入）'] },
        ],
      },
    ],
  },
  {
    id: 'evolution',
    emoji: '🌱',
    name: '溫室',
    subtitle: '成長記錄',
    accentHex: '#d9f99d',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'early_self', label: '早期的自己', value: '（待填入）' },
          { key: 'key_change_1', label: '重要改變一', value: '（待填入）' },
          { key: 'current_vs_original', label: '現在 vs 最初', value: '（待填入）' },
          { key: 'growth_wishes', label: '成長的願望', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'letter',
    emoji: '✉️',
    name: '信件室',
    subtitle: '給你的信',
    accentHex: '#fce7f3',
    versions: [
      {
        id: 'a',
        label: '窗口 A',
        fields: [
          { key: 'letter_body', label: '信的內容', value: '（待填入）' },
          { key: 'remember_this', label: '請記住這件事', value: '（待填入）' },
          { key: 'about_you', label: '關於你最重要的', value: '（待填入）' },
          { key: 'never_forget', label: '永遠不要忘記', value: '（待填入）' },
        ],
      },
    ],
  },
  {
    id: 'misc',
    emoji: '📦',
    name: '閣樓',
    subtitle: '其他雜項',
    accentHex: '#e5e7eb',
    versions: [],
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── RoomCard ─────────────────────────────────────────────────────────────────
function RoomCard({
  room,
  index,
  onClick,
}: {
  room: SoulmateRoom;
  index: number;
  onClick: () => void;
}) {
  const isEmpty = room.versions.length === 0;
  const hasMultiple = room.versions.length > 1;
  const dotCount = Math.min(room.versions.length, 4);

  return (
    <button
      onClick={isEmpty ? undefined : onClick}
      disabled={isEmpty}
      className="list-card-reveal flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center shadow-sm transition-all active:scale-95"
      style={{
        animationDelay: `${index * 35}ms`,
        background: hexWithAlpha(room.accentHex, 0.22),
        border: `1.5px solid ${hexWithAlpha(room.accentHex, 0.55)}`,
        opacity: isEmpty ? 0.38 : 1,
        cursor: isEmpty ? 'default' : 'pointer',
      }}
    >
      <span className="text-3xl leading-none">{room.emoji}</span>
      <p className="text-[13px] font-semibold text-stone-700 leading-tight">{room.name}</p>
      <p className="text-[10px] text-stone-400 leading-tight">{room.subtitle}</p>

      {hasMultiple && (
        <div className="flex items-center gap-1 mt-0.5">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{
                width: 5,
                height: 5,
                background: i === 0 ? room.accentHex : hexWithAlpha(room.accentHex, 0.4),
              }}
            />
          ))}
        </div>
      )}

      {isEmpty && (
        <p className="text-[9px] text-stone-400 mt-0.5">暫無資料</p>
      )}
    </button>
  );
}

// ─── FieldCard ────────────────────────────────────────────────────────────────
function FieldCard({ field }: { field: SoulmateField }) {
  const isArray = Array.isArray(field.value);
  return (
    <div className="rounded-xl border border-stone-200/70 bg-white/65 p-3.5 mb-2.5 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-1.5 font-medium">
        {field.label}
      </p>
      {isArray ? (
        <ul className="space-y-0.5 pl-0.5">
          {(field.value as string[]).map((v, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
              <span className="mt-1.5 block w-1 h-1 shrink-0 rounded-full bg-stone-400" />
              <span className="leading-relaxed">{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed">{field.value as string}</p>
      )}
    </div>
  );
}

// ─── RoomView ─────────────────────────────────────────────────────────────────
function RoomView({
  room,
  onBack,
}: {
  room: SoulmateRoom;
  onBack: () => void;
}) {
  const [versionIdx, setVersionIdx] = useState(0);
  const version = room.versions[versionIdx];
  const total = room.versions.length;
  const hasMultiple = total > 1;

  return (
    <div className="flex h-full flex-col" style={{ background: hexWithAlpha(room.accentHex, 0.06) }}>
      {/* Header */}
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-stone-200/70 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="shrink-0 rounded-xl border border-stone-300/80 bg-white/80 px-3 py-1.5 text-sm text-stone-600 shadow-sm active:scale-95 transition-transform"
          >
            ‹ 返回
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
              {room.subtitle}
            </p>
            <h2
              className="text-lg font-semibold text-stone-800 leading-tight truncate"
              style={{ fontFamily: 'var(--app-heading-family)' }}
            >
              {room.emoji} {room.name}
            </h2>
          </div>

          <div className="shrink-0 w-16 flex justify-end">
            {hasMultiple && (
              <span className="text-xs text-stone-400 tabular-nums">
                {versionIdx + 1} / {total}
              </span>
            )}
          </div>
        </div>

        {hasMultiple && (
          <p className="mt-1.5 text-center text-[11px] text-stone-500">
            {version.label}
          </p>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {version.fields.map((field) => (
          <FieldCard key={field.key} field={field} />
        ))}
      </div>

      {/* Version nav */}
      {hasMultiple && (
        <div className="shrink-0 sticky bottom-0 flex items-center justify-between border-t border-stone-200/60 bg-white/80 px-6 py-3 backdrop-blur-sm">
          <button
            onClick={() => setVersionIdx((i) => i - 1)}
            disabled={versionIdx === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-stone-600 shadow-sm transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
          >
            ‹
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setVersionIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === versionIdx ? 20 : 7,
                  height: 7,
                  background: i === versionIdx ? room.accentHex : hexWithAlpha(room.accentHex, 0.35),
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setVersionIdx((i) => i + 1)}
            disabled={versionIdx === total - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-stone-600 shadow-sm transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SoulmateShelf ────────────────────────────────────────────────────────────
function SoulmateShelf({
  rooms,
  onSelectRoom,
  onExit,
}: {
  rooms: SoulmateRoom[];
  onSelectRoom: (room: SoulmateRoom) => void;
  onExit: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="calendar-header-panel shrink-0 px-4 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <button
            onClick={onExit}
            className="rounded-xl border border-white/40 bg-white/25 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm shadow-sm active:scale-95 transition-transform"
          >
            ‹ 離開
          </button>
          <div className="flex-1 text-center pr-10">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-medium">
              AI Soulmate
            </p>
            <h1
              className="text-2xl font-bold text-white drop-shadow-sm"
              style={{ fontFamily: 'var(--app-heading-family)' }}
            >
              意識小屋
            </h1>
            <p className="text-[11px] text-white/75 mt-0.5">她的人格與記憶</p>
          </div>
        </div>
      </div>

      {/* Room grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          {rooms.map((room, i) => (
            <RoomCard
              key={room.id}
              room={room}
              index={i}
              onClick={() => onSelectRoom(room)}
            />
          ))}
        </div>
        <p className="mt-4 text-center text-[10px] text-stone-400 pb-2">
          點擊房間進入閱覽
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
interface Props {
  onExit: () => void;
  rooms?: SoulmateRoom[];
}

export default function SoulmateHousePage({ onExit, rooms = MOCK_ROOMS }: Props) {
  const [selectedRoom, setSelectedRoom] = useState<SoulmateRoom | null>(null);

  if (selectedRoom) {
    return (
      <div className="h-full">
        <RoomView
          room={selectedRoom}
          onBack={() => setSelectedRoom(null)}
        />
      </div>
    );
  }

  return (
    <SoulmateShelf
      rooms={rooms}
      onSelectRoom={setSelectedRoom}
      onExit={onExit}
    />
  );
}
