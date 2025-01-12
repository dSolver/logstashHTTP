'use strict';

/**
 * logstashHTTP appender sends JSON formatted log events to logstashHTTP receivers.
 */
const util = require('util');
const axios = require('axios');

function wrapErrorsWithInspect(items) {
  return items.map((item) => {
    if ((item instanceof Error) && item.stack) {
      return {
        inspect: function () {
          return `${util.format(item)}\n${item.stack}`;
        }
      };
    }

    return item;
  });
}

function format(logData) {
  return util.format.apply(util, wrapErrorsWithInspect(logData));
}

/**
 *
 * For HTTP (browsers or node.js) use the following configuration params:
 *   {
 *      "type": "@log4js-node/logstash-http",       // must be present for instantiation
 *      "application": "logstash-test",        // name of the application
 *      "logType": "application",        // type of the application
 *      "logChannel": "test",        // channel of the application
 *      "url": "http://lfs-server/_bulk",  // logstash receiver servlet URL
 *      "httpsAgent": https.Agent, // optional, offers finer control over how the logstash API is called
 *   }
 */
function logstashHTTPAppender(config) {
  const _config = {
    baseURL: config.url,
    timeout: config.timeout || 5000,
    headers: { 'Content-Type': 'application/x-ndjson' },
    withCredentials: true
  };
  
  if(config.httpsAgent){
    _config.httpsAgent = config.httpsAgent;
  }
  
  const sender = axios.create(_config);

  return function log(event) {
    const logstashEvent = [
      {
        index: {
          _index: config.application,
          _type: config.logType,
        },
      },
      {
        message: format(event.data),
        context: event.context,
        level: event.level.level / 100,
        level_name: event.level.levelStr,
        channel: config.logChannel,
        datetime: (new Date(event.startTime)).toISOString(),
        extra: {},
      },
    ];
    const logstashJSON = `${JSON.stringify(logstashEvent[0])}\n${JSON.stringify(logstashEvent[1])}\n`;

    // send to server
    sender.post('', logstashJSON)
      .catch((error) => {
        if (error.response) {
          console.error(`log4js.logstashHTTP Appender error posting to ${config.url}: ${error.response.status} - ${error.response.data}`);
          return;
        }
        console.error(`log4js.logstashHTTP Appender error: ${error.message}`);
      });
  };
}

function configure(config) {
  return logstashHTTPAppender(config);
}

module.exports.configure = configure;
