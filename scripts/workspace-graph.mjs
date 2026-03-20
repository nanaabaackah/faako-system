import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const GRAPH_CACHE = new Map();
const ROOT_CONFIG_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
];
const WORKSPACE_GROUPS = [
  { kind: "app", dir: "apps" },
  { kind: "package", dir: "packages" },
];
const GLOBAL_APP_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "workspace-links.json",
]);

const normalizeSlashes = (value = "") => value.replace(/\\/g, "/");

const toRelativePath = (root, filePath) =>
  normalizeSlashes(path.relative(root, path.resolve(root, filePath)));

const uniqueSorted = (values = []) =>
  [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const mergeDependencyMaps = (manifest = {}) => ({
  ...(manifest.dependencies || {}),
  ...(manifest.devDependencies || {}),
  ...(manifest.peerDependencies || {}),
  ...(manifest.optionalDependencies || {}),
});

const isRootWorkspace = (directory) => {
  try {
    const packageJsonPath = path.join(directory, "package.json");
    if (!fs.existsSync(packageJsonPath)) return false;

    const manifest = readJson(packageJsonPath);
    return Boolean(
      manifest?.workspaces
      && ROOT_CONFIG_FILES.every((fileName) => fs.existsSync(path.join(directory, fileName))),
    );
  } catch {
    return false;
  }
};

export const findWorkspaceRoot = (startDir = process.cwd()) => {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (isRootWorkspace(currentDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate the workspace root from "${startDir}".`);
    }

    currentDir = parentDir;
  }
};

const listProjectsInGroup = (rootDir, { kind, dir }) => {
  const groupDir = path.join(rootDir, dir);
  if (!fs.existsSync(groupDir)) return [];

  return fs
    .readdirSync(groupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectDir = path.join(groupDir, entry.name);
      const manifestPath = path.join(projectDir, "package.json");
      if (!fs.existsSync(manifestPath)) return null;

      const manifest = readJson(manifestPath);
      return {
        kind,
        name: manifest.name,
        dir: normalizeSlashes(path.relative(rootDir, projectDir)),
        manifestPath: normalizeSlashes(path.relative(rootDir, manifestPath)),
        dependencies: [],
        rawDependencies: mergeDependencyMaps(manifest),
      };
    })
    .filter(Boolean)
    .filter((project) => Boolean(project.name));
};

const readWorkspaceLinks = (rootDir) => {
  const linksPath = path.join(rootDir, "workspace-links.json");
  if (!fs.existsSync(linksPath)) {
    return {};
  }

  const parsed = readJson(linksPath);
  return parsed?.appBuildDependencies || {};
};

export const getWorkspaceGraph = (rootDir = findWorkspaceRoot()) => {
  const cacheKey = normalizeSlashes(rootDir);
  if (GRAPH_CACHE.has(cacheKey)) {
    return GRAPH_CACHE.get(cacheKey);
  }

  const projects = WORKSPACE_GROUPS.flatMap((group) => listProjectsInGroup(rootDir, group));
  const projectNames = new Set(projects.map((project) => project.name));
  const workspaceLinks = readWorkspaceLinks(rootDir);

  projects.forEach((project) => {
    const manifestDependencies = Object.keys(project.rawDependencies).filter((dependencyName) =>
      projectNames.has(dependencyName),
    );
    const linkedDependencies = workspaceLinks[project.name] || [];
    project.dependencies = uniqueSorted([
      ...manifestDependencies,
      ...linkedDependencies.filter((dependencyName) => projectNames.has(dependencyName)),
    ]);
  });

  const projectsByName = new Map(projects.map((project) => [project.name, project]));
  const dependentsByName = new Map(projects.map((project) => [project.name, new Set()]));

  projects.forEach((project) => {
    project.dependencies.forEach((dependencyName) => {
      dependentsByName.get(dependencyName)?.add(project.name);
    });
  });

  const sortedProjects = [...projects].sort((left, right) => right.dir.length - left.dir.length);
  const graph = {
    rootDir,
    projects,
    projectsByName,
    dependentsByName,
    apps: projects.filter((project) => project.kind === "app"),
    workspaceLinks,
    sortedProjects,
  };

  GRAPH_CACHE.set(cacheKey, graph);
  return graph;
};

export const isGlobalAppChange = (relativePath) => GLOBAL_APP_FILES.has(normalizeSlashes(relativePath));

export const getProjectForFile = (graph, filePath) => {
  const relativePath = toRelativePath(graph.rootDir, filePath);

  return (
    graph.sortedProjects.find((project) => (
      relativePath === project.dir || relativePath.startsWith(`${project.dir}/`)
    )) || null
  );
};

export const getTransitiveDependents = (graph, changedProjectNames = []) => {
  const queue = [...new Set(changedProjectNames)];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const currentName = queue.shift();
    const dependents = graph.dependentsByName.get(currentName) || new Set();

    dependents.forEach((dependentName) => {
      if (visited.has(dependentName)) return;
      visited.add(dependentName);
      queue.push(dependentName);
    });
  }

  return [...visited];
};

const hasGitRef = (rootDir, ref) => {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

export const getChangedFiles = ({
  rootDir = findWorkspaceRoot(),
  baseRef,
  headRef = "HEAD",
  files,
} = {}) => {
  if (files?.length) {
    return {
      changedFiles: uniqueSorted(files.map((filePath) => toRelativePath(rootDir, filePath))),
      baseRef: null,
      headRef: null,
      reason: null,
    };
  }

  if (!baseRef) {
    return {
      changedFiles: null,
      baseRef: null,
      headRef,
      reason: "Missing a base ref. Provide --base or CACHED_COMMIT_REF.",
    };
  }

  if (!hasGitRef(rootDir, baseRef)) {
    return {
      changedFiles: null,
      baseRef,
      headRef,
      reason: `Base ref "${baseRef}" is not available in this checkout.`,
    };
  }

  if (!hasGitRef(rootDir, headRef)) {
    return {
      changedFiles: null,
      baseRef,
      headRef,
      reason: `Head ref "${headRef}" is not available in this checkout.`,
    };
  }

  const diffOutput = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", baseRef, headRef],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );

  const changedFiles = uniqueSorted(
    diffOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  return {
    changedFiles,
    baseRef,
    headRef,
    reason: null,
  };
};

export const getAffectedApps = ({
  rootDir = findWorkspaceRoot(),
  baseRef,
  headRef = "HEAD",
  files,
} = {}) => {
  const graph = getWorkspaceGraph(rootDir);
  const diffResult = getChangedFiles({ rootDir, baseRef, headRef, files });

  if (!diffResult.changedFiles) {
    return {
      ...diffResult,
      changedProjects: [],
      apps: [],
      isGlobalChange: false,
    };
  }

  if (diffResult.changedFiles.length === 0) {
    return {
      ...diffResult,
      changedProjects: [],
      apps: [],
      isGlobalChange: false,
    };
  }

  if (diffResult.changedFiles.some((relativePath) => isGlobalAppChange(relativePath))) {
    return {
      ...diffResult,
      changedProjects: [],
      apps: [...graph.apps].sort((left, right) => left.name.localeCompare(right.name)),
      isGlobalChange: true,
    };
  }

  const changedProjectNames = uniqueSorted(
    diffResult.changedFiles
      .map((relativePath) => getProjectForFile(graph, relativePath)?.name)
      .filter(Boolean),
  );

  const affectedProjectNames = uniqueSorted(getTransitiveDependents(graph, changedProjectNames));
  const apps = affectedProjectNames
    .map((projectName) => graph.projectsByName.get(projectName))
    .filter((project) => project?.kind === "app")
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    ...diffResult,
    changedProjects: changedProjectNames,
    apps,
    isGlobalChange: false,
  };
};
