import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "영어 표현 암기 앱 미리보기";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f8fafc",
          color: "#172033",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: 64,
          width: "100%"
        }}
      >
        <div
          style={{
            background: "#172033",
            borderRadius: 44,
            color: "white",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: 56,
            width: "100%"
          }}
        >
          <div style={{ color: "#5eead4", fontSize: 30, fontWeight: 900, letterSpacing: 4 }}>
            ENGLISH RECALL
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.08 }}>오늘 배운 표현, 바로 외우기</div>
            <div style={{ color: "#cbd5e1", fontSize: 34, fontWeight: 700, lineHeight: 1.35 }}>
              한국어만 보고 영어 문장을 떠올리는 암기 앱
            </div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {["표현 저장", "암기 큐", "복습 기록"].map((label) => (
              <div
                key={label}
                style={{
                  background: "rgba(255, 255, 255, 0.10)",
                  borderRadius: 999,
                  color: "#f8fafc",
                  fontSize: 26,
                  fontWeight: 800,
                  padding: "16px 24px"
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
