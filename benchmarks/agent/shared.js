export function state(page, scenario, extra = {}) {
  page.postMessage({ type: 'benchmark-state', scenario, sequence: page.data.sequence, ...extra });
}

export function next(page, scenario, data = {}, extra = {}) {
  const sequence = page.data.sequence + 1;
  page.setData({ ...data, sequence, odd: sequence % 2 === 1 });
  state(page, scenario, extra);
}
