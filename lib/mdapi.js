//Placeholder for metadata functionality (deployment, etc.)
var fs = require('fs');
var archiver = require('archiver');
var logger = require('./logger');
var vorpal = require('./vorpalCommands'),
    color = require('colors-cli/safe')
/*
var conn = new jsforce.Connection({
  instanceUrl : '<your Salesforce server URL (e.g. https://na1.salesforce.com) is here>',
  accessToken : '<your Salesforrce OAuth2 access token is here>'
});
*/

var createZip = function(directory, packageName, cb){
  if(!packageName) packageName = 'mdPackage.zip';
  if(!packageName.endsWith('.zip')) packageName += '.zip';
  var path = directory;
  if(!fs.existsSync(directory)){
    var err = logger.error('Directory not found: ' + color.x230(directory));
    return;
  }
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
    return logger.stdout(fs.realpathSync(output.path));
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

var deployZip = function(pathToZip, config){
  if(!fs.existsSync(pathToZip)){
    return false;
  }
  logger.log('Deploying ' + pathToZip, true);
  var zipStream = fs.createReadStream(pathToZip);
  return conn.metadata.deploy(zipStream, { singlePackage: true });
}

module.exports.zip = createZip;
module.exports.createZip = createZip;
module.exports.deploy = deployZip;
module.exports.deployZip = deployZip;