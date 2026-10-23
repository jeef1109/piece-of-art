"use client";

import Image from "next/image";
import { assetPath } from "@/lib/asset-path";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./PieceOfArt.module.css";
import {
  type Language,
  type Painting,
  paintingIdReplacements,
  paintings as catalogPaintings,
  themes,
} from "./paintingCatalog.generated";
import { useHealingMusic, usePuzzleSounds } from "./usePuzzleSounds";

type EdgeValue = -1 | 0 | 1;

type GridCut = {
  horizontal: EdgeValue[][];
  vertical: EdgeValue[][];
};

type PieceState = {
  id: number;
  row: number;
  column: number;
  x: number;
  y: number;
  rotation: number;
  z: number;
  locked: boolean;
  flash: boolean;
};

type DragState = {
  id: number;
  offsetX: number;
  offsetY: number;
} | null;

const assetRoot = assetPath("/sites/piece-of-art");
const paintings = catalogPaintings.map((painting) => ({
  ...painting,
  image: assetPath(painting.image),
}));
const MIN_GRID = 3;
const MAX_GRID = 8;
const STARTING_PAINTING_ID = "picasso-le-reve";

const translations = {
  en: {
    blurbBefore: "A little ",
    blurbEmphasis: "puzzle",
    blurbAfter: " break. See how well you know the world’s most famous paintings.",
    startPuzzle: "Start Puzzle",
    randomize: "Randomize",
    pieces: "pieces:",
    decreasePieces: "Decrease pieces",
    increasePieces: "Increase pieces",
    newCut: "new cut",
    hint: "hint",
    secondsShort: "s",
    hideHint: "hide hint",
    reset: "reset",
    congratulations: "Congratulations! You did it!",
    nextPainting: "Next Painting",
    home: "Home",
    muteSound: "Mute sound",
    turnSoundOn: "Turn sound on",
    muteMusic: "Mute background music",
    turnMusicOn: "Turn background music on",
    switchLanguage: "切换为中文",
    collection: "Collection",
    level: "Level",
    openCollectionProgress: (level: number, collected: number) =>
      `Level ${level} of 120. Open collection. ${collected} paintings collected.`,
    openCollection: (collected: number) => `Open collection. ${collected} of 120 paintings collected.`,
    collectionTitle: "Your quiet museum",
    collectionIntro: "120 paintings, gathered one peaceful puzzle at a time.",
    closeCollection: "Close collection",
    todaysPainting: "Today’s painting",
    openingPainting: "Opening painting",
    playToday: "Play today’s painting",
    playPainting: "Play this painting",
    collected: "collected",
    themes: "Gallery rooms",
    works: "works",
    source: "Artwork source",
    publicDomain: "Public domain",
    userProvided: "User-provided image",
    dailyNote: "A new invitation each day — no streaks, no pressure.",
    desktopStartScreen: "Desktop start screen",
    startScreen: "Start screen",
  },
  zh: {
    blurbBefore: "来一场轻松的",
    blurbEmphasis: "拼图",
    blurbAfter: "休息，看看你对世界名画了解多少。",
    startPuzzle: "开始拼图",
    randomize: "随机换画",
    pieces: "拼图块：",
    decreasePieces: "减少拼图块",
    increasePieces: "增加拼图块",
    newCut: "重新切割",
    hint: "提示",
    secondsShort: "秒",
    hideHint: "隐藏提示",
    reset: "重置",
    congratulations: "恭喜！你完成了！",
    nextPainting: "下一幅，继续闯关",
    home: "首页",
    muteSound: "静音",
    turnSoundOn: "打开声音",
    muteMusic: "关闭背景音乐",
    turnMusicOn: "打开背景音乐",
    switchLanguage: "Switch to English",
    collection: "收藏馆",
    level: "第",
    openCollectionProgress: (level: number, collected: number) =>
      `第 ${level}/120 关，打开收藏馆，已收藏 ${collected}/120 幅。`,
    openCollection: (collected: number) => `打开收藏馆，已收藏 ${collected}/120 幅。`,
    collectionTitle: "你的静心美术馆",
    collectionIntro: "120 幅名画，一次完成一块，慢慢收藏。",
    closeCollection: "关闭收藏馆",
    todaysPainting: "今日名画",
    openingPainting: "开场名画",
    playToday: "开始今日拼图",
    playPainting: "拼这幅画",
    collected: "已收藏",
    themes: "主题展厅",
    works: "幅作品",
    source: "作品来源",
    publicDomain: "公版作品",
    userProvided: "用户提供图片",
    dailyNote: "每天一幅轻松邀请，不打卡，也没有压力。",
    desktopStartScreen: "桌面端开始页面",
    startScreen: "开始页面",
  },
} as const;

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0];
}

function shuffleArray<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createCut(size: number, seed: number): GridCut {
  const random = makeRandom(seed);
  const horizontal = Array.from({ length: size - 1 }, () =>
    Array.from({ length: size }, () => (random() > 0.5 ? 1 : -1) as EdgeValue),
  );
  const vertical = Array.from({ length: size }, () =>
    Array.from({ length: size - 1 }, () => (random() > 0.5 ? 1 : -1) as EdgeValue),
  );
  return { horizontal, vertical };
}

function pieceEdges(cut: GridCut, row: number, column: number, size: number) {
  return {
    top: row === 0 ? 0 : ((-cut.horizontal[row - 1][column]) as EdgeValue),
    right: column === size - 1 ? 0 : cut.vertical[row][column],
    bottom: row === size - 1 ? 0 : cut.horizontal[row][column],
    left: column === 0 ? 0 : ((-cut.vertical[row][column - 1]) as EdgeValue),
  };
}

