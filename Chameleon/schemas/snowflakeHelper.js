// Shared snowflake ID generator with automatic worker ID assignment
// Worker ID is derived from hostname + PID to ensure uniqueness across processes
// without requiring manual configuration

const crypto = require('crypto');
const os = require('os');
const Snowflake = require('snowflake-id').default;

// Generate unique mid (0-31, 5 bits) from hostname + PID
const mid = crypto.createHash('md5')
    .update(`${os.hostname()}-${process.pid}`)
    .digest()
    .readUInt8(0) % 32;

const snowflake = new Snowflake({ mid, offset: 0 });

module.exports = { snowflake, mid };
