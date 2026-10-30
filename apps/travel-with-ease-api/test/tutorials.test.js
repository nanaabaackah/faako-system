import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedTutorials,
  transitionProgress,
} from "../src/onboarding/catalogue.js";
import { ROLE_PERMISSIONS } from "../src/auth/permissions.js";
const initial = () => ({
  status: "new",
  enabled: true,
  position: null,
  completed: [],
  last_completed_version: 0,
  revision: 0,
});
test("first introduction, skip, resume and completion preserve individual progress", () => {
  const tours = allowedTutorials(ROLE_PERMISSIONS.owner);
  const started = transitionProgress(initial(), { type: "start" }, tours);
  assert.equal(started.position, "welcome:1:workspace");
  const next = transitionProgress(started, { type: "next" }, tours);
  const paused = transitionProgress(next, { type: "skip" }, tours);
  assert.equal(paused.status, "paused");
  assert.equal(
    transitionProgress(paused, { type: "resume" }, tours).position,
    next.position,
  );
  const complete = transitionProgress(paused, { type: "complete" }, tours);
  assert.equal(complete.status, "completed");
  assert.equal(complete.last_completed_version, 1);
  assert.equal(initial().completed.length, 0);
  assert.equal(
    transitionProgress(complete, { type: "restart" }, tours).completed.length,
    complete.completed.length,
  );
});
test("mode off hides active guide without erasing progress", () => {
  const tours = allowedTutorials(ROLE_PERMISSIONS.owner);
  const started = transitionProgress(initial(), { type: "start" }, tours);
  const off = transitionProgress(
    started,
    { type: "toggle", enabled: false },
    tours,
  );
  assert.equal(off.status, "paused");
  assert.equal(off.enabled, false);
  assert.equal(off.position, started.position);
  assert.throws(() => transitionProgress(off, { type: "next" }, tours));
});
test("permissions and disabled features exclude inaccessible modules", () => {
  const editor = allowedTutorials(ROLE_PERMISSIONS.editor);
  assert.equal(
    editor.some((tour) => ["staff", "publishing"].includes(tour.id)),
    false,
  );
  assert.deepEqual(
    allowedTutorials(ROLE_PERMISSIONS.platform_admin).map((tour) => tour.id),
    ["welcome", "account"],
  );
  assert.equal(
    allowedTutorials(ROLE_PERMISSIONS.owner, ["media"]).some(
      (tour) => tour.module === "media",
    ),
    false,
  );
  assert.throws(() =>
    transitionProgress(
      initial(),
      { type: "launch", tutorialId: "staff" },
      editor,
    ),
  );
});
test("removed current targets reconcile without deleting historic completions", () => {
  const old = {
    ...initial(),
    status: "paused",
    position: "removed:1:item",
    completed: ["removed:1:item"],
  };
  const result = transitionProgress(
    old,
    { type: "resume" },
    allowedTutorials(ROLE_PERMISSIONS.editor),
  );
  assert.equal(result.position, "welcome:1:workspace");
  assert.deepEqual(result.completed, old.completed);
});