function edgeSegment(
  x: number,
  y: number,
  tangentX: number,
  tangentY: number,
  normalX: number,
  normalY: number,
  length: number,
  edge: EdgeValue,
) {
  const point = (along: number, outward = 0) =>
    `${(x + tangentX * length * along + normalX * length * outward).toFixed(2)} ${(y + tangentY * length * along + normalY * length * outward).toFixed(2)}`;

  if (edge === 0) {
    return ` L ${point(1)}`;
  }

  const bump = edge * 0.13;
  return [
    ` L ${point(0.36)}`,
    ` C ${point(0.4)} ${point(0.39, bump)} ${point(0.49, bump)}`,
    ` C ${point(0.61, bump)} ${point(0.6)} ${point(0.66)}`,
    ` L ${point(1)}`,
  ].join("");
}

function piecePath(
  edges: ReturnType<typeof pieceEdges>,
  cell: number,
  margin: number,
) {
  const left = margin;
  const top = margin;
  const right = margin + cell;
  const bottom = margin + cell;

  return [
    `M ${left} ${top}`,
    edgeSegment(left, top, 1, 0, 0, -1, cell, edges.top),
    edgeSegment(right, top, 0, 1, 1, 0, cell, edges.right),
    edgeSegment(right, bottom, -1, 0, 0, 1, cell, edges.bottom),
    edgeSegment(left, bottom, 0, -1, -1, 0, cell, edges.left),
    " Z",
  ].join("");
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.logoCompact : styles.logo} aria-label="Piece Of Art">
      <span>Piece Of Art</span>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.4 3.6a2 2 0 0 1 3.7 1.1c0 .5-.2 1-.5 1.3h3.3a1 1 0 0 1 1 1v3.3c.4-.3.8-.5 1.3-.5a2 2 0 0 1 0 4c-.5 0-.9-.2-1.3-.5v3.3a1 1 0 0 1-1 1h-3.3c.3.4.5.8.5 1.3a2 2 0 0 1-4 0c0-.5.2-.9.5-1.3H7.3a1 1 0 0 1-1-1v-3.3c-.4.3-.8.5-1.3.5a2 2 0 0 1 0-4c.5 0 .9.2 1.3.5V7a1 1 0 0 1 1-1h3.3c-.3-.4-.5-.8-.5-1.3Z" />
    </svg>
  );
}

function BrushArrow({ compact = false }: { compact?: boolean }) {
  const id = useId().replaceAll(":", "");
  const maskId = `brush-arrow-mask-${id}`;
  const roughId = `brush-arrow-rough-${id}`;

  return (
    <svg
      className={`${styles.brushArrow}${compact ? ` ${styles.brushArrowCompact}` : ""}`}
      viewBox="0 0 92 32"
      aria-hidden="true"
    >
      <defs>
        <filter id={roughId} x="-6%" y="-18%" width="112%" height="136%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.028 0.2"
            numOctaves="2"
            seed="19"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.35"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="92" height="32">
          <rect width="92" height="32" fill="#000" />
          <path
            d="M3.5 8.7C18.4 7.7 34.6 8.1 53.7 8.5L59.8 8.8 53.2 3.9 58.4 1.1C68.4 8.2 78.7 12.8 89.6 16.2 79.3 20.9 68.9 26 58.2 31L52.3 25.3 59.9 20.9 51.3 21.4C34.2 22.5 18.9 22.7 5.2 21L8.2 18.8 2.6 17.6 6.1 14.9 2.4 12.5Z"
            fill="#fff"
            filter={`url(#${roughId})`}
          />
          <g fill="none" stroke="#000" strokeLinecap="round">
            <path d="M7 11.4c11.5.8 24.2.6 38.6.2" strokeWidth="1.15" opacity=".58" />
            <path d="M10.2 15.1c9.5-.7 22.8-.1 39.8.2" strokeWidth=".8" opacity=".72" />
            <path d="M7.8 18.8c12.6-.3 25.4.4 42.7-.4" strokeWidth="1.25" opacity=".54" />
            <path d="m60.5 7.2 16.7 8.3" strokeWidth=".85" opacity=".58" />
            <path d="m60.2 25.3 15.4-7.7" strokeWidth="1.05" opacity=".5" />
          </g>
          <g fill="#000" opacity=".62">
            <circle cx="13" cy="9.8" r=".65" />
            <circle cx="18.5" cy="20.4" r=".8" />
            <circle cx="27" cy="13.4" r=".55" />
            <circle cx="34.5" cy="19.2" r=".7" />
            <circle cx="45.3" cy="10.8" r=".6" />
            <circle cx="55.7" cy="17.2" r=".85" />
            <circle cx="67.8" cy="11.1" r=".7" />
            <circle cx="72.5" cy="21.6" r=".55" />
            <circle cx="83" cy="16" r=".65" />
          </g>
        </mask>
      </defs>
      <rect width="92" height="32" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

function ContinueIcon() {
  return <BrushArrow compact />;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5h13l-3-3M20.5 15.5h-13l3 3" />
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Z" />
      {muted ? (
        <>
          <path d="m15.5 9.5 5 5" />
          <path d="m20.5 9.5-5 5" />
        </>
      ) : (
        <>
          <path d="M15 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18 6.7a7.5 7.5 0 0 1 0 10.6" />
        </>
      )}
    </svg>
  );
}

function MusicIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V6.7l10-2.2v11.3" />
      <path d="M9 10.2 19 8" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="15.8" r="2.5" />
      {muted ? <path d="m3.5 4 17 17" /> : null}
    </svg>
  );
}

function CollectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5h16v13H4z" />
      <path d="m7 15 3.4-3.5 2.6 2.6 2.4-2.2L18 15" />
      <circle cx="15.8" cy="8.8" r="1.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

function SoundToggle({
  language,
  muted,
  onToggle,
}: {
  language: Language;
  muted: boolean;
  onToggle: () => void;
}) {
  const text = translations[language];
  return (
    <button
      className={styles.soundToggle}
      type="button"
      aria-label={muted ? text.turnSoundOn : text.muteSound}
      aria-pressed={muted}
      onClick={onToggle}
    >
      <SoundIcon muted={muted} />
    </button>
  );
}

