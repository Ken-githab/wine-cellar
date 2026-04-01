import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#881337",
          borderRadius: 102,
        }}
      >
        {/* Glass outline */}
        <svg
          width="320"
          height="320"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 28,20 L 72,20 C 78,50 62,65 54,65 L 54,80 L 62,80 L 62,84 L 38,84 L 38,80 L 46,80 L 46,65 C 38,65 22,50 28,20 Z"
            fill="white"
            opacity="0.92"
          />
          <path
            d="M 30,35 L 70,35 C 74,50 60,63 54,65 L 46,65 C 40,63 26,50 30,35 Z"
            fill="#dc2626"
            opacity="0.85"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
