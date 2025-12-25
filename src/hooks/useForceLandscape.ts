import { useEffect, useState } from "react";

export function useForceLandscape() {
    const [force, setForce] = useState(false);

    useEffect(() => {
        const check = () => {
            const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
            const isPortrait = window.innerHeight > window.innerWidth;
            setForce(isMobile && isPortrait);
        };

        check();

        window.addEventListener("resize", check);
        window.addEventListener("orientationchange", check);

        return () => {
            window.removeEventListener("resize", check);
            window.removeEventListener("orientationchange", check);
        };
    }, []);

    return force;
}
