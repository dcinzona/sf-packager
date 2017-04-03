var color = require('colors-cli/safe');
var _ = require('lodash');
var beautify = require("json-beautify");
var cardinal = require('cardinal');

// 0=silent, 1=info, 2=debug, 3=verbose
var logLevel = 0;
var _vorpal = false;
var vorpal = function (v) {
  _vorpal = v;
}

var setLogLevel = function (level) {
  logLevel = level;
};
var getLogLevel = function () {
  return logLevel;
};

var _log = function (text) {
  if (logLevel < 1) return text;
  this._vorpal ? this._vorpal.log(text) : console.log(text);
  //return text;
}

var stdout = function (text) {
  return _log(text);
}

var dorv = function (message, header) {
  if (logLevel < 2) return;
  logLevel == 2 ? debug(message, header) : verbose(message, header);
};

var verbose = function (message, header) {
  if (logLevel > 1) log(message, header);
}

var debug = function (message, header) {
  if (logLevel == 2) {
    !header ? _log(color.x230('[DEBUG] ' + (typeof message === typeof {} ? '\n' : '')) +
        parseMessage(message)) :
      _log(color.x229.underline(parseMessage(message)))
  }
}

var log = function (message, header) {
  !header ? _log(color.x253(parseMessage(message))) : _log(color.green.x34.underline(parseMessage(message)))
}

var error = function error(message) {
  return _log(color.red.bold('\n[ERROR] ') + parseMessage(message) + '\n');
}

var success = function (text) {
  if (logLevel < 1) return;
  return _log(formatSuccess(text));
};

var list = function (text, vals) {
  if (logLevel < 1) return;
  var li = '*'.list;
  return _log(li + ' ' + text);
};

var listError = function (text, vals) {
  if (logLevel < 1) return;
  var li = '*'.bad;
  return error(li + ' ' + text);
};

var create = function (text, vals) {
  if (logLevel < 1) return;
  var create = '[create] '.create;
  return _log(create + text);
};

var update = function (text, vals) {
  if (logLevel < 1) return;
  var update = '[update] '.update;
  return _log(update + text);
};

var destroy = function (text, vals) {
  if (logLevel < 1) return;
  var destroy = '[delete] '.destroy;
  return _log(destroy + text);
};

var noChange = function (text, vals) {
  if (logLevel < 1) return;
  var nochange = '[skipped] '.unchanged;
  return _log(nochange + text);
};

var done = function (ok) {
  if (logLevel < 1) return;
  ok = (typeof ok !== 'undefined') ? ok : true;

  if (ok) {
    _log('[OK]'.good);
  } else {
    _log('[NOT OK]'.bad);
  }
};

var parseMessage = function (message) {
  return typeof message === typeof {} ? //'\n' + 
    (cardinal.highlight(beautify(message, null, 2, 80))) + '\n' : message;
}

var formatLog = function (text) {
  var l = '[log] '.log;
  return l += text;
};

var formatError = function (text) {
  var l = '[err] '.bad;
  return l += text.bad;
};

var formatSuccess = function (text) {
  var l = '[log] '.log;
  return l += text.good;
};

var highlight = function (text) {
  if (!config.get('colorize')) {
    text = '*' + text + '*';
  } else {
    text = ('' + text).highlight;
  }
  return text;
};

var green = function (text) {
  if (config.get('colorize')) {
    text = ('' + text).good;
  }
  return text;
};

module.exports.setLogLevel = setLogLevel;
module.exports.getLogLevel = getLogLevel;
module.exports.dorv = dorv;
module.exports.verbose = verbose;
module.exports.log = log;
module.exports.info = log;
module.exports.debug = debug;
module.exports.success = success;
module.exports.error = error;
module.exports.list = list;
module.exports.listError = listError;
module.exports.done = done;
module.exports.setVorpal = vorpal;
module.exports.stdout = stdout;