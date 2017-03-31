var jwt = require('jsonwebtoken');
var fs = require('fs-extra');
var logger = require('./logger');
var Client = require('node-rest-client').Client;

// sign with RSA SHA256
/*
var cert = fs.readFileSync('private.key');  // get private key
var token = jwt.sign({ foo: 'bar' }, cert, { algorithm: 'RS256'});
*/

//test with sfpackage jwt getjwt username clientid [private.key]  -dvt

var sign = function(username, clientid, istest, certFile){
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

var getToken = function(username, clientid, istest, certFile){
  var client = new Client();
  var loginurl = istest ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
  var tokenUrl = loginurl + '/services/oauth2/token';
  var args = {
    data : {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  sign(username, clientid, istest, certFile)
    },
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  };
  logger.verbose(args);
  client.post(tokenUrl, args, function (data, response) {
    // parsed response body as js object
    if(response.statusCode == 200){
      var access_token = data.access_token;
      var instance_url = data.instance_url;
      logger.info('Access Token', true);
      logger.info(access_token);
      logger.info('Instance URL', true);
      logger.info(instance_url);
      logger.debug(data);
    }else{
      logger.info('Error retrieving token', true);
      logger.error(data);
    }
  });
}

module.exports.sign = sign;
module.exports.getjwt = sign;
module.exports.token = getToken;
module.exports.getToken = getToken;