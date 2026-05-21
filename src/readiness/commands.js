import { loadConfig } from '../config.js';
import { formatReadinessReport, validateProductReadiness } from './product.js';

export async function readinessCommand(opts = {}) {
  const config = await loadConfig({
    ...opts,
    configPath: opts.config || opts.productConfig,
    allowPlaceholder: true,
    requireProduct: true,
  });
  const report = validateProductReadiness(config, {
    level: opts.level || opts.readinessLevel || 'automation',
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReadinessReport(report));
  }

  if (!report.ok) process.exitCode = 1;
  return report;
}
