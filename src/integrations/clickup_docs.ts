import fetch from 'node-fetch';

const BASE = 'https://api.clickup.com/api/v3';

function headers(token: string) {
  return { Authorization: token, 'Content-Type': 'application/json' } as Record<string, string>;
}

export type DocSummary = { id: string; name?: string; key?: string; public_id?: string };
export type DocPage = { id: string; name?: string };

export async function listWorkspaceDocs(token: string, workspaceId: string): Promise<DocSummary[]> {
  const url = `${BASE}/workspaces/${workspaceId}/docs`;
  const resp = await fetch(url, { headers: headers(token) });
  if (!resp.ok) throw new Error(`ClickUp list docs failed: ${resp.status}`);
  const data: any = await resp.json();
  // Shape may be { docs: [...] }
  const raw = (data.docs || data.items || []) as any[];
  const docs = raw.map((d: any) => ({
    id: String(d.id),
    name: d.name,
    key: (d.key || d.short_id || d.secure_id || d.public_id) && String(d.key || d.short_id || d.secure_id || d.public_id),
    public_id: (d.public_id || d.secure_id) && String(d.public_id || d.secure_id),
  })) as DocSummary[];
  return docs;
}

async function resolveDocId(token: string, candidateId: string): Promise<string> {
  const ws = process.env.CLICKUP_WORKSPACE_ID;
  if (!ws) return candidateId;
  try {
    const docs = await listWorkspaceDocs(token, ws);
    const found = docs.find((d) => d.id === candidateId || d.key === candidateId || d.public_id === candidateId);
    return found?.id || candidateId;
  } catch {
    return candidateId;
  }
}

export async function listDocPages(token: string, docId: string): Promise<DocPage[]> {
  // If the provided docId is an app key like 2kzkjvng-35718, resolve to API id first
  const resolvedId = await resolveDocId(token, docId);

  const ws = process.env.CLICKUP_WORKSPACE_ID;
  const tryUrls = [
    `${BASE}/docs/${resolvedId}/pages`,
    ws ? `${BASE}/workspaces/${ws}/docs/${resolvedId}/pages` : undefined,
    `${BASE}/pages?doc_id=${encodeURIComponent(resolvedId)}`,
  ].filter(Boolean) as string[];

  for (const url of tryUrls) {
    const resp = await fetch(url, { headers: headers(token) });
    if (resp.ok) {
      const data: any = await resp.json();
      const pages = (data.pages || data.items || []).map((p: any) => ({ id: String(p.id), name: p.name })) as DocPage[];
      if (pages.length) return pages;
    }
  }
  throw new Error('ClickUp list doc pages failed: 404');
}

export async function getPageContentHtml(token: string, pageId: string): Promise<string> {
  // Try likely endpoint to fetch page content
  const ws = process.env.CLICKUP_WORKSPACE_ID;
  const urls = [
    `${BASE}/docs/pages/${pageId}`,
    `${BASE}/pages/${pageId}`,
    ws ? `${BASE}/workspaces/${ws}/docs/pages/${pageId}` : undefined,
  ].filter(Boolean) as string[];
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
