import { runPipeline } from './run.js';

export async function pipelineCommand(opts = {}) {
  const summary = await runPipeline(opts);
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  console.log(`Run dir: ${summary.run_dir}`);
  console.log(`Execute: ${summary.execute}`);
  console.log(`Plan targets: ${summary.steps.plan.targets}`);
  console.log(`Plan: ${summary.paths.plan}`);
  if (summary.steps.scout) {
    console.log(`Scout processed: ${summary.steps.scout.processed}`);
    console.log(`Scout failed: ${summary.steps.scout.failed}`);
    console.log(`Scout results: ${summary.steps.scout.results}`);
  }
  console.log(`Processed: ${summary.steps.run.processed}`);
  console.log(`Submitted: ${summary.steps.run.submitted}`);
  console.log(`Skipped: ${summary.steps.run.skipped}`);
  console.log(`Failed: ${summary.steps.run.failed}`);
  console.log(`Results: ${summary.paths.results}`);
  if (summary.steps.verify) {
    console.log(`Verified: ${summary.steps.verify.verified}`);
    console.log(`Not found: ${summary.steps.verify.not_found}`);
    console.log(`Verification: ${summary.paths.verification}`);
  }
  console.log(`Report: ${summary.paths.report}`);
  console.log(`Manifest: ${summary.paths.manifest}`);
  return summary;
}
