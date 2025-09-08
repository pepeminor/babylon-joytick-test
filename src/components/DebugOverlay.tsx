
export type DebugInfo = {
    fps: number;
    dt: number;
    speed: number;
    yaw: number;     // radians
    pitch: number;   // radians
    px: number; py: number; pz: number;
};

export function DebugOverlay(props: {
    info: DebugInfo;
    debugOn: boolean;
    setDebugOn: (v: boolean) => void;
    lockDrag: boolean;
    setLockDrag: (v: boolean) => void;
}) {
    const { info, debugOn, setDebugOn, lockDrag, setLockDrag } = props;
    const deg = (r: number) => (r * 180 / Math.PI);

    return (
        <div
            style={{
                position: "fixed",
                right: 12,
                top: 12,
                zIndex: 25,
                minWidth: 240,
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.15)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12,
                color: "#fff",
                backdropFilter: "blur(3px)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={debugOn} onChange={(e) => setDebugOn(e.target.checked)} />
                    <span>Debug</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={lockDrag} onChange={(e) => setLockDrag(e.target.checked)} />
                    <span>Lock drag: top 60%</span>
                </label>
            </div>

            {!debugOn ? (
                <div style={{ opacity: 0.7 }}>Debug OFF</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                        <tr><td>FPS</td><td style={{ textAlign: "right" }}>{info.fps.toFixed(0)}</td></tr>
                        <tr><td>dt (ms)</td><td style={{ textAlign: "right" }}>{(info.dt * 1000).toFixed(1)}</td></tr>
                        <tr><td>speed</td><td style={{ textAlign: "right" }}>{info.speed.toFixed(3)}</td></tr>
                        <tr><td>yaw° / pitch°</td>
                            <td style={{ textAlign: "right" }}>
                                {deg(info.yaw).toFixed(1)} / {deg(info.pitch).toFixed(1)}
                            </td>
                        </tr>
                        <tr><td>pos (x,y,z)</td>
                            <td style={{ textAlign: "right" }}>
                                {info.px.toFixed(2)}, {info.py.toFixed(2)}, {info.pz.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}
