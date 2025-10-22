import platform from './platform';
import { join } from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import createDebug from 'debug';

const debug = createDebug('jar2proxy:javahome');

interface JavaHome {
  javahome: string;
  toolsPath: string;
}

function exec(cmd: string): string {
  return (execSync(cmd) || '').toString().replace('\n', '');
}

function osx(): JavaHome {
  let toolsPath = '';
  let javahome = (process.env.JAVA_HOME || '').trim();

  if (!javahome) {
    javahome = exec('/usr/libexec/java_home');
    debug('osx.libexec', javahome);
  }

  if (javahome) {
    if (fs.existsSync(javahome)) {
      javahome = fs.realpathSync(javahome);
      debug('osx.realpath', javahome);
    }

    // jdk1.6 toolsPath = join(javahome, '../Classes/classes.jar');
    // jdk1.7, jdk1.8 has different dir with mac
    // only support jdk1.8
    toolsPath = join(javahome, 'lib/tools.jar');

    if (!fs.existsSync(toolsPath)) {
      throw new Error(
        'lib/tools.jar not found in JAVA_HOME! Only support jdk1.8, javahome: ' + javahome
      );
    }
  }

  return {
    javahome,
    toolsPath,
  };
}

function linux(): JavaHome {
  let toolsPath = '';
  let javahome = (process.env.JAVA_HOME || '').trim();

  if (fs.existsSync(javahome)) {
    javahome = fs.realpathSync(javahome);
  }

  toolsPath = join(javahome, 'lib/tools.jar');

  return {
    javahome,
    toolsPath,
  };
}

function win(): JavaHome | null {
  let javahome = (process.env.JAVA_HOME || '').trim();

  if (javahome) {
    javahome = javahome.replace(/[\r\n]/g, '');
    return {
      javahome,
      toolsPath: join(javahome, 'lib/tools.jar'),
    };
  }

  const roots = ['C:/Program Files/Java', 'C:/Program Files (x86)/Java'];

  for (const root of roots) {
    if (fs.existsSync(root)) {
      const files = fs.readdirSync(root);
      for (const file of files) {
        if (/^jdk/.test(file)) {
          return {
            javahome: join(root, file),
            toolsPath: join(root, file, 'lib/tools.jar'),
          };
        }
      }
    }
  }

  return null;
}

let javaHomeConfig: JavaHome | null = null;

if (platform === 'osx') {
  javaHomeConfig = osx();
} else if (platform === 'linux') {
  javaHomeConfig = linux();
} else if (platform === 'win') {
  javaHomeConfig = win();
}

if (!javaHomeConfig || !fs.existsSync(javaHomeConfig.toolsPath)) {
  throw new Error(
    (javaHomeConfig?.toolsPath || 'JAVA_HOME') + " Can't be found or not correct!"
  );
}

export const { javahome, toolsPath } = javaHomeConfig;
export default javaHomeConfig;
