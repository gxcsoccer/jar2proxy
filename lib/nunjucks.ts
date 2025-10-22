import * as nunjucks from 'nunjucks';
import { stringify } from 'cassandra-map';

interface Field {
  type?: string;
  generic?: Field[];
  arrayType?: boolean;
  arrayDepth?: number;
}

function getType(str: string, field?: Field, onlyBasis?: boolean): string {
  const generic = field?.generic;

  switch (str) {
    case 'boolean':
    case 'Boolean':
      return 'boolean';
    case 'String':
      return 'string';
    case 'short':
    case 'Short':
    case 'long':
    case 'Long':
    case 'Int':
    case 'int':
    case 'Integer':
    case 'float':
    case 'Float':
    case 'double':
    case 'Double':
    case 'BigDecimal':
      return 'number';
    case 'Void':
    case 'void':
      return 'void';
    case 'Date':
      return 'Date';
    case 'Map':
    case 'HashMap':
    case 'Properties':
    case 'Currency':
      if (Array.isArray(generic) && generic.length === 2) {
        const key = getType(splitLast(generic[0].type || '', '.'), generic[0], onlyBasis);
        const val = getType(splitLast(generic[1].type || '', '.'), generic[1], onlyBasis);
        return `{ [key: ${key === 'number' ? key : 'string'}]: ${val} }`;
      }
      return 'Object';
    case 'List':
    case 'ArrayList':
    case 'Collection':
      if (generic && generic.length && generic[0].type) {
        const val = getType(splitLast(generic[0].type, '.'), generic[0], onlyBasis);
        return `${val}[]`;
      }
      return 'any[]';
    case 'Set':
      if (generic && generic.length && generic[0].type) {
        const val = getType(splitLast(generic[0].type, '.'), generic[0], onlyBasis);
        return `Set<${val}>`;
      }
      return 'Set<any>';
    default:
      // T, K, V generic type
      return onlyBasis === true ? 'any' : str.length === 1 ? 'any' : str;
  }
}

function splitLast(str: string, sep: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const items = str.split(sep);
  return items[items.length - 1];
}

const filters = {
  stringify,
  toURL(val: string): string {
    return val.replace(/\./g, '/');
  },
  comment(text: string, indent?: number): string {
    text = (text || '').trim();

    if (!text) {
      return '';
    }

    indent = indent || 0; // spaces of indent
    const indentStr = new Array(indent + 2).join(' '); // indent string

    return (
      '/**\n' +
      indentStr +
      '* ' +
      text.replace(/\n/g, '\n' + indentStr + '*') +
      '\n' +
      indentStr +
      '*/'
    );
  },
  antx(val: string): string {
    val = val || '';
    const match = val.match(/^\${(.*)}$/);
    if (match && match[1]) {
      return "app.config['" + match[1] + "']";
    }
    return "'" + val + "'";
  },

  formatParams(str: string): string {
    return (str || '')
      .trim()
      .split(',')
      .filter((s) => !!s.trim())
      .map((s) => s.trim())
      .join(', ');
  },

  // return first param of arguments
  firstParam(str: string): string {
    return (str || '')
      .trim()
      .split(',')
      .filter((s) => !!s.trim())
      .map((s) => s.trim())[0];
  },

  arrayParam(str: string): string[] {
    return (str || '')
      .trim()
      .split(',')
      .filter((s) => !!s.trim())
      .map((s) => s.trim());
  },

  // split and return the last element
  splitLast,

  upperFirst(str: string): string {
    return str[0].toUpperCase() + str.substring(1);
  },

  lowerFirst(str: string): string {
    return str[0].toLowerCase() + str.substring(1);
  },

  getType(str: string, field?: Field, onlyBasis?: boolean): string {
    const type = getType(str, field, onlyBasis);
    let suffix = '';
    if (field?.arrayType) {
      for (let i = 0; i < (field.arrayDepth || 0); i++) {
        suffix += '[]';
      }
    }
    return type + suffix;
  },
};

const engine = nunjucks.configure({ autoescape: false, watch: false });

for (const k in filters) {
  engine.addFilter(k, (filters as any)[k]);
}

export default engine;
