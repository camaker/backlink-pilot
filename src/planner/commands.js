import { buildScoutQueuePlan, saveSubmissionPlan } from './plan.js';

export async function scoutQueueCommand(opts = {}) {
  const plan = buildScoutQueuePlan(opts);
  if (opts.output) {
    saveSubmissionPlan(plan, opts.output);
    console.log(`Scout queue written: ${opts.output}`);
    console.log(`Targets queued: ${plan.targets.length}`);
    return plan;
  }

  if (opts.json) {
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  console.log(`Targets queued: ${plan.targets.length}`);
  for (const target of plan.targets) {
    console.log(`${target.order}. ${target.name} - ${target.mode} - ${target.submit_url}`);
  }
  return plan;
}
