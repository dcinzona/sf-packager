#!/usr/bin/env node

/**
 * CLI tool to parse git diff and build a package.xml file from it.
 * This is useful for using the MavensMate deployment tool and selecting the existing package.xml file
 * Also used in larger orgs to avoid deploying all metadata in automated deployments
 *
 * usage:
 *  $ sfpackage master featureBranch ./deploy/
 *
 *  This will create a file at ./deploy/featureBranch/unpackaged/package.xml
 *  and copy each metadata item into a matching folder.
 *  Also if any deletes occurred it will create a file at ./deploy/featureBranch/destructive/destructiveChanges.xml
 */

var program = require('commander');
var vc = require('./lib/vorpalCommands');
var util = require('util'),
    spawnSync = require('child_process').spawnSync,
    cp = require('child_process'),
    packageWriter = require('./lib/metaUtils').packageWriter,
    buildPackageDir = require('./lib/metaUtils').buildPackageDir,
    copyFiles = require('./lib/metaUtils').copyFiles,
    packageVersion = require('./package.json').version,
    sprintf = require("sprintf-js").sprintf,
    color = require('colors-cli/safe'),
    typeOf = require('./lib/typeof'),
    git = require('./lib/git'),
    logger = require('./lib/logger'),
    jwt = require('./lib/jwt'),
    mdapi = require('./lib/mdapi'),
    build = require('./lib/packager').build

var options = {
    sourceBranch : false,
    targetBranch : false,
    commit : false,
    timeframe : false,
    output : false,
    packageName : false
}
// set initial log level
logger.setLogLevel(1);

program
    .command('since')
    .alias('s')
    .arguments( '<since> <targetBranch> [sourceBranch] [outputDirectory] [packageName]', 'Compare two branches')
    .description('Creates the package.xml file by comparing a target branch changes since a specified date')
    .action( function(since, targetBranch, sourceBranch, outputDirectory, packageName){
        if(!outputDirectory){
            outputDirectory = './deploy/';
        }
        if(!packageName){
            packageName = 'diff_'+targetBranch;
        }
        if(!sourceBranch){
            sourceBranch = git.branch().trim();
        }
        var spawn = git.spawnSync(since, targetBranch, sourceBranch);
        build(outputDirectory, spawn, packageName, program.dryrun);
    })

program
    .command('latest')
    .alias('l')
    .arguments( '<targetBranch> [sourceBranch] [outputDirectory] [packageName]', 'Compare two branches')
    .description('Creates the package.xml file by comparing the latest commit in two branches')
    .option('-f, --folder <outputDirectory>','Optionally specify output directory', './deploy/')
    .option('-p, --package <packageName>','Optionally specify the package name')
    .action( function(targetBranch, sourceBranch, outputDirectory, packageName){
        if(this.folder) outputDirectory = this.folder;
        if(!outputDirectory){
            outputDirectory = './deploy/';
        }
        if(this.package) packageName = this.package;
        if(!packageName){
            packageName = 'diff_'+targetBranch;
        }
        if(!sourceBranch){
            sourceBranch = git.branch().trim();
        }
        var spawn = git.spawnSync(false, targetBranch, sourceBranch);
        build(outputDirectory, spawn, packageName, program.dryrun);
    })

program
    .command('checkgit')
    .arguments('<cmd> [opts...]')
    .alias('g')
    .action(function(cmd, opts){
        //program.debug = true;
        logger.debug('\nOptions\n', true);
        logger.debug(sprintf('args: %j', opts));
        logger.log(git[cmd](opts));
        process.exit(0);
    });

program
    .command('jwt')
    .arguments('<cmd> <username> <clientid> [opts...]')
    .option('-t, --test', 'Sets loginurl to test.salesforce.com')
    .action(function(cmd, username, clientid, opts){
        //program.debug = true;
        logger.dorv('\nOptions\n', true);
        logger.dorv(sprintf('args: %j', opts));
        var data = opts ? jwt[cmd](username, clientid, this.test, opts[0]) : jwt[cmd](username, clientid, this.test);
        if(data) logger.log(data);
        return;
        //process.exit(0);
    });

program
    .command('mdapi')
    .arguments('<cmd> [opts...]')
    .option('-f, --filePath <filePath>', 'Path to zip file containing metadata package')
    .option('-p, --production', 'Sets loginurl to login.salesforce.com')
    .option('-c, --checkOnly', 'Sets loginurl to test.salesforce.com')
    .option('-j, --jwt', 'JWT Bearer token')
    .action(function(cmd, opts){
        //program.debug = true;
        if(cmd == 'createZip' || cmd == 'zip'){
            mdapi.zip(opts[0], opts[1]);
        }
        if(cmd == 'deploy' || cmd == 'deployZip'){
            mdapi.deployZip(opts[0], opts[1]);
        }
        return;
        //process.exit(0);
    });

program
    .command('createZip')
    .arguments('<unpackedDirectory> [packageName] [opts...]')
    .action(function(unpackedDirectory, packageName, opts){
        //program.debug = true;
        var output = mdapi.zip(unpackedDirectory, packageName);
        output.on('close', function(){
            process.exit(0);
        });
        return;
    });



program
    .version(packageVersion)
    .option('-d, --dryrun', 'Only print the package.xml and destructiveChanges.xml that would be generated')
    .option('-D, --debug', 'Show debug variables', function(){
        logger.setLogLevel(2);
    })
    .option('-v, --verbose', 'Use verbose logging', function(){
        logger.setLogLevel(3);
    })
    .option('--silent', 'skip logging', function(){
        logger.setLogLevel(0);
    })
    .option('-i, --interactive [autorun]', 'Enter interactive console', function(autorun){
        vc.init(autorun);
    });

function showHelp(missingArgs){
    if(missingArgs)
        logger.error('Error: Missing required arguments');
    program.help(); 
    process.exit(1);
}
/* */
program.parse(process.argv);
/* */
if (!program.args || !program.args.length) {
    //showHelp();
}
/* */