function LanguageToggle({ language, onToggle }: { language: Language; onToggle: () => void }) {
  return (
    <button
      className={styles.languageToggle}
      type="button"
      aria-label={translations[language].switchLanguage}
      onClick={onToggle}
    >
      {language === "en" ? "中文" : "EN"}
    </button>
  );
}

function MusicToggle({
  language,
  muted,
  onToggle,
}: {
  language: Language;
  muted: boolean;
  onToggle: () => void;
}) {
  const text = translations[language];
  return (
    <button
      className={styles.musicToggle}
      type="button"
      aria-label={muted ? text.turnMusicOn : text.muteMusic}
      aria-pressed={muted}
      onClick={onToggle}
    >
      <MusicIcon muted={muted} />
    </button>
  );
}

function CollectionToggle({
  language,
  count,
  level,
  onOpen,
}: {
  language: Language;
  count: number;
  level?: number;
  onOpen: () => void;
}) {
  const text = translations[language];
  const showsLevel = level !== undefined;
  return (
    <button
      className={styles.collectionToggle}
      type="button"
      aria-label={showsLevel ? text.openCollectionProgress(level, count) : text.openCollection(count)}
      onClick={onOpen}
    >
      <CollectionIcon />
      <span className={styles.collectionToggleLabel}>{showsLevel ? text.level : text.collection}</span>
      <strong>{showsLevel ? level : count}/120</strong>
      {showsLevel && language === "zh" ? <span>关</span> : null}
    </button>
  );
}

function UtilityControls({
  language,
  muted,
  musicMuted,
  collectionCount,
  challengeLevel,
  onToggleLanguage,
  onToggleSound,
  onToggleMusic,
  onOpenCollection,
}: {
  language: Language;
  muted: boolean;
  musicMuted: boolean;
  collectionCount: number;
  challengeLevel?: number;
  onToggleLanguage: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenCollection: () => void;
}) {
  return (
    <>
      <CollectionToggle language={language} count={collectionCount} level={challengeLevel} onOpen={onOpenCollection} />
      <MusicToggle language={language} muted={musicMuted} onToggle={onToggleMusic} />
      <LanguageToggle language={language} onToggle={onToggleLanguage} />
      <SoundToggle language={language} muted={muted} onToggle={onToggleSound} />
    </>
  );
}

function ScallopedCard() {
  const top = Array.from({ length: 40 }, (_, index) => 10 + index * 20);
  const sides = Array.from({ length: 48 }, (_, index) => 10 + index * 20);

  return (
    <svg className={styles.scallopedCard} viewBox="0 0 800 960" preserveAspectRatio="none" aria-hidden="true">
      <rect x="10" y="10" width="780" height="940" fill="#0b0b0b" />
      {top.map((x) => (
        <g key={`x-${x}`}>
          <circle cx={x} cy="10" r="10" fill="#0b0b0b" />
          <circle cx={x} cy="950" r="10" fill="#0b0b0b" />
        </g>
      ))}
      {sides.map((y) => (
        <g key={`y-${y}`}>
          <circle cx="10" cy={y} r="10" fill="#0b0b0b" />
          <circle cx="790" cy={y} r="10" fill="#0b0b0b" />
        </g>
      ))}
    </svg>
  );
}

