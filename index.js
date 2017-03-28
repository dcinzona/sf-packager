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
    packageWriter = require('./lib/metaUtils').packageWriter,
    buildPackageDir = require('./lib/metaUtils').buildPackageDir,
    copyFiles = require('./lib/metaUtils').copyFiles,
    packageVersion = require('./package.json').version;

function showHelp(missingArgs){
    if(missingArgs)
        console.error('Error: Missing required arguments');
    program.help(); 
    process.exit(1);
}

var git = {
    branch : function(){
        return spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.toString('utf8');
    },
    long : function(){
        return spawnSync('git', ['rev-parse', 'HEAD']).stdout.toString('utf8');
    },
    short : function(){
        return spawnSync('git', ['rev-parse', '--short', 'HEAD']).stdout.toString('utf8');
    },
    tag : function(){
        return spawnSync('git', ['describe', '--always', '--tag', '--abbrev=0']).stdout.toString('utf8');
    }
}

program
    .version(packageVersion)
    .command('create')
    .description('Creates the package.xml file')
    .option('-o, --output [targetDirectory]','Directory to save deployments. Defaults to "./deploy".  Overrides dryrun')
    .option('-b, --targetBranch <targetBranch>','Branch to compare to')
    .option('-s, --sourceBranch <sourceBranch>','Branch to compare with and copy files from (usually current branch)')
    .option('-d, --dryrun', 'Only print the package.xml and destructiveChanges.xml that would be generated')
    .option('-c, --commit <sinceCommit>', 'Compare commits on current branch instead of branch compare')
    .option('-t, --timeframe <tf>', 'Compare by timestamp - since date on current branch ex: "@{1.day.ago}"',/^@{\d\.(day|days|hour|hours|month|months).ago}$/i)
    .option('--debug', 'Show debug variables')
    .action(function(options){
        if(options.debug){
            console.log('options.targetBranch: ' + options.targetBranch);
            console.log('options.sourceBranch: ' + options.sourceBranch);
            console.log('options.timeframe: ' + options.timeframe);
            console.log('options.commit: ' + options.commit);
            console.log('options.output: ' + options.output);
            console.log('options.dryrun: ' + options.dryrun);
        }

        var gitDiff;
        var deploymentFolder;
        var timeframe;
        var gitOpts = ['--no-pager', 'diff', '--name-status'];

        if(options.timeframe === true){
            console.error('Error: invalid timeframe specified.  Please use the format @{1.day.ago}');
            process.exit(1);
        }else{
            timeframe = options.timeframe;
        }

        if(options.commit){
            if(options.targetBranch || options.sourceBranch){
                console.error('Error: commit flag cannot be used with sourceBranch or targetBranch');
                process.exit(1);
            }else{
                gitOpts.push(options.commit);
            }
            deploymentFolder = options.commit;
        }else if (options.targetBranch) {
            var sourceBranch = options.sourceBranch;
            if(!options.sourceBranch){
                sourceBranch = 'HEAD';
            }
            gitOpts.push([options.target, sourceBranch]);
            deploymentFolder = options.targetBranch;
        } else if(options.sourceBranch) {
            console.error('Error: target branch is required required when source is specified');
            program.help();
            process.exit(1);
        }else if(!timeframe){
            console.error('Error: missing required options');
            program.help();
            process.exit(1);
        }

        if(timeframe){
            gitOpts.push(timeframe);
        }

        gitDiff = spawnSync('git', gitOpts);

        //set deploymentFolder
        var currentBranch = git.branch();
        if(options.debug) console.log('current branch: ' + git.branch());

        execute(options.output, gitDiff, deploymentFolder, options.dryrun);
    });

program
    .command('deploy <env>')
    .description('TODO: Deploy the given environment')
    .action(function(env){
      console.log('deploying "%s"', env);
    });


function execute(outputDir, gitDiff, deploymentFolder, dryrun){
        

        if(!gitDiff){
            process.exit(1);
        }

        if (!dryrun && !outputDir) {
            outputDir = './deploy';
            console.log("using default target './deploy'");
            //console.error('target required when not dry-run');
            //program.help();
            //process.exit(1);
        }

        var target = outputDir;

        var currentDir = process.cwd();
        var gitDiffStdOut = gitDiff.stdout.toString('utf8');
        var gitDiffStdErr = gitDiff.stderr.toString('utf8');

        if (gitDiffStdErr) {
            console.error('An error has occurred: %s', gitDiffStdErr);
            process.exit(1);
        }

        var fileListForCopy = [],
            fileList = [];

        //defines the different member types
        var metaBag = {};
        var metaBagDestructive = {};
        var deletesHaveOccurred = false;

        fileList = gitDiffStdOut.split('\n');

        console.log('\nFiles detected as changed:');

        fileList.forEach(function (fileName, index) {
            // get the git operation
            var operation = fileName.slice(0,1);
            // remove the operation and spaces from fileName
            fileName = fileName.slice(1).trim();
            if(fileName) console.log(' - ' + fileName);

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
                    console.error('File name "%s" cannot be processed, exiting', fileName);
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
                    // file was added or modified - add fileName to array for unpackaged and to be copied
                    console.log('File was added or modified: %s', fileName);
                    fileListForCopy.push(fileName);

                    if (!metaBag.hasOwnProperty(parts[1])) {
                        metaBag[parts[1]] = [];
                    }

                    if (metaBag[parts[1]].indexOf(meta) === -1) {
                        metaBag[parts[1]].push(meta);
                    }
                } else if (operation === 'D') {
                    // file was deleted
                    console.log('File was deleted: %s', fileName);
                    deletesHaveOccurred = true;

                    if (!metaBagDestructive.hasOwnProperty(parts[1])) {
                        metaBagDestructive[parts[1]] = [];
                    }

                    if (metaBagDestructive[parts[1]].indexOf(meta) === -1) {
                        metaBagDestructive[parts[1]].push(meta);
                    }
                } else {
                    // situation that requires review
                    return console.error('Operation on file needs review: %s', fileName);
                }
            }
        });

        //build package file content
        var packageXML = packageWriter(metaBag);
        //build destructiveChanges file content
        var destructiveXML = packageWriter(metaBagDestructive);
        if (dryrun) {
            console.log('\nResulting package.xml\n');
            console.log(packageXML);
            console.log('\nResulting destructiveChanges.xml\n');
            console.log(destructiveXML);
            process.exit(0);
        }

        console.log('Building in directory %s', target);

        if(!deploymentFolder){
            console.error('Error: output folder was undefined');
            process.exit(1);
        }
        console.log('Saving deployment to folder: ', deploymentFolder);

        buildPackageDir(target, deploymentFolder, metaBag, packageXML, false, (err, buildDir) => {

            if (err) {
                return console.error(err);
            }

            copyFiles(currentDir, buildDir, fileListForCopy);
            console.log('Successfully created package.xml and files in %s',buildDir);

        });

        if (deletesHaveOccurred) {
            buildPackageDir(target, deploymentFolder, metaBagDestructive, destructiveXML, true, (err, buildDir) => {

                if (err) {
                    return console.error(err);
                }

                console.log('Successfully created destructiveChanges.xml in %s',buildDir);
            });
        }
}

program.parse(process.argv);
