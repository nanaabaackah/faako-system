const normalizeConcurrency = (value, fallback = 8) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const buildSitePageUrl = (site, page) => {
  if (!site?.baseUrl || !page?.path) return null;
  try {
    return new URL(page.path, site.baseUrl).toString();
  } catch {
    return null;
  }
};

export const getAggregateSiteStatus = (pages = []) => {
  if (!Array.isArray(pages) || !pages.length) return "unknown";
  if (pages.some((page) => page?.status === "offline")) return "offline";
  if (pages.some((page) => page?.status === "degraded")) return "degraded";
  if (pages.every((page) => page?.status === "not_configured")) return "not_configured";
  if (pages.every((page) => page?.status === "online")) return "online";
  return "unknown";
};

export const mapWithConcurrency = async (items = [], concurrency = 8, mapper) => {
  const source = Array.isArray(items) ? items : [];
  if (!source.length) return [];

  const results = new Array(source.length);
  const workerCount = Math.min(normalizeConcurrency(concurrency), source.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < source.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(source[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
};

export const buildSiteStatus = async ({
  sites = [],
  checkUrlStatus,
  concurrency = 8,
} = {}) => {
  const sourceSites = Array.isArray(sites) ? sites : [];
  const checks = sourceSites.flatMap((site, siteIndex) =>
    (Array.isArray(site?.pages) ? site.pages : []).map((page, pageIndex) => ({
      siteIndex,
      pageIndex,
      site,
      page,
    }))
  );
  const checkedPages = await mapWithConcurrency(checks, concurrency, async ({ site, page }) => {
    const url = buildSitePageUrl(site, page);
    const status = url && typeof checkUrlStatus === "function"
      ? await checkUrlStatus(url)
      : "not_configured";
    return { ...page, url, status };
  });

  let checkedPageIndex = 0;
  return sourceSites.map((site) => ({
    ...site,
    pages: (Array.isArray(site?.pages) ? site.pages : []).map(() => {
      const page = checkedPages[checkedPageIndex];
      checkedPageIndex += 1;
      return page;
    }),
  }));
};

export const buildSiteStatusFallback = (sites = [], status = "unknown") =>
  (Array.isArray(sites) ? sites : []).map((site) => ({
    ...site,
    pages: (Array.isArray(site?.pages) ? site.pages : []).map((page) => {
      const url = buildSitePageUrl(site, page);
      return {
        ...page,
        url,
        status: url ? status : "not_configured",
      };
    }),
  }));
