
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
          cb(result);
        });
      } else {
          //cb(vorpal.execSync('createZip /?'));
          cb(job);
      }
    });

vorpal
    .command('createZip <unpackedDirectory> [packageName]')
    .alias('zip')
    .option('-d, --delete', 'Delete the created zip.  Automatically sets log lever to DEBUG')
    .action((o, cb) => {
      var flags = o.options;
      if(flags.delete) logger.setLogLevel(2);
      logger.setVorpal(this.log);
      var output = mdapi.zip(o.unpackedDirectory, o.packageName, cb);
      if(output){
        output.on('close', function(){
          var path = fs.realpathSync(output.path);
          if(flags.delete){
            logger.log(color.red('\n[DELETED] ') + path + '\n');
            fs.unlinkSync(path);
          }
          cb();
        });
      } else{
        cb();
      }
    });

vorpal
    .command('login-jwt <certPath> <username> <clientid>')
    .option('--prod', 'Sets loginurl to login.salesforce.com (production)')
    .action((o, cb) => {
      logger.setVorpal(this.log);
      var loginurl = o.prod ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
      jwt.getToken(o.username, o.clientid, !o.prod, o.certPath, function(response){
        if(response.error){
          logger.dorv(response.error);
          cb();
        }else{
          config.conn = new jsforce.Connection({
            instanceUrl : response.instance_url,
            accessToken : response.access_token
          })
          cb();
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
        if (err) { return; }
        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        logger.log(conn.accessToken);
        logger.log(conn.instanceUrl);
        // logged in user property
        logger.log("User ID: " + userInfo.id);
        logger.log("Org ID: " + userInfo.organizationId);
        config.setSession(o.username, conn.instanceUrl, conn.accessToken);
        cb(config);
      }).catch(function(err){
        //logger.log((''+err).replace(/^Error: /,'\n')+'\n');
        logger.error((''+err).replace(/^Error: /,'')); cb();
      });
    });

var run = function(autorun){
  logger.log('\nStarting interactive session...');
  if(autorun.length > 0){
    var exec = autorun.join(' ').trim();
    logger.log('\nAutomatically executing `' + color.x6(exec) + '`\n');
    vorpal
      .exec(exec, function(err, data) {
        vorpal
            .delimiter(color.yellow('sfpackage') + ' > ')
            .show();
      });
  } else {
    vorpal
        .delimiter(color.yellow('sfpackage') + ' > ')
        .show();
  }
}



module.exports.run = run;