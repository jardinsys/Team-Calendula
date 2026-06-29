// Barrel re-exports for import modules
// Backward compatible: consumers can require('./import_functions') and get all the same names

const constants = require('./import/constants');
const r2_sync = require('./import/r2_sync');
const helpers = require('./import/helpers');
const pk = require('./import/import_pluralkit');
const tb = require('./import/import_tupperbox');
const sp = require('./import/import_simplyplural');
const oc = require('./import/import_octocon');
const auto = require('./import/import_autodetect');
module.exports = {
  ...auto,
  ...pk,
  ...tb,
  ...sp,
  ...oc,
};
