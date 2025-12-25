import { useEffect, useState } from "react";

export function useForceLandscape() {
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        const check = () => {
            // ❗ chỉ áp dụng cho mobile
            const isMobile =
                /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (!isMobile) {
                setBlocked(false);
                return;
            }

            // ❗ tránh lúc Safari chưa init xong
            if (window.innerWidth === 0 || window.innerHeight === 0) {
                setBlocked(false);
                return;
            }

            const isPortrait = window.innerHeight > window.innerWidth;
            setBlocked(isPortrait);
        };

        // check trễ 1 frame cho Safari
        requestAnimationFrame(check);

        window.addEventListener("resize", check);
        window.addEventListener("orientationchange", check);

        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("orientationchange", check);
        };
    }, []);

    return blocked;
}
