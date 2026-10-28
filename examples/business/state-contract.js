// Only this projection is persistable. Request handles, signals and host/model
// context are transient. The private draft is never part of catalog_state().
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const product = value => keys(value, ['sku','name','unitPrice','currency'])
  && typeof value.sku === 'string' && value.sku.length <= 100
  && typeof value.name === 'string' && value.name.length <= 200
  && Number.isFinite(value.unitPrice) && value.unitPrice >= 0 && value.currency === 'CNY';
export const catalogStateContract = {
  dataVersion: 1,
  validate(data, page) {
    if (!keys(data, ['catalog','draft']) || typeof data.draft !== 'string' || data.draft.length > 1000) return false;
    const c = data.catalog;
    return keys(c, ['instanceId','query','candidates','detail','selected','route','revision'])
      && typeof c.instanceId === 'string' && c.instanceId.length <= 100
      && typeof c.query === 'string' && c.query.length <= 100
      && Array.isArray(c.candidates) && c.candidates.length <= 100 && c.candidates.every(product)
      && (c.detail === null || product(c.detail)) && (c.selected === null || product(c.selected))
      && ['search','detail'].includes(c.route) && (c.route !== 'detail' || c.detail !== null)
      && page === (c.route === 'detail' ? 'pages/catalog/detail' : 'pages/catalog/index')
      && Number.isSafeInteger(c.revision) && c.revision >= 0;
  },
};
