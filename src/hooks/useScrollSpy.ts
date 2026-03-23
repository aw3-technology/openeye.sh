import { useEffect, useRef, useState } from "react";

export function useScrollSpy(ids: string[]) {
  const [activeId, setActiveId] = useState<string>(ids[0] ?? "");
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    if (ids.length === 0) return;

    // Set initial active to first id
    setActiveId(ids[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );

        if (intersecting.length > 0) {
          setActiveId(intersecting[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -40% 0px" }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return activeId;
}
