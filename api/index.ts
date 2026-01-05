import serverless from 'serverless-http';
import { app, init } from '../src/app';

const handler = serverless(app);

export default async function(req: any, res: any) {
  await init();
  return handler(req, res);
}
