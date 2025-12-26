import { component$, Slot } from '@builder.io/qwik';
import { StoreProvider } from './routes';

export default component$(() => {
    return (
        <StoreProvider>
            <Slot />
        </StoreProvider>
    );
});
