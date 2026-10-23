"use client";

import { useCallback, useEffect, useRef } from "react";

export type PuzzleSound =
  | "tap"
  | "pickup"
  | "drop"
  | "snap"
  | "hint"
  | "shuffle"
  | "complete";

type ToneOptions = {
  at?: number;
  duration: number;
  frequency: number;
  frequencyEnd?: number;
  gain: number;
  type?: OscillatorType;
};

function addTone(context: AudioContext, options: ToneOptions) {
  const start = context.currentTime + (options.at ?? 0);
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  if (options.frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(
      options.frequencyEnd,
      start + options.duration,
    );
  }

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + options.duration + 0.03);
}

function addSoftNoise(
  context: AudioContext,
  {
    at = 0,
    duration,
    frequency,
    gain,
  }: { at?: number; duration: number; frequency: number; gain: number },
) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    const fade = 1 - index / frameCount;
    data[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  const start = context.currentTime + at;

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.75;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(context.destination);
  source.start(start);
}

export function usePuzzleSounds(muted: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  const getContext = useCallback(() => {
    if (muted || typeof window === "undefined") return null;
    if (!contextRef.current || contextRef.current.state === "closed") {
      contextRef.current = new AudioContext();
    }
    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume();
    }
    return contextRef.current;
  }, [muted]);

  return useCallback(
    (sound: PuzzleSound) => {
      const context = getContext();
      if (!context) return;

      switch (sound) {
        case "tap":
          addTone(context, { duration: 0.1, frequency: 430, frequencyEnd: 360, gain: 0.035, type: "triangle" });
          addTone(context, { at: 0.018, duration: 0.16, frequency: 820, gain: 0.018 });
          break;
        case "pickup":
          addSoftNoise(context, { duration: 0.18, frequency: 920, gain: 0.025 });
          addTone(context, { duration: 0.2, frequency: 290, frequencyEnd: 390, gain: 0.018, type: "triangle" });
          break;
        case "drop":
          addSoftNoise(context, { duration: 0.13, frequency: 620, gain: 0.022 });
          addTone(context, { duration: 0.18, frequency: 210, frequencyEnd: 160, gain: 0.028, type: "triangle" });
          break;
        case "snap":
          addSoftNoise(context, { duration: 0.055, frequency: 1150, gain: 0.03 });
          addTone(context, { duration: 0.16, frequency: 510, frequencyEnd: 430, gain: 0.04, type: "triangle" });
          addTone(context, { at: 0.035, duration: 0.28, frequency: 860, gain: 0.025 });
          break;
        case "hint":
          addTone(context, { duration: 0.42, frequency: 659.25, gain: 0.025 });
          addTone(context, { at: 0.11, duration: 0.5, frequency: 880, gain: 0.02 });
          break;
        case "shuffle":
          [0, 0.075, 0.15, 0.225].forEach((at, index) => {
            addSoftNoise(context, { at, duration: 0.105, frequency: 720 + index * 90, gain: 0.019 });
            addTone(context, { at: at + 0.015, duration: 0.11, frequency: 270 + index * 24, gain: 0.014, type: "triangle" });
          });
          addTone(context, { at: 0.29, duration: 0.2, frequency: 620, gain: 0.018 });
          break;
        case "complete":
          [
            { at: 0, frequency: 523.25 },
            { at: 0.13, frequency: 659.25 },
            { at: 0.26, frequency: 783.99 },
            { at: 0.47, frequency: 1046.5 },
          ].forEach(({ at, frequency }, index) => {
            addTone(context, {
              at,
              duration: index === 3 ? 0.9 : 1.15,
              frequency,
              gain: index === 3 ? 0.018 : 0.025,
            });
          });
          addTone(context, { at: 0.54, duration: 0.34, frequency: 235, frequencyEnd: 190, gain: 0.022, type: "triangle" });
          break;
      }
    },
    [getContext],
  );
}

const ambientChords = [
  [130.81, 196, 261.63, 329.63],
  [110, 164.81, 220, 261.63],
  [146.83, 220, 293.66, 349.23],
  [98, 146.83, 196, 246.94],
];

export function useHealingMusic() {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const chordRef = useRef(0);
  const runningRef = useRef(false);
  const sourcesRef = useRef<Set<OscillatorNode>>(new Set());

  const scheduleChord = useCallback((context: AudioContext, master: GainNode) => {
    const frequencies = ambientChords[chordRef.current % ambientChords.length];
    chordRef.current += 1;
    const start = context.currentTime + 0.04;

    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();

      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 === 0 ? -4 : 4;
      filter.type = "lowpass";
      filter.frequency.value = 760 + index * 110;
      filter.Q.value = 0.45;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(index === 0 ? 0.24 : 0.11, start + 1.8);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 6.2);

      oscillator.connect(filter);
      filter.connect(envelope);
      envelope.connect(master);
      sourcesRef.current.add(oscillator);
      oscillator.onended = () => sourcesRef.current.delete(oscillator);
      oscillator.start(start);
      oscillator.stop(start + 6.3);
    });
  }, []);

  const startMusic = useCallback(() => {
    if (typeof window === "undefined" || runningRef.current) return;
    let context = contextRef.current;
    if (!context || context.state === "closed") {
      context = new AudioContext();
      contextRef.current = context;
      const master = context.createGain();
      master.gain.value = 0.0001;
      master.connect(context.destination);
      masterRef.current = master;
    }

    if (context.state === "suspended") void context.resume();
    const master = masterRef.current;
    if (!master) return;
    runningRef.current = true;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.026, context.currentTime + 1.4);
    scheduleChord(context, master);
    timerRef.current = window.setInterval(() => scheduleChord(context, master), 5500);
  }, [scheduleChord]);

  const stopMusic = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    runningRef.current = false;
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The oscillator may already have finished naturally.
      }
    });
    sourcesRef.current.clear();
    const context = contextRef.current;
    const master = masterRef.current;
    if (!context || !master || context.state === "closed") return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
  }, []);

  const duckMusic = useCallback(() => {
    const context = contextRef.current;
    const master = masterRef.current;
    if (!context || !master || !runningRef.current) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.007, now + 0.25);
    master.gain.exponentialRampToValueAtTime(0.026, now + 2.1);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      void contextRef.current?.close();
      contextRef.current = null;
      masterRef.current = null;
      sourcesRef.current.clear();
    },
    [],
  );

  return { startMusic, stopMusic, duckMusic };
}
