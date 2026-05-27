import { buildOpsStatus, buildReport, formatOpsStatus, formatReport } from './summary.js';
import { buildBacklogLanes, loadBacklogLanesSummary, writeBacklogLanes } from '../targets/backlog-lanes.js';
import { DEFAULT_REGISTRY_FILE } from '../targets/registry.js';

function resolveBacklogPath(opts = {}) {
  return opts.backlog || 'backlink-url/backlog-lanes/backlog-lanes.json';
}

function maybeRefreshBacklog(opts = {}) {
  const backlogPath = resolveBacklogPath(opts);
  if (!opts.refreshBacklogIfStale) return backlogPath;

  const staleAfterHours = Number.parseInt(opts.backlogStaleAfterHours || '24', 10);
  const threshold = Number.isFinite(staleAfterHours) && staleAfterHours > 0 ? staleAfterHours : 24;

  try {
    const summary = loadBacklogLanesSummary(backlogPath);
    const generatedAt = Date.parse(summary.generated_at || '');
    if (Number.isFinite(generatedAt)) {
      const ageHours = (Date.now() - generatedAt) / (1000 * 60 * 60);
      if (ageHours <= threshold) return backlogPath;
    }
  } catch {
    // refresh below
  }

  const outputDir = backlogPath.replace(/[\\/]backlog-lanes\.json$/i, '');
  const plan = buildBacklogLanes({
    registry: opts.registry || DEFAULT_REGISTRY_FILE,
    outputDir,
  });
  const files = writeBacklogLanes(plan, { outputDir });
  return files.summary_json;
}

export async function reportCommand(opts = {}) {
  const report = buildReport({
    ...opts,
    backlog: maybeRefreshBacklog(opts),
  });
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log(formatReport(report));
  return report;
}

export async function opsStatusCommand(opts = {}) {
  const status = buildOpsStatus({
    ...opts,
    backlog: maybeRefreshBacklog(opts),
  });
  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return status;
  }

  console.log(formatOpsStatus(status));
  return status;
}
