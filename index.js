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
    typeOf = require('./lib/typeof');

function showHelp(missingArgs){
    if(missingArgs)
        error('Error: Missing required arguments');
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
    },
    diff : function(opts){
        var gitOpts = ['--no-pager', 'diff', '--name-status'];
        if(typeOf(opts) == 'array'){
            opts.forEach(function(opt, index){
                gitOpts.push(opt);
            });
        }
        debug(gitOpts);
        log('\nResults',true);
        var gitCmd = spawnSync('git', gitOpts);
        var gitDiffStdErr = gitCmd.stderr.toString('utf8');
        if(gitDiffStdErr){
            error(sprintf('An error has occurred: %s', gitDiffStdErr));
        }
        return gitCmd.stdout.toString('utf8');
    },
    whatchanged : function(opts){
        var gitOpts = ['whatchanged', '--format=oneline', '--name-status' ];
        
        if(typeOf(opts) == 'array'){
            opts.forEach(function(opt, index){
                if(opt.startsWith('since')) opt = '--'+opt;
                gitOpts.push(opt);
            });
        }
        debug(gitOpts);
        log('\nResults',true);
        var g = cp.spawnSync('git', gitOpts);
        var grep = cp.spawnSync('grep', ['^[DAM]'], { input : g.stdout});
        var s1 = grep.stdout.toString('utf8');
        //go line by line and get unique values
        var lines = s1.split("\n");
        var files = [];
        var fileNames = [];
        lines.forEach(function(line, index){
            if(line!= ''){
                var spl = line.split('\t');
                var fn = spl[1];
                debug(spl + fileNames.indexOf(fn));

                if(fileNames.indexOf(fn) == -1){
                    fileNames.push(fn);
                    files.push(line);
                }
            }
        });
        return files.join('\n');
    },
    test : function(){
        /*
        var gitOpts = ['whatchanged', '--format=oneline', '--name-status', '--since="6 hours ago"' ];
        debug(gitOpts);
        log('\nResults',true);
        var g = cp.spawnSync('git', gitOpts);
        var grep = cp.spawnSync('grep', ['^[DAM]'], { input : g.stdout});
        var re = /^[DAM](.*)/g;
        var s1 = grep.stdout.toString('utf8');//.replace(re,"$1");
        return s1; // | grep "^:" | sed "s:.*\([DAM]\)[ \\''t]*\([^ \\''t]*\):\1\2:g"')
        */
        //git --no-pager diff $(git rev-list -1 --before="1 month ago" origin/full2) $(git rev-list -1 --before="1 month ago" master) --name-status -M100%
        var s1 = spawnSync('git', ['rev-list', '-1', '--before="1 month ago"', 'origin/full2']).stdout.toString('utf8').trim();
        console.log(s1.trim());
        var s2 = spawnSync('git', ['rev-list', '-1', '--before="1 month ago"', 'master']).stdout.toString('utf8').trim();
        console.log(s2);
        return spawnSync('git', ['--no-pager', 'diff', '--name-status', '-M100%', s1,s2]).stdout.toString('utf8');
    },
    spawnSync : function(since, targetBranch, sourceBranch){
        var s1 = spawnSync('git', ['rev-list', '-1', '--before="'+since+'"', targetBranch]).stdout.toString('utf8').trim();
        var s2 = spawnSync('git', ['rev-list', '-1', sourceBranch]).stdout.toString('utf8').trim();
        return spawnSync('git', ['--no-pager', 'diff', '--name-status', '-M100%', s1,s2]);
    },
    getDiff : function(since, targetBranch, sourceBranch){
        return git.spawnSync(since, targetBranch,sourceBranch).stdout.toString('utf8');
    }
}

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
            outputDirectory = './deploy';
        }
        if(!packageName){
            packageName = 'diff_'+targetBranch;
        }
        if(!sourceBranch){
            sourceBranch = git.branch().trim();
        }
        execute(outputDirectory, git.spawnSync(since, targetBranch, sourceBranch), packageName, program.dryrun);
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
        process.exit(1);
    });

program
    .version(packageVersion)    
    .option('-d, --dryrun', 'Only print the package.xml and destructiveChanges.xml that would be generated')
    .option('--debug', 'Show debug variables')
    .option('--verbose', 'Use verbose logging')
    .parse(process.argv)

program
    .command('create')
    .alias('make')
    .description('Creates the package.xml file using your current branch and checks it against another branch. checking, timestamp, or commit')
    .option('-s, --sourceBranch <sourceBranch>','Source branch to compare')
    .option('-b, --targetBranch <targetBranch>','Target branch to compare to')
    .option('-c, --commit <sinceCommit>', 'Compare commits on current branch instead of branch compare')
    .option('-t, --timeframe <timeframe>', 'Compare by timestamp - since date on current branch ex: "@{1.day.ago}"',/^@{\d\.(day|days|hour|hours|month|months).ago}$/i)
    .option('-o, --output [targetDirectory]','Directory to save deployments. Defaults to "./deploy/".  Overrides dryrun','./deploy/')
    .option('-p, --packageName <packageName>','The name of the folder that will contain your unmanaged packages')
    .action(function(opts){
        options = opts;
        debug('\nOptions\n', true);
        buildGitDiff(options);
    });

