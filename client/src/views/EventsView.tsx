/**
 * Events View — Historical Event Intelligence
 *
 * Two tabs:
 *   Upcoming — 30-day calendar list with recommendation cards
 *   History  — table of past events
 */

import { useState, useEffect } from "react";
import {
  fetchUpcomingEvents,
  fetchHistoricalEvents,
  createUpcomingEvent,
  createHistoricalEvent,
  updateUpcomingEvent,
} from "../api/endpoints.js";
import type { UpcomingEvent, HistoricalEvent } from "../api/types.js";
import { useToast } from "../contexts/ToastContext.js";

type Tab = "upcoming" | "history";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

// ─── Upcoming Event Card ──────────────────────────────────────────────────────

function UpcomingCard({
  event,
  onEdit,
}: {
  event: UpcomingEvent;
  onEdit: (ev: UpcomingEvent) => void;
}) {
  const staffDiff =
    event.recommended_staff !== null &&
    event.confirmed_staff !== null &&
    Math.abs(event.confirmed_staff - event.recommended_staff) > 2;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{event.name}</p>
          <p className="text-xs text-slate-400">{event.event_type} · {formatDate(event.date)}</p>
        </div>
        {staffDiff && (
          <span className="flex-shrink-0 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            ⚠ staffing diff
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-indigo-50 rounded-xl p-2 text-center">
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Confirmed</p>
          <p className="text-lg font-extrabold text-indigo-700">{event.confirmed_staff ?? "—"}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Recommended</p>
          <p className="text-lg font-extrabold text-slate-600">{event.recommended_staff ?? "—"}</p>
        </div>
      </div>

      {event.notes && (
        <p className="text-xs text-slate-500 italic">{event.notes}</p>
      )}

      <button
        onClick={() => onEdit(event)}
        className="mt-auto text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors text-right"
      >
        Edit →
      </button>
    </div>
  );
}

// ─── Add Upcoming Form ────────────────────────────────────────────────────────

function AddUpcomingForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("General");
  const [date, setDate] = useState("");
  const [staff, setStaff] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name || !date) return;
    setSaving(true);
    try {
      await createUpcomingEvent({
        name,
        event_type: type,
        date,
        confirmed_staff: staff ? parseInt(staff) : undefined,
        notes: notes || undefined,
      });
      showToast("Event created", "success");
      setName(""); setType("General"); setDate(""); setStaff(""); setNotes("");
      onCreated();
    } catch {
      showToast("Failed to create event", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
      <p className="text-sm font-bold text-slate-700">Add Upcoming Event</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Event name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          placeholder="Type (e.g. Festival)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          type="number"
          placeholder="Confirmed staff"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={saving || !name || !date}
        className="w-full h-9 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {saving ? "Saving…" : "Add Event"}
      </button>
    </div>
  );
}

// ─── Add Historical Form ──────────────────────────────────────────────────────

function AddHistoricalForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("General");
  const [date, setDate] = useState("");
  const [staff, setStaff] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name || !date || !staff || !hours) return;
    setSaving(true);
    try {
      await createHistoricalEvent({
        name,
        event_type: type,
        date,
        staff_used: parseInt(staff),
        hours_used: parseFloat(hours),
        notes: notes || undefined,
      });
      showToast("Historical event logged", "success");
      setName(""); setType("General"); setDate(""); setStaff(""); setHours(""); setNotes("");
      onCreated();
    } catch {
      showToast("Failed to log event", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
      <p className="text-sm font-bold text-slate-700">Log Historical Event</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Event name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          placeholder="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          type="number"
          placeholder="Staff used"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          type="number"
          step="0.5"
          placeholder="Hours used"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={saving || !name || !date || !staff || !hours}
        className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {saving ? "Saving…" : "Log Event"}
      </button>
    </div>
  );
}

// ─── Edit Modal (simple inline) ───────────────────────────────────────────────

function EditUpcomingModal({
  event,
  onClose,
  onSaved,
}: {
  event: UpcomingEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [staff, setStaff] = useState(event.confirmed_staff?.toString() ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateUpcomingEvent(event.id, {
        confirmed_staff: staff ? parseInt(staff) : undefined,
        notes: notes || undefined,
      });
      showToast("Event updated", "success");
      onSaved();
      onClose();
    } catch {
      showToast("Failed to update event", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <p className="font-bold text-slate-800">Edit: {event.name}</p>
        <label className="block text-xs font-semibold text-slate-600">Confirmed Staff</label>
        <input
          type="number"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <label className="block text-xs font-semibold text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Events View ──────────────────────────────────────────────────────────────

export function EventsView() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [history, setHistory] = useState<HistoricalEvent[]>([]);
  const [editing, setEditing] = useState<UpcomingEvent | null>(null);

  function loadUpcoming() {
    fetchUpcomingEvents().then(setUpcoming).catch(() => {});
  }
  function loadHistory() {
    fetchHistoricalEvents().then(setHistory).catch(() => {});
  }

  useEffect(() => {
    loadUpcoming();
    loadHistory();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Event Intelligence</h2>
        <p className="text-xs text-slate-400 mt-0.5">Track upcoming events and learn from historical staffing data</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(["upcoming", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "upcoming" ? "Upcoming" : "History"}
          </button>
        ))}
      </div>

      {tab === "upcoming" && (
        <div className="space-y-4">
          <AddUpcomingForm onCreated={loadUpcoming} />
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No upcoming events</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((ev) => (
                <UpcomingCard key={ev.id} event={ev} onEdit={setEditing} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <AddHistoricalForm onCreated={loadHistory} />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Staff</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Hours</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{ev.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{ev.event_type}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(ev.date)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{ev.staff_used}</td>
                    <td className="px-4 py-2.5 text-slate-600">{ev.hours_used}h</td>
                    <td className="px-4 py-2.5 text-slate-400 italic truncate max-w-[200px]">{ev.notes ?? "—"}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No historical events logged</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditUpcomingModal
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={loadUpcoming}
        />
      )}
    </div>
  );
}
