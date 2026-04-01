"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "error" | "success";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[100] rounded-xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2 ${
        type === "error"
          ? "bg-red-700 text-white"
          : "bg-emerald-700 text-white"
      }`}
    >
      <span className="text-xl shrink-0">{type === "error" ? "⚠️" : "✅"}</span>
      <p className="flex-1 text-sm leading-relaxed">{message}</p>
      <button
        onClick={onClose}
        className="shrink-0 text-white/70 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
