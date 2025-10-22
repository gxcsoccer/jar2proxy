declare module 'copy-to' {
  function copy<T extends Record<string, any>>(obj: T): {
    and: <U extends Record<string, any>>(target: U) => {
      to: <V extends Record<string, any>>(extra?: V) => T & U & V;
    };
  };

  export = copy;
}
