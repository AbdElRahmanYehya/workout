import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Dumbbell, Trophy, Save, Plus, CheckCircle2, History, Database } from "lucide-react";

// --- Types ---
export type WorkoutType = "Push" | "Pull" | "Legs";

export type ExerciseSet = {
  id: string;
  exercise: string;
  weight: number; // kg
  reps: number;
  notes?: string;
  timestamp: number; // epoch ms
};

export type WorkoutSession = {
  id: string;
  type: WorkoutType;
  date: string; // ISO date string
  sets: ExerciseSet[];
};

// --- Demo Exercises by Workout Type (edit as you like) ---
const EXERCISES: Record<WorkoutType, string[]> = {
  Push: [
    "Barbell Bench Press",
    "Overhead Press",
    "Incline Dumbbell Press",
    "Dumbbell Shoulder Press",
    "Cable Fly",
    "Triceps Pushdown",
  ],
  Pull: [
    "Conventional Deadlift",
    "Barbell Row",
    "Lat Pulldown",
    "Pull-up / Chin-up",
    "Seated Cable Row",
    "EZ Bar Curl",
  ],
  Legs: [
    "Back Squat",
    "Front Squat",
    "Romanian Deadlift",
    "Leg Press",
    "Walking Lunge",
    "Standing Calf Raise",
  ],
};

// --- Local Storage Helpers (swap with real API later) ---
const STORAGE_KEY = "workout_sessions_v1";

