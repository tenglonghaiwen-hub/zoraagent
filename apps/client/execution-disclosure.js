const states = new Map();

export function disclosureState(key, running) {
  let state = states.get(key);
  if (!state) {
    state = {open: running === true, running};
    states.set(key, state);
  } else if (running !== undefined && state.running !== running) {
    // Apply the automatic change only on a lifecycle transition.
    state.open = running;
    state.running = running;
  }
  return state;
}

export function bindExecutionDisclosure(panel, key, running) {
  const state = disclosureState(key, running);
  panel.open = state.open;
  panel.addEventListener('click', event => {
    const summary = event.target.closest?.('summary');
    if (!summary || summary.parentElement !== panel) return;
    event.preventDefault();
    state.open = !panel.open;
    panel.open = state.open;
  });
}
