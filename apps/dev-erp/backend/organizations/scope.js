const normalizeEmailAddress = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const defaultParseOrganizationId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const createIsGlobalAdmin = (globalAdminEmails = []) => {
  const globalAdminEmailSet = new Set(globalAdminEmails.map(normalizeEmailAddress).filter(Boolean));

  return (user) => {
    if (!user || user.roleName !== "Admin") return false;
    const email = normalizeEmailAddress(user.email);
    return Boolean(email && globalAdminEmailSet.has(email));
  };
};

export const createResolveOrganizationReadScope =
  ({ prisma, isGlobalAdmin, parseOrganizationId = defaultParseOrganizationId }) =>
  async ({
    user,
    organizationParam,
    requestedByAdmin = false,
    allAccessError = "Global admin access is required for organizationId=all.",
    ownAccessError = "You can only access records for your own organization.",
    missingOwnOrganizationError = "Authenticated user is missing an organization scope.",
  }) => {
    const ownOrganizationId = parseOrganizationId(user?.organizationId);
    if (!ownOrganizationId) {
      return { status: 403, error: missingOwnOrganizationError };
    }

    const ownOrganizationFilter = { organizationId: ownOrganizationId };
    if (!requestedByAdmin || organizationParam === undefined || organizationParam === null || organizationParam === "") {
      return {
        organizationFilter: ownOrganizationFilter,
        includeAllOrganizations: false,
        selectedOrganization: null,
      };
    }

    const requesterIsGlobalAdmin = isGlobalAdmin(user);
    if (String(organizationParam).toLowerCase() === "all") {
      if (!requesterIsGlobalAdmin) {
        return { status: 403, error: allAccessError };
      }
      return {
        organizationFilter: {},
        includeAllOrganizations: true,
        selectedOrganization: null,
      };
    }

    const parsedOrganizationId = parseOrganizationId(organizationParam);
    if (!parsedOrganizationId) {
      return { status: 400, error: "organizationId must be a valid id or 'all'" };
    }

    if (!requesterIsGlobalAdmin && parsedOrganizationId !== ownOrganizationId) {
      return { status: 403, error: ownAccessError };
    }

    const selectedOrganization = await prisma.organization.findUnique({
      where: { id: parsedOrganizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!selectedOrganization) {
      return { status: 404, error: "Organization not found" };
    }

    return {
      organizationFilter: { organizationId: selectedOrganization.id },
      includeAllOrganizations: false,
      selectedOrganization,
    };
  };

export const createResolveOrganizationWriteScope =
  ({ prisma, isGlobalAdmin, parseOrganizationId = defaultParseOrganizationId }) =>
  async ({
    user,
    organizationId,
    ownAccessError = "You can only write records for your own organization.",
    missingOwnOrganizationError = "Authenticated user is missing an organization scope.",
  }) => {
    const ownOrganizationId = parseOrganizationId(user?.organizationId);
    if (!ownOrganizationId) {
      return { status: 403, error: missingOwnOrganizationError };
    }

    if (organizationId === undefined || organizationId === null || organizationId === "") {
      return {
        organizationId: ownOrganizationId,
        organization: null,
      };
    }

    const parsedOrganizationId = parseOrganizationId(organizationId);
    if (!parsedOrganizationId) {
      return { status: 400, error: "organizationId must be a valid id" };
    }

    if (!isGlobalAdmin(user) && parsedOrganizationId !== ownOrganizationId) {
      return { status: 403, error: ownAccessError };
    }

    const organization = await prisma.organization.findUnique({
      where: { id: parsedOrganizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) {
      return { status: 404, error: "Organization not found" };
    }

    return {
      organizationId: organization.id,
      organization,
    };
  };
