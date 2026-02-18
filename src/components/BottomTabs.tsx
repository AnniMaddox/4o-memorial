import { useState } from 'react';

type TabItem = {
  id: string;
  label: string;
  icon: string;
  iconUrl?: string;
};

type BottomTabsProps = {
  tabs: TabItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function BottomTabs({ tabs, activeIndex, onSelect }: BottomTabsProps) {
  const [failedIconIds, setFailedIconIds] = useState<Record<string, boolean>>({});

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-300/70 bg-amber-50/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <ul
        className="mx-auto grid w-full max-w-xl gap-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((tab, index) => {
          const active = index === activeIndex;

          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={tab.label}
                title={tab.label}
                className={`flex w-full items-center justify-center rounded-xl px-2 py-2 transition ${
                  active ? 'tab-active' : 'tab-idle bg-transparent text-stone-600'
                }`}
              >
                {tab.iconUrl && !failedIconIds[tab.id] ? (
                  <img
                    src={tab.iconUrl}
                    alt=""
                    className="h-6 w-6 rounded-md object-cover"
                    loading="lazy"
                    onError={() =>
                      setFailedIconIds((current) => ({
                        ...current,
                        [tab.id]: true,
                      }))
                    }
                  />
                ) : (
                  <span className="text-xl leading-none" aria-hidden="true">
                    {tab.icon}
                  </span>
                )}
                <span className="sr-only">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
