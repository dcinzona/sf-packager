var vorpal = require('vorpal')(),
    logger = require('./logger'),
        fs = require('fs'),
        jf = require("jsonfile");
const fsAutocomplete = require('vorpal-autocomplete-fs');

jf.spaces = 4
vorpal.localStorage('sfpackage');
var configFolder = './config/sfpackage';
var configpath = configFolder + '/orgs.json';

module.exports.questionsMap = {
    "username" : "username",
    "sandbox" : "sandbox",
    "clientid" : "clientid",
    "cert" : "certPath",
    "jwt" : "jwt_or_pass"
}

var setSession = function (username, data) {
    /*
    vorpal.localStorage.setItem(username, JSON.stringify(data));
    */
}
var getSession = function (username) {
    /*
    var value;
    var valString = vorpal.localStorage.getItem(username);
    if (valString) value = JSON.parse(valString);
    return value;
    */
}
var setJWT = function (username, cert, loginurl) {
    /*
    vorpal.localStorage.setItem('JWT_' + username, JSON.stringify({
        username: username,
        secret: cert,
        loginurl: loginurl
    }));*/
}
var getJWT = function (username) {
    /*
    var value;
    var valString = vorpal.localStorage.getItem('JWT_' + username);
    if (valString) value = JSON.parse(valString);
    return value;
    */
}
var clearJWT = function (username) {
    vorpal.localStorage.setItem('JWT_' + username, null);
    return;
}

var readConfig = function (){
    if(fs.existsSync(configpath)){
        var cfg = jf.readFileSync(configpath, {throws: false});
        if(cfg != null){
            return cfg;
        }
    }
    return null;
}

var writeConfig = function (obj, addEnvironment){
    var cfg = obj;
    if(addEnvironment){
        cfg = readConfig() || {};
        cfg[obj.alias] = obj.answers;
        cfg.default = obj.default ? obj.alias : cfg.default;
    }
    try{
        if(!fs.existsSync(configFolder)){
            try{
                fs.mkdirSync(configFolder);
            }catch(ex){
                if(ex.code != 'EEXIST'){
                    logger.error(JSON.stringify(ex));
                    return null;
                }
            }
        }
        jf.writeFileSync(configpath, cfg)
    }catch(ex){
        logger.error(JSON.stringify(ex));
    }
    return cfg;
}

var getOrgConfig = function(name){
    var cfg = readConfig();
    var org;
    if(!cfg){
        // add env
        return org;
    }
    if(name && name != 'default'){
        for (var prop in cfg) {
          if (cfg.hasOwnProperty(prop) && prop != 'default') {
            var obj = cfg[prop];
            if(prop == name || obj.username == name){
              org = obj;
              break;
            }
          } 
        }
      } else if(cfg.default){
            org = cfg[cfg.default];
            if(!org){
                //logger.error('Default org alias is invalid');
            }
        }
      return org;
}

var conn = false;

module.exports.setSession = setSession;
module.exports.getSession = getSession;
module.exports.setJWT = setJWT;
module.exports.getJWT = getJWT;
module.exports.clearJWT = clearJWT;
module.exports.read = readConfig;
module.exports.write = writeConfig;
module.exports.getOrgConfig = getOrgConfig;
module.exports.conn = conn;

module.exports.aliasQuestions = function(){
  return [
  {
    type: 'confirm',
    name: 'sandbox',
    message: 'Is this a sandbox? '
  },
  {
    type: 'list',
    name: 'jwt_or_pass',
    message: 'What method would you like to use to obtain an access token? ',
    choices: ['JWT','Username/Password']
  },
  {
    type: 'input',
    name: 'username',
    message: 'Username: ',
    validate: function (value) {
      var pass = value.length > 1;
      if (pass) {
        return true;
      }

      return 'Username is required';
    }
  },
  {
    type: 'input',
    name: 'clientid',
    message: 'Connected app Client ID: '
  },
  {
    type: 'input',
    name: 'certPath',
    message: 'Certificate to use to sign JWT (path to file): ',
    when: function (answers) {
      return answers.jwt_or_pass == 'JWT';
    },
    validate: function (value) {
      var pass = value.length > 1;
      if (pass) {
        return true;
      }

      return 'Certificate file path is required';
    }
  },
  {
    type: 'password',
    name: 'secret',
    message: 'Password: ',
    when: function (answers) {
      return answers.jwt_or_pass != 'JWT';
    }
  }
];
}