// src/devtools/index.ts
interface DevToolsEvent {
  type: string;
  [key: string]: any;
}

class QwiklyticsDevTools {
  private events: DevToolsEvent[] = [];
  private listeners: Set<(event: DevToolsEvent) => void> = new Set();
  private isConnected = false;
  
  constructor() {
    this.setup();
  }
  
  private setup() {
    if (typeof window === 'undefined') return;
    
    // Создаем глобальный объект для DevTools
    (window as any).__QWIKLYTICS_DEVTOOLS__ = this;
    
    // Слушаем сообщения от расширения
    window.addEventListener('message', (event) => {
      if (event.data.source === 'qwiklytics-devtools-extension') {
        this.handleExtensionMessage(event.data);
      }
    });
    
    // Отправляем handshake расширению
    window.postMessage({
      source: 'qwiklytics-devtools',
      type: 'HANDSHAKE',
    }, '*');
  }
  
  public dispatch(event: DevToolsEvent) {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    });
    
    // Ограничиваем историю
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }
    
    // Уведомляем слушателей
    this.listeners.forEach(listener => listener(event));
    
    // Отправляем в расширение
    if (this.isConnected) {
      window.postMessage({
        source: 'qwiklytics-devtools',
        type: 'EVENT',
        event,
      }, '*');
    }
  }
  
  public subscribe(listener: (event: DevToolsEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  public getEvents() {
    return [...this.events];
  }
  
  public clear() {
    this.events = [];
  }
  
  private handleExtensionMessage(data: any) {
    switch (data.type) {
      case 'HANDSHAKE':
        this.isConnected = true;
        // Отправляем всю историю
        window.postMessage({
          source: 'qwiklytics-devtools',
          type: 'INIT',
          events: this.events,
        }, '*');
        break;
        
      case 'DISPATCH':
        // Обработка команд от DevTools
        this.handleDispatch(data.payload);
        break;
    }
  }
  
  private handleDispatch(payload: any) {
    // Здесь можно реализовать time travel и другие функции
    console.log('DevTools dispatch:', payload);
  }
}

// Экспортируем синглтон
export const devTools = new QwiklyticsDevTools();

// Хук для включения DevTools
export function enableQwiklyticsDevTools() {
  if (typeof window !== 'undefined') {
    // Загружаем расширение если есть
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/qwiklytics-devtools@latest/dist/extension.js';
    document.head.appendChild(script);
  }
  return devTools;
}