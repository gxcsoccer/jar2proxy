'use strict';

require('../global');
const ProxyConfig = require('../../lib/proxy_config');
const path = require('path');
const assert = require('assert');
// const { getPlugins } = require('egg-utils');
const fs = require('fs-extra');

describe('test/lib/proxy_config.test.js', function() {

  it('normal', async function() {
    const baseDir = path.join(__dirname, '../fixtures/proxy-config-app');
    const proxyConfigPath = path.join(baseDir, 'config/proxy.js');
    // clear logs,node_modules then install node_modules
    // this.prepareApp(baseDir);
    const logger = require('../../lib/logger')(baseDir);
    const proxyConfig = new ProxyConfig({
      baseDir,
      proxyConfigPath,
      logger,
    });
    const config = proxyConfig.readConfig();
    assert(Array.isArray(config.dependencies));
    assert(config.dependencies.length === 3);
    const logPath = logger.getPath('info');
    const logStr = fs.readFileSync(logPath, 'utf-8');
    assert(logStr.includes('getPlugins failed.'));
  });

  it('merge plugin proxy config should ok', function() {
    const baseDir = path.join(__dirname, '../fixtures/plugin-proxy-config-app');
    const proxyConfigPath = path.join(baseDir, 'config/proxy.js');
    this.prepareApp(baseDir);
    const logger = require('../../lib/logger')(baseDir);
    // copy module egg-proxy-demo to node_modules
    fs.copySync(
      path.join(__dirname, '../fixtures/egg-proxy-demo-plugin'),
      path.join(baseDir, 'node_modules/egg-proxy-demo')
    );
    const proxyConfig = new ProxyConfig({
      baseDir,
      proxyConfigPath,
      logger,
    });
    const config = proxyConfig.readConfig();
    assert(config.dependencies.length === 7);
    assert(config.dependencies.filter(item => item.__fromPlugin).length === 3);
    assert(config.services.length === 3);
    assert(config.services.filter(item => item.appName === 'plugin-a1').length === 1);
  });

});
