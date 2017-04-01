
var vorpal = require('vorpal')();
vorpal.localStorage('sfpackage');

var setSession = function(username, instance, token){
    var value = {
        instance_url : instance,
        access_token : token
    }
    vorpal.localStorage.setItem(username, JSON.stringify(value));
}
var getSession = function(username){
    var value;
    var valString = vorpal.localStorage.getItem(username);
    if(valString) value = JSON.parse(valString);
    return value;
}

var conn = false;

module.exports.setSession = setSession;
module.exports.getSession = getSession;
module.exports.conn = conn;