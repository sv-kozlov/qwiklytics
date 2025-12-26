qwiklytics/
├── src/                      # Исходный код библиотеки
│   ├── core/                 # Ядро библиотеки
│   │   ├── store.ts          # Основной Store
│   │   ├── action.ts         # Система действий
│   │   ├── effect.ts         # Асинхронные эффекты
│   │   ├── selector.ts       # Селекторы с мемоизацией
│   │   ├── types.ts          # Типы
│   │   └── middleware.ts     # Middleware система
│   ├── qwik/                 # Интеграция с Qwik
│   │   ├── integration.tsx   # Базовая интеграция
│   │   └── hooks.ts          # Qwik хуки
│   ├── devtools/             # Инструменты разработки
│   │   ├── index.ts          # DevTools ядро
│   │   ├── panel.ts          # UI панель
│   │   └── extension.ts      # Расширение браузера
│   └── plugins/              # Плагины
│       ├── index.ts          # Экспорт всех плагинов
│       ├── persist.ts        # Persist plugin
│       └── history.ts        # Undo/Redo plugin
├── package.json              # Конфигурация npm
├── tsconfig.json             # TypeScript конфигурация
├── vite.config.ts            # Конфигурация Vite
├── rollup.config.js          # Конфигурация Rollup
└── README.md                 # Основной README