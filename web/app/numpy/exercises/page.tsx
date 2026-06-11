"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ExerciseProgressRing } from "@/components/exercise-progress-ring";
import { XPToast } from "@/components/xp-toast";
import { BadgeToast } from "@/components/badge-toast";
import { CodeTutorChat } from "@/components/code-tutor-chat";
import { checkTierBadge, tryAwardBadge, type Badge } from "@/lib/achievements";
import {
  awardXPWithResult,
  XP_AWARD,
  getTierForXP,
  getXPProgressInTier,
  getNextTier,
  getXPSnapshot,
  getXPServerSnapshot,
  subscribeXP,
} from "@/lib/xp-store";
import { PythonCodeEditor } from "@/components/python-code";
import {
  EXERCISE_ZONE_CODE_LAB,
  EXERCISE_ZONE_MCQ_DRILL,
  recordExerciseResult,
  summarizeExerciseProgress,
} from "@/lib/numpy-exercise-progress";
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  notifyProgressChange,
  subscribeProgress,
} from "@/lib/numpy-progress-store";
import {
  difficultyFromSession,
  pickFocusTopic,
  type DrillDifficulty,
} from "@/lib/exercise-adaptive";
import { runAndValidateChallenge, type CodeChallengeCheck } from "@/lib/numpy-code-validate";
import { slugifyTopic } from "@/lib/numpy-learning-path";
import { loadNumpyPlacement, type NumpyPlacementPayload } from "@/lib/numpy-placement-storage";
import { ensurePyodideWorker } from "@/lib/pyodide-web-worker";
import {
  findSavedProblem,
  getSavedProblemsServerSnapshot,
  getSavedProblemsSnapshot,
  subscribeSavedProblems,
  toggleSavedProblem,
} from "@/lib/numpy-saved-problems";
import { pickCuratedCodeChallenge } from "@/lib/numpy-code-challenge-quality";
import { pickRotatingCodeLesson } from "@/lib/numpy-code-topics";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";
import { pickFallbackMcq } from "@/lib/numpy-mcq-bank";

type DrillMcq = {
  topic: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
};

type CodeChallenge = {
  id: string;
  topic: string;
  prompt: string;
  starterCode: string;
  expectedOutputs?: string[];
  checks?: CodeChallengeCheck[];
  hint: string;
};

/** Topics a user can manually select in the topic picker. */
const DRILL_TOPICS = [
  "NumPy arrays and indexing",
  "Array slicing",
  "Array shapes and reshaping",
  "Boolean indexing",
  "Array creation (zeros, ones, arange)",
  "Array math and operations",
  "Aggregation (sum, mean, min, max)",
  "Broadcasting",
  "Sorting and editing",
  "Transpose and flatten",
  "Matrices and dot product",
  "Random number generation",
] as const;

