declare module 'egg-utils' {
  interface Plugin {
    enable: boolean;
    path: string;
    name: string;
    version?: string;
    package?: string;
  }

  interface GetPluginsOptions {
    baseDir: string;
    framework?: string;
  }

  export function getPlugins(options: GetPluginsOptions): Record<string, Plugin>;
}
