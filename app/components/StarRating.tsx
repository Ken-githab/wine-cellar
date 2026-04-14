"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizePx = { sm: 18, md: 26, lg: 34 };

function StarIcon({ filled, sizePx: px }: { filled: "full" | "half" | "empty"; sizePx: number }) {
  return (
    <span className="relative inline-block leading-none select-none" style={{ width: px, height: px, fontSize: px }}>
      <span style={{ color: "#E5E7EB" }}>★</span>
      {filled !== "empty" && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ color: "#C9A96E", width: filled === "half" ? "50%" : "100%" }}
        >★</span>
      )}
    </span>
  );
}

export function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  const px = sizePx[size];

  const getStarFill = (star: number): "full" | "half" | "empty" => {
    if (display >= star) return "full";
    if (display >= star - 0.5) return "half";
    return "empty";
  };

  if (readonly) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon key={star} filled={getStarFill(star)} sizePx={px} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-0.5 cursor-pointer" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <div key={star} className="relative" style={{ width: px, height: px }}>
          <StarIcon filled={getStarFill(star)} sizePx={px} />
          <button type="button" className="absolute inset-y-0 left-0 w-1/2 z-10"
            onMouseEnter={() => setHover(star - 0.5)} onClick={() => onChange?.(star - 0.5)} aria-label={`${star - 0.5}点`} />
          <button type="button" className="absolute inset-y-0 right-0 w-1/2 z-10"
            onMouseEnter={() => setHover(star)} onClick={() => onChange?.(star)} aria-label={`${star}点`} />
        </div>
      ))}
      {value > 0 && (
        <span className="ml-1.5 text-sm font-medium self-center" style={{ color: "#C9A96E" }}>
          {value % 1 === 0 ? value.toFixed(1) : value}
        </span>
      )}
    </div>
  );
}
