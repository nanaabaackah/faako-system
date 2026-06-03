import { useState } from "react";
import {
  AppBottomBar,
  AnimatedLoadingState,
  Button,
  Card,
  DataTable,
  InlineNotice,
  KpiCard,
  PageHeader,
  PageShell,
  SearchField,
  SecurityState,
  TextField,
  UiSystemProvider,
  useToast,
} from "@faako/ui";
import appSystem from "../appSystem.js";

const starterRows = [
  { id: "1", module: "Orders", owner: "Ops", status: "Ready" },
  { id: "2", module: "Inventory", owner: "Warehouse", status: "Active" },
];

const starterColumns = [
  { id: "module", header: "Module", accessor: "module", sortable: true },
  { id: "owner", header: "Owner", accessor: "owner", sortable: true },
  { id: "status", header: "Status", accessor: "status", sortable: true, align: "right" },
];

function StarterScreen() {
  const [query, setQuery] = useState("");
  const { pushToast } = useToast();

  return (
    <div className="ui-app-screen">
      <PageShell>
        <PageHeader
          eyebrow="Canonical Scaffold"
          title="System Starter"
          subtitle="Every new app starts with the shared primitives, feedback delivery, and security-state baseline."
          actions={
            <Button
              variant="primary"
              type="button"
              onClick={() =>
                pushToast({
                  tone: "success",
                  title: "Starter action complete",
                  message: "This is the default save confirmation pattern.",
                })
              }
            >
              Trigger Starter Toast
            </Button>
          }
        />

        <div className="starter-grid is-two">
          <Card>
            <div className="starter-grid">
              <KpiCard label="Shared onboarding" value="Enabled" detail="Theme, feedback, and security state wiring are active." tone="success" />
              <SearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                placeholder="Search starter modules"
              />
              <TextField label="Workspace name" placeholder="Faako Operations" />
              <InlineNotice tone="info" title="Shared default" message="Customize brand tokens only when the app needs a deliberate visual difference." />
            </div>
          </Card>

          <Card>
            <div className="starter-grid">
              <SecurityState stateId="session-expired" compact />
              <SecurityState stateId="verification-sent" compact />
              <SecurityState stateId="blocked-action" compact />
            </div>
          </Card>
        </div>

        <Card>
          <DataTable
            title="Starter table"
            description="Use the shared table before writing app-local markup for tabular data."
            columns={starterColumns}
            rows={starterRows}
            rowKey="id"
            summary={[
              { id: "count", content: `${starterRows.length} modules` },
              { id: "owner", content: "" , empty: true },
              { id: "status", content: "2 configured", align: "right" },
            ]}
          />
        </Card>

        <Card>
          <AnimatedLoadingState
            compact
            title="Loading workspace"
            message="Use the shared app-themed skeleton for route and data fetch transitions."
          />
        </Card>
      </PageShell>
      <div className="ui-bottom-bar-shell">
        <AppBottomBar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UiSystemProvider appSystem={appSystem}>
      <StarterScreen />
    </UiSystemProvider>
  );
}
