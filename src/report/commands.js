import { buildReport, formatReport } from './summary.js';

export async function reportCommand(opts = {}) {
  const report = buildReport(opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log(formatReport(report));
  return report;
}
