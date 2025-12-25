export function RotateToLandscape() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#000",
                color: "#fff",
                zIndex: 999999,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
            }}
        >
            <div style={{ fontSize: 56, marginBottom: 12 }}>📱↔️</div>

            <div>Vui lòng xoay ngang màn hình</div>
            <div style={{ opacity: 0.6, marginTop: 6 }}>
                Please rotate your device
            </div>

            <button
                onClick={() => window.location.reload()}
                style={{
                    marginTop: 24,
                    padding: "10px 18px",
                    fontSize: 16,
                    borderRadius: 8,
                    border: "none",
                    background: "#1e90ff",
                    color: "#fff",
                }}
            >
                Reload game
            </button>
        </div>
    );
}
