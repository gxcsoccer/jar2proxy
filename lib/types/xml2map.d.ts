declare module 'xml2map' {
  interface Xml2Map {
    tojson: (xml: string) => any;
  }

  const xml2map: Xml2Map;
  export = xml2map;
}
