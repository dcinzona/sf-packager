var color = require('colors-cli/safe');
var _ = require('lodash');

// 0=silent, 1=info, 2=debug, 3=verbose
var logLevel = 0;

var setLogLevel = function(level) {
  logLevel = level;
};

var dorv = function(message, header){
    if(logLevel < 2){
        return;
    }
    logLevel == 2 ? this.debug(message, header) : this.verbose(message, header);
};

var verbose = function(message, header){
    if(logLevel > 1){
        this.log(message, header);
    }
}

var debug = function(message, header){
    if(logLevel == 2){
        !header ? console.info('[DEBUG] ' + color.x230(parseMessage(message))) : 
          console.info(color.x229.underline(parseMessage(message)))
    }
}

var log = function(message, header){
    !header ? console.log(color.x253(parseMessage(message))) : console.log(color.green.x34.underline(parseMessage(message)))
}

var error = function error(message){
    if(logLevel < 1) return;
    return console.error(color.red(parseMessage(message)));
}

var success = function(text) {
  if(logLevel < 1) return;
  return console.log(formatSuccess(text));
};

var list = function(text, vals) {
  if(logLevel < 1) return;
  var li = '*'.list;
  return log(li + ' ' + text);
};

var listError = function(text, vals) {
  if(logLevel < 1) return;
  var li = '*'.bad;
  return error(li + ' ' + text);
};

var create = function(text, vals) {
  if(logLevel < 1) return;
  var create = '[create] '.create;
  return log(create + text);
};

var update = function(text, vals) {
  if(logLevel < 1) return;
  var update = '[update] '.update;
  return log(update + text);
};

var destroy = function(text, vals) {
  if(logLevel < 1) return;
  var destroy = '[delete] '.destroy;
  return log(destroy + text);
};

var noChange = function(text, vals) {
  if(logLevel < 1) return;
  var nochange = '[skipped] '.unchanged;
  return log(nochange + text);
};

var done = function(ok) {
  if(logLevel < 1) return;
  ok = (typeof ok !== 'undefined') ? ok : true;

  if(ok) {
    log('[OK]'.good);
  } else {
    log('[NOT OK]'.bad);
  }
};

var parseMessage = function(message){
  return typeof message == typeof {} ? JSON.stringify(message) : message;
}

var formatLog = function(text) {
  var l = '[log] '.log;
  return l += text;
};

var formatError = function(text) {
  var l = '[err] '.bad;
  return l += text.bad;
};

var formatSuccess = function(text) {
  var l = '[log] '.log;
  return l += text.good;
};

var highlight = function(text) {
  if(!config.get('colorize')) {
    text = '*' + text + '*';
  } else {
    text = ('' + text).highlight;
  }
  return text;
};

var green = function(text) {
  if(config.get('colorize')) {
    text = ('' + text).good;
  }
  return text;
};

module.exports.setLogLevel   = setLogLevel;
module.exports.dorv          = dorv;
module.exports.verbose       = verbose;
module.exports.log           = log;
module.exports.info          = log;
module.exports.debug         = debug;
module.exports.success       = success;
module.exports.error         = error;
module.exports.list          = list;
module.exports.listError     = listError;
module.exports.done          = done;