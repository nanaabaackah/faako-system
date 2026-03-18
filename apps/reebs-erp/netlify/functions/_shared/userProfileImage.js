export const ensureUserImageUrlColumn = async (client) => {
  try {
    await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`);
  } catch (error) {
    console.warn("User image column check failed:", error?.message || error);
  }
};

const MAX_PROFILE_IMAGE_URL_LENGTH = 500000;

export const normalizeProfileImageUrl = (value) => {
  if (value === undefined) return { provided: false, value: null };
  if (value === null) return { provided: true, value: null };
  if (typeof value !== "string") {
    return { provided: true, error: "Profile image must be a string URL or data URL." };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { provided: true, value: null };
  }
  if (trimmed.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
    return { provided: true, error: "Profile image is too large." };
  }

  return { provided: true, value: trimmed };
};
