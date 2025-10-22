import * as path from 'path';
import * as fs from 'fs';
import { getPlugins } from 'egg-utils';
import assert from 'assert';
import type { ProxyConfig as ProxyConfigType, Logger, Service, Dependency } from './types';

interface Plugin {
  enable: boolean;
  path: string;
  name: string;
  version?: string;
}

interface ProxyConfigOptions {
  baseDir: string;
  proxyConfigPath: string;
  logger: Logger;
}

interface DependencyWithPlugin extends Dependency {
  __fromPlugin?: string;
}

interface ServiceWithDependency extends Service {
  dependency: DependencyWithPlugin[];
}

interface ProxyConfigWithPlugin extends Partial<ProxyConfigType> {
  __fromPlugin?: string;
  services: ServiceWithDependency[];
}

class ProxyConfig {
  private baseDir: string;
  private proxyConfigPath: string;
  private logger: Logger;
  private appProxyConfig!: ProxyConfigWithPlugin;
  private pluginProxyConfigs!: ProxyConfigWithPlugin[];
  private proxyConfig!: ProxyConfigType;

  constructor(options: ProxyConfigOptions) {
    const { baseDir, proxyConfigPath, logger } = options;
    assert(logger, "property logger can't be empty");
    assert(baseDir, "property baseDir can't be empty");
    assert(proxyConfigPath, "property proxyConfigPath can't be empty");
    this.baseDir = baseDir;
    this.proxyConfigPath = proxyConfigPath;
    this.logger = logger;
  }

  readConfig(): ProxyConfigType {
    const proxyConfig = require(this.proxyConfigPath) as ProxyConfigWithPlugin;
    const { eggFramework = 'egg' } = proxyConfig;
    this.logger.info('getPlugins %s %s', this.baseDir, eggFramework);

    let plugins: Record<string, Plugin> = {};

    try {
      plugins = getPlugins({
        baseDir: this.baseDir,
        framework: path.join(this.baseDir, 'node_modules', eggFramework),
      });
    } catch (err) {
      plugins = {};
      this.logger.info('getPlugins failed.');
      this.logger.error(err);
    }

    this.logger.info('getPlugins: %j', plugins);
    this.appProxyConfig = proxyConfig;
    this.pluginProxyConfigs = this.readPluginProxyConfig(plugins);
    this.proxyConfig = this.mergeProxyConfig();
    return this.proxyConfig;
  }

  private readPluginProxyConfig(plugins: Record<string, Plugin>): ProxyConfigWithPlugin[] {
    const proxyConfigs: ProxyConfigWithPlugin[] = [];

    for (const pluginName in plugins) {
      const plugin = plugins[pluginName];
      if (!plugin.enable) {
        continue;
      }

      const proxyPath = path.join(plugin.path, 'app/proxy');
      const configPath = path.join(plugin.path, 'config/proxy.js');

      // If plugin author pushed jar2proxy result files, jar2proxy will skip process when exec in application
      if (!fs.existsSync(proxyPath) && fs.existsSync(configPath)) {
        const pluginConfig = require(configPath) as ProxyConfigWithPlugin;
        pluginConfig.__fromPlugin = plugin.path;
        proxyConfigs.push(pluginConfig);
      }
    }

    return proxyConfigs;
  }

  // merge all plugin proxy config to app/config/proxy.js
  private mergeProxyConfig(): ProxyConfigType {
    // app/config/proxy.js
    let appConfig = this.appProxyConfig;

    // ${plugins}/config/proxy.js
    this.pluginProxyConfigs.forEach((pluginConfig) => {
      appConfig = this.mergePluginConfigToAppConfig(this.appProxyConfig, pluginConfig);
    });

    if (!Array.isArray(appConfig.services)) {
      throw new Error("proxyConfig.services can't be empty.");
    }

    const dependencies = this.mergeDependencies(appConfig);

    return {
      ...appConfig,
      dependencies,
    } as ProxyConfigType;
  }

