import * as React from "react";
const MOBILE_BREAKPOINT = 768;
// Phones/tablets in landscape often exceed 768px width; treat coarse-pointer devices
// under this width as "mobile" for layout decisions (e.g., fullscreen games).
const COARSE_POINTER_MAX_WIDTH = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return window.innerWidth < MOBILE_BREAKPOINT || (coarse && window.innerWidth < COARSE_POINTER_MAX_WIDTH);
  });

  React.useEffect(() => {
    const compute = () => {
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      setIsMobile(
        window.innerWidth < MOBILE_BREAKPOINT || (coarse && window.innerWidth < COARSE_POINTER_MAX_WIDTH)
      );
    };

    const widthMql = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const coarseMql = window.matchMedia?.(`(pointer: coarse) and (max-width: ${COARSE_POINTER_MAX_WIDTH - 1}px)`);

    widthMql?.addEventListener?.("change", compute);
    coarseMql?.addEventListener?.("change", compute);
    window.addEventListener("resize", compute);

    compute();

    return () => {
      widthMql?.removeEventListener?.("change", compute);
      coarseMql?.removeEventListener?.("change", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return isMobile;
}
