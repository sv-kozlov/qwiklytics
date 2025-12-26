// rollup.config.js
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';

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
    // Явно помечаем как external (peer deps / runtime deps)
    external: ['@builder.io/qwik'],
    plugins: [
        // Важно: node-resolve должен быть ДО replace
        resolve({
            extensions: ['.js', '.mjs', '.cjs'],
        }),
        replace({
            preventAssignment: true,
            __QWIKLYTICS_DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
        }),
    ],
};
