import { execSync, spawnSync } from 'child_process';
import platform from './platform';
import { javahome, toolsPath } from './javahome';
import { join, delimiter, basename } from 'path';
import * as fs from 'fs';
import createDebug from 'debug';
import type { JarProcessorOptions, Logger, ProxyConfig } from '../types';

const debug = createDebug('jar2proxy:jar');

class JarProcessor {
  private logger: Logger;

  constructor(options: JarProcessorOptions) {
    this.logger = options.logger;
  }

  copyTo(jarFile: string, distdir: string): void {
    fs.copyFileSync(jarFile, join(distdir, basename(jarFile)));
  }

  /**
   * extract all jar files to target dir
   * @param jarFiles all fullpath jar
   * @param distdir target dir
   */
  extract(jarFiles: string[], distdir: string): void {
    debug('extract javahome: %s', javahome);
    const winprefix =
      platform === 'win' && /^\w:/.test(distdir) ? distdir.substring(0, 2) + ' && ' : '';
    const binjar = join(javahome, 'bin/jar');

    for (const jarFile of jarFiles) {
      if (!fs.existsSync(jarFile)) {
        console.log('[jar2proxy:extract] jar file not exists: %s.', jarFile);
        continue;
      }

      // #37 compatible with windows cross drive cd, d:/tmp
      const cmd = `${winprefix} cd ${distdir} && "${binjar}" -xf ${jarFile}`;
      debug('exec: %s', cmd);
      execSync(cmd, { encoding: 'utf8' });
    }
  }

  /**
   * parse
   * @param sourcesDir source code dir
   * @param proxyConfig proxy config
   * @return ast file path
   */
  parse(sourcesDir: string, proxyConfig: ProxyConfig): string {
    const astfile = join(sourcesDir, 'proxy-ast.json');
    const classpath: string[] = [];

    this.logger.info('[jar2proxy] javahome: %s', javahome);
    this.logger.info('[jar2proxy] toolsPath: %s', toolsPath);

    classpath.push(toolsPath);
    classpath.push(join(__dirname, '../../bin/libs/fastjson-1.2.48.jar'));
    classpath.push(join(__dirname, '../../bin/libs/log4j-core-2.11.1.jar'));
    classpath.push(join(__dirname, '../../bin/libs/log4j-api-2.11.1.jar'));
    classpath.push(join(__dirname, '../../bin/libs/astparser.jar'));

    const cmd: string[] = [];
    // Running the container sometimes initializes less than 256m of memory.
    cmd.push('-Xmx1024m');
    cmd.push('-Dfile.encoding=UTF-8');
    cmd.push('-Djava.awt.headless=true');
    cmd.push('-classpath');
    cmd.push(classpath.join(delimiter));
    cmd.push('com.ali.jar2proxy.astparser.AstParser');
    cmd.push('-source');
    cmd.push(sourcesDir);
    cmd.push('-output');
    cmd.push(astfile);

    const interfaceNames: string[] = [];
    proxyConfig.services.forEach((service) => {
      for (const facadeName in service.api) {
        const facade = service.api[facadeName];
        const interfaceName =
          typeof facade === 'string' ? facade.split(':')[0] : facade.interfaceName;

        if (!interfaceName || interfaceName.indexOf('.') === -1) {
          throw new Error(
            `Please config interface name [${facadeName}:${interfaceName}] at proxy.js with right package name`
          );
        }
        interfaceNames.push(interfaceName);
      }
    });

    cmd.push('-proxy');
    cmd.push(interfaceNames.join(':'));

    const bin = join(javahome, 'bin/java');
    this.logger.info('[jar2proxy] parse: %s %s', bin, cmd.join(' '));

    const result = spawnSync(bin, cmd, {
      stdio: 'pipe',
    });

    this.logger.info('%s', result.stdout);
    this.logger.info('%s', result.stderr);

    return astfile;
  }
}

export default JarProcessor;
