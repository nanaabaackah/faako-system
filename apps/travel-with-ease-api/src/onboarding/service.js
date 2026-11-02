import { transaction } from "../db/database.js";
import { ContentError } from "../content/schema.js";
import { ROLE_PERMISSIONS } from "../auth/permissions.js";
import {
  allowedTutorials,
  transitionProgress,
  tutorialVersion,
} from "./catalogue.js";

export class TutorialService {
  constructor(pool, organisationId) {
    this.pool = pool;
    this.organisationId = organisationId;
  }
  async access(client, actor) {
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Workspace access denied.",
      );
    const { rows } = await client.query(
      "SELECT role FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 AND active=true FOR SHARE",
      [this.organisationId, actor.id],
    );
    if (!rows[0] || !ROLE_PERMISSIONS[rows[0].role])
      throw new ContentError(
        403,
        "permission_error",
        "Workspace access denied.",
      );
    return allowedTutorials(ROLE_PERMISSIONS[rows[0].role]);
  }
  async run(actor, action) {
    return transaction(this.pool, async (client) => {
      const catalogue = await this.access(client, actor);
      await client.query(
        "INSERT INTO twe.tutorial_progress(organisation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [this.organisationId, actor.id],
      );
      const {
        rows: [progress],
      } = await client.query(
        "SELECT status,enabled,position,completed,last_completed_version,revision FROM twe.tutorial_progress WHERE organisation_id=$1 AND user_id=$2 FOR UPDATE",
        [this.organisationId, actor.id],
      );
      if (!action) return { progress, catalogue, version: tutorialVersion };
      if (action.revision !== progress.revision)
        throw new ContentError(
          409,
          "conflict",
          "Tutorial progress changed on another tab. Reload your progress before continuing.",
        );
      let next;
      try {
        next = transitionProgress(progress, action, catalogue);
      } catch {
        throw new ContentError(
          400,
          "validation_error",
          "This tutorial action is not available. Reload your progress.",
        );
      }
      await client.query(
        "UPDATE twe.tutorial_progress SET status=$3,enabled=$4,position=$5,completed=$6::jsonb,last_completed_version=$7,revision=revision+1,updated_at=now() WHERE organisation_id=$1 AND user_id=$2",
        [
          this.organisationId,
          actor.id,
          next.status,
          next.enabled,
          next.position,
          JSON.stringify(next.completed),
          next.last_completed_version,
        ],
      );
      return {
        progress: { ...next, revision: progress.revision + 1 },
        catalogue,
        version: tutorialVersion,
      };
    });
  }
}
