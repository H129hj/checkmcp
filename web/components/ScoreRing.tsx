import { scoreKey, GRADE_TEXT } from "../lib/format";

export default function ScoreRing({ score, label = "MCP SCORE", size = "9rem" }: { score: number; label?: string; size?: string }) {
  const k = scoreKey(score);
  return (
    <div
      className={`radial-progress ${GRADE_TEXT[k]}`}
      style={{ "--value": score, "--size": size, "--thickness": "7px" } as React.CSSProperties}
      role="progressbar"
      aria-label={`${label} : ${score} sur 100`}
    >
      <div className="flex flex-col items-center leading-none">
        <span className="text-4xl font-extrabold tracking-tighter">{score}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-base-content/45 mt-1">{label}</span>
      </div>
    </div>
  );
}
