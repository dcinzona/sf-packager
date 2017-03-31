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
    jwt = require('./lib/jwt');

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
        execute(outputDirectory, spawn, packageName, program.dryrun);
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
        execute(outputDirectory, spawn, packageName, program.dryrun);
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
    });

function execute(outputDir, gitDiff, deploymentFolder, dryrun){
    
        if(!gitDiff){
            process.exit(1);
        }

        if (!dryrun && !outputDir) {
            outputDir = './deploy';
            logger.debug(sprintf("using default target %s", outputDir));
        }

        var target = outputDir;

        var currentDir = process.cwd();
        var gitDiffStdOut = gitDiff.stdout.toString('utf8');
        var gitDiffStdErr = gitDiff.stderr.toString('utf8');

        if (gitDiffStdErr) {
            logger.error(sprintf('An error has occurred: %s', gitDiffStdErr));
            process.exit(1);
        }

        var fileListForCopy = [],
            fileList = [];

        //defines the different member types
        var metaBag = {};
        var metaBagDestructive = {};
        var deletesHaveOccurred = false;

        fileList = gitDiffStdOut.split('\n');

        if(fileList.length == 1 && fileList[0] == '') {
            logger.info('\nFiles detected as changed\n', true);
            logger.info('No changes detected...exiting', false);
            process.exit(0);
        }
        else if(program.verbose || program.debug){
            var otherFiles = [];
            fileList.forEach(function (fileName, index) {
                var operation = fileName.slice(0,1);
                fileName = fileName.slice(1).trim();
                var op = operation == 'A' ? color.cyan('Added') : operation == 'M' ? color.yellow('Modified') : operation == 'D' ? color.red('Deleted') : sprintf('[%s]',operation);
                if(!fileName.startsWith('src/') & fileName != ''){
                    otherFiles.push(sprintf('%s %s', op, fileName))
                }
            });
            otherFiles.forEach(function(f,i){
                if(i == 0)
                    logger.dorv('\nNon-Salesforce files detected as changed\n', true);
                logger.dorv(f);
            });
        }
        var displayedSFHEader = false;
        fileList.forEach(function (fileName, index) {
            // get the git operation
            var operation = fileName.slice(0,1);
            // remove the operation and spaces from fileName
            fileName = fileName.slice(1).trim();
            //ensure file is inside of src directory of project
            if (fileName && fileName.substring(0,3) === 'src') {

                //ignore changes to the package.xml file
                if(fileName === 'src/package.xml') {
                    return;
                }

                var parts = fileName.split('/');
                // Check for invalid fileName, likely due to data stream exceeding buffer size resulting in incomplete string
                // TODO: need a way to ensure that full fileNames are processed - increase buffer size??
                if (parts[2] === undefined) {
                    logger.error(sprintf('\nFile name "%s" cannot be processed, exiting', fileName));
                    process.exit(1);
                }

                var meta;

                if (parts.length === 4) {
                    // Processing metadata with nested folders e.g. emails, documents, reports
                    meta = parts[2] + '/' + parts[3].split('.')[0];
                } else {
                    // Processing metadata without nested folders. Strip -meta from the end.
                    meta = parts[2].split('.')[0].replace('-meta', '');
                }

                if (operation === 'A' || operation === 'M') {
                    if(!displayedSFHEader) {
                        logger.dorv('\nSalesforce source files detected as changed\n', true);
                        displayedSFHEader = true;
                    }
                    // file was added or modified - add fileName to array for unpackaged and to be copied
                    var op = operation == 'A' ? color.cyan('Added') : operation == 'M' ? color.yellow('Modified') : operation == 'D' ? color.red('Deleted') : sprintf('[%s]',operation);
                    logger.dorv(sprintf('%s %s', op, fileName));
                    fileListForCopy.push(fileName);

                    if (!metaBag.hasOwnProperty(parts[1])) {
                        metaBag[parts[1]] = [];
                    }

                    if (metaBag[parts[1]].indexOf(meta) === -1) {
                        metaBag[parts[1]].push(meta);
                    }
                } else if (operation === 'D') {
                    if(!displayedSFHEader) {
                        logger.dorv('\nSalesforce source files detected as changed\n', true);
                        displayedSFHEader = true;
                    }
                    // file was deleted
                    logger.dorv(sprintf('%s %s',color.red('Deleted'), fileName));
                    deletesHaveOccurred = true;

                    if (!metaBagDestructive.hasOwnProperty(parts[1])) {
                        metaBagDestructive[parts[1]] = [];
                    }

                    if (metaBagDestructive[parts[1]].indexOf(meta) === -1) {
                        metaBagDestructive[parts[1]].push(meta);
                    }
                } else {
                    // situation that requires review
                    return logger.error(sprintf('Operation on file needs review: %s', fileName));
                }
            }
        });

        //build package file content
        var packageXML = packageWriter(metaBag);
        //build destructiveChanges file content
        var destructiveXML = packageWriter(metaBagDestructive);
        if (dryrun) {
            logger.info('\nResulting package.xml\n', true);
            logger.info(packageXML);
            logger.info('\nResulting destructiveChanges.xml\n', true);
            logger.info(destructiveXML);
            process.exit(0);
        }
        logger.info(sprintf('\nBuild log'), true);
        logger.info(sprintf('\nBuilding in directory %s', target));

        if(!deploymentFolder){
            logger.error('\nError: output folder was undefined');
            process.exit(1);
        }
        logger.info(sprintf('Saving deployment to folder: %s', deploymentFolder));
        
        buildPackageDir(target, deploymentFolder, metaBag, packageXML, false, (err, buildDir) => {

            if (err) {
                return logger.error(err);
            }

            copyFiles(currentDir, buildDir, fileListForCopy);
            logger.info(sprintf('Successfully created package.xml and files in %s',buildDir));

        });

        if (deletesHaveOccurred) {
            buildPackageDir(target, deploymentFolder, metaBagDestructive, destructiveXML, true, (err, buildDir) => {

                if (err) {
                    return logger.error(err);
                }

                logger.info(sprintf('Successfully created destructiveChanges.xml in %s',buildDir));
            });
        }
}

function showHelp(missingArgs){
    if(missingArgs)
        logger.error('Error: Missing required arguments');
    program.help(); 
    process.exit(1);
}

program.parse(process.argv);

if (!program.args || !program.args.length) {
    showHelp();
}
