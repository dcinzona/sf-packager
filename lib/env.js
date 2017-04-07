
var fs = require('fs'),
  jsforce = require('jsforce'),
  logger = require('./logger'),
  config = require('./config'),
  jwt = require('./jwt')
const fsAutocomplete = require('vorpal-autocomplete-fs');

module.exports = function(vorpal){

  vorpal
    .command('env show', 'Displays the currently saved org configs')
    .action((o, cb)=>{
      logger.setVorpal(this.log);
      cfg = config.read();
      if(!cfg || Object.keys(cfg).length == 0){
        logger.log('\nNo orgs configured yet.  Add one by running `'+logger.color.x45('env add <alias> [--default]')+'`\n');
        logger.dorv(cfg);
      }else{
        logger.log('Environment Config', true);
        logger.log(cfg);
      }
      cb();
    });

  vorpal
    .command('env update <alias>', 'Displays the currently saved org configs')
    .option('--cert <certPath>','Set the file path to the JWT Certificate')
    .option('--username <username>','Set the username')
    .option('--clientid <clientid>','Set the Client ID')
    .option('--jwt-or-pass <useJWT>', 'User JWT Bearer token or Username and Password',['JWT', 'Password'])
    .option('--production', 'Sets the login url to https://login.salesforce.com')
    .types({
            string: ['cert','username','clientid']
    })
    .action((o, cb)=>{
      logger.setVorpal(this.log);
      var alias = o.alias;
      var cfg = config.read();
      var orgConfig = config.getOrgConfig(alias);
      if(!orgConfig){
          logger.error('Could not find an org configuration with alias "'+logger.color.x45(o.alias)+'"');
          cb();
          return;
      }
      var opts = o.options;
      if(Object.keys(o.options).length == 0){
          vorpal.execSync('env update --help')
          cb();
          return;
      }
      if(opts.cert){
          if (fs.existsSync(opts.cert)) {
              var cert = fs.readFileSync(opts.cert);
              orgConfig["cert"] = opts.cert;
          }else{
              logger.error(`Certificate path is invalid: ${opts.cert}`)
              cb();
              return;
          }
      }
      if(opts.username){
          orgConfig["username"] = opts.username;
      }
      if(opts.clientid){
          orgConfig["clientid"] = opts.clientid;
      }
      if(opts["jwt-or-pass"]){
          orgConfig["jwt"] = opts["jwt-or-pass"] == 'JWT';
      }
      if(opts.production){
          orgConfig["sandbox"] = false;
      }
      cfg[alias] = orgConfig;
        logger.log(orgConfig);
        config.write(cfg, false);
        cb('Done');
    });


  vorpal
    .command('env add <alias>', 'Adds required parameters for connecting to Salesforce')
    .option('--default', 'Sets this alias as the default environment')
    .action((o, cb)=>{
      logger.setVorpal(this.log);
      vorpal.activeCommand
        .prompt(config.aliasQuestions())
        .then(function(a){
          var env = {
            alias : o.alias,
            default : o.options.default,
            answers : {
              "username" :a.username,
              "sandbox": a.sandbox,
              "clientid": a.clientid,
              "cert" : a.certPath,
              "jwt": a.jwt_or_pass == 'JWT'
            } 
          }
          var cfg = config.write(env, true);
          cb('Done');
        });
    });

  vorpal
    .command('env default [alias]', 'Sets or clears the default alias used for connecting to Salesforce')
    .action((o, cb)=>{
      logger.setVorpal(this.log);
      var cfg = config.read();
      if(o.alias){
        if(!config.getOrgConfig(o.alias)){
          logger.error('Could not find an org configuration with alias "'+logger.color.x45(o.alias)+'"')
        }else{
          cfg["default"] = o.alias;
          config.write(cfg,false)
          logger.success('Alias "' + logger.color.x45(o.alias) + '" set as default')
        }
      }else{
        delete cfg["default"];
        config.write(cfg,false);
        logger.success('Default alias has been removed');
      }
      cb();
    });

  vorpal
    .command('env remove <alias>')
    .action((o, cb)=>{
      logger.setVorpal(this.log);
      vorpal.activeCommand
        .prompt({
              type: 'confirm',
              name: 'remove',
              message: 'Are you sure you want to remove the alias '+ logger.color.x45(o.alias) +'? ',
              default: false
         })
        .then(function(a){
          if(a.remove){
            var cfg = config.read();
            if(cfg["default"] == o.alias) delete cfg["default"];
            if(cfg.hasOwnProperty(o.alias)){
              delete cfg[o.alias];
              config.write(cfg, false);
              logger.success('Alias "' + logger.color.x45(o.alias) + '" removed')
            }else{
              logger.error('Alias "' + logger.color.x45(o.alias)+ '" not found.  No action taken');
            }
          }
          cb();
        });
    });
}