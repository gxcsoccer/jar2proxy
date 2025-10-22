import * as path from 'path';
import * as fs from 'fs';
import { request, RequestOptions } from 'urllib';
import copy from 'copy-to';
import xml2map from 'xml2map';
import type { DependencyConfig, Dependency as DependencyType, Logger } from '../types';

interface JarUrlHelper extends DependencyType {
  mavenRepository?: string | null;
  timestamp?: number;
  jarVersion?: string;
  sources?: boolean;
}

class Dependency {
  private config: DependencyConfig;
  private directoryToJar: string;
  private jarDir: string;
  private logger: Logger;

  constructor(config: DependencyConfig) {
    this.config = config;
    const { baseDir, directoryToJar, logger, jarDir } = this.config;

    this.directoryToJar = directoryToJar || path.join(baseDir, 'assembly');
    this.jarDir = jarDir;
    fs.mkdirSync(this.jarDir, { recursive: true });
    this.logger = logger;
  }

  async download(): Promise<void> {
    await this.execDownload();
  }

  private async execDownload(): Promise<void> {
    const jarUrls: Record<string, JarUrlHelper> = {};
    const { mavenRepository, dependencies } = this.config;

    for (const dependency of dependencies) {
      if (!dependency) {
        continue;
      }

      const key = dependency.artifactId + '-' + dependency.version;
      const helper: JarUrlHelper = {
        groupId: dependency.groupId,
        artifactId: dependency.artifactId,
        version: dependency.version,
        mavenRepository,
        timestamp: Date.now(),
        ignoreSources: dependency.ignoreSources,
      };

      // if mavenRepository is empty only try read file from local libs dir
      if (mavenRepository && /-SNAPSHOT$/i.test(helper.version)) {
        const metadataUrl = `${mavenRepository}/${helper.groupId.replace(/\./g, '/')}/${helper.artifactId}/${helper.version}/maven-metadata.xml`;
        this.logger.info('[jar2proxy] metadata %s', metadataUrl);

        const rvData = await this.request(
          metadataUrl,
          {
            method: 'GET',
            headers: {
              accept: '*/*',
              'accept-language': 'zh-CN,zh;',
            },
            timeout: 30000,
          },
          3
        );

        if (rvData.status === 200) {
          const dataStr = rvData.data?.toString() || '';
          (rvData as any).data = xml2map.tojson(dataStr);
        }

        this.logger.info('[jar2proxy] SNAPSHOT metadata: %j', rvData.data);

        if (!(rvData.data as any).metadata || !(rvData.data as any).metadata.versioning) {
          throw new Error(
            `Jar Not Found SNAPSHOT: ${helper.groupId}/${helper.artifactId}/${helper.version}`
          );
        }

        const versioning = (rvData.data as any).metadata.versioning;

        if (!versioning.snapshotVersions) {
          const snapshot = versioning.snapshot;
          const version = `${helper.version.replace('-SNAPSHOT', '')}-${snapshot.timestamp}-${snapshot.buildNumber}`;
          jarUrls[key + '.jar'] = copy({ jarVersion: version }).and(helper).to();
          if (!helper.ignoreSources) {
            jarUrls[key + '-sources.jar'] = copy({ jarVersion: `${version}-sources` })
              .and(helper)
              .to({ sources: true });
          }
        } else {
          const versions = versioning.snapshotVersions.snapshotVersion;
          const sources = versions.filter((v: any) => v.classifier === 'sources')[0];

          if (!sources) {
            throw new Error(
              `${key}-sources.jar is missing, Please contact the package administrator.`
            );
          }

          const jar = versions.filter((v: any) => !v.classifier)[0];
          jarUrls[key + '.jar'] = copy({ jarVersion: sources.value }).and(helper).to();
          if (!helper.ignoreSources) {
            jarUrls[key + '-sources.jar'] = copy({ jarVersion: `${jar.value}-sources` })
              .and(helper)
              .to({ sources: true });
          }
        }
      } else {
        jarUrls[key + '.jar'] = helper;
        if (!helper.ignoreSources) {
          jarUrls[key + '-sources.jar'] = copy({ jarVersion: `${helper.version}-sources` })
            .and(helper)
            .to({ sources: true });
        }
      }
    }

    await Promise.all(
      Object.keys(jarUrls).map((fileName) => this.createTask(jarUrls[fileName], fileName))
    );
  }

  private async createTask(helper: JarUrlHelper, fileName: string): Promise<void> {
    this.logger.info(this.jarDir, fileName);

    if (!helper.mavenRepository) {
      await this.createCopyTask(helper, fileName);
      return;
    }

    const startTime = Date.now();
    const filepath = path.join(this.jarDir, fileName);
    const jarUrl = `${helper.mavenRepository}/${helper.groupId.replace(/\./g, '/')}/${helper.artifactId}/${helper.version}/${helper.artifactId}-${helper.jarVersion || helper.version}.jar`;

    this.logger.info('downloading: %j %s', helper, jarUrl);

    const writeStream = fs.createWriteStream(filepath);
    const rvData = await this.request(
      jarUrl,
      {
        method: 'GET',
        headers: {
          accept: '*/*',
          'accept-language': 'zh-CN,zh;',
        },
        writeStream,
        timeout: 600 * 1000,
      },
      3
    );

    if (rvData.status !== 200) {
      throw new Error('Jar Not Found ' + jarUrl);
    }

    this.logger.info(
      '[jar2proxy] Downloaded %s %s %sms',
      jarUrl,
      rvData.status,
      Date.now() - startTime
    );
  }

  // try copy jar file from jarDir if mavenRepository empty
  private async createCopyTask(_helper: JarUrlHelper, fileName: string): Promise<void> {
    const filepath = path.join(this.jarDir, fileName);
    fs.copyFileSync(path.join(this.directoryToJar, fileName), filepath);
  }

  private async request(
    url: string,
    args: RequestOptions,
    retry: number
  ): Promise<{ status: number; data: any }> {
    retry--;

    try {
      const result = await request(url, args);
      return {
        status: result.status,
        data: result.data,
      };
    } catch (err: any) {
      if (retry <= 0) {
        throw err;
      }

      if (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ENETRESET') {
        console.warn(
          '[jar2proxy] request %s error: %s, retry after 100ms, left: %s',
          url,
          err,
          retry
        );
        console.error(err);
        return await this.request(url, args, retry);
      }

      throw err;
    }
  }
}

export default Dependency;
