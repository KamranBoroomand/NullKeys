import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #6C7A47 0%, #31443A 58%, #1F2834 100%)",
          borderRadius: 42,
        }}
      >
        <div
          style={{
            width: 126,
            height: 102,
            borderRadius: 24,
            background: "#F6F2E8",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: "inset 0 0 0 8px #EAE3CF",
          }}
        >
          <div
            style={{
              width: 84,
              height: 14,
              borderRadius: 999,
              background: "linear-gradient(90deg, #D7A55A 0%, #E9D8A6 100%)",
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 18,
                borderRadius: 6,
                background: "#22303A",
              }}
            />
            <div
              style={{
                width: 36,
                height: 18,
                borderRadius: 6,
                background: "#22303A",
              }}
            />
            <div
              style={{
                width: 24,
                height: 18,
                borderRadius: 6,
                background: "#22303A",
              }}
            />
          </div>
          <div
            style={{
              width: 84,
              height: 12,
              borderRadius: 999,
              background: "#22303A",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
