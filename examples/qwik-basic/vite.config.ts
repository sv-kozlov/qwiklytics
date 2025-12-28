// examples/qwik-basic/vite.config.ts
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import path from 'node:path';

export default defineConfig({
    plugins: [
        qwikVite({
            // Важно: разрешаем оптимайзеру обрабатывать файлы вне корня examples/qwik-basic
            // Здесь указываем корень репозитория (где лежит src/qwik/* твоей библиотеки)
            vendorRoots: [
                path.resolve(__dirname, '../../../src/qwik/'), // <-- корень qwiklytics (подстрой при необходимости)
            ],
        }),
    ],
});
