# Frontend plugin API

`api.ts` defines the version 1 browser contract. A backend plugin registers a
`FrontendExtension` on `StandardExtensionPoints.FRONTEND`, containing a
self-contained ES module and an action handler. The authenticated session catalog
supplies only modules from that session's selected plugins. It is independent of
model tools and conversation payloads.

The module exports synchronous `activate(host)`, optionally returning a cleanup
function. Use `host.React` for React components and hooks, so the plugin shares
the application's React instance. Compile TypeScript/JSX before packaging; bundle
other dependencies into the module. Bare or relative imports are not resolved by
the blob module loader. Do not bundle another React instance.

```js
export function activate(host) {
  const { createElement: h, useState } = host.React;
  host.registerReferenceRenderer('JOB', function Job({ reference, context }) {
    const [details, setDetails] = useState(null);
    return h('button', {
      onClick: async () => setDetails(await context.invoke('status', { id: reference }))
    }, details === null ? reference : String(details));
  });
  host.registerPanel('jobs', 'conversation.footer', ({ context }) =>
    h('aside', null, context.session));
  return () => { /* dispose plugin-owned subscriptions, timers and resources */ };
}
```

Reference renderers replace matching `[TYPE:reference]` text in conversation and
Records. Panels appear at the conversation footer. Registrations are made during
activation, names are unique within a module, and conflicting reference types
are rejected. The module may register multiple components. Components receive
`context.session`, `context.agent`, `context.locale`, and
`context.invoke(action, arguments, optionalAbortSignal)`. Actions exchange JSON;
the backend handler receives the authenticated owner/session/agent scope and
must authorize access to its resources. It is not a model tool invocation.

The host aborts scoped requests and disposes registrations when leaving a
session/agent or unmounting the surface. Module load failures offer retry;
component render failures preserve the original reference. Components own their
pending/error states and should cancel component-specific requests on unmount.
Use `host.signal` for activation-level resource cleanup and a returned disposer
for subscriptions. Locale changes update component context without reactivation.

Frontend modules are trusted code executing in the application page, with normal
browser JavaScript access; the API is not a sandbox. Install only trusted plugin
packages. The server sends module source and action responses with `no-store`.

Use the host's semantic CSS tokens and public `ui-button`, `veto-plugin-inline`,
`veto-plugin-text`, and `veto-plugin-action` classes for consistent appearance.
Custom React elements and event handlers are supported; the API currently offers
reference mounts and `conversation.footer`, not arbitrary app route replacement.
