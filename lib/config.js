
var vorpal = require('vorpal')();
vorpal.localStorage('sfpackage');

var setSession = function(username, data){
    vorpal.localStorage.setItem(username, JSON.stringify(data));
}
var getSession = function(username){
    var value;
    var valString = vorpal.localStorage.getItem(username);
    if(valString) value = JSON.parse(valString);
    return value;
}
var setJWT = function(username,cert,loginurl){
    vorpal.localStorage.setItem('JWT_'+username, JSON.stringify({
        username: username,
        secret:cert,
        loginurl:loginurl
    }));
}
var getJWT = function(username){
    var value;
    var valString = vorpal.localStorage.getItem('JWT_'+username);
    if(valString) value = JSON.parse(valString);
    return value;
}

var conn = false;

module.exports.setSession = setSession;
module.exports.getSession = getSession;
module.exports.setJWT = setJWT;
module.exports.getJWT = getJWT;
module.exports.conn = conn;