import React, { useEffect, useState } from "react";
import { useTtsStore } from "../../stores/ttsStore";
import { Voice } from "../../types/tts";

interface VoiceSelectorProps {
  provider?: string;
  selectedVoice: string;
  onChange: (voiceId: string) => void;
  className?: string;
}

const DEFAULT_ELEVENLABS_VOICES: Voice[] = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Deep, Natural Male)", language: "en-US", gender: "male", provider: "elevenlabs", is_default: true },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Soft, Gentle Female)", language: "en-US", gender: "female", provider: "elevenlabs", is_default: false },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Warm, Clear Male)", language: "en-US", gender: "male", provider: "elevenlabs", is_default: false },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (Authoritative Male)", language: "en-US", gender: "male", provider: "elevenlabs", is_default: false },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Expressive Male)", language: "en-US", gender: "male", provider: "elevenlabs", is_default: false },
];

function detectGender(name: string): string {
  const lower = name.toLowerCase();
  const femaleHints = ["female", "aria", "jenny", "eva", "zira", "hazel", "sara", "natasha", "catherine", "linda", "susan"];
  return femaleHints.some((h) => lower.includes(h)) ? "female" : "male";
}

function loadSystemVoices(): Promise<Voice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const extract = (): boolean => {
      const raw = window.speechSynthesis.getVoices();
      if (raw.length === 0) return false;
      resolve(
        raw.map((v) => ({
          id: v.voiceURI,
          name: v.name,
          language: v.lang,
          gender: detectGender(v.name),
          provider: "system",
          is_default: v.default,
        }))
      );
      return true;
    };
    if (!extract()) {
      window.speechSynthesis.onvoiceschanged = () => { extract(); };
      setTimeout(() => { extract() || resolve([]); }, 1500);
    }
  });
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  provider,
  selectedVoice,
  onChange,
  className = "",
}) => {
  const { voices, loadVoices, isLoadingVoices } = useTtsStore();
  const [systemVoices, setSystemVoices] = useState<Voice[]>([]);

  useEffect(() => {
    loadVoices(provider);
    if (provider === "system" || !provider) {
      loadSystemVoices().then(setSystemVoices);
    }
  }, [provider]);

  let displayVoices: Voice[];
  if (provider === "system" || !provider) {
    displayVoices =
      systemVoices.length > 0
        ? systemVoices
        : [{ id: "default", name: "System Default Voice", language: "en-US", provider: "system", is_default: true }];
  } else if (provider === "elevenlabs") {
    displayVoices = voices.length > 0 ? voices : DEFAULT_ELEVENLABS_VOICES;
  } else {
    displayVoices =
      voices.length > 0
        ? voices
        : [{ id: "default", name: "Default Voice", language: "en-US", provider: provider || "system", is_default: true }];
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedVoice || displayVoices[0]?.id || "default"}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoadingVoices && displayVoices.length === 0}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
      >
        {displayVoices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}{v.language ? ` (${v.language})` : ""}{v.gender ? ` - ${v.gender}` : ""}
          </option>
        ))}
      </select>
      {(provider === "system" || !provider) && systemVoices.length === 0 && (
        <p className="mt-1.5 text-xs text-amber-500 dark:text-amber-400">
          💡 لتحميل اصوات اضافية: Settings &rarr; Time &amp; Language &rarr; Speech &rarr; Add voices
        </p>
      )}
    </div>
  );
};
