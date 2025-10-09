import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "@babylonjs/core";

import { connectGameServer } from "../network/connectGameServer";

export type GameServerStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

type UseGameServerOptions = {
    enabled?: boolean;
    autoReconnect?: boolean;
    reconnectDelayMs?: number;
};

type CleanupFn = (code?: number, reason?: string) => void;

export function useGameServer(scene: Scene | null, options?: UseGameServerOptions) {
    const { enabled = true, autoReconnect = true, reconnectDelayMs = 3000 } = options ?? {};

    const [status, setStatus] = useState<GameServerStatus>("idle");
    const [error, setError] = useState<Error | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const closeRef = useRef<CleanupFn | null>(null);
    const reconnectFnRef = useRef<() => void>(() => { });
    const disconnectFnRef = useRef<CleanupFn>(() => { });
    const pausedRef = useRef(!enabled);

    useEffect(() => {
        pausedRef.current = !enabled;
    }, [enabled]);

    const reconnect = useCallback(() => {
        reconnectFnRef.current();
    }, []);

    const disconnect = useCallback((code?: number, reason?: string) => {
        disconnectFnRef.current(code, reason);
    }, []);

    useEffect(() => {
        if (!scene || !enabled) {
            return () => { };
        }

        let cancelled = false;
        let reconnectTimer: number | null = null;
        let closeHandler: ((event: CloseEvent) => void) | null = null;

        pausedRef.current = false;

        const clearReconnectTimer = () => {
            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        const cleanupSocket = (code = 1000, reason = "cleanup") => {
            if (closeHandler && socketRef.current) {
                socketRef.current.removeEventListener("close", closeHandler);
            }
            closeHandler = null;

            if (closeRef.current) {
                closeRef.current(code, reason);
            } else if (socketRef.current) {
                socketRef.current.close(code, reason);
            }

            socketRef.current = null;
            closeRef.current = null;
        };

        const scheduleReconnect = () => {
            if (!autoReconnect || cancelled || pausedRef.current) {
                return;
            }
            clearReconnectTimer();
            reconnectTimer = window.setTimeout(() => {
                attemptConnect();
            }, reconnectDelayMs);
        };

        function attemptConnect() {
            if (cancelled || pausedRef.current) {
                return;
            }

            setStatus("connecting");
            setError(null);

            if (!scene) return

            connectGameServer(scene)
                .then(({ socket, close }) => {
                    if (cancelled || pausedRef.current) {
                        close(1000, pausedRef.current ? "connection paused" : "effect cancelled");
                        return;
                    }

                    socketRef.current = socket;
                    closeRef.current = close;
                    setStatus("connected");

                    const handleClose = () => {
                        if (cancelled) return;
                        if (socketRef.current) {
                            socketRef.current.removeEventListener("close", handleClose);
                        }
                        socketRef.current = null;
                        closeRef.current = null;
                        closeHandler = null;

                        if (pausedRef.current) {
                            setStatus("idle");
                            return;
                        }

                        setStatus("disconnected");
                        scheduleReconnect();
                    };

                    closeHandler = handleClose;
                    socket.addEventListener("close", handleClose);
                })
                .catch((err) => {
                    if (cancelled || pausedRef.current) {
                        return;
                    }

                    setError(err instanceof Error ? err : new Error(String(err)));
                    setStatus("error");
                    scheduleReconnect();
                });
        }

        attemptConnect();

        reconnectFnRef.current = () => {
            if (cancelled) return;
            pausedRef.current = false;
            clearReconnectTimer();
            cleanupSocket(1000, "manual reconnect");
            attemptConnect();
        };

        disconnectFnRef.current = (code = 1000, reason = "manual disconnect") => {
            pausedRef.current = true;
            clearReconnectTimer();
            cleanupSocket(code, reason);
            setStatus("idle");
        };

        return () => {
            cancelled = true;
            pausedRef.current = true;
            clearReconnectTimer();
            cleanupSocket(1000, "scene disposed");
        };
    }, [scene, enabled, autoReconnect, reconnectDelayMs]);

    useEffect(() => {
        if (!scene || !enabled) {
            socketRef.current = null;
            closeRef.current = null;
            reconnectFnRef.current = () => { };
            disconnectFnRef.current = () => { };
            if (!scene) {
                setStatus("idle");
            }
        }
    }, [scene, enabled]);

    return {
        socket: socketRef.current,
        socketRef,
        status,
        error,
        reconnect,
        disconnect,
    };
}
