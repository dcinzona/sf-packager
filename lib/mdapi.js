//Placeholder for metadata functionality (deployment, etc.)
var fs = require('fs');
var archiver = require('archiver');
var jsforce = require('jsforce');
var logger = require('./logger');
var vorpal = require('./vorpalCommands');
/*
var conn = new jsforce.Connection({
  instanceUrl : '<your Salesforce server URL (e.g. https://na1.salesforce.com) is here>',
  accessToken : '<your Salesforrce OAuth2 access token is here>'
});
*/

var createZip = function(directory, packageName){
  if(!packageName) packageName = 'mdPackage.zip';
  if(!packageName.endsWith('.zip')) packageName += '.zip';
  // create a file to stream archive data to.
  var output = fs.createWriteStream(directory + '/../' + packageName); //save to parent
  var archive = archiver('zip', {
      zlib: { level: 6 } // Sets the compression level.
  });
  output.on('close', function() {
    logger.info('');
    logger.dorv('Archiver has been finalized and the output file descriptor has closed.');
    logger.dorv(archive.pointer() + ' total bytes\n');
    logger.info('Packaged Zip Successful', true);
    logger.info(fs.realpathSync(output.path));
  });
  archive.on('error', function(err) {
    logger.error(err.message);
    process.exit(1);
  });
  archive.pipe(output);
  archive.directory(directory);
  archive.finalize();
  return output;
}

var deployZip = function(pathToZip, opts){
  logger.log(pathToZip);
  var conn = new jsforce.Connection({
    serverUrl : '<your Salesforce server URL (e.g. https://na1.salesforce.com) is here>',
    sessionId : '<your Salesforce session ID is here>'
  });
  var zipStream = fs.createReadStream(pathToZip);
  conn.metadata.deploy(zipStream, { singlePackage: true })
    .complete(function(err, result) {
      if (err) { console.error(err); return; }
      logger.log('done ? :' + result.done);
      logger.log('success ? : ' + result.true);
      logger.log('state : ' + result.state);
      logger.log('component errors: ' + result.numberComponentErrors);
      logger.log('components deployed: ' + result.numberComponentsDeployed);
      logger.log('tests completed: ' + result.numberTestsCompleted);
    });
}

module.exports.zip = createZip;
module.exports.createZip = createZip;
module.exports.deploy = deployZip;
module.exports.deployZip = deployZip;