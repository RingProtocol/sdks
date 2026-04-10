#!/usr/bin/env node
/**
 * Replace workspace:* dependencies in package.json with concrete versions before publishing.
 * This script runs before the @semantic-release/npm prepare step.
 */

const fs = require('fs');
const path = require('path');

// Collect versions for all workspace packages
function getWorkspaceVersions(rootDir) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const rootPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const workspaces = rootPackageJson.workspaces || [];
  
  const versions = {};
  
  // Iterate through all workspace packages
  for (const workspacePattern of workspaces) {
    const workspaceDir = path.join(rootDir, workspacePattern.replace('/*', ''));
    if (fs.existsSync(workspaceDir)) {
      const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packageJsonPath = path.join(workspaceDir, entry.name, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.name && packageJson.version) {
              versions[packageJson.name] = packageJson.version;
            }
          }
        }
      }
    }
  }
  
  return versions;
}

// Replace workspace:* dependencies in package.json
function replaceWorkspaceDeps(packageJsonPath, versions) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let updated = false;
  
  // Replace workspace:* entries in dependencies
  if (packageJson.dependencies) {
    for (const [depName, depVersion] of Object.entries(packageJson.dependencies)) {
      if (depVersion === 'workspace:*' || (typeof depVersion === 'string' && depVersion.startsWith('workspace:'))) {
        if (versions[depName]) {
          console.log(`Replacing ${depName}: ${depVersion} -> ${versions[depName]}`);
          packageJson.dependencies[depName] = versions[depName];
          updated = true;
        } else {
          // If a version cannot be found, fall back to the current package version.
          // Use a caret-prefixed default version when needed.
          const defaultVersion = packageJson.version || '0.1.0';
          console.log(`Warning: ${depName} version not found, using default: ${defaultVersion}`);
          packageJson.dependencies[depName] = `^${defaultVersion}`;
          updated = true;
        }
      }
    }
  }
  
  // Replace workspace:* entries in devDependencies
  if (packageJson.devDependencies) {
    for (const [depName, depVersion] of Object.entries(packageJson.devDependencies)) {
      if (depVersion === 'workspace:*' || (typeof depVersion === 'string' && depVersion.startsWith('workspace:'))) {
        if (versions[depName]) {
          console.log(`Replacing ${depName}: ${depVersion} -> ${versions[depName]}`);
          packageJson.devDependencies[depName] = versions[depName];
          updated = true;
        } else {
          // workspace:* could be left in devDependencies because it does not affect publishing,
          // but we replace it as well for consistency.
          const defaultVersion = packageJson.version || '0.1.0';
          console.log(`Warning: ${depName} version not found in devDependencies, using default: ${defaultVersion}`);
          packageJson.devDependencies[depName] = `^${defaultVersion}`;
          updated = true;
        }
      }
    }
  }
  
  // Replace workspace:* entries in peerDependencies
  if (packageJson.peerDependencies) {
    for (const [depName, depVersion] of Object.entries(packageJson.peerDependencies)) {
      if (depVersion === 'workspace:*' || (typeof depVersion === 'string' && depVersion.startsWith('workspace:'))) {
        if (versions[depName]) {
          console.log(`Replacing ${depName}: ${depVersion} -> ${versions[depName]} in peerDependencies`);
          packageJson.peerDependencies[depName] = versions[depName];
          updated = true;
        } else {
          const defaultVersion = packageJson.version || '0.1.0';
          console.log(`Warning: ${depName} version not found in peerDependencies, using default: ${defaultVersion}`);
          packageJson.peerDependencies[depName] = `^${defaultVersion}`;
          updated = true;
        }
      }
    }
  }
  
  if (updated) {
    // Ensure the file is written correctly
    const jsonString = JSON.stringify(packageJson, null, 2) + '\n';
    fs.writeFileSync(packageJsonPath, jsonString, 'utf8');
    
    // Force a filesystem sync
    const fd = fs.openSync(packageJsonPath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    
    // Wait briefly to ensure the filesystem is in sync
    const { execSync } = require('child_process');
    try {
      execSync('sync', { stdio: 'ignore' });
    } catch (e) {
      // The sync command may not exist; ignore the error if it does not.
    }
    
    // Verify that the file was written correctly
    const verifyJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasWorkspace = JSON.stringify(verifyJson).includes('workspace:');
    if (hasWorkspace) {
      console.error(`ERROR: Still found workspace: protocol in ${packageJsonPath} after replacement!`);
      console.error('Package.json content:', JSON.stringify(verifyJson, null, 2));
      
      // Print all dependencies to help with debugging
      console.error('Dependencies:', JSON.stringify(verifyJson.dependencies || {}, null, 2));
      console.error('DevDependencies:', JSON.stringify(verifyJson.devDependencies || {}, null, 2));
      console.error('PeerDependencies:', JSON.stringify(verifyJson.peerDependencies || {}, null, 2));
      
      process.exit(1);
    }
    
    console.log(`Updated workspace dependencies in ${packageJsonPath}`);
    console.log('Verification: No workspace: protocol found in package.json');
    
    // Print updated dependencies for debugging
    if (packageJson.dependencies) {
      const deps = Object.entries(packageJson.dependencies)
        .filter(([_, v]) => typeof v === 'string' && v.includes('@ring-protocol'))
        .map(([k, v]) => `  ${k}: ${v}`);
      if (deps.length > 0) {
        console.log('Updated dependencies:');
        deps.forEach(d => console.log(d));
      }
    }
  } else {
    console.log(`No workspace:* dependencies found in ${packageJsonPath}`);
  }
  
  return updated;
}

