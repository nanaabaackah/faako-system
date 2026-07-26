import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const imageRoot = fileURLToPath(new URL('../dist/imgs/', import.meta.url));
const publicImageRoot = fileURLToPath(new URL('../public/imgs/', import.meta.url));
const cacheRoot = fileURLToPath(new URL('../.astro/optimized-images/', import.meta.url));
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
const minimumOptimizationSize = 200 * 1024;
const concurrency = 4;

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    })
  );
  return nested.flat();
};

const optimize = async (file) => {
  const extension = path.extname(file).toLowerCase();
  const original = await stat(file);
  if (!supportedExtensions.has(extension) || original.size < minimumOptimizationSize) {
    return { before: original.size, after: original.size, optimized: false };
  }

  const webpFile = file.replace(/\.(?:jpe?g|png)$/i, '.webp');
  const temporaryFile = `${webpFile}.optimized`;
  const relativePath = path.relative(imageRoot, file).split(path.sep).join('/');
  const cachedFile = path.join(
    cacheRoot,
    relativePath.replace(/\.(?:jpe?g|png)$/i, '.webp'),
  );
  const sourceFile = path.join(publicImageRoot, relativePath);

  try {
    const [cached, source] = await Promise.all([stat(cachedFile), stat(sourceFile)]);
    if (cached.mtimeMs >= source.mtimeMs && cached.size < original.size) {
      await mkdir(path.dirname(webpFile), { recursive: true });
      await copyFile(cachedFile, webpFile);
      await unlink(file);
      return {
        before: original.size,
        after: cached.size,
        optimized: true,
        sourceUrl: `/imgs/${relativePath}`,
        targetUrl: `/imgs/${relativePath.replace(/\.(?:jpe?g|png)$/i, '.webp')}`,
      };
    }
  } catch {
    // A missing or stale cache falls through to a fresh conversion.
  }

  const pipeline = sharp(file, { failOn: 'none' }).rotate().resize({
    width: 2400,
    height: 2400,
    fit: 'inside',
    withoutEnlargement: true,
  }).webp({ quality: 82, effort: 0, smartSubsample: true });

  await pipeline.toFile(temporaryFile);
  const optimized = await stat(temporaryFile);

  if (optimized.size >= original.size) {
    await unlink(temporaryFile);
    return { before: original.size, after: original.size, optimized: false, sourceUrl: '', targetUrl: '' };
  }

  await rename(temporaryFile, webpFile);
  await unlink(file);
  await mkdir(path.dirname(cachedFile), { recursive: true });
  await copyFile(webpFile, cachedFile);
  return {
    before: original.size,
    after: optimized.size,
    optimized: true,
    sourceUrl: `/imgs/${relativePath}`,
    targetUrl: `/imgs/${relativePath.replace(/\.(?:jpe?g|png)$/i, '.webp')}`,
  };
};

const files = await walk(imageRoot);
for (const file of files.filter((entry) => path.extname(entry).toLowerCase() === '.webp')) {
  const relativePath = path.relative(imageRoot, file);
  const cachedFile = path.join(cacheRoot, relativePath);
  await mkdir(path.dirname(cachedFile), { recursive: true });
  await copyFile(file, cachedFile);
}
const results = [];

for (let index = 0; index < files.length; index += concurrency) {
  const batch = files.slice(index, index + concurrency);
  results.push(...(await Promise.all(batch.map(optimize))));
}

const totals = results.reduce(
  (summary, result) => ({
    files: summary.files + 1,
    optimized: summary.optimized + Number(result.optimized),
    before: summary.before + result.before,
    after: summary.after + result.after,
  }),
  { files: 0, optimized: 0, before: 0, after: 0 }
);

const replacements = results.filter((result) => result.optimized);
const textFiles = (await walk(fileURLToPath(new URL('../dist/', import.meta.url)))).filter((file) =>
  textExtensions.has(path.extname(file).toLowerCase())
);

for (const file of textFiles) {
  const original = await readFile(file, 'utf8');
  const updated = replacements.reduce(
    (content, replacement) =>
      content.replaceAll(replacement.sourceUrl, replacement.targetUrl),
    original
  );
  if (updated !== original) await writeFile(file, updated);
}

console.log(
  JSON.stringify(
    {
      ...totals,
      savedBytes: totals.before - totals.after,
      reductionPercent:
        totals.before > 0
          ? Number((((totals.before - totals.after) / totals.before) * 100).toFixed(1))
          : 0,
    },
    null,
    2
  )
);
