export const getDeleteUserBlocker = ({
  requesterUserId,
  targetUserId,
  targetRoleName,
  remainingAdminCount,
}) => {
  if (Number(requesterUserId) === Number(targetUserId)) {
    return "You cannot remove your own account.";
  }

  if (targetRoleName === "Admin" && Number(remainingAdminCount) < 1) {
    return "You cannot remove the last admin user.";
  }

  return null;
};

export const getResendInvitationBlocker = ({ targetStatus }) => {
  if (targetStatus === "SUSPENDED") {
    return "Activate the user before resending the setup link.";
  }

  return null;
};

export const getUserAccessUpdateBlocker = ({
  requesterUserId,
  targetUserId,
  targetRoleName,
  nextRoleName,
  nextStatus,
  remainingActiveAdminCount,
}) => {
  const isSelf = Number(requesterUserId) === Number(targetUserId);
  const changesOwnRole = isSelf && nextRoleName && nextRoleName !== targetRoleName;
  const suspendsSelf = isSelf && String(nextStatus || "").toUpperCase() !== "ACTIVE";

  if (changesOwnRole) {
    return "You cannot change your own role assignment.";
  }
  if (suspendsSelf) {
    return "You cannot deactivate your own account.";
  }

  const removesActiveAdmin =
    targetRoleName === "Admin" &&
    (nextRoleName !== "Admin" || String(nextStatus || "").toUpperCase() !== "ACTIVE");
  if (removesActiveAdmin && Number(remainingActiveAdminCount) < 1) {
    return "You cannot deactivate or reassign the last active admin user.";
  }

  return null;
};

export const resolveUserStatusForPasswordState = ({
  currentStatus,
  requestedStatus,
  hasPassword,
}) => {
  if (!hasPassword) {
    return "PENDING";
  }

  const nextStatus = String(requestedStatus || currentStatus || "ACTIVE").trim().toUpperCase();
  if (nextStatus === "SUSPENDED") {
    return "SUSPENDED";
  }

  return "ACTIVE";
};
