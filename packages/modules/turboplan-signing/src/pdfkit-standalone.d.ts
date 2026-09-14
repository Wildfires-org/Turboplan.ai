// @types/pdfkit only declares the extensionless subpath
// "pdfkit/js/pdfkit.standalone". We import it with the explicit ".js" extension
// (required by Node ESM at runtime — see pdf-generator.ts), so re-declare that
// specifier as an alias of the typed one.
declare module "pdfkit/js/pdfkit.standalone.js" {
  import doc = require("pdfkit/js/pdfkit.standalone");
  export = doc;
}