program
    .command('fromcurrent')
    .alias('fc')
    .arguments( '<targetBranch> [outputDirectory] [packageName]', 'Compare the current branch to the target specified')
    .description('Creates the package.xml file by comparing the current branch to another branch')
    .action( function(targetBranch, outputDirectory, packageName){
        debug('\nOptions\n', true);
        branchBuild(git.branch().trim(), targetBranch, outputDirectory, packageName);
    });

program
    .command('frombranch')
    .alias('fb')
    .arguments( '<sourceBranch> <targetBranch> [outputDirectory] [packageName]', 'Compare two branches')
    .description('Creates the package.xml file by comparing two branches')
    .action( function(sourceBranch, targetBranch, outputDirectory, packageName){
        debug('\nOptions\n', true);
        branchBuild(sourceBranch,targetBranch,outputDirectory,packageName);
    })


program.parse(process.argv);


if (!program.args.length) {
    showHelp();
}

function branchBuild(sourceBranch, targetBranch, outputDirectory, packageName){

        var options = {};

        if(!outputDirectory){
            outputDirectory = './deploy';
        }
        if(!packageName){
            packageName = 'diff_'+targetBranch;
        }

        options.targetBranch = targetBranch;
        options.sourceBranch = sourceBranch;
        options.output = outputDirectory;
        options.packageName = packageName;
        
        debug(options);

        buildGitDiff(options);
}

function buildGitDiff(options){

    if(!options){
        program.help();
        process.exit(1);
    }
    debug('options.sourceBranch: ' + options.sourceBranch);
    debug('options.targetBranch: ' + options.targetBranch);
    debug('options.timeframe: ' + options.timeframe);
    debug('options.commit: ' + options.commit);
    debug('options.output: ' + options.output);
    debug('options.dryrun: ' + options.dryrun);
    debug('options.packageName: ' + options.packageName);

    var gitDiff;
    var deploymentFolder;
    var timeframe;
    var gitOpts = ['--no-pager', 'diff', '--name-status', '-M100%'];

    if(options.timeframe === true){
        error('Error: invalid timeframe specified.  Please use the format @{1.day.ago}');
        process.exit(1);
    }else{
        timeframe = options.timeframe;
    }

    if(options.commit){
        if(options.targetBranch || options.sourceBranch){
            error('Error: commit flag cannot be used with sourceBranch or targetBranch');
            process.exit(1);
        }else{
            gitOpts.push(options.commit);
        }
        deploymentFolder = options.commit;
    }else if (options.targetBranch) {
        var sourceBranch = options.sourceBranch;
        if(!options.sourceBranch){
            sourceBranch = 'HEAD~1';
        }
        gitOpts.push(options.targetBranch);
        gitOpts.push(sourceBranch);
        deploymentFolder = !options.packageName ? options.targetBranch : options.packageName;
    } else if(options.sourceBranch) {
        error('Error: target branch is required required when source is specified');
        program.help();
        process.exit(1);
    }else if(!timeframe){
        error('Error: missing required options');
        program.help();
        process.exit(1);
    }

    if(timeframe){
        gitOpts.push(timeframe);
    }

    debug(sprintf('Git command: `git %s`',gitOpts.join(' ')));

    gitDiff = spawnSync('git', gitOpts);

    var currentBranch = git.branch().trim();
    debug(sprintf('current branch: %s', currentBranch));

    deploymentFolder = options.packageName ? options.packageName : deploymentFolder;

    debug('unpackaged directory: '+ options.output + deploymentFolder);

    execute(options.output, gitDiff, deploymentFolder, program.dryrun);
}

function execute(outputDir, gitDiff, deploymentFolder, dryrun){
        

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

function dorv(message, header){
    if(program.debug || program.verbose){
        program.debug ? debug(message, header) : verbose(message, header);
    }
}

function verbose(message, header){
    if(program.verbose){
        log(message, header);
    }
}

function debug(message, header){
    if(program.debug){
        if(typeof message == typeof {}){
            message = JSON.stringify(message);
        }
        !header ? console.info('[DEBUG] ' + color.x230(message)) : console.info(color.x229.underline(message))
    }
}
function log(message, header){
    info(message,header);
}
function info(message, header){
    if(typeof message == typeof {}){
        message = JSON.stringify(message);
    }
    !header ? console.log(color.x253(message)) : console.log(color.green.x34.underline(message))
}
function error(message){
    if(typeof message == typeof {}){
        message = JSON.stringify(message);
    }
    console.error(color.red(message));
}
