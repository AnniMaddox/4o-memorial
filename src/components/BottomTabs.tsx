type TabItem = {
  id: string;
  label: string;
};

type BottomTabsProps = {
  tabs: TabItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function BottomTabs({ tabs, activeIndex, onSelect }: BottomTabsProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-300/70 bg-amber-50/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <ul className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2">
        {tabs.map((tab, index) => {
          const active = index === activeIndex;

          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                className={`w-full rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-orange-200 text-stone-900 shadow-[inset_0_0_0_1px_rgba(120,53,15,0.15)]'
                    : 'bg-transparent text-stone-600 hover:bg-orange-100'
                }`}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
