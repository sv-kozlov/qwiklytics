import { Store } from 'src/core/store';
const counter = new Store({
    name: 'counter',
    initialState: { count: 0 },
    actions: {
        inc(state, payload) {
            state.count += payload.by;
        },
        dec(state, payload) {
            state.count -= payload.by;
        },
    },
    selectors: {
        doubled(state) {
            return state.count * 2;
        },
    },
});
const unsubscribe = counter.subscribe(state => {
    console.log('[subscribe] state:', state);
});
const inc = counter.getAction('inc');
const dec = counter.getAction('dec');
const doubled = counter.getSelector('doubled');
console.log('initial:', counter.getState(), 'doubled:', doubled());
inc({ by: 2 });
console.log('after inc:', counter.getState(), 'doubled:', doubled());
dec({ by: 1 });
console.log('after dec:', counter.getState(), 'doubled:', doubled());
unsubscribe();