// Main entry point
function main() {
  // semantic-release runs this script from the package directory.
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Could not find package.json at ${packageJsonPath}`);
    process.exit(1);
  }
  
  const packageDir = path.dirname(packageJsonPath);
  
  // Find the workspace root (the directory with package.json and workspaces).
  let rootDir = packageDir;
  while (rootDir !== path.dirname(rootDir)) {
    const rootPackageJsonPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(rootPackageJsonPath)) {
      const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
      if (rootPackageJson.workspaces) {
        break;
      }
    }
    rootDir = path.dirname(rootDir);
  }
  
  if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
    console.error('Could not find root package.json with workspaces configuration');
    process.exit(1);
  }
  
  // Collect versions for all workspace packages
  const versions = getWorkspaceVersions(rootDir);
  
  console.log(`Found ${Object.keys(versions).length} workspace packages:`);
  for (const [name, version] of Object.entries(versions)) {
    console.log(`  ${name}: ${version}`);
  }
  
  if (Object.keys(versions).length === 0) {
    console.warn('No workspace packages found');
  }
  
  // Replace workspace:* dependencies for the current package
  const hasUpdates = replaceWorkspaceDeps(packageJsonPath, versions);
  
  // Important: npm version checks the whole workspace, so replace workspace:* dependencies for every package.
  // Do not limit the replacement to only the current package.
  console.log('Replacing workspace:* dependencies in all workspace packages...');
  
  // Reload the root package.json to read the workspaces configuration
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
  const workspaces = rootPackageJson.workspaces || [];
  let totalUpdates = hasUpdates ? 1 : 0;
  
  for (const workspacePattern of workspaces) {
    const workspaceDir = path.join(rootDir, workspacePattern.replace('/*', ''));
    if (fs.existsSync(workspaceDir)) {
      const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const otherPackageJsonPath = path.join(workspaceDir, entry.name, 'package.json');
          if (fs.existsSync(otherPackageJsonPath) && otherPackageJsonPath !== packageJsonPath) {
            const otherHasUpdates = replaceWorkspaceDeps(otherPackageJsonPath, versions);
            if (otherHasUpdates) {
              totalUpdates++;
            }
          }
        }
      }
    }
  }
  
  console.log(`Replaced workspace:* dependencies in ${totalUpdates} package(s)`);
  
  // Final verification: ensure no package.json file still contains workspace:* dependencies.
  console.log('Final verification: Checking all package.json files for remaining workspace:* dependencies...');
  let foundWorkspace = false;
  for (const workspacePattern of workspaces) {
    const workspaceDir = path.join(rootDir, workspacePattern.replace('/*', ''));
    if (fs.existsSync(workspaceDir)) {
      const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const otherPackageJsonPath = path.join(workspaceDir, entry.name, 'package.json');
          if (fs.existsSync(otherPackageJsonPath)) {
            const verifyJson = JSON.parse(fs.readFileSync(otherPackageJsonPath, 'utf8'));
            const jsonString = JSON.stringify(verifyJson);
            if (jsonString.includes('workspace:')) {
              console.error(`ERROR: Found workspace: protocol in ${otherPackageJsonPath} after replacement!`);
              foundWorkspace = true;
            }
          }
        }
      }
    }
  }
  
  if (foundWorkspace) {
    console.error('ERROR: Some package.json files still contain workspace:* dependencies after replacement!');
    process.exit(1);
  }
  
  console.log('Final verification passed: No workspace:* dependencies found in any package.json file.');
  
  // If any dependencies were replaced, temporarily move the root yarn.lock file.
  // npm version may read yarn.lock during validation and fail if it still sees workspace:* references.
  // yarn.lock is restored later in the @semantic-release/exec successCmd/failCmd hooks.
  if (totalUpdates > 0) {
    const yarnLockPath = path.join(rootDir, 'yarn.lock');
    if (fs.existsSync(yarnLockPath)) {
      console.log(`Temporarily removing ${yarnLockPath} to prevent npm version from reading workspace:* references`);
      fs.renameSync(yarnLockPath, yarnLockPath + '.bak');
      console.log(`Renamed ${yarnLockPath} to ${yarnLockPath}.bak`);
    }
  }
  
  console.log('All workspace:* dependencies have been replaced. Ready for npm version.');
}

main();

