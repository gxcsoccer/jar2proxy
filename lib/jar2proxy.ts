import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import assert from 'assert';
import JarProcessor from './java/jar';
import createDebug from 'debug';
import ProxyConfig from './proxy_config';
import Dependency from './maven/dependency';
import { globby } from 'globby';
import nunjucks from './nunjucks';
import createLogger from './logger';
import type {
  Jar2proxyOptions,
  Jar2proxyConfig,
  Logger,
  ProxyConfig as ProxyConfigType,
  ASTJson,
  ApiConfig,
} from './types';

const debug = createDebug('jar2proxy:jar2proxy');

interface DefaultApiOptions {
  tpl: string;
  group: string;
  version: string;
  port: number;
  responseTimeout: number;
}

const DEFAULT_API_OPTIONS: DefaultApiOptions = {
  tpl: 'proxy.js.tpl',
  group: 'HSF',
  version: '1.0',
  port: 12200,
  responseTimeout: 3000,
};

class Jar2proxy {
  private config: Jar2proxyConfig;
  private logger: Logger;
  private jarDir: string;
  private proxyConfig!: ProxyConfigType;
  private astjson!: ASTJson;
  private proxyDir!: string;
  private proxyClassDir!: string;

  constructor(options: Jar2proxyOptions) {
    const {
      proxyConfigPath = 'config/proxy.js',
      baseDir = process.cwd(),
      defaultTpl = 'proxy.js.tpl',
      isProduction = false,
    } = options;

    this.config = {
      baseDir,
      proxyConfigPath,
      defaultTpl,
      isProduction,
    };
    this.logger = createLogger(this.config.baseDir);
    debug('constructor %j', this.config);

    assert(fs.existsSync(baseDir), `Application baseDir not exists! ${baseDir}`);

    const configPath = path.join(baseDir, proxyConfigPath);
    assert(fs.existsSync(configPath), `Config file config/proxy.js not found! ${configPath}`);

    this.config.proxyConfigPath = configPath;
    this.jarDir = path.join(os.tmpdir(), Date.now().toString());
  }

  loadConfig(): ProxyConfigType {
    const { baseDir, proxyConfigPath } = this.config;
    const proxyConfig = new ProxyConfig({
      baseDir,
      proxyConfigPath,
      logger: this.logger,
    });
    const config = proxyConfig.readConfig();
    return config;
  }

  async run(): Promise<void> {
    try {
      const { baseDir } = this.config;
      const config = this.loadConfig();
      this.logger.info('%j', config);
      this.proxyConfig = config;

      const depd = new Dependency({
        baseDir,
        directoryToJar: config.directoryToJar,
        mavenRepository: config.mavenRepository,
        dependencies: config.dependencies,
        logger: this.logger,
        jarDir: this.jarDir,
      });

      await depd.download();
      await this.genAST(config);
      await this.renderByAST();
    } catch (err) {
      this.logger.error(err);
      if (this.logger.flush) {
        this.logger.flush();
      }
      console.log((err as Error).stack);
    }
  }

  private async genAST(proxyConfig: ProxyConfigType): Promise<void> {
    const jar = new JarProcessor({
      logger: this.logger,
    });

    const arr = await globby(['*-sources.jar'], {
      cwd: this.jarDir,
    });

    jar.extract(
      arr.map((jarName) => path.join(this.jarDir, jarName)),
      this.jarDir
    );

    const astfile = jar.parse(this.jarDir, proxyConfig);
    this.logger.info('[jar2proxy] astfile: %s', astfile);

    if (!fs.existsSync(astfile)) {
      throw new Error("Ast result file can't be found");
    }

    this.astjson = require(astfile);
  }

  private async renderByAST(): Promise<void> {
    this.proxyDir = path.join(this.config.baseDir, 'app/proxy');
    this.proxyClassDir = path.join(this.config.baseDir, 'app/proxy_class');

    fs.mkdirSync(this.proxyDir, { recursive: true });
    fs.mkdirSync(this.proxyClassDir, { recursive: true });

    fs.copyFileSync(
      path.join(__dirname, './tpls/proxy_class.js'),
      path.join(this.proxyClassDir, './index.js')
    );

    this.renderProxy();
    this.renderClass();
  }

  private renderProxy(): void {
    const defaultOptions: any = { ...DEFAULT_API_OPTIONS };
    defaultOptions.responseTimeout =
      this.proxyConfig.responseTimeout || defaultOptions.responseTimeout;
    defaultOptions.version = this.proxyConfig.version || defaultOptions.version;
    defaultOptions.group = this.proxyConfig.group || defaultOptions.group;
    defaultOptions.tpl = this.config.defaultTpl || defaultOptions.tpl;

    for (const appService of this.proxyConfig.services) {
      for (const apiName in appService.api) {
        const apiConfigValue = appService.api[apiName];
        const apiConfig: ApiConfig =
          typeof apiConfigValue === 'string'
            ? { interfaceName: apiConfigValue }
            : apiConfigValue;

        this.logger.info('[jar2proxy] render proxy %s: %s', apiName, apiConfig.interfaceName);

        const proxyAST = this.astjson.proxyMap[apiConfig.interfaceName];
        if (!proxyAST) {
          this.logger.info('[jar2proxy] proxy %s not found.', apiConfig.interfaceName);
          continue;
        }

        const proxyName = apiName.substring(0, 1).toLowerCase() + apiName.substring(1);
        const proxyModel = {
          ...defaultOptions,
          ...appService,
          ...apiConfig,
          proxyName,
          proxyProfile: proxyAST,
        };

        this.logger.info('[jar2proxy] render proxy with model: %j', proxyModel);

        const content = nunjucks.renderString(this.getTemplateStr(proxyModel.tpl), proxyModel);
        const proxyfile = path.join(this.proxyDir, proxyName) + '.js';

        this.logger.info('[jar2proxy] write proxy name to %s', proxyfile);
        fs.writeFileSync(proxyfile, content);
      }
    }
  }

  private renderClass(): void {
    for (const className in this.astjson.classMap) {
      const classfile = this.initClassPath(className);
      const classAST = this.astjson.classMap[className];
      this.logger.info('[jar2proxy] render class %s %j', className, classAST);

      const content = nunjucks.renderString(this.getTemplateStr('class.js.tpl'), {
        class: classAST,
      });
      fs.writeFileSync(classfile, content);
    }

    for (const className in this.astjson.enumMap) {
      const classfile = this.initClassPath(className);
      const enumAST = this.astjson.enumMap[className];
      this.logger.info('[jar2proxy] render enum %s %j', className, enumAST);

      const content = nunjucks.renderString(this.getTemplateStr('enum.js.tpl'), enumAST);
      fs.writeFileSync(classfile, content);
    }
  }

  private initClassPath(className: string): string {
    const args = className.split('.');
    args.unshift(this.proxyClassDir);
    args[args.length - 1] = args[args.length - 1] + '.js';

    const classfile = path.join(...args);
    fs.mkdirSync(path.dirname(classfile), { recursive: true });
    return classfile;
  }

  private getTemplateStr(name: string): string {
    if (path.isAbsolute(name)) {
      return fs.readFileSync(name, 'utf8');
    }

    const str = fs.readFileSync(path.join(__dirname, './tpls', name), 'utf8');
    return str;
  }
}

export default Jar2proxy;
