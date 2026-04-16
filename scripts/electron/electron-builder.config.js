const { resolveMacBuildOutputDir } = require('./builder-paths.cjs');

module.exports = {
    directories: {
        output: resolveMacBuildOutputDir()
    },
    files: [
        'electron/**/*',
        'js/**/*',
        'css/**/*',
        'data/**/*',
        'locales/**/*',
        'assets/**/*',
        'index.html',
        'steam_appid.txt'
    ],
    mac: {
        category: 'public.app-category.strategy-games',
        target: [
            {
                target: 'dmg',
                arch: ['arm64', 'x64']
            }
        ],
        hardenedRuntime: false
    },
    win: {
        target: [
            {
                target: 'nsis',
                arch: ['x64']
            }
        ]
    },
    linux: {
        target: ['AppImage'],
        category: 'Game'
    }
};
