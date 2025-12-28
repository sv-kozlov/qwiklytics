import { jsx as _jsx } from "@builder.io/qwik/jsx-runtime";
import { component$, Slot } from '@builder.io/qwik';
import { StoreProvider } from './routes';
export default component$(() => {
    return (_jsx(StoreProvider, { children: _jsx(Slot, {}) }));
});
