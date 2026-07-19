import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Users, RotateCcw, Check, AlertCircle, ChevronRight, Sparkles } from "lucide-react";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_ACTIVE_DAYS = ["Monday", "Tuesday", "Thursday", "Friday"];
const DEFAULT_PLAYERS = ["Aaron", "Ife", "Keith", "Mick", "TJ"];
const STORAGE_KEY = "kitchen-queue-state-v1";

function defaultState() {
  const playCounts = {};
  DEFAULT_PLAYERS.forEach((p) => (playCounts[p] = 0));
  return {
    players: DEFAULT_PLAYERS,
    activeDays: DEFAULT_ACTIVE_DAYS,
    availability: {},
    playCounts,
    queueOrder: [...DEFAULT_PLAYERS],
    queuePointer: 1, // starts on Ife per last known rotation
    weekNumber: 1,
    history: [],
  };
}

export default function PickleballScheduler() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlayer, setNewPlayer] = useState("");
  const [preview, setPreview] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setState(raw ? JSON.parse(raw) : defaultState());
    } catch (e) {
      setState(defaultState());
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = useCallback((next) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Couldn't save — your changes are visible now but may not persist.");
    }
  }, []);

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-[#0F2E2C] flex items-center justify-center">
        <div className="text-[#DCE8B0] font-mono text-sm tracking-widest animate-pulse">LOADING COURT DATA…</div>
      </div>
    );
  }

  const { players, activeDays, availability, playCounts, queueOrder, queuePointer } = state;

  const toggleAvailability = (day, player) => {
    const next = {
      ...state,
      availability: {
        ...availability,
        [day]: {
          ...(availability[day] || {}),
          [player]: !(availability[day] && availability[day][player]),
        },
      },
    };
    persist(next);
    setPreview(null);
  };

  const toggleDay = (day) => {
    const isActive = activeDays.includes(day);
    const next = {
      ...state,
      activeDays: isActive ? activeDays.filter((d) => d !== day) : [...activeDays, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)),
    };
    persist(next);
    setPreview(null);
  };

  const addPlayer = () => {
    const name = newPlayer.trim();
    if (!name || players.includes(name)) return;
    const next = {
      ...state,
      players: [...players, name],
      playCounts: { ...playCounts, [name]: 0 },
      queueOrder: [...queueOrder, name],
    };
    persist(next);
    setNewPlayer("");
    setPreview(null);
  };

  const removePlayer = (name) => {
    const nextAvailability = {};
    Object.keys(availability).forEach((day) => {
      nextAvailability[day] = { ...availability[day] };
      delete nextAvailability[day][name];
    });
    const nextPlayCounts = { ...playCounts };
    delete nextPlayCounts[name];
    const nextQueue = queueOrder.filter((p) => p !== name);
    const next = {
      ...state,
      players: players.filter((p) => p !== name),
      availability: nextAvailability,
      playCounts: nextPlayCounts,
      queueOrder: nextQueue,
      queuePointer: Math.min(queuePointer, Math.max(0, nextQueue.length - 1)),
    };
    persist(next);
    setPreview(null);
  };

  const generateSchedule = () => {
    const results = {};
    activeDays.forEach((day) => {
      const dayAvail = availability[day] || {};
      const available = players.filter((p) => dayAvail[p]);
      if (available.length >= 4) {
        const benchCount = available.length - 4;
        const sorted = [...available].sort((a, b) => {
          const diff = (playCounts[b] || 0) - (playCounts[a] || 0);
          return diff !== 0 ? diff : a.localeCompare(b);
        });
        const benched = sorted.slice(0, benchCount);
        const playing = available.filter((p) => !benched.includes(p));
        results[day] = { status: "full", playing, benched };
      } else {
        results[day] = { status: "short", playing: available, needed: 4 - available.length };
      }
    });

    // Pass-payment queue walk (only for full sessions), simulated without committing
    let pointer = queuePointer;
    const order = [...queueOrder];
    activeDays.forEach((day) => {
      const r = results[day];
      if (r.status !== "full") return;
      const payers = [];
      let steps = 0;
      let idx = pointer;
      while (payers.length < 2 && steps < order.length * 2) {
        const candidate = order[idx % order.length];
        if (r.playing.includes(candidate) && !payers.includes(candidate)) {
          payers.push(candidate);
        }
        idx++;
        steps++;
      }
      r.payers = payers;
      if (payers.length === 2) {
        const lastIdx = order.indexOf(payers[1]);
        pointer = (lastIdx + 1) % order.length;
      }
    });

    setPreview({ results, finalPointer: pointer });
  };

  const confirmWeek = async () => {
    if (!preview) return;
    const nextPlayCounts = { ...playCounts };
    activeDays.forEach((day) => {
      const r = preview.results[day];
      if (r.status === "full") {
        r.playing.forEach((p) => {
          nextPlayCounts[p] = (nextPlayCounts[p] || 0) + 1;
        });
      }
    });
    const next = {
      ...state,
      playCounts: nextPlayCounts,
      queuePointer: preview.finalPointer,
      weekNumber: state.weekNumber + 1,
      availability: {},
    };
    await persist(next);
    setPreview(null);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2200);
  };

  const resetAll = () => {
    if (!confirm("Reset everything — roster, counts, queue, and this week's picks?")) return;
    persist(defaultState());
    setPreview(null);
  };

  return (
    <div className="min-h-screen bg-[#0F2E2C] text-[#F4F2E9]">
      <div className="max-w-5xl mx-auto px-5 py-10">
        {/* Header */}
        <header className="mb-10 relative">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-[#C7D66B] uppercase mb-2">
                Week {state.weekNumber} · Non-Volley Zone Scheduling
              </p>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
                KITCHEN QUEUE
              </h1>
            </div>
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-[#8FA88F] hover:text-[#F4F2E9] transition-colors border border-[#2A4F45] hover:border-[#8FA88F] rounded px-3 py-1.5"
            >
              <RotateCcw size={12} /> RESET ALL
            </button>
          </div>
          <div className="mt-4 h-[3px] w-full bg-gradient-to-r from-[#C7D66B] via-[#2A4F45] to-transparent" />
          <p className="mt-3 text-sm text-[#A8BFA0] max-w-xl">
            Set who's free this week, generate the day-by-day lineup, and see who owes court passes — 4 per session, split 2 and 2, on a rotating queue.
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-sm bg-[#4A2020] border border-[#7A3030] text-[#F4C4C4] rounded px-4 py-2.5">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Roster */}
        <section className="mb-8">
          <h2 className="text-xs font-mono tracking-[0.25em] text-[#C7D66B] uppercase mb-3 flex items-center gap-2">
            <Users size={14} /> Roster
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {players.map((p) => (
              <span
                key={p}
                className="group flex items-center gap-1.5 bg-[#173A34] border border-[#2A4F45] rounded-full pl-3 pr-1.5 py-1 text-sm"
              >
                {p}
                <button
                  onClick={() => removePlayer(p)}
                  className="opacity-40 group-hover:opacity-100 hover:text-[#F4A0A0] transition-opacity rounded-full p-0.5"
                  aria-label={`Remove ${p}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Add a player…"
              className="bg-[#173A34] border border-[#2A4F45] rounded px-3 py-1.5 text-sm placeholder-[#5C7A70] focus:outline-none focus:border-[#C7D66B] w-48"
            />
            <button
              onClick={addPlayer}
              className="flex items-center gap-1 bg-[#C7D66B] text-[#0F2E2C] font-semibold text-sm rounded px-3 py-1.5 hover:bg-[#DCE8B0] transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </section>

        {/* Active days */}
        <section className="mb-8">
          <h2 className="text-xs font-mono tracking-[0.25em] text-[#C7D66B] uppercase mb-3">Days This Week</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((day) => {
              const active = activeDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`text-sm rounded px-3 py-1.5 border transition-colors ${
                    active
                      ? "bg-[#C7D66B] text-[#0F2E2C] border-[#C7D66B] font-semibold"
                      : "border-[#2A4F45] text-[#8FA88F] hover:border-[#5C7A70]"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </section>

        {/* Availability grid */}
        <section className="mb-8">
          <h2 className="text-xs font-mono tracking-[0.25em] text-[#C7D66B] uppercase mb-3">Who's Free</h2>
          <div className="overflow-x-auto border border-[#2A4F45] rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#173A34]">
                  <th className="text-left font-mono text-[11px] tracking-wider text-[#8FA88F] uppercase px-4 py-2.5">Player</th>
                  {activeDays.map((day) => (
                    <th key={day} className="text-center font-mono text-[11px] tracking-wider text-[#8FA88F] uppercase px-3 py-2.5">
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p} className={i % 2 === 0 ? "bg-[#0F2E2C]" : "bg-[#11332F]"}>
                    <td className="px-4 py-2.5 font-medium">{p}</td>
                    {activeDays.map((day) => {
                      const checked = !!(availability[day] && availability[day][p]);
                      return (
                        <td key={day} className="text-center px-3 py-2.5">
                          <button
                            onClick={() => toggleAvailability(day, p)}
                            className={`w-6 h-6 rounded border flex items-center justify-center mx-auto transition-colors ${
                              checked
                                ? "bg-[#C7D66B] border-[#C7D66B]"
                                : "border-[#3A5C50] hover:border-[#8FA88F]"
                            }`}
                            aria-label={`${p} available ${day}`}
                          >
                            {checked && <Check size={14} className="text-[#0F2E2C]" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Generate */}
        <div className="mb-8">
          <button
            onClick={generateSchedule}
            className="flex items-center gap-2 bg-[#C7D66B] text-[#0F2E2C] font-semibold rounded px-5 py-2.5 hover:bg-[#DCE8B0] transition-colors"
          >
            <Sparkles size={16} /> Generate This Week's Schedule
          </button>
        </div>

        {/* Results */}
        {preview && (
          <section className="mb-10">
            <h2 className="text-xs font-mono tracking-[0.25em] text-[#C7D66B] uppercase mb-3">This Week's Lineup</h2>
            <div className="space-y-3">
              {activeDays.map((day) => {
                const r = preview.results[day];
                return (
                  <div key={day} className="border border-[#2A4F45] rounded-lg px-4 py-3.5 bg-[#173A34]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-mono text-[11px] tracking-wider text-[#C7D66B] uppercase">{day}</span>
                      {r.status === "short" && (
                        <span className="text-[11px] font-mono text-[#F0B860] flex items-center gap-1">
                          <AlertCircle size={12} /> {r.needed} sub{r.needed > 1 ? "s" : ""} needed
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm">
                      {r.playing.length > 0 ? r.playing.join(", ") : "No one available"}
                      {r.status === "short" && r.playing.length > 0 && <span className="text-[#8FA88F]"> + subs</span>}
                    </p>
                    {r.benched && r.benched.length > 0 && (
                      <p className="mt-1 text-xs text-[#7C9A8E]">Sitting out: {r.benched.join(", ")}</p>
                    )}
                    {r.status === "full" && r.payers && (
                      <p className="mt-1.5 text-xs text-[#DCE8B0] flex items-center gap-1">
                        <ChevronRight size={12} /> Passes: {r.payers.join(" & ")} (2 each)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={confirmWeek}
              className="mt-5 flex items-center gap-2 bg-[#F4F2E9] text-[#0F2E2C] font-semibold rounded px-5 py-2.5 hover:bg-white transition-colors"
            >
              <Check size={16} /> Confirm & Save This Week
            </button>
            {saveFlash && <span className="ml-3 text-sm text-[#C7D66B]">Saved — queue and counts updated.</span>}
          </section>
        )}

        {/* Standings footer */}
        <section className="border-t border-[#2A4F45] pt-6">
          <h2 className="text-xs font-mono tracking-[0.25em] text-[#C7D66B] uppercase mb-3">Season Totals & Queue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {players.map((p) => (
              <div key={p} className="bg-[#173A34] border border-[#2A4F45] rounded-lg px-3 py-2.5 text-center">
                <p className="text-2xl font-black">{playCounts[p] || 0}</p>
                <p className="text-[11px] font-mono text-[#8FA88F] uppercase tracking-wide mt-0.5">{p}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#7C9A8E]">
            Pass queue order: {queueOrder.map((p, i) => (i === queuePointer ? `[${p}]` : p)).join(" → ")}
            <span className="block mt-1 text-[#5C7A70]">Bracketed name is next up.</span>
          </p>
        </section>
      </div>
    </div>
  );
}
