/**
 * TEMPORARY — Debug logging for import flows.
 * Remove before production deployment.
 */

const TAG = '🔍 [IMPORT]';

module.exports = {
    log: {
        trying(source, msg) {
            console.log('  ↳ 🔄 ' + TAG + ' [' + source + '] ' + msg + '...');
        },
        success(source, msg) {
            console.log('  ↳ ✅ ' + TAG + ' [' + source + '] ' + msg);
        },
        fail(source, msg, err) {
            console.error('  ↳ ❌ ' + TAG + ' [' + source + '] ' + msg, err?.message || err || '');
        },
        info(source, msg) {
            console.log('     ℹ️  ' + TAG + ' [' + source + '] ' + msg);
        },
        step(source, step, total, msg) {
            console.log('  ↳ 📦 ' + TAG + ' [' + source + '] [' + step + '/' + total + '] ' + msg);
        },
    }
};
