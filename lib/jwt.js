var jwt = require('jsonwebtoken');
var fs = require('fs-extra');
var logger = require('./logger');

// sign with RSA SHA256
/*
var cert = fs.readFileSync('private.key');  // get private key
var token = jwt.sign({ foo: 'bar' }, cert, { algorithm: 'RS256'});
*/

//test with sfpackage jwt getjwt username clientid [private.key]  -dvt

var getjwt = function(username, clientid, istest, certFile){
  var timenow = Math.floor(Date.now() / 1000);
  var expires = timenow + 300;
  var loginurl = istest ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
  var claims = {
    iat : timenow, // timenow= `TZ=EST5EDT date +%s` 
    iss : clientid, // clientid
    aud : loginurl, // loginurl
    sub : username, // username
    exp : expires  // expires=`expr $timenow + 300`
  }
  logger.dorv(claims);
  if(certFile){
    var cert = fs.readFileSync(certFile);
    return jwt.sign(claims, cert, { algorithm: 'RS256'});
  }
  return jwt.sign(claims, 'secret-didnotprovidecert');
}

module.exports.getjwt = getjwt;