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

// 4. Expo Go 전용: react-native-worklets(Reanimated 4)가 Expo Go에서 크래시를 일으키므로
//    draggable-flatlist를 plain FlatList stub으로 대체 (dev build에서는 이 블록 제거)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-draggable-flatlist') {
    return {
      filePath: path.resolve(projectRoot, 'lib/stubs/draggable-flatlist.jsx'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
