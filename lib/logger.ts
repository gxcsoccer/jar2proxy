import * as path from 'path';
import * as fs from 'fs';
import Logger from 'mini-logger';
import type { Logger as LoggerType } from './types';

/**
 * log all runtime info to jar2proxy-info.log
 * @param baseDir application dir
 * @return return logger instance
 */
export default function createLogger(baseDir: string): LoggerType {
  const logdir = path.join(baseDir, 'logs');
  fs.mkdirSync(logdir, { recursive: true });

  return Logger({
    dir: logdir,
    categories: ['info'],
    format: '[jar2proxy-{category}.]YYYY-MM-DD[.log]',
    flushInterval: '1ms',
    timestamp: true,
    seperator: '\n',
  });
}
