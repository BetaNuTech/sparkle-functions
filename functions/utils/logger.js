const winston = require('winston');

winston.addColors({
  foo: 'blue',
  bar: 'green',
  baz: 'yellow',
  foobar: 'red',
});

module.exports = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      colorize: true,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.align(),
        winston.format.printf(info => {
          const printInfo = Object.assign({}, info)
          const { timestamp, level, message } = printInfo;
          delete printInfo.timestamp;
          delete printInfo.level;
          delete printInfo.message;
          const ts = timestamp.slice(0, 19).replace('T', ' ');
          return `${ts} [${level}]: ${message.trim()} ${
            Object.keys(printInfo).length ? JSON.stringify(printInfo, null, 2) : ''
          }`;
        })
      )
    })
  ],
});
