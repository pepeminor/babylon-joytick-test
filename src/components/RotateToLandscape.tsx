export function RotateToLandscape() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#000",
                color: "#fff",
                zIndex: 9999999999,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
            }}
        >
            <div style={{ fontSize: 64 }}>📱↔️</div>

            <div style={{ marginTop: 12, fontSize: 18 }}>
                Vui lòng xoay ngang màn hình
            </div>

            <div style={{ marginTop: 6, opacity: 0.7 }}>
                Please rotate your device
            </div>

            <div style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>
                Nếu đang bật Lock Rotation, hãy tắt để tiếp tục
            </div>

            <button
                style={{
                    marginTop: 20,
                    padding: "10px 18px",
                    fontSize: 14,
                    borderRadius: 8,
                    border: "none",
                    background: "#22c55e",
                    color: "#000",
                    cursor: "pointer",
                }}
                onClick={() => window.location.reload()}
            >
                Reload game
            </button>
        </div>
    );
}
