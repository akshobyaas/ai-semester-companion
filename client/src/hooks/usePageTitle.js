import { useEffect } from "react";

/**
 * Sets document.title for the current page, restoring the app-wide default
 * on unmount. A plain <title> tag in index.html never updates across
 * React Router navigations on its own — this fixes that gap.
 */
export function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · AI Semester Companion` : "AI Semester Companion";
    return () => {
      document.title = previous;
    };
  }, [title]);
}