function NumpyExercisesContent() {
  const searchParams = useSearchParams();
  const [placement, setPlacement] = useState<NumpyPlacementPayload | null>(null);
  const [tab, setTab] = useState<"mcq" | "code">("code");
  /** When set, overrides the placement-derived focus topic with the user's pick. */
  const [topicOverride, setTopicOverride] = useState<string | null>(null);

  const focusHint = useMemo(() => {
    if (topicOverride) return topicOverride;
    const q = searchParams.get("focus")?.trim();
    if (q) return q;
    if (placement?.recommendedTopic) return placement.recommendedTopic;
    if (placement?.weakTopics?.length) return placement.weakTopics[0]!;
    return "NumPy arrays and indexing";
  }, [placement, searchParams, topicOverride]);

  const topicProgressKey = useMemo(() => slugifyTopic(focusHint), [focusHint]);

  useEffect(() => {
    setPlacement(loadNumpyPlacement());
    const t = searchParams.get("tab");
    if (t === "code" || searchParams.get("saved")) setTab("code");
    if (t === "mcq") setTab("mcq");
  }, [searchParams]);

  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );
  const summary = useMemo(() => summarizeExerciseProgress(progress), [progress]);

  /* —— Session adaptivity (mistakes → next question/challenge) —— */
  const [topicMistakes, setTopicMistakes] = useState<Record<string, number>>({});
  const [mcqSessionCorrect, setMcqSessionCorrect] = useState(0);
  const [mcqSessionAttempted, setMcqSessionAttempted] = useState(0);
  const [codeSessionCorrect, setCodeSessionCorrect] = useState(0);
  const [codeSessionAttempted, setCodeSessionAttempted] = useState(0);
  const [drillDifficulty, setDrillDifficulty] = useState<DrillDifficulty>("easy");
  const reinforceTopicRef = useRef<string | null>(null);
  const codeRotationRef = useRef(0);
  const seenCodeLessonIdsRef = useRef<string[]>([]);

  /* —— MCQ drill —— */
  const [mcq, setMcq] = useState<DrillMcq | null>(null);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [mcqError, setMcqError] = useState<string | null>(null);
  const [prevTopic, setPrevTopic] = useState<string | undefined>(undefined);
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);
  const [seenMcqPrompts, setSeenMcqPrompts] = useState<string[]>([]);
  const [xpToast, setXpToast] = useState<{ amount: number; levelUpTier?: { name: string; icon: string } } | null>(null);
  const [badgeToast, setBadgeToast] = useState<Badge | null>(null);

  const xpRecord = useSyncExternalStore(subscribeXP, getXPSnapshot, getXPServerSnapshot);
  const tier = getTierForXP(xpRecord.total);
  const nextTier = getNextTier(xpRecord.total);
  const xpProgress = getXPProgressInTier(xpRecord.total);

  const loadMcq = useCallback(async () => {
    setMcqLoading(true);
    setMcqError(null);
    setMcqSelected(null);
    const difficulty = difficultyFromSession(mcqSessionAttempted, mcqSessionCorrect);
    const focusTopic = pickFocusTopic(topicMistakes, focusHint);
    setDrillDifficulty(difficulty);
    try {
      const res = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty,
          focusTopic,
          previousTopic: prevTopic,
          seenPrompts: seenMcqPrompts,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as Record<string, unknown>;
      if (
        typeof data.prompt !== "string" ||
        !Array.isArray(data.choices) ||
        data.choices.length !== 4 ||
        typeof data.correctIndex !== "number" ||
        data.correctIndex < 0 ||
        data.correctIndex > 3
      ) {
        throw new Error("Bad shape");
      }
      const newMcq: DrillMcq = {
        topic: typeof data.topic === "string" ? data.topic : "general",
        prompt: data.prompt as string,
        choices: data.choices as string[],
        correctIndex: data.correctIndex as number,
        explanation: typeof data.explanation === "string" ? data.explanation : "",
        hint: typeof data.hint === "string" ? data.hint : undefined,
      };
      setMcq(newMcq);
      setSeenMcqPrompts((prev) =>
        prev.includes(newMcq.prompt) ? prev : [...prev, newMcq.prompt],
      );
    } catch {
      // Rotate through the local bank (preferring unseen prompts) instead of
      // repeating one hard-coded question every time generation fails.
      const fallback = pickFallbackMcq(seenMcqPrompts);
      setMcq(fallback);
      setSeenMcqPrompts((prev) =>
        prev.includes(fallback.prompt) ? prev : [...prev, fallback.prompt],
      );
      setMcqError("question from local bank");
    } finally {
      setMcqLoading(false);
    }
  }, [
    focusHint,
    prevTopic,
    seenMcqPrompts,
    topicMistakes,
    mcqSessionAttempted,
    mcqSessionCorrect,
  ]);

  useEffect(() => {
    if (tab === "mcq" && !mcq && !mcqLoading) void loadMcq();
  }, [tab, mcq, mcqLoading, loadMcq]);

  function onMcqPick(idx: number) {
    if (mcqSelected !== null || !mcq) return;
    setMcqSelected(idx);
    const ok = idx === mcq.correctIndex;
    setMcqSessionAttempted((n) => n + 1);
    if (ok) {
      setMcqSessionCorrect((n) => n + 1);
      const result = awardXPWithResult("mcq_correct");
      setXpToast({
        amount: XP_AWARD.mcq_correct,
        ...(result.leveledUp ? { levelUpTier: result.newTier } : {}),
      });
      setBadgeToast((prev) => prev ?? tryAwardBadge("first-correct") ?? checkTierBadge(result.newTier.minXP));
    } else {
      setTopicMistakes((prev) => ({
        ...prev,
        [mcq.topic]: (prev[mcq.topic] ?? 0) + 1,
      }));
    }
    recordExerciseResult(EXERCISE_ZONE_MCQ_DRILL, ok, { topicKey: topicProgressKey });
    notifyProgressChange();
    setPrevTopic(mcq.topic);
  }

  function onMcqNext() {
    void loadMcq();
  }

  // Keyboard nav: 1–4 to select, Enter to load next question
  useEffect(() => {
    if (tab !== "mcq") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && mcqSelected !== null) { onMcqNext(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4 && mcqSelected === null) onMcqPick(n - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // deps: tab + mcqSelected so the handler sees fresh state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mcqSelected]);

  /* —— Code lab —— */
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const codeAttemptRef = useRef(0);
  /** XP / progress for the current challenge are granted at most once. */
  const codeRewardClaimedRef = useRef(false);
  /** A generated challenge fetched in the background, ready to show instantly. */
  const prefetchedChallengeRef = useRef<CodeChallenge | null>(null);
  const prefetchInFlightRef = useRef(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** Saved (bookmarked) problems for the current account. */
  const savedProblems = useSyncExternalStore(
    subscribeSavedProblems,
    getSavedProblemsSnapshot,
    getSavedProblemsServerSnapshot,
  );
  const isCurrentSaved = !!challenge && savedProblems.some((p) => p.id === challenge.id);
  /** Open at most one saved problem from a ?saved=<id> deep link. */
  const openedSavedRef = useRef(false);
  const [seenCodePrompts, setSeenCodePrompts] = useState<string[]>([]);
  /** Ref mirror so background prefetch reads the latest seen prompts without re-subscribing. */
  const seenCodePromptsRef = useRef<string[]>([]);
  const [codeInput, setCodeInput] = useState(MINIMAL_STARTER_CODE);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");
  const canRun = !pyodideLoading && !pyodideError;

  useEffect(() => {
    let cancelled = false;
    setPyodideError("");
    setPyodideLoading(true);
    void ensurePyodideWorker()
      .then(() => {
        if (!cancelled) setPyodideLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setPyodideError(e instanceof Error ? e.message : "Pyodide failed");
          setPyodideLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the ref mirror current so background prefetch sees the latest prompts.
  useEffect(() => {
    seenCodePromptsRef.current = seenCodePrompts;
  }, [seenCodePrompts]);

  const buildChallengeFromData = useCallback(
    (data: Record<string, unknown>): CodeChallenge | null => {
      if (typeof data.id !== "string" || typeof data.prompt !== "string") return null;
      const hasChecks = Array.isArray(data.checks) && data.checks.length > 0;
      const hasExpected =
        Array.isArray(data.expectedOutputs) && data.expectedOutputs.length > 0;
      if (!hasChecks && !hasExpected) return null;
      return {
        id: data.id,
        topic: typeof data.topic === "string" ? data.topic : "general",
        prompt: data.prompt,
        starterCode: MINIMAL_STARTER_CODE,
        expectedOutputs: Array.isArray(data.expectedOutputs)
          ? (data.expectedOutputs as string[])
          : undefined,
        checks: Array.isArray(data.checks) ? (data.checks as CodeChallengeCheck[]) : undefined,
        hint: typeof data.hint === "string" ? data.hint : "",
      };
    },
    [],
  );

  const pickNextCodeLesson = useCallback(
    (reinforceTopic: string | null) => {
      // Rotation index + recent-id list let the picker cycle the curriculum
      // instead of repeating whatever topic happens to score highest.
      const lesson = pickRotatingCodeLesson({
        placementRecommended: placement?.recommendedTopic ?? null,
        placementWeak: placement?.weakTopics,
        urlFocus: searchParams.get("focus") ?? undefined,
        reinforceTopic,
        recentLessonIds: seenCodeLessonIdsRef.current,
        rotationIndex: codeRotationRef.current,
      });
      codeRotationRef.current += 1;
      // Keep only the last 8 lesson ids as a short "don't repeat" window.
      seenCodeLessonIdsRef.current = [...seenCodeLessonIdsRef.current.slice(-8), lesson.id];
      return lesson;
    },
    [placement, searchParams],
  );

  const fetchGeneratedChallenge = useCallback(
    async (
      lessonId: string,
      focus: string,
      difficulty: DrillDifficulty,
      reinforceTopic: string | null,
    ): Promise<CodeChallenge | null> => {
      // Returns null (not throws) on any failure so callers can silently fall
      // back to a curated challenge without breaking the prefetch pipeline.
      try {
        const res = await fetch("/api/generate-code-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            difficulty,
            lessonId,
            focusTopic: focus,
            reinforceWeakTopic: reinforceTopic ?? undefined,
            // Read from the ref (not state) so a background prefetch sees the
            // freshest "seen" list without this callback re-subscribing.
            seenPrompts: seenCodePromptsRef.current,
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        return buildChallengeFromData(data);
      } catch {
        return null;
      }
    },
    [buildChallengeFromData],
  );

  const curatedToChallenge = useCallback((focus: string): CodeChallenge => {
    const fb = pickCuratedCodeChallenge(focus);
    return {
      id: fb.id,
      topic: fb.topic,
      prompt: fb.prompt,
      starterCode: MINIMAL_STARTER_CODE,
      checks: fb.checks,
      hint: fb.hint,
    };
  }, []);

  const applyChallenge = useCallback((ch: CodeChallenge, difficulty: DrillDifficulty) => {
    // Reset per-challenge state: attempt counter and reward latch must start
    // fresh so the next challenge can award XP on its own first try.
    codeAttemptRef.current = 0;
    codeRewardClaimedRef.current = false;
    setDrillDifficulty(difficulty);
    setChallenge(ch);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
    setCodeError(null);
    setCodeLoading(false);
    setSeenCodePrompts((prev) => (prev.includes(ch.prompt) ? prev : [...prev, ch.prompt]));
  }, []);

  // Generate the *next* challenge in the background so "New challenge" is instant.
  const startCodePrefetch = useCallback(() => {
    // Guard against double-fetching: skip if one is already in flight or a
    // result is already buffered and waiting to be shown.
    if (prefetchInFlightRef.current || prefetchedChallengeRef.current) return;
    prefetchInFlightRef.current = true;
    const difficulty = difficultyFromSession(codeSessionAttempted, codeSessionCorrect);
    const lesson = pickNextCodeLesson(null);
    void fetchGeneratedChallenge(lesson.id, lesson.focus, difficulty, null).then((ch) => {
      // ch may be null (generation failed) — that's fine; loadCodeChallenge
      // will fall through to a curated challenge when nothing is buffered.
      prefetchedChallengeRef.current = ch;
      prefetchInFlightRef.current = false;
    });
  }, [
    fetchGeneratedChallenge,
    pickNextCodeLesson,
    codeSessionAttempted,
    codeSessionCorrect,
  ]);

  const loadCodeChallenge = useCallback(() => {
    // reinforceTopicRef is set when the learner just missed a challenge; we
    // read-and-clear it so the reinforcement only applies to this next load.
    const reinforce = reinforceTopicRef.current;
    reinforceTopicRef.current = null;

    // After a miss: an instant, topic-matched curated challenge at easy difficulty.
    if (reinforce) {
      applyChallenge(curatedToChallenge(reinforce), "easy");
      startCodePrefetch();
      return;
    }

    // A generated challenge prepared in the background → show it instantly.
    const ready = prefetchedChallengeRef.current;
    if (ready) {
      prefetchedChallengeRef.current = null;
      applyChallenge(ready, difficultyFromSession(codeSessionAttempted, codeSessionCorrect));
      startCodePrefetch();
      return;
    }

    // Nothing buffered yet → show a curated challenge now, generate the next in the background.
    const lesson = pickNextCodeLesson(null);
    applyChallenge(
      curatedToChallenge(lesson.focus),
      difficultyFromSession(codeSessionAttempted, codeSessionCorrect),
    );
    startCodePrefetch();
  }, [
    applyChallenge,
    curatedToChallenge,
    pickNextCodeLesson,
    startCodePrefetch,
    codeSessionAttempted,
    codeSessionCorrect,
  ]);

  const openSavedProblem = useCallback((id: string): boolean => {
    const saved = findSavedProblem(id);
    if (!saved) return false;
    const ch: CodeChallenge = {
      id: saved.id,
      topic: saved.topic,
      prompt: saved.prompt,
      starterCode: saved.starterCode ?? MINIMAL_STARTER_CODE,
      expectedOutputs: saved.expectedOutputs,
      checks: saved.checks,
      hint: saved.hint,
    };
    setChallenge(ch);
    setCodeInput(ch.starterCode);
    setRunStatus("idle");
    setRunMessage("");
    setCodeError(null);
    return true;
  }, []);

  useEffect(() => {
    if (tab !== "code" || challenge || codeLoading) return;
    const savedId = searchParams.get("saved");
    if (savedId && !openedSavedRef.current) {
      openedSavedRef.current = true;
      if (openSavedProblem(savedId)) return;
    }
    void loadCodeChallenge();
  }, [tab, challenge, codeLoading, loadCodeChallenge, openSavedProblem, searchParams]);

  function toggleSaveCurrent() {
    if (!challenge) return;
    toggleSavedProblem({
      id: challenge.id,
      topic: challenge.topic,
      prompt: challenge.prompt,
      hint: challenge.hint,
      starterCode: challenge.starterCode,
      checks: challenge.checks,
      expectedOutputs: challenge.expectedOutputs,
    });
  }

  async function runCode() {
    if (!canRun || !challenge) return;
    setRunStatus("running");
    setRunMessage("Running…");
    // attemptNum is this challenge's 0-based try count: 0 means first attempt,
    // which is what distinguishes a "first try" bonus from a normal pass and a
    // first miss (which triggers topic reinforcement).
    const attemptNum = codeAttemptRef.current;
    codeAttemptRef.current += 1;
    try {
      const outcome = await runAndValidateChallenge(codeInput, {
        expectedOutputs: challenge.expectedOutputs,
        checks: challenge.checks,
      });
      setRunStatus(outcome.passed ? "pass" : "fail");
      setRunMessage(
        outcome.passed && codeRewardClaimedRef.current
          ? `${outcome.message} (already passed — no extra XP)`
          : outcome.message,
      );

      // codeRewardClaimedRef latches once this challenge has been scored so
      // re-running a solved challenge can't farm XP or double-count progress.
      if (!codeRewardClaimedRef.current) {
        setCodeSessionAttempted((n) => n + 1);
        if (outcome.passed) {
          codeRewardClaimedRef.current = true;
          setCodeSessionCorrect((n) => n + 1);
          if (attemptNum === 0) reinforceTopicRef.current = null;
          const eventType = attemptNum === 0 ? "code_first_try" : "code_pass";
          const result = awardXPWithResult(eventType);
          setXpToast({
            amount: XP_AWARD[eventType],
            ...(result.leveledUp ? { levelUpTier: result.newTier } : {}),
          });
          setBadgeToast((prev) => prev ?? tryAwardBadge("first-code") ?? checkTierBadge(result.newTier.minXP));
          recordExerciseResult(EXERCISE_ZONE_CODE_LAB, true, {
            topicKey: topicProgressKey,
          });
          notifyProgressChange();
        } else if (attemptNum === 0 && challenge) {
          setTopicMistakes((prev) => ({
            ...prev,
            [challenge.topic]: (prev[challenge.topic] ?? 0) + 1,
          }));
          reinforceTopicRef.current = challenge.topic;
          recordExerciseResult(EXERCISE_ZONE_CODE_LAB, false, {
            topicKey: topicProgressKey,
          });
          notifyProgressChange();
        }
      }
    } catch (e) {
      setRunStatus("fail");
      setRunMessage(e instanceof Error ? e.message : "Run failed");
      if (!codeRewardClaimedRef.current && attemptNum === 0) {
        recordExerciseResult(EXERCISE_ZONE_CODE_LAB, false, { topicKey: topicProgressKey });
        notifyProgressChange();
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/numpy/path" className="text-sm text-sky-700 hover:underline">
            ← Back to path
          </Link>

          {/* Topic picker — lets users override placement-derived focus */}
          <div className="flex items-center gap-2">
            <label htmlFor="topic-picker" className="text-xs font-medium text-slate-500 shrink-0">
              Focus topic:
            </label>
            <select
              id="topic-picker"
              value={topicOverride ?? focusHint}
              onChange={(e) => {
                setTopicOverride(e.target.value);
                // Reset current questions so the new topic loads immediately.
                setMcq(null);
                setChallenge(null);
                setMcqSelected(null);
                setRunStatus("idle");
                setRunMessage("");
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {DRILL_TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {topicOverride && (
              <button
                type="button"
                onClick={() => { setTopicOverride(null); setMcq(null); setChallenge(null); }}
                className="text-xs text-slate-400 hover:text-slate-600"
                title="Reset to placement-recommended topic"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ExerciseProgressRing percent={summary.overallPercent} />
            <div className="flex flex-col items-end gap-1.5">
              {/* Tier badge */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tier.icon}</span>
                <div className="text-right">
                  <p className={`text-xs font-semibold uppercase tracking-widest ${tier.colorClass}`}>{tier.name}</p>
                  <p className="text-lg font-black text-slate-900">{xpRecord.total} XP</p>
                </div>
              </div>
              {/* XP progress bar to next tier */}
              {nextTier && (
                <div className="w-40">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>{xpProgress.xpInTier} / {xpProgress.tierSize} XP</span>
                    <span>{nextTier.name} {nextTier.icon}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="adapted-xp-shimmer h-full rounded-full transition-all duration-500"
                      style={{ width: `${xpProgress.pct}%` }}
                    />
                  </div>
                </div>
              )}
              {/* All-time vs this-session breakdown */}
              <p className="text-xs text-slate-400">
                All time: {summary.totalAttempted} attempts · {summary.totalCorrect} correct
              </p>
              {(mcqSessionAttempted + codeSessionAttempted) > 0 && (
                <p className="text-xs font-medium text-sky-600">
                  This session: {mcqSessionCorrect + codeSessionCorrect}/{mcqSessionAttempted + codeSessionAttempted} correct
                </p>
              )}
            </div>
          </div>

          {/* Weak topics this session */}
          {Object.keys(topicMistakes).length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Topics to review this session
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(topicMistakes)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([topic, count]) => (
                    <span
                      key={topic}
                      className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                    >
                      {topic} · {count} miss{count > 1 ? "es" : ""}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === "code" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => setTab("code")}
          >
            Code lab
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === "mcq" ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => setTab("mcq")}
          >
            Quick concept check
          </button>
        </div>

        {tab === "mcq" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Adaptive MCQs</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {drillDifficulty}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Miss a topic and the next question targets your weak areas; difficulty shifts with
              your session accuracy.
            </p>
            {mcqError && <p className="mt-2 text-xs text-slate-400">{mcqError}</p>}
            {mcqLoading && <p className="mt-4 text-slate-600">Loading question…</p>}
            {!mcqLoading && mcq && (
              <div className="mt-4">
                <p className="text-xs uppercase text-slate-500">{mcq.topic}</p>
                <h3 className="mt-1 text-xl font-medium text-slate-900">{mcq.prompt}</h3>
                <div className="mt-4 flex flex-col gap-2">
                  {mcq.choices.map((c, i) => {
                    let cls = "border-slate-200 hover:bg-slate-50";
                    if (mcqSelected !== null) {
                      if (i === mcq.correctIndex) cls = "border-emerald-500 bg-emerald-50";
                      else if (i === mcqSelected) cls = "border-red-400 bg-red-50";
                      else cls = "border-slate-100 text-slate-400";
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={mcqSelected !== null}
                        onClick={() => onMcqPick(i)}
                        className={`rounded-lg border-2 p-3 text-left text-sm ${cls}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {mcqSelected !== null && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-700">{mcq.explanation}</p>
                    <button
                      type="button"
                      className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                      onClick={onMcqNext}
                    >
                      Next question
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "code" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Structured code tasks</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {drillDifficulty}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Fail a challenge and the next one reinforces that topic at an easier level. Set{" "}
              <code className="rounded bg-slate-100 px-1">answer</code> and run real Python.
            </p>
            {codeError && <p className="mt-2 text-xs text-slate-400">{codeError}</p>}
            {pyodideLoading && <p className="mt-2 text-sm text-amber-800">Loading Python…</p>}
            {pyodideError && <p className="mt-2 text-sm text-red-700">{pyodideError}</p>}
            {codeLoading && <p className="mt-4 text-slate-600">Loading challenge…</p>}
            {!codeLoading && challenge && (
              <div className="mt-4">
                <p className="text-xs uppercase text-slate-500">{challenge.topic}</p>
                <p className="mt-2 text-slate-800">{challenge.prompt}</p>
                <p className="mt-2 text-xs text-slate-500">Hint: {challenge.hint}</p>
                <PythonCodeEditor
                  className="mt-3 w-full overflow-hidden rounded-lg border border-slate-200"
                  minHeight="12rem"
                  modelPath={`/numpy/exercises/${challenge.id}.py`}
                  value={codeInput}
                  onChange={setCodeInput}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canRun || runStatus === "running"}
                    onClick={() => void runCode()}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {runStatus === "running" ? "Running…" : "Run and check"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadCodeChallenge()}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    New challenge
                  </button>
                  <button
                    type="button"
                    onClick={toggleSaveCurrent}
                    aria-pressed={isCurrentSaved}
                    className={`ml-auto rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      isCurrentSaved
                        ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {isCurrentSaved ? "★ Saved" : "☆ Save problem"}
                  </button>
                </div>
                {runMessage && (
                  <p
                    className={`mt-3 text-sm ${
                      runStatus === "pass" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {runMessage}
                  </p>
                )}
                <CodeTutorChat
                  challenge={{
                    id: challenge.id,
                    topic: challenge.topic,
                    prompt: challenge.prompt,
                    hint: challenge.hint,
                  }}
                  learnerCode={codeInput}
                />
              </div>
            )}
          </section>
        )}
      </div>
      <XPToast
        amount={xpToast?.amount ?? null}
        levelUpTier={xpToast?.levelUpTier}
        onDone={() => setXpToast(null)}
      />
      <BadgeToast badge={badgeToast} onDone={() => setBadgeToast(null)} />
    </main>
  );
}

export default function NumpyExercisesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <p className="text-slate-600">Loading exercises…</p>
        </main>
      }
    >
      <NumpyExercisesContent />
    </Suspense>
  );
}