function loadSessions(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkoutSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: WorkoutSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- PR & Last-Workout Utilities ---
function getLastWorkout(sessions: WorkoutSession[], type: WorkoutType): WorkoutSession | undefined {
  return sessions
    .filter((s) => s.type === type)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function bestSetByExercise(sets: ExerciseSet[]): Record<string, ExerciseSet> {
  const best: Record<string, ExerciseSet> = {};
  for (const s of sets) {
    const prev = best[s.exercise];
    if (!prev) {
      best[s.exercise] = s;
    } else {
      // Priority: higher weight, then higher reps, then newer
      if (
        s.weight > prev.weight ||
        (s.weight === prev.weight && s.reps > prev.reps) ||
        (s.weight === prev.weight && s.reps === prev.reps && s.timestamp > prev.timestamp)
      ) {
        best[s.exercise] = s;
      }
    }
  }
  return best;
}

function oneRepMaxEpley(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

// --- API place-holders (wire these to Spring Boot later) ---
async function fetchSessionsFromApiMock(): Promise<WorkoutSession[]> {
  return loadSessions();
}

async function saveSessionToApiMock(session: WorkoutSession): Promise<void> {
  const sessions = loadSessions();
  saveSessions([session, ...sessions]);
}

// --- Main Component ---
export default function WorkoutTrackerApp() {
  const [workoutType, setWorkoutType] = useState<WorkoutType | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [draftSets, setDraftSets] = useState<ExerciseSet[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchSessionsFromApiMock();
      setSessions(data);
    })();
  }, []);

  const last = useMemo(() => (workoutType ? getLastWorkout(sessions, workoutType) : undefined), [sessions, workoutType]);
  const lastSets = last?.sets ?? [];

  const prs = useMemo(() => {
    if (!workoutType) return {} as Record<string, ExerciseSet & { orm: number }>;
    const setsForType = sessions.filter((s) => s.type === workoutType).flatMap((s) => s.sets);
    const best = bestSetByExercise(setsForType);
    const withOrm: Record<string, ExerciseSet & { orm: number }> = {};
    Object.entries(best).forEach(([ex, set]) => {
      withOrm[ex] = { ...set, orm: oneRepMaxEpley(set.weight, set.reps) };
    });
    return withOrm;
  }, [sessions, workoutType]);

  function addDraftSet(partial?: Partial<ExerciseSet>) {
    if (!workoutType) return;
    const exercise = partial?.exercise || EXERCISES[workoutType][0] || "Custom Exercise";
    setDraftSets((prev) => [
      ...prev,
      {
        id: uid("set"),
        exercise,
        weight: Number(partial?.weight ?? 0),
        reps: Number(partial?.reps ?? 0),
        notes: partial?.notes ?? "",
        timestamp: Date.now(),
      },
    ]);
  }

  function updateDraftSet(id: string, patch: Partial<ExerciseSet>) {
    setDraftSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeDraftSet(id: string) {
    setDraftSets((prev) => prev.filter((s) => s.id !== id));
  }

  async function saveWorkout() {
    if (!workoutType || draftSets.length === 0) return;
    setSaving(true);
    try {
      const session: WorkoutSession = {
        id: uid("wo"),
        type: workoutType,
        date: new Date().toISOString(),
        sets: draftSets,
      };
      await saveSessionToApiMock(session);
      const updated = await fetchSessionsFromApiMock();
      setSessions(updated);
      setDraftSets([]);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6">
      <div className="max-w-full sm:max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-7 h-7" />
            <h1 className="text-xl sm:text-2xl font-semibold">Workout Tracker</h1>
          </div>
          <div className="text-xs sm:text-sm text-gray-500 flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>Local storage mode (mock). Ready for Spring Boot API.</span>
          </div>
        </header>

        {/* Workout Type Selector */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Select Workout Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Push", "Pull", "Legs"].map((type) => (
                <Button
                  key={type}
                  variant={workoutType === (type as WorkoutType) ? "default" : "secondary"}
                  className="w-full py-4 sm:py-6 rounded-2xl text-base sm:text-lg"
                  onClick={() => setWorkoutType(type as WorkoutType)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Overview Panels */}
        {workoutType && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Last Workout */}
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  <CardTitle className="text-base sm:text-lg">Last {workoutType} Workout</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  {last ? new Date(last.date).toLocaleString() : "No history yet. Add today’s workout to get started."}
                </p>
              </CardHeader>
              <CardContent>
                {lastSets.length > 0 ? (
                  <div className="space-y-3">
                    {lastSets.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border p-3 text-sm sm:text-base"
                      >
                        <div className="font-medium">{s.exercise}</div>
                        <div className="text-gray-600">
                          {s.weight} kg × {s.reps} reps
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-gray-500">No sets recorded for the last session.</div>
                )}
              </CardContent>
            </Card>

            {/* PRs */}
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  <CardTitle className="text-base sm:text-lg">Best Sets (per Exercise)</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">Highest weight, then reps. Includes 1RM estimate.</p>
              </CardHeader>
              <CardContent>
                {Object.keys(prs).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(prs).map(([ex, s]) => (
                      <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border p-3 text-sm sm:text-base">
                        <div className="font-medium">{ex}</div>
                        <div className="text-gray-600">
                          {s.weight} kg × {s.reps} reps · est 1RM {s.orm} kg
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-gray-500">No PRs yet for this workout type.</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Current Workout */}
        {workoutType && (
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                <CardTitle className="text-base sm:text-lg">Add Sets — {workoutType}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Add Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select onValueChange={(v) => addDraftSet({ exercise: v })}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Quick add exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISES[workoutType].map((ex) => (
                      <SelectItem key={ex} value={ex}>
                        {ex}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    type="number"
                    placeholder="Weight (kg)"
                    className="rounded-2xl"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addDraftSet();
                    }}
                    onBlur={(e) => addDraftSet({ weight: Number(e.currentTarget.value) })}
                  />
                  <Input
                    type="number"
                    placeholder="Reps"
                    className="rounded-2xl"
                    onBlur={(e) => addDraftSet({ reps: Number(e.currentTarget.value) })}
                  />
                  <Button className="rounded-2xl" variant="default" onClick={() => addDraftSet()}>
                    <Plus className="w-4 h-4 mr-1" /> Add Set
                  </Button>
                </div>
              </div>

              {/* Draft Sets List */}
              <div className="space-y-3">
                <AnimatePresence>
                  {draftSets.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="grid grid-cols-1 md:grid-cols-12 items-center gap-3 border rounded-2xl p-3 text-sm sm:text-base"
                    >
                      <div className="md:col-span-4">
                        <Select
                          value={s.exercise}
                          onValueChange={(v) => updateDraftSet(s.id, { exercise: v })}
                        >
                          <SelectTrigger className="rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXERCISES[workoutType].map((ex) => (
                              <SelectItem key={ex} value={ex}>
                                {ex}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Input
                          type="number"
                          value={s.weight}
                          onChange={(e) => updateDraftSet(s.id, { weight: Number(e.currentTarget.value) })}
                          className="rounded-2xl"
                          placeholder="Weight"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Input
                          type="number"
                          value={s.reps}
                          onChange={(e) => updateDraftSet(s.id, { reps: Number(e.currentTarget.value) })}
                          className="rounded-2xl"
                          placeholder="Reps"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Textarea
                          value={s.notes || ""}
                          onChange={(e) => updateDraftSet(s.id, { notes: e.currentTarget.value })}
                          className="rounded-2xl"
                          placeholder="Notes (RPE, tempo, cues)"
                        />
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <Button variant="destructive" className="rounded-2xl" onClick={() => removeDraftSet(s.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-500">
                  {draftSets.length} set{draftSets.length === 1 ? "" : "s"} ready
