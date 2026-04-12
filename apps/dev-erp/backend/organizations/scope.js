const normalizeEmailAddress = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const defaultParseOrganizationId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const summarizeOrganizations = (organizations) => {
  const organizationStatusCounts = organizations.reduce((counts, organization) => {
    const key = String(organization.status || "").trim().toLowerCase();
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const topLevelOrganizations = organizations.filter((organization) => organization.isTopLevel);
  const childOrganizationsCount = organizations.filter((organization) => organization.parentOrganizationId).length;
  const leafOrganizationsCount = organizations.filter(
    (organization) => (organization.childOrganizationsCount ?? 0) === 0
  ).length;
  const totalManagedOrganizations = topLevelOrganizations.reduce(
    (total, organization) => total + (organization.managedOrganizationsCount ?? 0),
    0
  );

  return {
    organizations,
    organizationHierarchy: topLevelOrganizations,
    totalOrganizations: organizations.length,
    topLevelOrganizationsCount: topLevelOrganizations.length,
    childOrganizationsCount,
    leafOrganizationsCount,
    totalManagedOrganizations: totalManagedOrganizations || organizations.length,
    organizationStatusBreakdown: Object.entries(organizationStatusCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => ({
        status,
        count,
      })),
  };
};

export const createIsGlobalAdmin = (globalAdminEmails = []) => {
  const globalAdminEmailSet = new Set(globalAdminEmails.map(normalizeEmailAddress).filter(Boolean));

  return (user) => {
    if (!user || user.roleName !== "Admin") return false;
    const email = normalizeEmailAddress(user.email);
    return Boolean(email && globalAdminEmailSet.has(email));
  };
};

export const scopeOrganizationHierarchySummary = (
  summary,
  user,
  { isGlobalAdmin, parseOrganizationId = defaultParseOrganizationId } = {}
) => {
  if (!summary || typeof summary !== "object") return summary;
  if (typeof isGlobalAdmin === "function" && isGlobalAdmin(user)) return summary;

  const ownOrganizationId = parseOrganizationId(user?.organizationId);
  if (!ownOrganizationId) return summarizeOrganizations([]);

  const visibleOrganizationIds = new Set([ownOrganizationId]);
  const organizations = Array.isArray(summary.organizations) ? summary.organizations : [];
  const scopedOrganizations = organizations
    .filter((organization) => visibleOrganizationIds.has(parseOrganizationId(organization?.id)))
    .map((organization) => {
      const childOrganizations = Array.isArray(organization.childOrganizations)
        ? organization.childOrganizations.filter((child) =>
            visibleOrganizationIds.has(parseOrganizationId(child?.id))
          )
        : [];
      const parentOrganizationId = parseOrganizationId(organization.parentOrganizationId);
      const parentIsVisible = parentOrganizationId && visibleOrganizationIds.has(parentOrganizationId);

      return {
        ...organization,
        parentOrganizationId: parentIsVisible ? parentOrganizationId : null,
        parentOrganizationName: parentIsVisible ? organization.parentOrganizationName ?? null : null,
        parentOrganizationSlug: parentIsVisible ? organization.parentOrganizationSlug ?? null : null,
        isTopLevel: !parentIsVisible,
        childOrganizations,
        childOrganizationsCount: childOrganizations.length,
        managedOrganizationsCount: childOrganizations.length ? childOrganizations.length + 1 : 0,
      };
    });

  return summarizeOrganizations(scopedOrganizations);
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