  private mergePluginConfigToAppConfig(
    appConfig: ProxyConfigWithPlugin,
    pluginConfig: ProxyConfigWithPlugin
  ): ProxyConfigWithPlugin {
    const mergedConfig = { ...appConfig };
    const keys = ['group', 'responseTimeout', 'errorAsNull'];

    const mergeService = (pluginService: ServiceWithDependency) => {
      // 打标签，方便后面合并 jar 处理
      pluginService.dependency = Array.isArray(pluginService.dependency)
        ? pluginService.dependency
        : [pluginService.dependency as any];

      pluginService.dependency.forEach((item) => {
        if (!item) {
          return;
        }
        item.__fromPlugin = pluginConfig.__fromPlugin;
      });

      const targetService = mergedConfig.services.find(
        (mergedService) => mergedService.appName === pluginService.appName
      );

      if (targetService) {
        targetService.api = { ...targetService.api, ...pluginService.api };
        const diffDependency = pluginService.dependency.filter((pluginDepd) => {
          if (!pluginDepd) {
            return false;
          }
          const isSameDep = targetService.dependency.some(
            (appDepd) =>
              pluginDepd.groupId === appDepd.groupId &&
              pluginDepd.artifactId === appDepd.artifactId &&
              pluginDepd.version === appDepd.version
          );
          return !isSameDep;
        });
        targetService.dependency = targetService.dependency.concat(diffDependency);
      } else {
        mergedConfig.services.push(pluginService);
      }
    };

    for (const keyName in pluginConfig) {
      if (
        keys.some((item) => item === keyName) &&
        !Object.prototype.hasOwnProperty.call(mergedConfig, keyName)
      ) {
        (mergedConfig as any)[keyName] = (pluginConfig as any)[keyName];
        console.log(
          '[jar2proxy] `%s` not found in config/proxy.js use plugin config first [%s]',
          keyName,
          (mergedConfig as any)[keyName]
        );
      }

      if (keyName !== 'services') {
        continue;
      }

      pluginConfig.services.forEach(mergeService);
    }

    return mergedConfig;
  }

  private mergeDependencies(appConfig: ProxyConfigWithPlugin): DependencyWithPlugin[] {
    const tmpAppDependencies: DependencyWithPlugin[] = [];
    const appDependencies: DependencyWithPlugin[] = [];
    const pluginDependencies: DependencyWithPlugin[] = [];
    const services = appConfig.services;

    for (const service of services) {
      const depds = Array.isArray(service.dependency)
        ? service.dependency
        : [service.dependency as any];

      depds.forEach((depd) => {
        if (!depd) {
          return;
        }
        if (depd.__fromPlugin) {
          pluginDependencies.push(depd);
        } else {
          tmpAppDependencies.push(depd);
        }
      });
    }

    // check if app config had conflict depd config
    for (const depd of tmpAppDependencies) {
      if (
        appDependencies.find(
          (item) => item.groupId === depd.groupId && item.artifactId === depd.artifactId
        )
      ) {
        continue;
      }

      const result = tmpAppDependencies.filter(
        (item) => item.artifactId === depd.artifactId && item.groupId === depd.groupId
      );

      if (result.length >= 2) {
        const message = `
        App dependency "groupId:${depd.groupId}, artifactId:${depd.artifactId}" appeared twice, you should delete the old one!
        Problem dependencies: ${JSON.stringify(result, null, 2)}
        `;
        this.dependencyConflictCheck(result, message);
        appDependencies.push(result[0]);
      } else {
        appDependencies.push(depd);
      }
    }

    const pluginHasChecked: DependencyWithPlugin[] = [];

    pluginDependencies.forEach((pluginDepd) => {
      if (!pluginDepd) {
        return;
      }

      if (
        pluginHasChecked.find(
          (item) => item.groupId === pluginDepd.groupId && item.artifactId === pluginDepd.artifactId
        )
      ) {
        return;
      }

      const result = pluginDependencies.filter((item) => {
        if (!item || !pluginDepd) {
          return false;
        }
        return item.artifactId === pluginDepd.artifactId && item.groupId === pluginDepd.groupId;
      });

      const existInApp = appDependencies.find(
        (appDepd) =>
          appDepd.artifactId === pluginDepd.artifactId && appDepd.groupId === pluginDepd.groupId
      );

      if (result.length >= 2 && !existInApp) {
        const message = `
          Plugin dependency "groupId:${pluginDepd.groupId}, artifactId:${pluginDepd.artifactId}" appeared twice but not found in app, you can override plugin config with assign newer one in app!
          Problem dependencies: ${JSON.stringify(result, null, 2)}
        `;
        this.dependencyConflictCheck(result, message);
        appDependencies.push(result[0]);
      } else if (result.length === 1) {
        if (existInApp) {
          this.logger.info(
            '[jar2proxy] App and Plugin dependency conflict, default use app dependency first!'
          );
          this.logger.info(`Plugin dependency: ${JSON.stringify(pluginDepd, null, 2)}`);
          this.logger.info(`App dependency: ${JSON.stringify(existInApp, null, 2)}`);
        } else {
          appDependencies.push(pluginDepd);
        }
      }

      pluginHasChecked.push(pluginDepd);
    });

    return appDependencies;
  }

  private dependencyConflictCheck(dependencies: DependencyWithPlugin[], message: string): void {
    if (dependencies.length === 1) {
      return;
    }

    const versions: string[] = [];

    dependencies.forEach((depd) => {
      if (!versions.some((ver) => ver === depd.version)) {
        versions.push(depd.version);
      }
    });

    if (versions.length === 1) {
      // print the same depd, but do not stop task
      console.warn(message);
    } else {
      // multiple versions, break the task.
      throw new Error(message);
    }
  }
}

export default ProxyConfig;
