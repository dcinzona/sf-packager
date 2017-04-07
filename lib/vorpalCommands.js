const vorpal = require('vorpal')();
var color = require('colors-cli/safe'),
  fs = require('fs'),
  jsforce = require('jsforce'),
  logger = require('./logger'),
  config = require('./config'),
  jwt = require('./jwt'),
  mdapi = require('./mdapi'),
    git = require('./git'),
  build = require('./packager').build
  //autoExit = require('../index').autoExit;

module.exports = function(vorpal){

  var autoExit = false;

  vorpal.history('sfpackage');

  vorpal
    .command('deploy <zipFile>')
    .action((args, cb) => {
      logger.setVorpal(this.log);
      var job = mdapi.deploy(args.zipFile, config);
      if (job) {
        job.complete(function (err, result) {
          if (err) {
            logger.error(err);
          } else {
            logger.dorv('done ? :' + result.done);
            logger.dorv('success ? : ' + result.true);
            logger.dorv('state : ' + result.state);
            logger.dorv('component errors: ' + result.numberComponentErrors);
            logger.dorv('components deployed: ' + result.numberComponentsDeployed);
            logger.dorv('tests completed: ' + result.numberTestsCompleted);
          }
          if(autoExit) process.exit(0);
          cb(result);
        });
      } else {
        //cb(vorpal.execSync('createZip /?'));
        if(autoExit) process.exit(0);
        cb(job);
      }
    });

  vorpal
    .command('createZip <unpackedDirectory> [packageName]')
    .alias('zip')
    .option('-d, --delete', 'Delete the created zip.  Automatically sets log lever to DEBUG')
    .action((o, cb) => {
      logger.setVorpal(this.log);
      var flags = o.options;
      if (flags.delete) logger.setLogLevel(2);
      var output = mdapi.zip(o.unpackedDirectory, o.packageName, cb);
      if (output) {
        output.on('close', function () {
          var path = fs.realpathSync(output.path);
          if (flags.delete) {
            logger.log(color.red('\n[DELETED] ') + path + '\n');
            fs.unlinkSync(path);
            logger.setLogLevel(1);
          }
          if(autoExit) process.exit(0);
          cb();
        });
      } else {
          if(flags.exit){
            process.exit(0);
          }
        cb();
      }
    });

  vorpal
    .command('login-jwt <certPath> <username> <clientid>')
    .option('--prod', 'Sets loginurl to login.salesforce.com (production)')
    .action((o, cb) => {
      logger.setVorpal(this.log);
      var loginurl = o.options.prod ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
      jwt.getToken(o.username, o.clientid, !o.options.prod, o.certPath, function (response) {
        if (response.error) {
          logger.dorv(response.error);
          if(autoExit) process.exit(0);
          cb();
        } else {
          config.conn = new jsforce.Connection({
            instanceUrl: response.instance_url,
            accessToken: response.access_token
          })
          if(autoExit) process.exit(0);
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
        loginUrl: loginurl
      });
      config.conn.login(o.username, o.password, function (err, userInfo) {
        if (err) {
          if(autoExit) process.exit(0);
          return;
        }
        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        logger.log(conn.accessToken);
        logger.log(conn.instanceUrl);
        // logged in user property
        logger.log("User ID: " + userInfo.id);
        logger.log("Org ID: " + userInfo.organizationId);
        config.setSession(o.username, conn.instanceUrl, conn.accessToken);
        if(autoExit) process.exit(0);
        cb(config);
      }).catch(function (err) {
        //logger.log((''+err).replace(/^Error: /,'\n')+'\n');
        logger.error(('' + err).replace(/^Error: /, ''));
        if(autoExit) process.exit(0);
        cb();
      });
    });

  vorpal    
      .command('since <timespan> <targetBranch> [sourceBranch] [outputDirectory] [packageName]', 'Creates the package.xml file by comparing a target branch changes since a specified date')
      .option('-d,--displayOnly','This will output the contents of package.xml instead of writing to disk')
      .action((o, cb) => {
        logger.setVorpal(this.log);
        if (!o.outputDirectory) {
            o.outputDirectory = './deploy/';
        }
        if (!o.packageName) {
            o.packageName = 'diff_' + o.targetBranch;
        }
        if (!o.sourceBranch) {
            o.sourceBranch = git.branch().trim();
        }
        var spawn = git.spawnSync(o.since, o.targetBranch, o.sourceBranch);
        build(o.outputDirectory, spawn, o.packageName, o.options.displayOnly, function(msg){
          if(autoExit) process.exit(0);
          cb(msg);
        });
      });

  vorpal    
      .command('latest <targetBranch> [sourceBranch] [outputDirectory] [packageName]', 'Creates the package.xml file by comparing a target branch')
      .option('-d,--displayOnly','This will output the contents of package.xml instead of writing to disk')
      .action((o, cb) => {
        logger.setVorpal(this.log);
        if (!o.outputDirectory) {
            o.outputDirectory = './deploy/';
        }
        if (!o.packageName) {
            o.packageName = 'diff_' + o.targetBranch;
        }
        if (!o.sourceBranch) {
            o.sourceBranch = git.branch().trim();
        }
        var spawn = git.spawnSync(false, o.targetBranch, o.sourceBranch);
        build(o.outputDirectory, spawn, o.packageName, o.options.displayOnly, function(msg){
          if(autoExit) process.exit(0);
          cb(msg);
        })
      });

  vorpal
      .command('logmode [mode]')
      .autocomplete(['default','debug', 'verbose', 'silent'])
      .action((o,cb)=>{
        logger.setVorpal(this.log);
        logger.setLogLevel(1);
        vorpal
            .delimiter(color.yellow('sfpackage') + ' > ')
        if(o.mode == 'debug'){
          logger.setLogLevel(2);
          vorpal
              .delimiter(color.yellow('sfpackage[DEBUG]') + ' > ')
        }
        if(o.mode == 'verbose'){
          logger.setLogLevel(3);
          vorpal
              .delimiter(color.yellow('sfpackage[VERBOSE]') + ' > ')
        }
        if(o.mode == 'silent'){
          logger.setLogLevel(0);
          vorpal
              .delimiter(color.yellow('sfpackage[SILENT]') + ' > ')
        }
        cb();
      })
}