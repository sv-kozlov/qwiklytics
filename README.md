qwiklytics/
├── src/                      # Исходный код библиотеки
│   ├── core/                 # Ядро библиотеки
│   │   ├── store.ts          # Основной Store
│   │   ├── action.ts         # Система действий
│   │   ├── effect.ts         # Асинхронные эффекты
│   │   ├── selector.ts       # Селекторы с мемоизацией
│   │   └── middleware.ts     # Middleware система
│   ├── qwik/                 # Интеграция с Qwik
│   │   ├── integration.ts    # Базовая интеграция
│   │   └── hooks.ts          # Qwik хуки
│   ├── devtools/             # Инструменты разработки
│   │   ├── index.ts          # DevTools ядро
│   │   ├── panel.ts          # UI панель
│   │   └── extension.ts      # Расширение браузера
│   └── plugins/              # Плагины
│       ├── index.ts          # Экспорт всех плагинов
│       ├── persist.ts        # Persist plugin
│       └── history.ts        # Undo/Redo plugin
├── examples/                 ⬅️ ПАПКА С ПРИМЕРАМИ
│   ├── basic/                # Базовые примеры
│   │   ├── counter/          # Счетчик
│   │   │   ├── store.ts      # Store счетчика
│   │   │   ├── component.tsx # Компонент
│   │   │   └── README.md     # Объяснение
│   │   ├── todo/             # Todo приложение
│   │   ├── auth/             # Аутентификация
│   │   └── shopping-cart/    # Корзина покупок
│   ├── advanced/             # Продвинутые примеры
│   │   ├── realtime-chat/    # Чат в реальном времени
│   │   ├── dashboard/        # Дашборд с графиками
│   │   ├── offline-first/    # Оффлайн-приложение
│   │   └── multiplayer/      # Мультиплеерное состояние
│   ├── integrations/         # Интеграции
│   │   ├── with-rxjs/        # Qwiklytics + RxJS
│   │   ├── with-zustand/     # Qwiklytics + Zustand
│   │   └── with-effector/    # Qwiklytics + Effector
│   └── showcase/             # Демо-приложения
│       ├── ecommerce/        # Интернет-магазин
│       ├── social-media/     # Социальная сеть
│       └── project-manager/  # Менеджер проектов
├── test/                     # Тесты
│   ├── unit/                 # Юнит-тесты
│   ├── integration/          # Интеграционные тесты
│   └── e2e/                  # E2E тесты
├── docs/                     # Документация
│   ├── getting-started.md    # Начало работы
│   ├── api-reference.md      # API документация
│   ├── guides/               # Гайды
│   └── recipes/              # Рецепты
├── playground/               ⬅️ ИНТЕРАКТИВНАЯ ПЕСОЧНИЦА
│   ├── index.html            # Основная страница
│   ├── examples/             # Примеры для песочницы
│   └── config.js             # Конфигурация
├── package.json              # Конфигурация npm
├── tsconfig.json             # TypeScript конфигурация
├── vite.config.ts            # Конфигурация Vite
├── rollup.config.js          # Конфигурация Rollup
├── LICENSE                   # Лицензия
└── README.md                 # Основной README