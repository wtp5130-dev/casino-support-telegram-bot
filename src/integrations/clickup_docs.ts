import fetch from 'node-fetch';

const BASE = 'https://api.clickup.com/api/v3';

function headers(token: string) {
  return { Authorization: token, 'Content-Type': 'application/json' } as Record<string, string>;
}

export type DocSummary = { id: string; name?: string };
export type DocPage = { id: string; name?: string };

export async function listWorkspaceDocs(token: string, workspaceId: string): Promise<DocSummary[]> {
  const url = `${BASE}/workspaces/${workspaceId}/docs`;
  const resp = await fetch(url, { headers: headers(token) });
  if (!resp.ok) throw new Error(`ClickUp list docs failed: ${resp.status}`);
  const data: any = await resp.json();
  // Shape may be { docs: [...] }
  const docs = (data.docs || data.items || []).map((d: any) => ({ id: String(d.id), name: d.name })) as DocSummary[];
  return docs;
}

export async function listDocPages(token: string, docId: string): Promise<DocPage[]> {
  // Try likely endpoint
  let url = `${BASE}/docs/${docId}/pages`;
  let resp = await fetch(url, { headers: headers(token) });
  if (!resp.ok) {
    // Fallback: some APIs might use /pages?doc_id=
    url = `${BASE}/pages?doc_id=${encodeURIComponent(docId)}`;
    resp = await fetch(url, { headers: headers(token) });
    if (!resp.ok) throw new Error(`ClickUp list doc pages failed: ${resp.status}`);
  }
  const data: any = await resp.json();
  const pages = (data.pages || data.items || []).map((p: any) => ({ id: String(p.id), name: p.name })) as DocPage[];
  return pages;
}

export async function getPageContentHtml(token: string, pageId: string): Promise<string> {
  // Try likely endpoint to fetch page content
  const urls = [
    `${BASE}/docs/pages/${pageId}`,
    `${BASE}/pages/${pageId}`,
  ];
  for (const url of urls) {
    const resp = await fetch(url, { headers: headers(token) });
    if (resp.ok) {
      const data: any = await resp.json();
      const html = data.html || data.content || '';
      if (typeof html === 'string' && html.trim()) return html;
    }
  }
  throw new Error('Unable to fetch page content');
}
