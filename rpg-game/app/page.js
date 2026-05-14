"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ---------- SVG パーツ ---------- */

// 黄色い星（主人公）
function HeroStar({ size = 96, color = "#FFD93B", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      className={className}
    >
      <polygon
        points="0,-42 12,-13 42,-13 18,5 27,34 0,17 -27,34 -18,5 -42,-13 -12,-13"
        fill={color}
        stroke="#B8860B"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* 顔（左右の目と口） */}
      <circle cx="-10" cy="-8" r="2.5" fill="#222" />
      <circle cx="10" cy="-8" r="2.5" fill="#222" />
      <path
        d="M -7 2 Q 0 8 7 2"
        stroke="#222"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 緑の三角形の敵（目つき）
function EnemyTriangle({ size = 96, hit = false }) {
  const fill = hit ? "#E63946" : "#2BB673";
  const stroke = hit ? "#7a1d24" : "#176b42";
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100">
      <polygon
        points="0,-42 42,38 -42,38"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* 目 */}
      <circle cx="-12" cy="10" r="6" fill="#fff" />
      <circle cx="12" cy="10" r="6" fill="#fff" />
      <circle cx="-12" cy="11" r="3" fill="#111" />
      <circle cx="12" cy="11" r="3" fill="#111" />
    </svg>
  );
}

// 赤いハート（HP）
function Heart({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M12 21s-7.5-4.5-9.5-9.5C0.8 7.5 3.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 6.2 3.5 4.5 7.5C19.5 16.5 12 21 12 21z"
        fill="#FF3B5C"
        stroke="#8a0f25"
        strokeWidth="1.2"
      />
    </svg>
  );
}

