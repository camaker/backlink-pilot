import {
  authProfileStatus,
  clearAuthProfile,
  listAuthProfiles,
  loginAuthProfile,
} from './session.js';

function printStatus(status) {
  console.log(`Profile: ${status.profile}`);
  console.log(`Exists: ${status.exists}`);
  console.log(`Path: ${status.path}`);
  if (status.updated_at) console.log(`Updated: ${status.updated_at}`);
  if (status.meta?.login_url) console.log(`Login URL: ${status.meta.login_url}`);
}

export async function authLoginCommand(opts = {}) {
  const status = await loginAuthProfile(opts);
  if (opts.json) console.log(JSON.stringify(status, null, 2));
  else {
    console.log('Auth profile saved.');
    printStatus(status);
  }
  return status;
}

export function authStatusCommand(opts = {}) {
  const status = authProfileStatus(opts.profile || 'default', opts);
  if (opts.json) console.log(JSON.stringify(status, null, 2));
  else printStatus(status);
  if (!status.exists) process.exitCode = 1;
  return status;
}

export function authListCommand(opts = {}) {
  const profiles = listAuthProfiles(opts);
  if (opts.json) console.log(JSON.stringify(profiles, null, 2));
  else {
    if (!profiles.length) {
      console.log('No auth profiles found.');
      return profiles;
    }
    for (const profile of profiles) {
      console.log(`${profile.profile}\t${profile.updated_at}\t${profile.path}`);
    }
  }
  return profiles;
}

export function authClearCommand(opts = {}) {
  const status = clearAuthProfile(opts.profile || 'default', opts);
  if (opts.json) console.log(JSON.stringify(status, null, 2));
  else {
    console.log(`Auth profile cleared: ${status.profile}`);
    console.log(`Path: ${status.path}`);
  }
  return status;
}
