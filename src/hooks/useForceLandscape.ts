import { useEffect, useState } from "react";

export function useForceLandscape() {
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        const check = () => {
            const isMobile =
                /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (!isMobile) {
                setBlocked(false);
                return;
            }

            const isPortrait = window.innerHeight > window.innerWidth;
            setBlocked(isPortrait);
        };

        check();
        window.addEventListener("resize", check);
        window.addEventListener("orientationchange", check);

        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("orientationchange", check);
        };
    }, []);

    return blocked;
}
