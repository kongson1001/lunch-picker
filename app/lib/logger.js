import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_PATH = join(process.cwd(), 'data', 'access.log');

export function writeLog(entry) {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    console.error('[logger] 로그 쓰기 실패:', e.message);
  }
}
