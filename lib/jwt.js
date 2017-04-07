var jwt = require('jsonwebtoken');
var fs = require('fs-extra');
var logger = require('./logger');
var Client = require('node-rest-client').Client;
var config = require('./config');

// sign with RSA SHA256
/*
var cert = fs.readFileSync('private.key');  // get private key
var token = jwt.sign({ foo: 'bar' }, cert, { algorithm: 'RS256'});
*/

//test with sfpackage jwt getjwt username clientid [private.key]  -dvt

var sign = function (username, clientid, loginurl, certFile) {
  var timenow = Math.floor(Date.now() / 1000);
  var expires = timenow + 300;
  //var loginurl = istest ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
  var claims = {
    iat: timenow, // timenow= `TZ=EST5EDT date +%s` 
    iss: clientid, // clientid
    aud: loginurl, // loginurl
    sub: username, // username
    exp: expires // expires=`expr $timenow + 300`
  };
  //logger.dorv(claims);
  if (certFile && certFile != "") {
    if (fs.existsSync(certFile)) {
      var cert = fs.readFileSync(certFile);
      //config.setJWT(username, cert, loginurl);
      return jwt.sign(claims, cert, {
        algorithm: 'RS256'
      });
    }
  }
  logger.error('Certificate "' + logger.color.x45(certFile) + '" was not found.');
  return {
    error: 'Certificate "' + logger.color.x45(certFile) + '" was not found.'
  };
}

var getToken = function (username, clientid, loginurl, certFile, cb) {
  var client = new Client();
  //var loginurl = istest ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
  var tokenUrl = loginurl + '/services/oauth2/token';
  var assertion = sign(username, clientid, loginurl, certFile);
  if (assertion.error) {
    //config.clearJWT(username);
    if (cb) cb({
      error: assertion.error
    });
    return;
  } else {
    var args = {
    data: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: sign(username, clientid, loginurl, certFile)
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  };
  logger.dorv(args);
  client.post(tokenUrl, args, function (data, response) {
    // parsed response body as js object
    if (response.statusCode == 200) {
      var access_token = data.access_token;
      var instance_url = data.instance_url;
      logger.dorv('Instance URL', true);
      logger.dorv(instance_url);
      logger.dorv('Access Token', true);
      logger.dorv(access_token);
      logger.verbose(data);
      if (cb) cb(data);
    } else {
      logger.error('Unable to retrieve access token: ' + data.error.trim());
      //config.clearJWT(username);
      if (cb) cb({
        error: data
      });
    }
  });
  }
}

var checkExpired = function (username) {
  //check if token info is stored in session - if not, try to create a new token. 
  //if new token creation fails, clear saved login info and prompt user for login again
  //JWT does not have a refresh token, so we must generate a new JWT every time we talk to sfpackage

}

module.exports.sign = sign;
module.exports.getToken = getToken;