type JSON = boolean | number | string | null | JSON[] | { [key: string]: JSON };

declare module "partial-json-parser" {
  function partialParse(input: string): JSON;
  export = partialParse;
}
