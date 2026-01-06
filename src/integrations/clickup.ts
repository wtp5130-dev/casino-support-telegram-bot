import fetch from 'node-fetch';

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

export type ClickUpTask = {
  id: string;
  name: string;
  text_content?: string; // sometimes present
  description?: string; // markdown/html
  url?: string;
};

export type ClickUpComment = {
  id: string;
  comment?: string;
  text?: string;
  user?: { username?: string };
  date?: string | number;
};

function authHeader(token: string) {
  return { Authorization: token } as Record<string, string>;
}

export async function fetchTasksFromList(token: string, listId: string): Promise<ClickUpTask[]> {
  const url = `${CLICKUP_BASE}/list/${listId}/task?include_closed=true&subtasks=true&order_by=updated&reverse=true&limit=100`;
  const resp = await fetch(url, { headers: authHeader(token) });
  if (!resp.ok) throw new Error(`ClickUp list tasks failed: ${resp.status}`);
  const data: any = await resp.json();
  const tasks: ClickUpTask[] = (data.tasks || []).map((t: any) => ({
    id: String(t.id),
    name: String(t.name || ''),
    description: t.description || '',
    url: t.url || `https://app.clickup.com/t/${t.id}`,
  }));
  return tasks;
}

export async function fetchTaskComments(token: string, taskId: string): Promise<ClickUpComment[]> {
  try {
    const url = `${CLICKUP_BASE}/task/${taskId}/comment`;
    const resp = await fetch(url, { headers: authHeader(token) });
    if (!resp.ok) {
      // Many workspaces restrict comments API; log and continue silently
      return [];
    }
    const data: any = await resp.json();
    const comments: ClickUpComment[] = (data.comments || []).map((c: any) => ({
      id: String(c.id),
      comment: c.comment_text || c.comment || '',
      text: c.text || '',
      user: { username: c.user?.username },
      date: c.date,
    }));
    return comments;
  } catch {
    return [];
  }
}
