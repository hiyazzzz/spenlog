const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. 모노레포 전체 파일 감시 (packages/* 포함)
config.watchFolders = [monorepoRoot];

// 2. 패키지 resolve 순서: apps/mobile/node_modules → root/node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm 심볼릭 링크 추적 허용
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