// 小さな赤い星（プレイヤー弾）
function MiniStar({ size = 28, color = "#FF3B3B" }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100">
      <polygon
        points="0,-42 12,-13 42,-13 18,5 27,34 0,17 -27,34 -18,5 -42,-13 -12,-13"
        fill={color}
        stroke="#7a0d0d"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 小さな青い三角（敵の弾）
function MiniTriangle({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100">
      <polygon
        points="0,-42 42,38 -42,38"
        fill="#2E7BFF"
        stroke="#0c2f7a"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 煙パフ
function Smoke({ delay = 0, x = 0, y = 0 }) {
  return (
    <div
      className="absolute pointer-events-none animate-smoke"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="rounded-full bg-gray-300/80"
        style={{ width: 26, height: 26, filter: "blur(2px)" }}
      />
    </div>
  );
}

function SmokeBurst() {
  // ランダム風に複数パフ
  const puffs = [
    { x: 0, y: 0, d: 0 },
    { x: -18, y: -6, d: 0.05 },
    { x: 16, y: -10, d: 0.1 },
    { x: -8, y: 14, d: 0.15 },
    { x: 12, y: 10, d: 0.2 },
    { x: 0, y: -18, d: 0.08 },
  ];
  return (
    <div className="absolute inset-0">
      {puffs.map((p, i) => (
        <Smoke key={i} x={p.x} y={p.y} delay={p.d} />
      ))}
    </div>
  );
}

/* ---------- メインゲーム ---------- */

const STAGE_W = 720; // 戦闘エリアの幅(px)
const STAGE_H = 360; // 戦闘エリアの高さ(px)
const HERO_X = 110; // ヒーロー中心X
const ENEMY_X = STAGE_W - 110; // 敵中心X
const CENTER_Y = STAGE_H / 2;

const PLAYER_BULLET_MS = 600;
const ENEMY_BULLET_MS = 700;
const SMOKE_MS = 900;
const ENEMY_RESPAWN_MS = 700;
const ENEMY_FIRE_DELAY_MS = 500;

export default function Page() {
  const [hp, setHp] = useState(3);
  const [enemyAlive, setEnemyAlive] = useState(true);
  const [enemyHit, setEnemyHit] = useState(false); // 赤くなる
  const [enemySmoke, setEnemySmoke] = useState(false);
  const [heroSmoke, setHeroSmoke] = useState(false);
  const [heroAlive, setHeroAlive] = useState(true);
  const [heroShake, setHeroShake] = useState(false);
  const [message, setMessage] = useState("敵があらわれた！");

  // 弾の状態
  const [playerBullet, setPlayerBullet] = useState(null); // {progress 0..1}
  const [enemyBullet, setEnemyBullet] = useState(null);

  // ボタンロック（連打防止）
  const [busy, setBusy] = useState(false);

  const timers = useRef([]);
  const addTimer = (id) => timers.current.push(id);
  const clearAllTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clearAllTimers(), []);

  /* プレイヤーの攻撃 */
  const handleAttack = useCallback(() => {
    if (busy || !heroAlive || !enemyAlive) return;
    setBusy(true);
    setMessage("プレイヤーの こうげき！");

    // 弾を発射（HEROからENEMYへ）
    const start = performance.now();
    setPlayerBullet({ start });

    // 命中処理
    addTimer(
      setTimeout(() => {
        setPlayerBullet(null);
        // 敵にダメージ：赤く→煙→消滅
        setEnemyHit(true);
        setMessage("こうかは ばつぐんだ！");
        addTimer(
          setTimeout(() => {
            setEnemySmoke(true);
            setEnemyAlive(false);
          }, 280)
        );
        addTimer(
          setTimeout(() => {
            setEnemySmoke(false);
            setEnemyHit(false);
            // 新しい敵を出す
            setEnemyAlive(true);
            setMessage("つぎの 敵が あらわれた！");
            // 敵が攻撃してくる
            addTimer(
              setTimeout(() => {
                enemyFire();
              }, ENEMY_FIRE_DELAY_MS)
            );
          }, 280 + SMOKE_MS)
        );
      }, PLAYER_BULLET_MS)
    );
  }, [busy, heroAlive, enemyAlive]);

  /* 敵の攻撃 */
  const enemyFire = useCallback(() => {
    setMessage("敵の こうげき！");
    const start = performance.now();
    setEnemyBullet({ start });

    addTimer(
      setTimeout(() => {
        setEnemyBullet(null);
        // プレイヤーにダメージ
        setHeroShake(true);
        addTimer(setTimeout(() => setHeroShake(false), 400));

        setHp((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            // ゲームオーバー
            setMessage("やられてしまった…");
            addTimer(
              setTimeout(() => {
                setHeroSmoke(true);
                setHeroAlive(false);
              }, 250)
            );
            addTimer(
              setTimeout(() => {
                setHeroSmoke(false);
              }, 250 + SMOKE_MS)
            );
            setBusy(true); // 入力ロック
          } else {
            setMessage(`HPが ${next} に なった！`);
            setBusy(false); // 次のターン
          }
          return Math.max(0, next);
        });
      }, ENEMY_BULLET_MS)
    );
  }, []);

  /* リスタート */
  const restart = () => {
    clearAllTimers();
    setHp(3);
    setEnemyAlive(true);
    setEnemyHit(false);
    setEnemySmoke(false);
    setHeroAlive(true);
    setHeroSmoke(false);
    setHeroShake(false);
    setPlayerBullet(null);
    setEnemyBullet(null);
    setBusy(false);
    setMessage("敵があらわれた！");
  };

  /* 弾アニメーション（rAFで位置を毎フレーム更新） */
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    if (playerBullet || enemyBullet) raf = requestAnimationFrame(loop);
    return () => raf && cancelAnimationFrame(raf);
  }, [playerBullet, enemyBullet]);

  const now = performance.now();
  const playerBulletProgress = playerBullet
    ? Math.min(1, (now - playerBullet.start) / PLAYER_BULLET_MS)
    : 0;
  const enemyBulletProgress = enemyBullet
    ? Math.min(1, (now - enemyBullet.start) / ENEMY_BULLET_MS)
    : 0;

  const playerBulletX =
    HERO_X + (ENEMY_X - HERO_X) * playerBulletProgress;
  const enemyBulletX =
    ENEMY_X - (ENEMY_X - HERO_X) * enemyBulletProgress;

  const gameOver = !heroAlive;

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="text-3xl font-bold tracking-wider">
        <span className="text-yellow-300">★</span> Star RPG{" "}
        <span className="text-green-400">▲</span>
      </h1>

      {/* HP（赤いハート × 3） */}
      <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-xl">
        <span className="text-sm text-gray-200 mr-2">HP</span>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="transition-all duration-300"
            style={{
              opacity: i < hp ? 1 : 0.15,
              transform: i < hp ? "scale(1)" : "scale(0.85)",
            }}
          >
            <Heart size={36} />
          </div>
        ))}
      </div>

      {/* 戦闘エリア */}
      <div
        className="relative rounded-2xl border-2 border-indigo-400/40 bg-gradient-to-b from-indigo-950/60 to-slate-900/80 shadow-2xl overflow-hidden"
        style={{ width: STAGE_W, height: STAGE_H, maxWidth: "95vw" }}
      >
        {/* 地面っぽいライン */}
        <div className="absolute left-0 right-0 bottom-10 h-px bg-white/10" />

        {/* ヒーロー（星） */}
        <div
          className="absolute"
          style={{
            left: HERO_X - 48,
            top: CENTER_Y - 48,
            width: 96,
            height: 96,
          }}
        >
          {heroAlive && (
            <div
              className={`${heroShake ? "animate-shake" : "animate-pulse2"}`}
            >
              <HeroStar size={96} />
            </div>
          )}
          {heroSmoke && <SmokeBurst />}
        </div>

        {/* 敵（三角） */}
        <div
          className="absolute"
          style={{
            left: ENEMY_X - 48,
            top: CENTER_Y - 48,
            width: 96,
            height: 96,
          }}
        >
          {enemyAlive && (
            <div className={enemyHit ? "" : "animate-pulse2"}>
              <EnemyTriangle size={96} hit={enemyHit} />
            </div>
          )}
          {enemySmoke && <SmokeBurst />}
        </div>

        {/* プレイヤー弾（小さい赤い星） */}
        {playerBullet && (
          <div
            className="absolute"
            style={{
              left: playerBulletX - 14,
              top: CENTER_Y - 14,
              transform: `rotate(${playerBulletProgress * 720}deg)`,
            }}
          >
            <MiniStar size={28} />
          </div>
        )}

        {/* 敵の弾（小さい青い三角） */}
        {enemyBullet && (
          <div
            className="absolute"
            style={{
              left: enemyBulletX - 12,
              top: CENTER_Y - 12,
              transform: `rotate(${-enemyBulletProgress * 540}deg)`,
            }}
          >
            <MiniTriangle size={24} />
          </div>
        )}

        {/* メッセージウィンドウ */}
        <div className="absolute left-3 right-3 bottom-3 bg-black/60 border border-white/20 rounded-lg px-4 py-2 text-sm">
          {message}
        </div>
      </div>

      {/* 攻撃ボタン or リスタート */}
      {!gameOver ? (
        <button
          onClick={handleAttack}
          disabled={busy || !heroAlive}
          className="select-none px-12 py-4 rounded-full border-4 border-yellow-300 bg-yellow-400/90 hover:bg-yellow-300 text-slate-900 text-xl font-extrabold tracking-widest shadow-lg shadow-yellow-500/30 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minWidth: 220 }}
        >
          攻撃
        </button>
      ) : (
        <button
          onClick={restart}
          className="px-10 py-4 rounded-full border-4 border-rose-300 bg-rose-400/90 hover:bg-rose-300 text-slate-900 text-xl font-extrabold tracking-widest shadow-lg shadow-rose-500/30 transition active:scale-95"
        >
          もういちど
        </button>
      )}

      <p className="text-xs text-white/40">
        攻撃ボタンで赤い小星を発射 → 敵を倒すと次の敵が反撃します
      </p>
    </main>
  );
}
