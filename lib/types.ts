export interface ProxyConfig {
  eggFramework?: string;
  directoryToJar?: string;
  mavenRepository?: string | null;
  group?: string;
  version?: string;
  responseTimeout?: number;
  dependencies: Dependency[];
  services: Service[];
}

export interface Service {
  appName: string;
  group?: string;
  version?: string;
  responseTimeout?: number;
  api: Record<string, string | ApiConfig>;
}

export interface ApiConfig {
  interfaceName: string;
  version?: string;
  group?: string;
  port?: number;
  responseTimeout?: number;
  tpl?: string;
}

export interface Dependency {
  groupId: string;
  artifactId: string;
  version: string;
  ignoreSources?: boolean;
}

export interface Jar2proxyOptions {
  proxyConfigPath?: string;
  baseDir?: string;
  defaultTpl?: string;
  isProduction?: boolean;
}

export interface Jar2proxyConfig {
  baseDir: string;
  proxyConfigPath: string;
  defaultTpl: string;
  isProduction: boolean;
}

export interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  flush?: () => void;
}

export interface ASTJson {
  proxyMap: Record<string, ProxyAST>;
  classMap: Record<string, ClassAST>;
  enumMap: Record<string, EnumAST>;
}

export interface ProxyAST {
  interfaceName: string;
  methods: MethodAST[];
}

export interface MethodAST {
  name: string;
  returnType: string;
  parameters: ParameterAST[];
}

export interface ParameterAST {
  name: string;
  type: string;
}

export interface ClassAST {
  className: string;
  fields: FieldAST[];
}

export interface FieldAST {
  name: string;
  type: string;
}

export interface EnumAST {
  className: string;
  values: string[];
}

export interface DependencyConfig {
  baseDir: string;
  directoryToJar?: string;
  mavenRepository?: string | null;
  dependencies: Dependency[];
  logger: Logger;
  jarDir: string;
}

export interface JarProcessorOptions {
  logger: Logger;
}
