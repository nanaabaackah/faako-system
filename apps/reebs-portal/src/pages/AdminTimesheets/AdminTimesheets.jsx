import React, { useEffect, useMemo, useState } from "react";
import "./AdminTimesheets.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faClock,
  faHistory,
  faSignInAlt,
  faSignOutAlt,
  faLocationDot,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes)) return "-";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hrs) return `${mins}m`;
  return `${hrs}h ${mins}m`;
};

function AdminTimesheets() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [history, setHistory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [totals, setTotals] = useState({ weeklyHours: 0, monthlyHours: 0, weeklyShifts: 0, monthlyShifts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clocking, setClocking] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTimesheets = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/timesheets", {
        headers: { "x-user-id": String(user.id) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load timesheets.");
      setActiveShift(data.activeShift || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setTotals(data.totals || { weeklyHours: 0, monthlyHours: 0, weeklyShifts: 0, monthlyShifts: 0 });
    } catch (err) {
      console.error("Timesheets fetch failed", err);
      setError(err.message || "Unable to load timesheets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, [user?.id]);

  const activeMinutes = useMemo(() => {
    if (!activeShift?.clockIn) return 0;
    const diff = now.getTime() - new Date(activeShift.clockIn).getTime();
    if (diff <= 0) return 0;
    return Math.round(diff / 60000);
  }, [activeShift, now]);

  const completedShiftCount = useMemo(
    () => history.filter((shift) => shift?.clockOut).length,
    [history]
  );

  const geoTaggedCount = useMemo(
    () => history.filter((shift) => shift?.clockInLat && shift?.clockInLng).length,
    [history]
  );

  const averageShiftMinutes = useMemo(() => {
    if (!completedShiftCount) return 0;
    const totalMinutes = history.reduce(
      (sum, shift) => sum + (Number(shift?.durationMinutes) || 0),
      0
    );
    return totalMinutes / completedShiftCount;
  }, [completedShiftCount, history]);

  const toggleShift = async () => {
    if (!user?.id) return;
    setClocking(true);
    setGeoStatus("");
    let coords = {};

    if ("geolocation" in navigator) {
      try {
        const location = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
        coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setGeoStatus("Location captured.");
      } catch (err) {
        setGeoStatus("Location unavailable.");
      }
    }

    try {
      const res = await fetch("/.netlify/functions/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": String(user.id) },
        body: JSON.stringify(coords),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Clocking failed.");
      await fetchTimesheets();
    } catch (err) {
      console.error("Clock toggle failed", err);
      setError(err.message || "Clocking failed.");
    } finally {
      setClocking(false);
    }
  };

  return (
    <div className="timesheet-page timesheet-page--redesign">
      <div className="timesheet-shell">
        <AdminBreadcrumb items={[{ label: "Timesheets" }]} />

        <header className="timesheet-header">
          <div>
            <p className="timesheet-eyebrow">Digital Punch Card</p>
            <h1>Timesheets</h1>
            <p className="timesheet-subtitle">
              Log attendance, verify work locations, and prep payroll automatically.
            </p>
          </div>
        </header>

        <section className="timesheet-hero">
          <div className="timesheet-now">
            <div className="timesheet-now-clock">
              <AppIcon icon={faClock} />
              <div>
                <p>Current time</p>
                <h2>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</h2>
                <span>{now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" })}</span>
              </div>
            </div>
            <div className={`timesheet-status ${activeShift ? "active" : "idle"}`}>
              <p>Status</p>
              <h3>{activeShift ? "Clocked in" : "Off duty"}</h3>
              <span>
                {activeShift
                  ? `Active since ${formatTime(activeShift.clockIn)} · ${formatDuration(activeMinutes)}`
                  : "No active shift"}
              </span>
            </div>
          </div>
          <div className="timesheet-action">
            <button
              type="button"
              className={`timesheet-btn ${activeShift ? "out" : "in"}`}
              onClick={toggleShift}
              disabled={clocking}
            >
              <AppIcon icon={activeShift ? faSignOutAlt : faSignInAlt} />
              {clocking ? "Updating..." : activeShift ? "Clock out" : "Clock in"}
            </button>
            <div className="timesheet-geo">
              <AppIcon icon={faLocationDot} />
              <span>{geoStatus || (activeShift ? "Location stored for shift." : "Geo-tag optional.")}</span>
            </div>
          </div>
        </section>

        <section className="timesheet-kpis">
          <div className="timesheet-card">
            <p className="timesheet-card-label">Weekly hours</p>
            <h3>{totals.weeklyHours}</h3>
            <span>{totals.weeklyShifts} shifts logged</span>
          </div>
          <div className="timesheet-card">
            <p className="timesheet-card-label">Monthly hours</p>
            <h3>{totals.monthlyHours}</h3>
            <span>{totals.monthlyShifts} shifts logged</span>
          </div>
          <div className="timesheet-card">
            <p className="timesheet-card-label">Avg shift</p>
            <h3>{completedShiftCount ? formatDuration(averageShiftMinutes) : "--"}</h3>
            <span>{completedShiftCount} completed shifts</span>
          </div>
          <div className="timesheet-card">
            <p className="timesheet-card-label">Geo-tagged</p>
            <h3>{geoTaggedCount}</h3>
            <span>{history.length} entries recorded</span>
          </div>
        </section>

        <section className="timesheet-history">
          <div className="timesheet-history-head">
            <div>
              <p className="timesheet-card-label">Shift log</p>
              <h3>
                <AppIcon icon={faHistory} /> Recent shifts
              </h3>
            </div>
            <div className="timesheet-history-actions">
              <span className="timesheet-history-meta">{history.length} entries</span>
              <button type="button" className="timesheet-refresh" onClick={fetchTimesheets} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <p className="timesheet-muted">Loading shifts...</p>
          ) : error ? (
            <p className="timesheet-error">{error}</p>
          ) : history.length === 0 ? (
            <p className="timesheet-muted">No shifts logged yet.</p>
          ) : (
            <div className="timesheet-list">
              {history.map((shift) => (
                <div key={shift.id} className={`timesheet-item ${shift.clockOut ? "" : "is-active"}`}>
                  <div>
                    <p className="timesheet-item-date">{formatDate(shift.clockIn)}</p>
                    <p className="timesheet-item-time">
                      {formatTime(shift.clockIn)} - {shift.clockOut ? formatTime(shift.clockOut) : "In progress"}
                    </p>
                  </div>
                  <div className="timesheet-item-meta">
                    <span>{shift.durationMinutes ? formatDuration(shift.durationMinutes) : "Open"}</span>
                    <span className="timesheet-dot">
                      <AppIcon icon={faLocationDot} />
                      {shift.clockInLat ? "Geo-tagged" : "No geo"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminTimesheets;
