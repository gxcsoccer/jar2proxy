declare module 'mini-logger' {
  interface LoggerOptions {
    dir: string;
    categories?: string[];
    format?: string;
    flushInterval?: string;
    timestamp?: boolean;
    seperator?: string;
  }

  interface Logger {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    flush?: () => void;
  }

  function MiniLogger(options: LoggerOptions): Logger;

  export = MiniLogger;
}
