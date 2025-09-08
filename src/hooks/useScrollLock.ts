import { useEffect } from "react";

export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;
        const prev = {
            ob: document.body.style.overscrollBehavior,
            ta: document.documentElement.style.touchAction,
        };
        document.body.style.overscrollBehavior = "none";
        document.documentElement.style.touchAction = "none";
        const stop = (e: TouchEvent) => e.preventDefault();
        document.addEventListener("touchmove", stop, { passive: false });
        return () => {
            document.body.style.overscrollBehavior = prev.ob;
            document.documentElement.style.touchAction = prev.ta;
            document.removeEventListener("touchmove", stop);
        };
    }, [active]);
}
