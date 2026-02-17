import { useEffect, useRef } from 'react';

type SwipePagerProps = {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  swipeEnabled: boolean;
  pages: Array<{
    id: string;
    node: React.ReactNode;
  }>;
};

export function SwipePager({ activeIndex, onIndexChange, swipeEnabled, pages }: SwipePagerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const pageWidth = node.clientWidth;
    node.scrollTo({
      left: activeIndex * pageWidth,
      behavior: 'smooth',
    });
  }, [activeIndex]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const onScroll = () => {
      const pageWidth = node.clientWidth;
      if (!pageWidth) {
        return;
      }

      const next = Math.round(node.scrollLeft / pageWidth);
      if (next !== activeIndex && next >= 0 && next < pages.length) {
        onIndexChange(next);
      }
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [activeIndex, onIndexChange, pages.length]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      style={{
        scrollBehavior: 'smooth',
        touchAction: swipeEnabled ? 'pan-x pan-y' : 'pan-y',
        overflowX: swipeEnabled ? 'auto' : 'hidden',
      }}
    >
      <div className="flex h-full w-full">
        {pages.map((page) => (
          <section key={page.id} className="h-full w-full shrink-0 snap-center overflow-y-auto px-4 pb-28 pt-4">
            {page.node}
          </section>
        ))}
      </div>
    </div>
  );
}
