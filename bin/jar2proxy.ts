#!/usr/bin/env node

import { Command } from 'commander';
import Jar2proxy from '../lib/jar2proxy';
import createDebug from 'debug';

const debug = createDebug('jar2proxy:bin');

const program = new Command();

program
  .option('-b, --base <base>', 'the base directory of the project')
  .option('-t, --tpl <tpl>', 'path to template')
  .option('-c, --config <config>', 'appoint the proxy config file path')
  .allowUnknownOption()
  .parse(process.argv);

const options = program.opts();

const opts = {
  baseDir: options.base,
  defaultTpl: options.tpl,
  proxyConfigPath: options.config,
  isProduction: process.env.NODE_ENV === 'production',
};

debug('%j', opts);

const jar2proxy = new Jar2proxy(opts);

jar2proxy
  .run()
  .then(() => {
    console.log('[jar2proxy] Generated completed.');
    console.log(
      '[jar2proxy] You can see detail at %s/logs/jar2proxy-*.log',
      jar2proxy['config'].baseDir
    );
    setTimeout(() => {
      process.exit();
    }, 1000);
  })
  .catch((err) => {
    console.error('[jar2proxy] Error:', err);
    process.exit(1);
  });
