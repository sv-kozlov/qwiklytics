// rollup.config.js
const input = {
    index: 'build/index.js',
    'devtools/index': 'build/devtools/index.js',
    'plugins/index': 'build/plugins/index.js',
    'qwik/hooks': 'build/qwik/hooks.js',
};

const makeOutput = (format) => ({
    dir: 'dist',
    format,
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'build',
    exports: 'named',
    entryFileNames: format === 'cjs' ? '[name].cjs' : '[name].js',
});

export default {
    input,
    output: [makeOutput('es'), makeOutput('cjs')],
};
