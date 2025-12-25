export function RotateToLandscape() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#000",
                color: "#fff",
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                flexDirection: "column",
                fontSize: 18,
            }}
        >
            <div style={{ fontSize: 56, marginBottom: 12 }}>📱↔️</div>
            <div>Vui lòng xoay ngang màn hình</div>
            <div style={{ opacity: 0.6, marginTop: 6 }}>
                Please rotate your device
            </div>

            <button
                style={{
                    marginTop: 16,
                    padding: "10px 16px",
                    fontSize: 16,
                    borderRadius: 8,
                    border: "none",
                }}
                onClick={() => window.location.reload()}
            >
                Reload game
            </button>
        </div>
    );
}

