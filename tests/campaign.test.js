import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAutoTarget, selectCampaignTargets } from '../src/campaign.js';

describe('campaign target selection', () => {
  it('selects only auto non-paid live targets by default', () => {
    const targets = [
      { name: 'A', submit_url: 'https://a.example/submit', auto: 'yes', type: 'form' },
      { name: 'B', submit_url: 'https://b.example/submit', auto: 'manual', type: 'form' },
      { name: 'C', submit_url: 'https://c.example/submit', auto: 'yes', type: 'form', status: 'paid' },
      { name: 'D', submit_url: 'https://d.example/submit', auto: 'yes', type: 'github' },
      { name: 'E', submit_url: 'https://e.example/submit', auto: 'yes', type: 'form' },
    ];

    assert.equal(isAutoTarget(targets[0]), true);
    assert.equal(isAutoTarget(targets[1]), false);
    assert.equal(isAutoTarget(targets[2]), false);
    assert.equal(isAutoTarget(targets[3]), false);

    const selected = selectCampaignTargets(targets, { limit: 2 });
    assert.deepEqual(selected.map(target => target.name), ['A', 'E']);
  });

  it('allows explicit target URLs for agent routed requests', () => {
    const selected = selectCampaignTargets([], {
      targets: 'https://custom.example/submit',
      limit: 1,
    });

    assert.equal(selected.length, 1);
    assert.equal(selected[0].submit_url, 'https://custom.example/submit');
  });
});
