// Test host integration. Production adapters must authenticate and authorize
// their store in trusted host/backend code, not trust identities from the View.
export function portAdapter(trustedOrigin, contract) {
  return async ({signal}) => {
    if (new URL(document.referrer).origin !== trustedOrigin) return undefined;
    const binding = await new Promise((resolve, reject) => {
      const cleanup = () => { window.removeEventListener('message', receive); signal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(signal.reason); };
      const receive = event => {
        if (event.source !== window.parent || event.origin !== trustedOrigin || event.data?.type !== 'snapshot-bound') return;
        cleanup(); resolve(event.data.supported ? {scope:event.data.scope,port:event.ports[0]} : undefined);
      };
      if (signal.aborted) { reject(signal.reason); return; }
      window.addEventListener('message', receive); signal.addEventListener('abort', abort, {once:true});
      window.parent.postMessage({type:'snapshot-bind'}, trustedOrigin);
    });
    if (!binding) return undefined;
    const pending = new Map();
    binding.port.onmessage = ({data}) => {
      const item = pending.get(data.id); if (!item) return;
      pending.delete(data.id);item.cleanup();
      if (data.error) item.reject(new Error('Snapshot store request failed'));
      else item.resolve(data.value);
    };
    signal.addEventListener('abort', () => {
      binding.port.close(); for (const item of pending.values()) {item.cleanup();item.reject(signal.reason);}pending.clear();
    }, {once:true});
    function request(method, args, options) {
      return new Promise((resolve,reject)=>{
        const id=crypto.randomUUID();
        const abort=()=>{pending.delete(id);binding.port.postMessage({type:'cancel',id});reject(options.signal.reason);};
        if(options.signal.aborted){reject(options.signal.reason);return;}
        const cleanup=()=>options.signal.removeEventListener('abort',abort);
        pending.set(id,{resolve,reject,cleanup});options.signal.addEventListener('abort',abort,{once:true});
        binding.port.postMessage({type:'request',id,method,args});
      });
    }
    return {...contract,store:{scope:binding.scope,
      read:options=>request('read',{},options),
      write:(snapshot,options)=>request('write',{snapshot,expectedRevision:options.expectedRevision},options),
      remove:options=>request('remove',{expectedRevision:options.expectedRevision},options),
    }};
  };
}
