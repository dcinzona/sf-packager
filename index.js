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
    l = require('./lib/log');

var options = {
    sourceBranch : false,
    targetBranch : false,
    commit : false,
    timeframe : false,
    output : false,
    packageName : false
}

program
    .command('since')
    .alias('s')
    .arguments( '<since> <targetBranch> [sourceBranch] [outputDirectory] [packageName]', 'Compare two branches')
    .description('Creates the package.xml file by comparing two branches')
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
    .arguments( '<targetBranch> <sourceBranch> [outputDirectory] [packageName]', 'Compare two branches')
    .description('Creates the package.xml file by comparing two branches')
    .action( function(targetBranch, sourceBranch, outputDirectory, packageName){
        if(!outputDirectory){
            outputDirectory = './deploy/';
        }
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
        debug('\nOptions\n', true);
        debug(sprintf('args: %j', opts));
        log(git[cmd](opts));
        process.exit(0);
    });

program
    .version(packageVersion)    
    .option('-d, --dryrun', 'Only print the package.xml and destructiveChanges.xml that would be generated')
    .option('-D, --debug', 'Show debug variables')
    .option('-v, --verbose', 'Use verbose logging');

function execute(outputDir, gitDiff, deploymentFolder, dryrun){
    console.log('executing...');
        if(!gitDiff){
            process.exit(1);
        }

        if (!dryrun && !outputDir) {
            outputDir = './deploy';
            //error('target required when not dry-run');
            //program.help();
            //process.exit(1);
            debug(sprintf("using default target %s", outputDir));
        }

        var target = outputDir;

        var currentDir = process.cwd();
        var gitDiffStdOut = gitDiff.stdout.toString('utf8');
        var gitDiffStdErr = gitDiff.stderr.toString('utf8');

        if (gitDiffStdErr) {
            error(sprintf('An error has occurred: %s', gitDiffStdErr));
            process.exit(1);
        }

        var fileListForCopy = [],
            fileList = [];

        //defines the different member types
        var metaBag = {};
        var metaBagDestructive = {};
        var deletesHaveOccurred = false;

        fileList = gitDiffStdOut.split('\n');

        //fileList.length > 0 && fileList[0] != '' ? info('Files detected as changed', true) : info('No changes detected', true);
        if(fileList.length == 1 && fileList[0] == '') {
            info('\nFiles detected as changed\n', true);
            info('No changes detected...exiting', false);
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
                    dorv('\nNon-Salesforce files detected as changed\n', true);
                dorv(f);
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
                    error(sprintf('\nFile name "%s" cannot be processed, exiting', fileName));
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
                        dorv('\nSalesforce source files detected as changed\n', true);
                        displayedSFHEader = true;
                    }
                    // file was added or modified - add fileName to array for unpackaged and to be copied
                    var op = operation == 'A' ? color.cyan('Added') : operation == 'M' ? color.yellow('Modified') : operation == 'D' ? color.red('Deleted') : sprintf('[%s]',operation);
                    dorv(sprintf('%s %s', op, fileName));
                    fileListForCopy.push(fileName);

                    if (!metaBag.hasOwnProperty(parts[1])) {
                        metaBag[parts[1]] = [];
                    }

                    if (metaBag[parts[1]].indexOf(meta) === -1) {
                        metaBag[parts[1]].push(meta);
                    }
                } else if (operation === 'D') {
                    if(!displayedSFHEader) {
                        dorv('\nSalesforce source files detected as changed\n', true);
                        displayedSFHEader = true;
                    }
                    // file was deleted
                    dorv(sprintf('%s %s',color.red('Deleted'), fileName));
                    deletesHaveOccurred = true;

                    if (!metaBagDestructive.hasOwnProperty(parts[1])) {
                        metaBagDestructive[parts[1]] = [];
                    }

                    if (metaBagDestructive[parts[1]].indexOf(meta) === -1) {
                        metaBagDestructive[parts[1]].push(meta);
                    }
                } else {
                    // situation that requires review
                    return error(sprintf('Operation on file needs review: %s', fileName));
                }
            }
        });

        //build package file content
        var packageXML = packageWriter(metaBag);
        //build destructiveChanges file content
        var destructiveXML = packageWriter(metaBagDestructive);
        if (dryrun) {
            info('\nResulting package.xml\n', true);
            info(packageXML);
            info('\nResulting destructiveChanges.xml\n', true);
            info(destructiveXML);
            process.exit(0);
        }
        info(sprintf('\nBuild log'), true);
        info(sprintf('\nBuilding in directory %s', target));

        if(!deploymentFolder){
            error('\nError: output folder was undefined');
            process.exit(1);
        }
        info(sprintf('Saving deployment to folder: %s', deploymentFolder));
        
        buildPackageDir(target, deploymentFolder, metaBag, packageXML, false, (err, buildDir) => {

            if (err) {
                return error(err);
            }

            copyFiles(currentDir, buildDir, fileListForCopy);
            info(sprintf('Successfully created package.xml and files in %s',buildDir));

        });

        if (deletesHaveOccurred) {
            buildPackageDir(target, deploymentFolder, metaBagDestructive, destructiveXML, true, (err, buildDir) => {

                if (err) {
                    return error(err);
                }

                info(sprintf('Successfully created destructiveChanges.xml in %s',buildDir));
            });
        }
}

function showHelp(missingArgs){
    if(missingArgs)
        error('Error: Missing required arguments');
    program.help(); 
    process.exit(1);
}

program.parse(process.argv);

if (!program.args || !program.args.length) {
    showHelp();
}


function dorv(message, header){
    l.dorv(message, header);
};

function verbose(message, header){
    l.verbose(message, header);
}

function debug(message, header){
    l.debug(message, header);
}

function log(message, header){
    info(message, header);
}

function info(message, header){
    l.info(message, header);
}

function error(message){
    l.error(message);
}
