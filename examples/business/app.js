import wx from 'wx';

// UI state belongs to this App realm, never to the shared headless Worker.
export default {
  onLaunch() {
    this.catalog = { instanceId: 'catalog-' + Math.random().toString(36).slice(2), query: '', candidates: [], detail: null, selected: null, route: 'search', revision: 0 };
    this.searchRevision = 0;
    this.privateDraft = '';
    this.restorationActive = false;
    this.restoredDetailRoot = false;
  },
  snapshot() { return JSON.parse(JSON.stringify(this.catalog)); },
  attach(page, route) { this.catalogPage = page; this.catalog.route = route; this.renderCatalog(); this.persistCatalog(); page.postMessage({type:'mcpkit:state-connect'}); },
  detach(page) { if (this.catalogPage === page) this.catalogPage = null; },
  backCatalog() {
    // A reconstructed detail page is the root, with no previous Page to pop.
    if (this.restoredDetailRoot) {
      this.restoredDetailRoot = false;
      wx.redirectTo({url:'/pages/catalog/index'});
    } else wx.navigateBack();
  },
  renderCatalog() {
    const state = this.catalog;
    this.catalogPage?.setData({ query: state.query, candidates: state.candidates,
      selectedName: state.selected ? state.selected.name : 'None',
      detailName: state.detail ? state.detail.name : '', detailPrice: state.detail ? state.detail.unitPrice : 0,
      detailSku: state.detail ? state.detail.sku : '', selectedSku: state.selected ? state.selected.sku : '',
      selectedPrice: state.selected ? state.selected.unitPrice : 0, empty: state.candidates.length === 0, status: '',
      draft: this.privateDraft, restorationActive: this.restorationActive, saveStatus: this.saveStatus || '' });
  },
  persistCatalog() {
    if (!this.restorationActive || !this.catalogPage) return;
    this.catalogPage.postMessage({ type:'mcpkit:state-save', restoreId:this.restorationId,
      page:this.catalog.route === 'detail' ? 'pages/catalog/detail' : 'pages/catalog/index',
      data:{catalog:this.snapshot(),draft:this.privateDraft} });
  },
  updateDraft(value) { this.privateDraft = value; this.catalogPage?.setData({draft:value}); this.persistCatalog(); },
  apply(tool, data, input) {
    if (tool === 'search_catalog' && Array.isArray(data.candidates)) {
      this.catalog.candidates = data.candidates; this.catalog.query = input.query;
    } else if (tool === 'inspect_catalog_product' && data.product) {
      this.catalog.detail = data.product;
      if (this.catalog.route !== 'detail') wx.navigateTo({ url: '/pages/catalog/detail' });
    } else if (tool === 'select_catalog_product' && data.selected) this.catalog.selected = data.selected;
    else return;
    this.catalog.revision++; this.renderCatalog(); this.persistCatalog();
  },
  receive(message) {
    if (message.type === 'mcpkit:restore-state') {
      this.restorationId = message.restoreId;
      this.restorationActive = message.supported;
      if (message.snapshot) {
        this.catalog = message.snapshot.data.catalog;
        this.privateDraft = message.snapshot.data.draft;
        this.restoredDetailRoot = this.catalog.route === 'detail';
      }
      this.renderCatalog();
      this.catalogPage?.postMessage({type:'mcpkit:state-ready',restoreId:this.restorationId});
      this.persistCatalog(); return;
    }
    if (message.type === 'mcpkit:state-status') {
      if (message.restoreId === this.restorationId) {
        this.saveStatus = message.status === 'saved' ? 'Saved for next time' : message.status === 'saving' ? 'Saving changes…' : message.status === 'error' ? 'Could not save changes' : '';
        this.catalogPage?.setData({saveStatus:this.saveStatus});
      }
      return;
    }
    if (message.type !== 'mcpkit:tool-result' || message.isError || !message.structuredContent) return;
    this.apply(message.tool, message.structuredContent, message.input || {});
  },
  async run(tool, input, signal) {
    // Latest search wins; a slow earlier search must not replace newer data.
    const revision = tool === 'search_catalog' ? ++this.searchRevision : undefined;
    const result = await this.getAgent().callTool(tool, input, { signal });
    signal?.throwIfAborted();
    if (result.isError) throw new Error(result.content?.[0]?.text || 'Catalog operation failed');
    if (revision === undefined || revision === this.searchRevision) this.apply(tool, result.structuredContent, input);
    return this.snapshot();
  },
  searchCatalog: ModelContext.defineAction({
    name: 'catalog_search', description: 'Search within THIS open catalog App. Preserve current detail page and selection. Do not open a new card.',
    inputSchema: {type:'object',properties:{query:{type:'string',maxLength:100}},required:['query'],additionalProperties:false},
    execute(input, {signal}) { return this.run('search_catalog', input, signal); },
  }),
  inspectCatalog: ModelContext.defineAction({
    name: 'catalog_inspect', description: 'Show a product detail in THIS catalog App, preserving its search and selection.',
    inputSchema: {type:'object',properties:{sku:{type:'string'}},required:['sku'],additionalProperties:false},
    execute(input, {signal}) { return this.run('inspect_catalog_product', input, signal); },
  }),
  selectCatalog: ModelContext.defineAction({
    name: 'catalog_select', description: 'Update selection in THIS catalog App without changing navigation. No purchase is made.',
    inputSchema: {type:'object',properties:{sku:{type:'string'}},required:['sku'],additionalProperties:false},
    execute(input, {signal}) { return this.run('select_catalog_product', input, signal); },
  }),
  catalogState: ModelContext.defineAction({
    name: 'catalog_state', description: 'Read THIS catalog App instance, navigation, search, detail and selection.',
    inputSchema: {type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true},
    execute() { return this.snapshot(); },
  }),
};
