import { buildOpsStatus, buildReport, formatOpsStatus, formatReport } from './summary.js';

export async function reportCommand(opts = {}) {
  const report = buildReport(opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log(formatReport(report));
  return report;
}

export async function opsStatusCommand(opts = {}) {
  const status = buildOpsStatus(opts);
  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return status;
  }

  console.log(formatOpsStatus(status));
  return status;
}
