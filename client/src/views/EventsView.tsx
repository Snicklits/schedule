import { useState, useEffect } from "react";
import {
  fetchHistoricalEvents, createHistoricalEvent,
  fetchUpcomingEvents, createUpcomingEvent, updateUpcomingEvent,
} from "../api/endpoints.js";
import type { HistoricalEvent, UpcomingEvent } from "../api/types.js";
import { Modal } from "../components/Modal.js";

type Tab = "upcoming" | "history";

const EVENT_TYPES = ["holiday", "sport", "concert", "promotion", "other"];

export function EventsView() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [history, setHistory] = useState<HistoricalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showHistModal, setShowHistModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);

  // History form
  const [histForm, setHistForm] = useState({ name: "", event_type: "other", date: "", staff_used: "", hours_used: "", notes: "" });
  const [savingHist, setSavingHist] = useState(false);

  // Upcoming form
  const [upcomingForm, setUpcomingForm] = useState({ name: "", event_type: "other", date: "", confirmed_staff: "", notes: "" });
  const [savingUpcoming, setSavingUpcoming] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [u, h] = await Promise.all([fetchUpcomingEvents(), fetchHistoricalEvents()]);
      setUpcoming(u);
      setHistory(h);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, []);

  async function handleSaveHistory(e: React.FormEvent) {
    e.preventDefault();
    setSavingHist(true);
    try {
      await createHistoricalEvent({
        name: histForm.name,
        event_type: histForm.event_type,
        date: histForm.date,
        staff_used: parseInt(histForm.staff_used),
        hours_used: parseFloat(histForm.hours_used),
        notes: histForm.notes || null,
      });
      setShowHistModal(false);
      setHistForm({ name: "", event_type: "other", date: "", staff_used: "", hours_used: "", notes: "" });
      await loadAll();
    } catch { /* ignore */ }
    finally { setSavingHist(false); }
  }

  async function handleSaveUpcoming(e: React.FormEvent) {
    e.preventDefault();
    setSavingUpcoming(true);
    try {
      await createUpcomingEvent({
        name: upcomingForm.name,
        event_type: upcomingForm.event_type,
        date: upcomingForm.date,
        confirmed_staff: upcomingForm.confirmed_staff ? parseInt(upcomingForm.confirmed_staff) : null,
        notes: upcomingForm.notes || null,
      });
      setShowUpcomingModal(false);
      setUpcomingForm({ name: "", event_type: "other", date: "", confirmed_staff: "", notes: "" });
      await loadAll();
    } catch { /* ignore */ }
    finally { setSavingUpcoming(false); }
  }

  async function handleUpdateConfirmed(id: string, confirmed_staff: number | null) {
    try {
      await updateUpcomingEvent(id, confirmed_staff);
      await loadAll();
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Events</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHistModal(true)} className="bg-gray-100 hover:bg-gray-200 border text-gray-700 font-medium px-4 py-2 rounded text-sm">
            + Log Past Event
          </button>
          <button onClick={() => setShowUpcomingModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded text-sm">
            + Add Upcoming Event
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(["upcoming", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "upcoming" ? "Upcoming Events" : "Event History"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === "upcoming" ? (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming events. Add one to get started.</p>
          ) : upcoming.map((ev) => {
            const diffFromRec = ev.confirmed_staff != null && ev.recommended_staff != null
              ? Math.abs(ev.confirmed_staff - ev.recommended_staff)
              : 0;
            const showAmber = diffFromRec > 2;
            return (
              <div key={ev.id} className="bg-white border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{ev.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{ev.event_type}</span>
                    {showAmber && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded">⚠ differs from rec.</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{new Date(ev.date).toLocaleDateString()}</p>
                  {ev.recommended_staff != null && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Recommended: {ev.recommended_staff} staff
                      {ev.recommended_hours != null && ` / ${ev.recommended_hours}h`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Confirmed staff:</label>
                  <input
                    type="number"
                    min="0"
                    defaultValue={ev.confirmed_staff ?? ""}
                    onBlur={(e) => handleUpdateConfirmed(ev.id, e.target.value ? parseInt(e.target.value) : null)}
                    className="w-16 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder={ev.recommended_staff?.toString() ?? "—"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Name", "Type", "Date", "Staff Used", "Hours Used"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-gray-400 text-center">No historical events logged yet.</td></tr>
              ) : history.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{ev.name}</td>
                  <td className="px-4 py-3 text-gray-500">{ev.event_type}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(ev.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-700">{ev.staff_used}</td>
                  <td className="px-4 py-3 text-gray-700">{ev.hours_used}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Past Event Modal */}
      {showHistModal && (
        <Modal title="Log Past Event" onClose={() => setShowHistModal(false)}>
          <form onSubmit={handleSaveHistory} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Event Name</label>
                <input required value={histForm.name} onChange={(e) => setHistForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" placeholder="e.g. Christmas Day" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={histForm.event_type} onChange={(e) => setHistForm((f) => ({ ...f, event_type: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400">
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input required type="date" value={histForm.date} onChange={(e) => setHistForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Staff Used</label>
                <input required type="number" min="1" value={histForm.staff_used} onChange={(e) => setHistForm((f) => ({ ...f, staff_used: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hours Used</label>
                <input required type="number" min="1" step="0.5" value={histForm.hours_used} onChange={(e) => setHistForm((f) => ({ ...f, hours_used: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={histForm.notes} onChange={(e) => setHistForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowHistModal(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm">Cancel</button>
              <button type="submit" disabled={savingHist} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {savingHist ? "Saving…" : "Log Event"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Upcoming Event Modal */}
      {showUpcomingModal && (
        <Modal title="Add Upcoming Event" onClose={() => setShowUpcomingModal(false)}>
          <form onSubmit={handleSaveUpcoming} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Event Name</label>
                <input required value={upcomingForm.name} onChange={(e) => setUpcomingForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" placeholder="e.g. FA Cup Final" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={upcomingForm.event_type} onChange={(e) => setUpcomingForm((f) => ({ ...f, event_type: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400">
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input required type="date" value={upcomingForm.date} onChange={(e) => setUpcomingForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmed Staff (optional)</label>
                <input type="number" min="0" value={upcomingForm.confirmed_staff} onChange={(e) => setUpcomingForm((f) => ({ ...f, confirmed_staff: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" placeholder="Leave blank for auto-recommendation" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={upcomingForm.notes} onChange={(e) => setUpcomingForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-400" placeholder="Optional" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Recommended staff count will be auto-calculated from event history.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowUpcomingModal(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm">Cancel</button>
              <button type="submit" disabled={savingUpcoming} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {savingUpcoming ? "Saving…" : "Add Event"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