function PuzzlePreview({
  image,
  size,
  grid,
  seed,
  scattered = false,
  loose = false,
}: {
  image: string;
  size: number;
  grid: number;
  seed: number;
  scattered?: boolean;
  loose?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const cut = useMemo(() => createCut(grid, seed), [grid, seed]);
  const cell = size / grid;
  const margin = Math.ceil(cell * 0.32) + 1;
  const random = makeRandom(seed * 17 + 3);
  const looseId = grid - 1;
  const looseX = grid === 3 ? size - cell * 1.35 : size - cell * 0.55;

  return (
    <svg className={styles.previewSvg} viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {Array.from({ length: grid }, (_, row) =>
          Array.from({ length: grid }, (_entry, column) => {
            const path = piecePath(pieceEdges(cut, row, column, grid), cell, margin);
            return (
              <clipPath id={`${id}-${row}-${column}`} key={`${row}-${column}`} clipPathUnits="userSpaceOnUse">
                <path d={path} />
              </clipPath>
            );
          }),
        )}
      </defs>
      {Array.from({ length: grid }, (_, row) =>
        Array.from({ length: grid }, (_entry, column) => {
          const isLoose = loose && row === 0 && column === looseId;
          if (isLoose) return null;
          const path = piecePath(pieceEdges(cut, row, column, grid), cell, margin);
          const offsetX = scattered ? (random() - 0.5) * cell * 0.35 : 0;
          const offsetY = scattered ? (random() - 0.5) * cell * 0.38 : 0;
          const rotation = scattered ? (random() - 0.5) * 12 : 0;
          const center = margin + cell / 2;
          return (
            <g
              key={`${row}-${column}`}
              transform={`translate(${column * cell - margin + offsetX} ${row * cell - margin + offsetY}) rotate(${rotation} ${center} ${center})`}
            >
              <image
                href={image}
                x={margin - column * cell}
                y={margin - row * cell}
                width={size}
                height={size}
                preserveAspectRatio="none"
                clipPath={`url(#${id}-${row}-${column})`}
              />
              <path d={path} fill="none" stroke="#0c0c0c" strokeOpacity=".76" strokeWidth="1.4" />
            </g>
          );
        }),
      )}
      {loose ? (
        <g transform={`translate(${looseX} ${-margin - cell * 0.12}) rotate(17 ${margin + cell / 2} ${margin + cell / 2})`}>
          <image
            href={image}
            x={margin - looseId * cell}
            y={margin}
            width={size}
            height={size}
            preserveAspectRatio="none"
            clipPath={`url(#${id}-0-${looseId})`}
          />
        </g>
      ) : null}
    </svg>
  );
}

function getDailyPaintingIndex() {
  const today = new Date();
  const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  return day % paintings.length;
}

function getStartingPaintingIndex() {
  const index = paintings.findIndex((painting) => painting.id === STARTING_PAINTING_ID);
  return index >= 0 ? index : getDailyPaintingIndex();
}

function CollectionScreen({
  language,
  muted,
  musicMuted,
  collectedIds,
  activeThemeId,
  dailyPainting,
  onSelectTheme,
  onSelectPainting,
  onClose,
  onToggleLanguage,
  onToggleSound,
  onToggleMusic,
}: {
  language: Language;
  muted: boolean;
  musicMuted: boolean;
  collectedIds: Set<string>;
  activeThemeId: string;
  dailyPainting: Painting;
  onSelectTheme: (themeId: string) => void;
  onSelectPainting: (painting: Painting) => void;
  onClose: () => void;
  onToggleLanguage: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
}) {
  const text = translations[language];
  const activeTheme = themes.find((theme) => theme.id === activeThemeId) ?? themes[0];
  const themePaintings = paintings.filter((painting) => painting.themeId === activeTheme.id);
  const themeCollected = themePaintings.filter((painting) => collectedIds.has(painting.id)).length;

  return (
    <main className={styles.collectionScreen} style={{ "--gallery-accent": activeTheme.accent } as CSSProperties}>
      <div className={styles.collectionTopRail}>
        <Logo compact />
        <button className={styles.collectionClose} type="button" onClick={onClose} aria-label={text.closeCollection}>
          <CloseIcon />
        </button>
        <MusicToggle language={language} muted={musicMuted} onToggle={onToggleMusic} />
        <LanguageToggle language={language} onToggle={onToggleLanguage} />
        <SoundToggle language={language} muted={muted} onToggle={onToggleSound} />
      </div>

      <header className={styles.collectionHeader}>
        <div>
          <p className={styles.collectionEyebrow}>{text.collection} · {collectedIds.size}/120 {text.collected}</p>
          <h1>{text.collectionTitle}</h1>
          <p>{text.collectionIntro}</p>
        </div>
        <button
          className={styles.dailyFeature}
          type="button"
          onClick={() => onSelectPainting(dailyPainting)}
          aria-label={`${text.playToday}: ${dailyPainting.title[language]}`}
        >
          <span className={styles.dailyCopy}>
            <small>{text.todaysPainting}</small>
            <strong>{dailyPainting.title[language]}</strong>
            <span>{text.dailyNote}</span>
            <b>{text.playToday}<BrushArrow /></b>
          </span>
          <span className={styles.dailyArtFrame} aria-hidden="true">
            <span className={styles.dailyImage} style={{ backgroundImage: `url("${dailyPainting.image}")` }} />
            <Image
              className={styles.dailyFrameImage}
              src={`${assetRoot}/frame.webp`}
              alt=""
              fill
              sizes="(max-width: 600px) 42vw, 28vw"
            />
          </span>
        </button>
      </header>

      <section className={styles.collectionBody}>
        <div className={styles.themeHeading}>
          <span>{text.themes}</span>
          <span>{themeCollected}/10 {text.collected}</span>
        </div>
        <nav className={styles.themeNav} aria-label={text.themes}>
          {themes.map((theme) => (
            <button
              className={theme.id === activeTheme.id ? styles.themeActive : ""}
              key={theme.id}
              type="button"
              aria-current={theme.id === activeTheme.id ? "page" : undefined}
              onClick={() => onSelectTheme(theme.id)}
            >
              <span>{theme.name[language]}</span>
              <small>{paintings.filter((painting) => painting.themeId === theme.id && collectedIds.has(painting.id)).length}/10</small>
            </button>
          ))}
        </nav>

        <div className={styles.galleryIntro}>
          <h2>{activeTheme.name[language]}</h2>
          <span>10 {text.works}</span>
        </div>
        <div className={styles.collectionGrid}>
          {themePaintings.map((artwork, index) => {
            const isCollected = collectedIds.has(artwork.id);
            return (
              <button
                className={styles.artworkEntry}
                key={artwork.id}
                type="button"
                onClick={() => onSelectPainting(artwork)}
                aria-label={`${text.playPainting}: ${artwork.title[language]}`}
              >
                <span
                  className={styles.artworkFrame}
                  style={{
                    aspectRatio: index % 3 === 1 ? "4 / 5" : index % 3 === 2 ? "5 / 4" : "1",
                  }}
                  aria-hidden="true"
                >
                  <span
                    className={styles.artworkImage}
                    style={{ backgroundImage: `url("${artwork.image}")` }}
                  />
                  <Image
                    className={styles.artworkFrameImage}
                    src={`${assetRoot}/frame.webp`}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 46vw, (max-width: 900px) 30vw, 24vw"
                  />
                  {isCollected ? <span className={styles.collectedMark}><CheckIcon /></span> : null}
                </span>
                <span className={styles.artworkMeta}>
                  <strong>{artwork.workTitle}</strong>
                  <span>{artwork.artist} · {artwork.date}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function LandingScreen({
  language,
  muted,
  musicMuted,
  collectionCount,
  openingPainting,
  onStart,
  onOpening,
  onToggleLanguage,
  onToggleSound,
  onToggleMusic,
  onOpenCollection,
}: {
  language: Language;
  muted: boolean;
  musicMuted: boolean;
  collectionCount: number;
  openingPainting: Painting;
  onStart: () => void;
  onOpening: () => void;
  onToggleLanguage: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenCollection: () => void;
}) {
  const landingImage = openingPainting.image;
  const text = translations[language];
  return (
    <div className={styles.landingShell}>
      <UtilityControls
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectionCount={collectionCount}
        onToggleLanguage={onToggleLanguage}
        onToggleSound={onToggleSound}
        onToggleMusic={onToggleMusic}
        onOpenCollection={onOpenCollection}
      />
      <section className={styles.landingDesktop} aria-label={text.desktopStartScreen}>
        <div className={styles.landingLeft}>
          <button className={styles.homeButton} type="button" aria-label={text.home}>
            <HomeIcon />
          </button>
          <Logo />
          <p className={styles.blurb}>
            {text.blurbBefore}<u>{text.blurbEmphasis}</u>{text.blurbAfter}
          </p>
          <button className={styles.dailyCue} type="button" onClick={onOpening}>
            <small>{text.openingPainting}</small>
            <strong>{openingPainting.workTitle}</strong>
            <BrushArrow />
          </button>
          <div className={styles.desktopPile}>
            <PuzzlePreview image={landingImage} size={304} grid={4} seed={21} scattered />
          </div>
          <button className={styles.primaryButton} type="button" onClick={onStart}>
            {text.startPuzzle} <PuzzleIcon />
          </button>
        </div>
        <div className={styles.landingRight}>
          <div className={styles.landingCard}>
            <ScallopedCard />
            <div className={styles.framedPreview}>
              <PuzzlePreview image={landingImage} size={304} grid={4} seed={21} loose />
            </div>
            <Image className={styles.frameImage} src={`${assetRoot}/frame.webp`} alt="" fill sizes="60vw" priority />
          </div>
        </div>
      </section>

      <section className={styles.landingMobile} aria-label={text.startScreen}>
        <button className={styles.mobileHomeButton} type="button" aria-label={text.home}>
          <HomeIcon />
        </button>
        <div className={styles.mobileIntro}>
          <Logo />
          <p className={styles.mobileBlurb}>
            {text.blurbBefore}<u>{text.blurbEmphasis}</u>{text.blurbAfter}
          </p>
          <button className={styles.mobileDailyCue} type="button" onClick={onOpening}>
            <small>{text.openingPainting}</small>
            <strong>{openingPainting.workTitle}</strong>
            <BrushArrow />
          </button>
        </div>
        <div className={styles.mobileArt}>
          <div className={styles.mobilePuzzlePreview}>
            <PuzzlePreview image={landingImage} size={304} grid={3} seed={19} loose />
          </div>
          <Image
            className={styles.frameImage}
            src={`${assetRoot}/frame.webp`}
            alt=""
            fill
            sizes="(max-width: 600px) calc(100vw - 40px), 1px"
            priority
          />
        </div>
        <button className={styles.mobilePrimaryButton} type="button" onClick={onStart}>
          {text.startPuzzle} <PuzzleIcon />
        </button>
      </section>
    </div>
  );
}

function SlotGuides({ cut, grid }: { cut: GridCut; grid: number }) {
  const size = 304;
  const cell = size / grid;
  const margin = Math.ceil(cell * 0.32) + 1;
  return (
    <svg className={styles.slotGuides} viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: grid }, (_, row) =>
        Array.from({ length: grid }, (_entry, column) => (
          <path
            key={`${row}-${column}`}
            d={piecePath(pieceEdges(cut, row, column, grid), cell, margin)}
            transform={`translate(${column * cell - margin} ${row * cell - margin})`}
            fill="none"
            stroke="rgba(255,255,255,.48)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )),
      )}
    </svg>
  );
}

function FramedArtwork({
  painting,
  className,
  sizes,
}: {
  painting: Painting;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`${styles.framedArtwork} ${className}`}>
      <div className={styles.resultPainting} style={{ backgroundImage: `url("${painting.image}")` }} />
      <Image className={styles.frameImage} src={`${assetRoot}/frame.webp`} alt="" fill sizes={sizes} priority />
      <div className={styles.resultPlaque} style={{ backgroundImage: `url("${assetRoot}/plaque.webp")` }}>
        <strong>{painting.plaqueTitle}</strong>
        <span>{painting.plaqueSub}</span>
      </div>
    </div>
  );
}

function ResultScreen({
  language,
  muted,
  musicMuted,
  collectionCount,
  challengeLevel,
  painting,
  onHome,
  onContinue,
  onToggleLanguage,
  onToggleSound,
  onToggleMusic,
  onOpenCollection,
}: {
  language: Language;
  muted: boolean;
  musicMuted: boolean;
  collectionCount: number;
  challengeLevel: number;
  painting: Painting;
  onHome: () => void;
  onContinue: () => void;
  onToggleLanguage: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenCollection: () => void;
}) {
  const text = translations[language];
  return (
    <main className={styles.resultScreen} style={{ "--painting-accent": painting.accent } as CSSProperties}>
      <UtilityControls
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectionCount={collectionCount}
        challengeLevel={challengeLevel}
        onToggleLanguage={onToggleLanguage}
        onToggleSound={onToggleSound}
        onToggleMusic={onToggleMusic}
        onOpenCollection={onOpenCollection}
      />
      <section className={styles.resultCopy}>
        <button className={styles.resultHome} type="button" aria-label={text.home} onClick={onHome}>
          <HomeIcon />
        </button>
        <Logo />
        <span className={styles.resultDivider} aria-hidden="true" />
        <p className={styles.congratulations}>{text.congratulations}</p>
        <FramedArtwork
          painting={painting}
          className={styles.resultThumbnail}
          sizes="(max-width: 600px) 1px, 14vw"
        />
        <button className={styles.resultAction} type="button" onClick={onContinue}>
          {text.nextPainting} <ContinueIcon />
        </button>
      </section>
      <section className={styles.resultArtColumn}>
        <div className={styles.resultCard}>
          <ScallopedCard />
          <div className={styles.resultDetails}>
            <h1>{painting.title[language]}</h1>
            <p>{painting.description[language]}</p>
            <a className={styles.sourceLink} href={painting.sourceUrl} target="_blank" rel="noreferrer">
              {text.source}: {painting.sourceName} · {painting.publicDomain ? text.publicDomain : text.userProvided}
            </a>
          </div>
          <FramedArtwork
            painting={painting}
            className={styles.resultHeroArt}
            sizes="(max-width: 600px) calc(100vw - 40px), 48vw"
          />
        </div>
      </section>
    </main>
  );
}

export function PieceOfArtExperience() {
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [muted, setMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [paintingIndex, setPaintingIndex] = useState(getStartingPaintingIndex);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(() => new Set());
  const [activeThemeId, setActiveThemeId] = useState(themes[0].id);
  const [completionBloom, setCompletionBloom] = useState(false);
  const [grid, setGrid] = useState(MIN_GRID);
  const [cutSeed, setCutSeed] = useState(43);
  const [hint, setHint] = useState(false);
  const [hintSeconds, setHintSeconds] = useState(0);
  const [hintCycle, setHintCycle] = useState(0);
  const [pieces, setPieces] = useState<PieceState[]>([]);
  const [boardSize, setBoardSize] = useState(304);

  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const piecesRef = useRef<PieceState[]>([]);
  const zRef = useRef(20);
  const resizeTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const hintIntervalRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);

  const painting = paintings[paintingIndex];
  const cut = useMemo(() => createCut(grid, cutSeed), [grid, cutSeed]);
  const playSound = usePuzzleSounds(muted);
  const { startMusic, stopMusic, duckMusic } = useHealingMusic();
  const text = translations[language];
  const dailyPainting = paintings[getDailyPaintingIndex()];
  const startingPainting = paintings[getStartingPaintingIndex()];
  const challengeLevel = Math.min(
    paintings.length,
    Math.max(1, collectedIds.size + (completed || collectedIds.has(painting.id) ? 0 : 1)),
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMuted(window.localStorage.getItem("piece-of-art-muted") === "true");
      setMusicMuted(window.localStorage.getItem("piece-of-art-music-muted") === "true");
      setLanguage(window.localStorage.getItem("piece-of-art-language") === "zh" ? "zh" : "en");
      try {
        const stored = JSON.parse(window.localStorage.getItem("piece-of-art-collected") ?? "[]") as string[];
        const currentIds = stored.map((id) => paintingIdReplacements[id] ?? id);
        setCollectedIds(new Set(currentIds.filter((id) => paintings.some((painting) => painting.id === id))));
      } catch {
        setCollectedIds(new Set());
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      if (hintIntervalRef.current) window.clearInterval(hintIntervalRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const replacePieces = useCallback((next: PieceState[]) => {
    piecesRef.current = next;
    setPieces(next);
  }, []);

  const toggleSound = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      window.localStorage.setItem("piece-of-art-muted", String(next));
      return next;
    });
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicMuted((current) => {
      const next = !current;
      window.localStorage.setItem("piece-of-art-music-muted", String(next));
      if (next) stopMusic();
      else startMusic();
      return next;
    });
  }, [startMusic, stopMusic]);

  const beginMusicIfEnabled = useCallback(() => {
    if (!musicMuted) startMusic();
  }, [musicMuted, startMusic]);

  const openCollection = useCallback(() => {
    playSound("tap");
    beginMusicIfEnabled();
    setCollectionOpen(true);
  }, [beginMusicIfEnabled, playSound]);

  const markCollected = useCallback((paintingId: string) => {
    setCollectedIds((current) => {
      if (current.has(paintingId)) return current;
      const next = new Set(current);
      next.add(paintingId);
      window.localStorage.setItem("piece-of-art-collected", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    playSound("tap");
    setLanguage((current) => {
      const next = current === "en" ? "zh" : "en";
      window.localStorage.setItem("piece-of-art-language", next);
      return next;
    });
  }, [playSound]);

  const cancelHint = useCallback(() => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    if (hintIntervalRef.current) window.clearInterval(hintIntervalRef.current);
    hintTimerRef.current = null;
    hintIntervalRef.current = null;
    setHintSeconds(0);
    setHint(false);
  }, []);

  const showTemporaryHint = useCallback(() => {
    playSound("hint");
    cancelHint();
    const endsAt = Date.now() + 10_000;
    setHint(true);
    setHintSeconds(10);
    setHintCycle((cycle) => cycle + 1);
    hintIntervalRef.current = window.setInterval(() => {
      setHintSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    hintTimerRef.current = window.setTimeout(() => {
      if (hintIntervalRef.current) window.clearInterval(hintIntervalRef.current);
      hintIntervalRef.current = null;
      setHintSeconds(0);
      setHint(false);
    }, 10_000);
  }, [cancelHint, playSound]);

  const scatterPieces = useCallback(() => {
    const root = rootRef.current;
    const board = boardRef.current;
    const pile = pileRef.current;
    if (!root || !board || !pile) return;

    const rootRect = root.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const pileRect = pile.getBoundingClientRect();
    const nextBoardSize = boardRect.width;
    const cell = nextBoardSize / grid;
    const margin = Math.ceil(cell * 0.32) + 1;
    const pieceSize = cell + margin * 2;
    const random = makeRandom(randomSeed());
    const maxX = Math.max(0, pileRect.width - pieceSize);
    const maxY = Math.max(0, pileRect.height - pieceSize);
    const shuffledIds = shuffleArray(
      Array.from({ length: grid * grid }, (_, id) => id),
      random,
    );
    const baseZ = 20;
    zRef.current = baseZ + shuffledIds.length;

    const nextPieces = shuffledIds.map((id, stackIndex) => ({
      id,
      row: Math.floor(id / grid),
      column: id % grid,
      x: pileRect.left - rootRect.left + random() * maxX,
      y: pileRect.top - rootRect.top + random() * maxY,
      rotation: window.innerWidth <= 600 ? (random() - 0.5) * 14 : 0,
      z: baseZ + stackIndex,
      locked: false,
      flash: false,
    }));

    setBoardSize(nextBoardSize);
    replacePieces(nextPieces);
    setCompleted(false);
    cancelHint();
  }, [cancelHint, grid, replacePieces]);

  useEffect(() => {
    if (!started || completed || collectionOpen) return;
    const frame = window.requestAnimationFrame(scatterPieces);
    return () => window.cancelAnimationFrame(frame);
  }, [collectionOpen, completed, cutSeed, grid, paintingIndex, scatterPieces, started]);

  useEffect(() => {
    if (!started || completed || collectionOpen) return;
    const handleResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(scatterPieces, 180);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
    };
  }, [collectionOpen, completed, scatterPieces, started]);

  const snapPiece = useCallback((pieceId: number) => {
    const root = rootRef.current;
    const board = boardRef.current;
    if (!root || !board) return;

    const rootRect = root.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const cell = boardRect.width / grid;
    const margin = Math.ceil(cell * 0.32) + 1;
    const active = piecesRef.current.find((piece) => piece.id === pieceId);
    if (!active) return;
    const targetX = boardRect.left - rootRect.left + active.column * cell - margin;
    const targetY = boardRect.top - rootRect.top + active.row * cell - margin;

    const next = piecesRef.current.map((piece) =>
      piece.id === active.id
        ? { ...piece, x: targetX, y: targetY, rotation: 0, locked: true, flash: true, z: 2 }
        : piece,
    );
    replacePieces(next);
    playSound("snap");
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      replacePieces(piecesRef.current.map((piece) => ({ ...piece, flash: false })));
    }, 480);
    if (next.every((piece) => piece.locked)) {
      cancelHint();
      markCollected(painting.id);
      setCompletionBloom(true);
      duckMusic();
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = window.setTimeout(() => {
        playSound("complete");
        setCompleted(true);
        setCompletionBloom(false);
      }, 880);
    }
  }, [cancelHint, duckMusic, grid, markCollected, painting.id, playSound, replacePieces]);

  const releasePiece = useCallback(() => {
    const dragging = dragRef.current;
    dragRef.current = null;
    const root = rootRef.current;
    const board = boardRef.current;
    if (!dragging || !root || !board) return;

    const rootRect = root.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const cell = boardRect.width / grid;
    const margin = Math.ceil(cell * 0.32) + 1;
    const snapDistance = Math.max(16, cell * 0.45);
    const active = piecesRef.current.find((piece) => piece.id === dragging.id);
    if (!active) return;
    const targetX = boardRect.left - rootRect.left + active.column * cell - margin;
    const targetY = boardRect.top - rootRect.top + active.row * cell - margin;

    if (Math.hypot(active.x - targetX, active.y - targetY) >= snapDistance) {
      playSound("drop");
      return;
    }
    snapPiece(active.id);
  }, [grid, playSound, snapPiece]);

  useEffect(() => {
    const movePiece = (event: PointerEvent) => {
      const dragging = dragRef.current;
      const root = rootRef.current;
      if (!dragging || !root) return;
      const rootRect = root.getBoundingClientRect();
      replacePieces(
        piecesRef.current.map((piece) =>
          piece.id === dragging.id
            ? {
                ...piece,
                x: event.clientX - rootRect.left - dragging.offsetX,
                y: event.clientY - rootRect.top - dragging.offsetY,
              }
            : piece,
        ),
      );
    };

    window.addEventListener("pointermove", movePiece);
    window.addEventListener("pointerup", releasePiece);
    window.addEventListener("pointercancel", releasePiece);
    return () => {
      window.removeEventListener("pointermove", movePiece);
      window.removeEventListener("pointerup", releasePiece);
      window.removeEventListener("pointercancel", releasePiece);
    };
  }, [releasePiece, replacePieces]);

  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>, piece: PieceState) => {
    if (piece.locked || !rootRef.current) return;
    playSound("pickup");
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rootRect = rootRef.current.getBoundingClientRect();
    dragRef.current = {
      id: piece.id,
      offsetX: event.clientX - rootRect.left - piece.x,
      offsetY: event.clientY - rootRect.top - piece.y,
    };
    zRef.current += 1;
    replacePieces(
      piecesRef.current.map((item) =>
        item.id === piece.id ? { ...item, z: zRef.current } : item,
      ),
    );
  };

  const changeGrid = (delta: -1 | 1) => {
    playSound("tap");
    cancelHint();
    replacePieces([]);
    setGrid((value) => Math.min(MAX_GRID, Math.max(MIN_GRID, value + delta)));
  };

  const randomizePainting = () => {
    setPaintingIndex((current) => {
      const offset = 1 + Math.floor(Math.random() * (paintings.length - 1));
      return (current + offset) % paintings.length;
    });
  };

  const selectPainting = (selected: Painting) => {
    const nextIndex = paintings.findIndex((item) => item.id === selected.id);
    if (nextIndex < 0) return;
    playSound("shuffle");
    beginMusicIfEnabled();
    setPaintingIndex(nextIndex);
    setStarted(true);
    setCompleted(false);
    setCollectionOpen(false);
    cancelHint();
  };

  const goHome = () => {
    playSound("tap");
    setStarted(false);
    setCompleted(false);
    setCollectionOpen(false);
    replacePieces([]);
    cancelHint();
  };

  const continueChallenge = () => {
    playSound("shuffle");
    beginMusicIfEnabled();
    cancelHint();
    setPaintingIndex((current) => {
      for (let offset = 1; offset < paintings.length; offset += 1) {
        const candidate = (current + offset) % paintings.length;
        if (!collectedIds.has(paintings[candidate].id)) return candidate;
      }
      return (current + 1) % paintings.length;
    });
    setCompleted(false);
  };

  if (collectionOpen) {
    return (
      <CollectionScreen
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectedIds={collectedIds}
        activeThemeId={activeThemeId}
        dailyPainting={dailyPainting}
        onSelectTheme={(themeId) => {
          playSound("tap");
          setActiveThemeId(themeId);
        }}
        onSelectPainting={selectPainting}
        onClose={() => {
          playSound("tap");
          setCollectionOpen(false);
        }}
        onToggleLanguage={toggleLanguage}
        onToggleSound={toggleSound}
        onToggleMusic={toggleMusic}
      />
    );
  }

  if (!started) {
    return (
      <LandingScreen
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectionCount={collectedIds.size}
        openingPainting={startingPainting}
        onStart={() => {
          playSound("tap");
          beginMusicIfEnabled();
          setPaintingIndex(getStartingPaintingIndex());
          setCompleted(false);
          setStarted(true);
        }}
        onOpening={() => selectPainting(startingPainting)}
        onToggleLanguage={toggleLanguage}
        onToggleSound={toggleSound}
        onToggleMusic={toggleMusic}
        onOpenCollection={openCollection}
      />
    );
  }

  if (completed) {
    return (
      <ResultScreen
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectionCount={collectedIds.size}
        challengeLevel={challengeLevel}
        painting={painting}
        onHome={goHome}
        onContinue={continueChallenge}
        onToggleLanguage={toggleLanguage}
        onToggleSound={toggleSound}
        onToggleMusic={toggleMusic}
        onOpenCollection={openCollection}
      />
    );
  }

  const cell = boardSize / grid;
  const margin = Math.ceil(cell * 0.32) + 1;
  const pieceSize = cell + margin * 2;

  return (
    <main className={styles.game} ref={rootRef} style={{ "--painting-accent": painting.accent } as CSSProperties}>
      <UtilityControls
        language={language}
        muted={muted}
        musicMuted={musicMuted}
        collectionCount={collectedIds.size}
        challengeLevel={challengeLevel}
        onToggleLanguage={toggleLanguage}
        onToggleSound={toggleSound}
        onToggleMusic={toggleMusic}
        onOpenCollection={openCollection}
      />
      <aside className={styles.gameSidebar}>
        <button className={styles.gameHome} type="button" aria-label={text.home} onClick={goHome}>
          <HomeIcon />
        </button>
        <Logo compact />
        <p className={styles.gameBlurb}>
          {text.blurbBefore}<u>{text.blurbEmphasis}</u>{text.blurbAfter}
        </p>
        <div className={styles.gamePile} ref={pileRef} aria-hidden="true" />
        <button
          className={styles.randomizeButton}
          type="button"
          onClick={() => {
            playSound("shuffle");
            randomizePainting();
          }}
        >
          {text.randomize} <ShuffleIcon />
        </button>
      </aside>

      <section className={styles.gameMain}>
        <div className={styles.gameCard}>
          <ScallopedCard />
          <div className={styles.topBar}>
            <div className={styles.controls}>
              <span className={styles.controlLabel}>{text.pieces}</span>
              <div className={`${styles.pill} ${styles.stepper}`}>
                <button
                  type="button"
                  aria-label={text.decreasePieces}
                  disabled={grid === MIN_GRID}
                  onClick={() => changeGrid(-1)}
                >
                  −
                </button>
                <strong>{grid * grid}</strong>
                <button
                  type="button"
                  aria-label={text.increasePieces}
                  disabled={grid === MAX_GRID}
                  onClick={() => changeGrid(1)}
                >
                  +
                </button>
              </div>
              <button
                className={styles.pill}
                type="button"
                onClick={() => {
                  playSound("shuffle");
                  setCutSeed((value) => value + 1);
                }}
              >
                <PuzzleIcon /> <span>{text.newCut}</span>
              </button>
              <button
                className={`${styles.pill} ${styles.hintButton}`}
                type="button"
                aria-pressed={hint}
                aria-label={
                  hint
                    ? language === "zh"
                      ? `提示，剩余 ${hintSeconds} 秒`
                      : `Hint, ${hintSeconds} seconds remaining`
                    : text.hint
                }
                onClick={showTemporaryHint}
              >
                <EyeIcon /> <span>{text.hint}</span>
                {hint ? (
                  <>
                    <strong className={styles.hintSeconds} aria-hidden="true">
                      {hintSeconds}{text.secondsShort}
                    </strong>
                    <span className={styles.hintProgress} key={hintCycle} aria-hidden="true" />
                  </>
                ) : null}
              </button>
              <button
                className={styles.pill}
                type="button"
                onClick={() => {
                  playSound("shuffle");
                  scatterPieces();
                }}
              >
                {text.reset}
              </button>
            </div>
          </div>
          <div className={styles.stage}>
            <div className={styles.playArea} />
            <div className={styles.board} ref={boardRef}>
              <div
                className={`${styles.hintArt} ${hint ? styles.hintVisible : ""}`}
                style={{ backgroundImage: `url("${painting.image}")` }}
              />
              <SlotGuides cut={cut} grid={grid} />
            </div>
          </div>
        </div>
      </section>

      <div
        className={styles.pieceLayer}
        aria-label={language === "zh" ? `${grid * grid} 块拼图` : `${grid * grid} piece jigsaw puzzle`}
      >
        {pieces.map((piece) => {
          const path = piecePath(pieceEdges(cut, piece.row, piece.column, grid), cell, margin);
          const pieceStyle = {
            width: pieceSize,
            height: pieceSize,
            zIndex: piece.z,
            clipPath: `path("${path}")`,
            backgroundImage: `url("${painting.image}")`,
            backgroundSize: `${boardSize}px ${boardSize}px`,
            backgroundPosition: `${margin - piece.column * cell}px ${margin - piece.row * cell}px`,
            transform: `translate3d(${piece.x}px, ${piece.y}px, 0) rotate(${piece.rotation}deg)`,
          } as CSSProperties;
          return (
            <button
              className={`${styles.piece} ${piece.locked ? styles.pieceLocked : ""} ${piece.flash ? styles.pieceFlash : ""}`}
              key={piece.id}
              type="button"
              aria-label={
                language === "zh"
                  ? `拼图块 ${piece.id + 1}${piece.locked ? "，已放置" : "，按回车键放置"}`
                  : `Puzzle piece ${piece.id + 1}${piece.locked ? ", placed" : ", press Enter to place"}`
              }
              disabled={piece.locked}
              style={pieceStyle}
              onPointerDown={(event) => startDragging(event, piece)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                snapPiece(piece.id);
              }}
            />
          );
        })}
      </div>
      <div className={`${styles.completionBloom} ${completionBloom ? styles.completionBloomVisible : ""}`} aria-hidden="true" />
    </main>
  );
}
