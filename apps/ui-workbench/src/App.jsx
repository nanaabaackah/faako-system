import { useMemo, useState } from "react";
import { SYSTEM_THEME_PRESETS } from "@faako/theme";
import {
  AppBottomBar,
  AnimatedLoadingState,
  Button,
  Card,
  DataTable,
  FilterBar,
  InlineNotice,
  KpiCard,
  NoticeBanner,
  PageHeader,
  PageShell,
  SearchField,
  SecurityState,
  SelectField,
  StatusPill,
  TextField,
  TextareaField,
  UiSystemProvider,
  useToast,
} from "@faako/ui";
import appSystem from "../appSystem.js";

const activityRows = [
  { id: "row-1", item: "System starter scaffold", owner: "Platform", status: "Ready", date: "2026-04-05" },
  { id: "row-2", item: "Shared toast delivery", owner: "Portal", status: "Active", date: "2026-04-04" },
  { id: "row-3", item: "Security gate baseline", owner: "Monorepo", status: "Review", date: "2026-04-03" },
];

const tableColumns = [
  {
    id: "item",
    header: "Artifact",
    accessor: "item",
    sortable: true,
  },
  {
    id: "owner",
    header: "Owner",
    accessor: "owner",
    sortable: true,
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => (
      <StatusPill
        tone={row.status === "Ready" ? "success" : row.status === "Review" ? "warning" : "info"}
      >
        {row.status}
      </StatusPill>
    ),
  },
  {
    id: "date",
    header: "Updated",
    accessor: "date",
    align: "right",
    sortable: true,
  },
];

function WorkbenchScreen({ presetId, setPresetId }) {
  const { pushToast } = useToast();
  const themeOptions = useMemo(
    () =>
      Object.values(SYSTEM_THEME_PRESETS).map((preset) => ({
        value: preset.id,
        label: preset.label || preset.id,
      })),
    [],
  );

  return (
    <div className="ui-app-screen">
      <PageShell>
        <PageHeader
          eyebrow="Shared Baseline"
          title="UI Workbench"
          subtitle="Live reference for shared primitives, feedback delivery, and security states across the faako-system presets."
          actions={
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  pushToast({
                    tone: "success",
                    title: "Settings saved",
                    message: "The shared toast system is active in the workbench.",
                  })
                }
              >
                Trigger Success Toast
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  pushToast({
                    tone: "warning",
                    title: "Rate limit approaching",
                    message: "This is the shared warning toast state.",
                  })
                }
              >
                Trigger Warning Toast
              </Button>
            </>
          }
        />

        <FilterBar>
          <SelectField
            label="Theme Preset"
            value={presetId}
            options={themeOptions}
            onChange={(event) => setPresetId(event.target.value)}
          />
          <SearchField
            placeholder="Search component catalog"
            value=""
            onChange={() => {}}
          />
        </FilterBar>

        <div className="workbench-card-grid">
          <KpiCard label="Shared presets" value={themeOptions.length} detail="Theme contract wired through @faako/theme" tone="info" />
          <KpiCard label="Feedback modes" value="3" detail="Inline, banner, and toast delivery" tone="success" />
          <KpiCard label="Security states" value="8" detail="Session, access, throttle, and secure action flows" tone="warning" />
        </div>

        <div className="workbench-grid is-two">
          <Card>
            <PageHeader
              eyebrow="Forms"
              title="Field primitives"
              subtitle="Shared field states for settings, forms, and filters."
            />
            <div className="workbench-grid">
              <TextField label="Team name" placeholder="Faako Platform" />
              <TextField label="Domain" placeholder="platform.faako.app" hint="Public hostname" />
              <TextareaField
                label="Implementation note"
                defaultValue="Use shared primitives first. Brand through presets, not markup forks."
              />
            </div>
          </Card>

          <Card>
            <PageHeader
              eyebrow="Feedback"
              title="Message delivery"
              subtitle="Default success, warning, error, and loading states."
            />
            <div className="workbench-state-grid">
              <InlineNotice tone="success" title="Settings saved" message="Your changes were written and synchronized." />
              <InlineNotice tone="loading" title="Sending email" message="Message delivery is in progress." />
              <NoticeBanner tone="warning" title="Privilege escalation blocked" message="This action needs a stronger role before it can continue." />
              <AnimatedLoadingState
                compact
                title="Loading workspace"
                message="Shared skeleton animation with the active app theme."
              />
            </div>
          </Card>
        </div>

        <Card>
          <PageHeader
            eyebrow="Security States"
            title="Individual security responses"
            subtitle="Shared states every app can reuse for auth, policy, and transport failures."
          />
          <div className="workbench-state-grid">
            <SecurityState stateId="session-expired" compact />
            <SecurityState stateId="forbidden" compact />
            <SecurityState stateId="rate-limited" compact />
            <SecurityState stateId="secure-download-failed" compact />
          </div>
        </Card>

        <Card>
          <DataTable
            title="Shared data table"
            description="Canonical table primitive with sortable headers and summary cells."
            columns={tableColumns}
            rows={activityRows}
            rowKey="id"
            summary={[
              { id: "count", content: `${activityRows.length} rows` },
              { id: "spacer-1", content: "", empty: true },
              { id: "spacer-2", content: "", empty: true },
              { id: "updated", align: "right", content: "Latest 2026-04-05" },
            ]}
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
  const [presetId, setPresetId] = useState(appSystem.theme.presetId);
  const runtimeAppSystem = useMemo(
    () => ({
      ...appSystem,
      theme: {
        ...appSystem.theme,
        presetId,
      },
    }),
    [presetId],
  );

  return (
    <UiSystemProvider appSystem={runtimeAppSystem}>
      <WorkbenchScreen presetId={presetId} setPresetId={setPresetId} />
    </UiSystemProvider>
  );
}
