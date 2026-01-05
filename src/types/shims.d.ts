declare module './admin/views/_ejsLayoutShim.js' {
  import type { Application } from 'express';
  export function ejsLayouts(app: Application): void;
}

declare module 'pdf-parse';
