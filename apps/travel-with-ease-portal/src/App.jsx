import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import { Button, Card, InlineNotice, KpiCard, PageHeader, PageShell, UiSystemProvider } from "@faako/ui";
import appSystem from "../appSystem.js";
import { toLeadRow } from "./leadView.js";

const api = createBrowserApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || "" });

function LeadDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem("twe-agent-token") || "");
  const [draftToken, setDraftToken] = useState(token);
  const [leads, setLeads] = useState([]);
  const [state, setState] = useState({ loading: false, error: "" });
  const load = useCallback(async () => {
    if (!token) return;
    setState({ loading: true, error: "" });
    try {
      const data = await api.get("/api/agent/leads", { headers: { authorization: `Bearer ${token}` }, fallbackMessage: "Could not load leads." });
      setLeads(data.items || []); setState({ loading: false, error: "" });
    } catch (error) { setState({ loading: false, error: error.message }); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => leads.map(toLeadRow), [leads]);
  const connect = (event) => { event.preventDefault(); sessionStorage.setItem("twe-agent-token", draftToken); setToken(draftToken); };
  if (!token) return <PageShell><PageHeader eyebrow="Travel operations" title="Agent access" subtitle="Enter the temporary development access token. Production requires the approved staff authentication integration."/><Card className="access-card"><form onSubmit={connect}><label>Development access token<input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} autoComplete="current-password" required /></label><Button type="submit">Open dashboard</Button></form></Card></PageShell>;
  return <PageShell><PageHeader eyebrow="Today at a glance" title="New trip conversations" subtitle="Every website plan arrives here as a CRM lead, ready for a considered response." actions={<Button type="button" onClick={load} disabled={state.loading}>{state.loading ? "Refreshing…" : "Refresh"}</Button>}/>
    {state.error && <InlineNotice tone="danger" title="Leads unavailable" message={state.error}/>}<div className="kpi-grid"><KpiCard label="New leads" value={String(rows.filter((row) => row.stage === "new").length)} detail="Awaiting first response" tone="info"/><KpiCard label="All enquiries" value={String(rows.length)} detail="Website estimator source"/></div>
    <Card><div className="table-heading"><div><span>CRM · Leads</span><h2>Trip enquiries</h2></div><button className="text-button" type="button" onClick={() => { sessionStorage.removeItem("twe-agent-token"); setToken(""); }}>End development session</button></div>
      {rows.length ? <div className="table-wrap"><table><thead><tr><th>Traveller</th><th>Destination</th><th>Travel date</th><th>Party</th><th>Stage</th><th>Received</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.destination}</td><td>{row.timing}</td><td>{row.party}</td><td><span className="stage">{row.stage}</span></td><td>{row.received}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span>✦</span><h3>No enquiries yet</h3><p>Submitted trip plans will appear here.</p></div>}
    </Card></PageShell>;
}
export default function App(){ return <UiSystemProvider appSystem={appSystem}><div className="portal-shell"><aside><div className="portal-brand"><span>TWE</span><div><strong>Travel With Ease</strong><small>Operations</small></div></div><nav><a className="active" href="/">Dashboard</a><a className="active" href="/">Leads</a></nav><p>Only functional modules are shown.</p></aside><LeadDashboard/></div></UiSystemProvider>; }
