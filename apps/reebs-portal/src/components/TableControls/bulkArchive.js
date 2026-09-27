/** Do not retry mutations. Stop on the first failure and report committed successes. */
export async function archiveSequentially(items, archiveItem) {
  const archived = [];
  for (const item of items) {
    try {
      const result = await archiveItem(item);
      archived.push({ ...item, ...result, isArchived: true });
    } catch (error) {
      return { archived, error, remaining: items.slice(archived.length) };
    }
  }
  return { archived, error: null, remaining: [] };
}
