
var vorpal = require('vorpal')(),
    color = require('colors-cli/safe'),
    fs = require('fs'),
    jsforce = require('jsforce'),
    logger = require('./logger'),
    config = require('./config'),
    jwt = require('./jwt'),
    mdapi = require('./mdapi'),
    build = require('./packager').build

vorpal.history('sfpackage');

vorpal
    .command('deploy <zipFile>')
    .action((args, cb) => {
      logger.setVorpal(this.log);
      var job = mdapi.deploy(args.zipFile, config);
      if(job){
        job.complete(function(err, result) {
          if (err) { 
            logger.error(err); 
          }else{
            logger.dorv('done ? :' + result.done);
            logger.dorv('success ? : ' + result.true);
            logger.dorv('state : ' + result.state);
            logger.dorv('component errors: ' + result.numberComponentErrors);
            logger.dorv('components deployed: ' + result.numberComponentsDeployed);
            logger.dorv('tests completed: ' + result.numberTestsCompleted);
          }
          cb();
        });
      }else{
          logger.error('File not found: ' + color.x230(args.zipFile) + '\nYou can create one by running `createZip <unpackedDirectory> [packageName]`')
          //cb(vorpal.execSync('createZip /?'));
          cb();
      }
    });

vorpal
    .command('createZip <unpackedDirectory> [packageName]')
    .option('-d, --delete', 'Delete the created zip.  Automatically sets log lever to DEBUG')
    .action((o, cb) => {
      var flags = o.options;
      if(flags.delete) logger.setLogLevel(2);
      logger.setVorpal(this.log);
      var output = mdapi.zip(o.unpackedDirectory, o.packageName, cb);
      output.on('close', function(){
        var path = fs.realpathSync(output.path);
        if(flags.delete){
          logger.log(color.red('\n[DELETED] ') + path + '\n');
          fs.unlinkSync(path);
        }
        //vorpal.show();
        cb(path);
      })
    });

vorpal
    .command('login-jwt <certPath> <username> <clientid>')
    .option('--prod', 'Sets loginurl to login.salesforce.com (production)')
    .action((o, cb) => {
      logger.setVorpal(this.log);
      var loginurl = o.prod ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
      jwt.getToken(o.username, o.clientid, !o.prod, o.certPath, function(response){
        if(response.error){
          cb(response);
        }else{
          config.conn = new jsforce.Connection({
            instanceUrl : response.instance_url,
            accessToken : response.access_token
          });
          cb(config);
        }
      })
    });

vorpal
    .command('login-pw <username> <password>')
    .option('--prod', 'Sets loginurl to login.salesforce.com (production)')
    .action((o, cb) => {
      logger.setVorpal(this.log);
      var loginurl = o.prod ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
      config.conn = new jsforce.Connection({
        // you can change loginUrl to connect to sandbox or prerelease env.
        loginUrl : loginurl
      });
      config.conn.login(o.username, o.password, function(err, userInfo) {
        if (err) { logger.error(err); cb(err); }
        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        logger.log(conn.accessToken);
        logger.log(conn.instanceUrl);
        // logged in user property
        logger.log("User ID: " + userInfo.id);
        logger.log("Org ID: " + userInfo.organizationId);
        config.setSession(o.username, conn.instanceUrl, conn.accessToken);
        cb(config);
      });
    });

var init = function(autorun){

  logger.log('\nStarting interactive session...');
  if(autorun){
      logger.log('\nAutomatically executing `' + autorun + '`');
      vorpal.execSync(autorun);
  } 
  vorpal
      .delimiter(color.yellow('sfpackage') + ' > ')
      .show();
}



module.exports.init = init;