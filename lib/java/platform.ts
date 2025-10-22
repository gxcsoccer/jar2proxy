import * as os from 'os';

const osPlatform = os.platform();
let platform: 'osx' | 'linux' | 'win' | undefined;

switch (osPlatform) {
  case 'darwin':
    platform = 'osx';
    break;
  case 'linux':
  case 'freebsd':
    platform = 'linux';
    break;
  case 'win32':
  case 'cygwin':
    platform = 'win';
    break;
  default:
    break;
}

export default platform;
