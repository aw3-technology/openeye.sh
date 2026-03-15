import { type DependencyList, useEffect } from "react";

/**
 * Sets document.title and optionally scrolls to top.
 * Appends " | OpenEye" unless the title already contains "|".
 */
export function usePageMeta(
  title: string,
  deps: DependencyList = [],
  scrollToTop = true,
): void {
  useEffect(() => {
    document.title = title.includes("|") ? title : `${title} | OpenEye`;
    if (scrollToTop) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
