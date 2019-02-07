const winston = require('winston');
const { LEVEL, MESSAGE } = require('triple-beam');

winston.addColors({
  foo: 'blue',
  bar: 'green',
  baz: 'yellow',
  foobar: 'red',
});

const consoleTransport = new winston.transports.Console({
  colorize: true,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf(info => {
      const printInfo = Object.assign({}, info)
      const { timestamp, message } = printInfo;
      delete printInfo.timestamp;
      delete printInfo.level;
      delete printInfo.message;
      const ts = timestamp.slice(0, 19).replace('T', ' ');
      return `${ts}: ${message.trim()} ${
        Object.keys(printInfo).length ? JSON.stringify(printInfo, null, 2) : ''
      }`;
    })
  )
});

/**
 * Custom logging method exposed to Winston to replace
 * usage of console._stderr which Firebase Functions does
 * not accept output from
 * @param {Object} info - TODO: add param description.
 * @param {Function} callback - TODO: add param description.
 * @returns {undefined}
 */
consoleTransport.log = function log(info, callback) {
  setImmediate(() => this.emit('logged', info));

  // Remark: what if there is no raw...?
  if (this.stderrLevels[info[LEVEL]]) {
    // console.error adds a newline
    console.error(info[MESSAGE]);

    if (callback) {
      callback(); // eslint-disable-line callback-return
    }

    return;
  } else if (this.consoleWarnLevels[info[LEVEL]]) {
    // console.warn adds a newline
    console.warn(info[MESSAGE]);

    if (callback) {
      callback(); // eslint-disable-line callback-return
    }
    return;
  }

  // console.log adds a newline.
  console.log(info[MESSAGE]);

  if (callback) {
    callback(); // eslint-disable-line callback-return
  }
}

module.exports = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [consoleTransport]
});
