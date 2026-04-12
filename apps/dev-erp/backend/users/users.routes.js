export const registerUserRoutes = (
  app,
  {
    authMiddleware,
    prisma,
    bcrypt,
    normalizeEmailAddress,
    validatePasswordStrength,
    passwordPolicyHint,
    buildToken,
    createCsrfToken,
    setAuthCookies,
    serializeUserRole,
    extractAllowedModules,
  }
) => {
  app.get("/api/users/me", authMiddleware, async (req, res) => {
    const { userId } = req.user;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      role: serializeUserRole(user.role),
      allowedModules: extractAllowedModules(user.role.permissions),
    });
  });

  app.patch("/api/users/me", authMiddleware, async (req, res) => {
    const hasFirstName = req.body?.firstName !== undefined;
    const hasLastName = req.body?.lastName !== undefined;
    const hasEmail = req.body?.email !== undefined;
    const hasCurrentPassword = req.body?.currentPassword !== undefined;
    const hasNewPassword = req.body?.newPassword !== undefined;
    if (!hasFirstName && !hasLastName && !hasEmail && !hasCurrentPassword && !hasNewPassword) {
      return res.status(400).json({
        error: "Provide firstName, lastName, email, and/or password details to update profile.",
      });
    }

    const normalizeName = (value) => (typeof value === "string" ? value.trim() : "");

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextFirstName = hasFirstName ? normalizeName(req.body.firstName) : user.firstName;
    const nextLastName = hasLastName ? normalizeName(req.body.lastName) : user.lastName;
    if (!nextFirstName || !nextLastName) {
      return res.status(400).json({ error: "First name and last name are required." });
    }

    const updateData = {
      firstName: nextFirstName,
      lastName: nextLastName,
      fullName: `${nextFirstName} ${nextLastName}`.trim(),
    };
    let shouldRefreshSession = false;

    if (hasEmail) {
      const nextEmail = normalizeEmailAddress(req.body.email);
      if (!nextEmail) {
        return res.status(400).json({ error: "email must be a valid email address." });
      }
      if (nextEmail !== String(user.email || "").trim().toLowerCase()) {
        const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ error: "A user with that email already exists." });
        }
        updateData.email = nextEmail;
        shouldRefreshSession = true;
      }
    }

    if (hasCurrentPassword && !hasNewPassword) {
      return res.status(400).json({ error: "Provide newPassword when currentPassword is supplied." });
    }
    if (!hasCurrentPassword && hasNewPassword) {
      return res.status(400).json({ error: "currentPassword is required to change password." });
    }

    if (hasCurrentPassword && hasNewPassword) {
      const currentPassword = String(req.body.currentPassword || "").trim();
      const newPassword = String(req.body.newPassword || "").trim();
      if (!currentPassword) {
        return res.status(400).json({ error: "currentPassword cannot be empty." });
      }
      if (!newPassword) {
        return res.status(400).json({ error: "newPassword cannot be empty." });
      }

      const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password);
      if (!currentPasswordMatches) {
        return res.status(403).json({ error: "Current password is incorrect." });
      }

      const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
      if (sameAsCurrent) {
        return res.status(400).json({ error: "newPassword must be different from currentPassword." });
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.ok) {
        return res.status(400).json({
          error: passwordValidation.error,
          passwordPolicy: passwordPolicyHint,
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
      shouldRefreshSession = true;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { role: true },
    });

    const payload = {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      fullName: updated.fullName,
      email: updated.email,
      role: serializeUserRole(updated.role),
      allowedModules: extractAllowedModules(updated.role.permissions),
    };

    if (shouldRefreshSession) {
      const refreshedToken = buildToken(updated);
      const csrfToken = createCsrfToken();
      setAuthCookies(res, { token: refreshedToken, csrfToken });
      payload.sessionUpdated = true;
    }

    return res.json(payload);
  });
};
