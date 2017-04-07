var util = require('util'),
    spawnSync = require('child_process').spawnSync,
    cp = require('child_process'),
    packageWriter = require('./metaUtils').packageWriter,
    buildPackageDir = require('./metaUtils').buildPackageDir,
    copyFiles = require('./metaUtils').copyFiles,
    sprintf = require("sprintf-js").sprintf,
    color = require('colors-cli/safe'),
    typeOf = require('./typeof'),
    git = require('./git'),
    logger = require('./logger'),
    jwt = require('./jwt'),
    mdapi = require('./mdapi')

var build = module.exports.build = function (outputDir, gitDiff, deploymentFolder, dryrun, cb) {

    if (!gitDiff) {
        return 'error';//process.exit(1);
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
        return;//process.exit(1);
    }

    var fileListForCopy = [],
        fileList = [];

    //defines the different member types
    var metaBag = {};
    var metaBagDestructive = {};
    var deletesHaveOccurred = false;

    fileList = gitDiffStdOut.split('\n');

    if (fileList.length == 1 && fileList[0] == '') {
        logger.info('\nFiles detected as changed\n', true);
        logger.info('No changes detected...exiting', false);
        cb();
        return;//process.exit(0);
    } else if (logger.getLogLevel() >= 2) {
        var otherFiles = [];
        fileList.forEach(function (fileName, index) {
            var operation = fileName.slice(0, 1);
            fileName = fileName.slice(1).trim();
            var op = operation == 'A' ? color.cyan('Added') : operation == 'M' ? color.yellow('Modified') : operation == 'D' ? color.red('Deleted') : sprintf('[%s]', operation);
            if (!fileName.startsWith('src/') & fileName != '') {
                otherFiles.push(sprintf('%s %s', op, fileName))
            }
        });
        otherFiles.forEach(function (f, i) {
            if (i == 0)
                logger.dorv('\nNon-Salesforce files detected as changed\n', true);
            logger.dorv(f);
        });
    }
    var displayedSFHEader = false;
    fileList.forEach(function (fileName, index) {
        // get the git operation
        var operation = fileName.slice(0, 1);
        // remove the operation and spaces from fileName
        fileName = fileName.slice(1).trim();
        //ensure file is inside of src directory of project
        if (fileName && fileName.substring(0, 3) === 'src') {

            //ignore changes to the package.xml file
            if (fileName === 'src/package.xml') {
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
                if (!displayedSFHEader) {
                    logger.dorv('\nSalesforce source files detected as changed\n', true);
                    displayedSFHEader = true;
                }
                // file was added or modified - add fileName to array for unpackaged and to be copied
                var op = operation == 'A' ? color.cyan('Added') : operation == 'M' ? color.yellow('Modified') : operation == 'D' ? color.red('Deleted') : sprintf('[%s]', operation);
                logger.dorv(sprintf('%s %s', op, fileName));
                fileListForCopy.push(fileName);

                if (!metaBag.hasOwnProperty(parts[1])) {
                    metaBag[parts[1]] = [];
                }

                if (metaBag[parts[1]].indexOf(meta) === -1) {
                    metaBag[parts[1]].push(meta);
                }
            } else if (operation === 'D') {
                if (!displayedSFHEader) {
                    logger.dorv('\nSalesforce source files detected as changed\n', true);
                    displayedSFHEader = true;
                }
                // file was deleted
                logger.dorv(sprintf('%s %s', color.red('Deleted'), fileName));
                deletesHaveOccurred = true;

                if (!metaBagDestructive.hasOwnProperty(parts[1])) {
                    metaBagDestructive[parts[1]] = [];
                }

                if (metaBagDestructive[parts[1]].indexOf(meta) === -1) {
                    metaBagDestructive[parts[1]].push(meta);
                }
            } else {
                // situation that requires review
                logger.error(sprintf('Operation on file needs review: %s', fileName));
                return;
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
        logger.info('');
        cb();
    }
    else{
        logger.info(sprintf('\nBuild log'), true);
        logger.info(sprintf('\nBuilding in directory %s', target));

        if (!deploymentFolder) {
            return logger.error('\nError: output folder was undefined');;//process.exit(1);
        }
        logger.info(sprintf('Saving deployment to folder: %s', deploymentFolder));
            
        buildPackageDir(target, deploymentFolder, metaBag, packageXML, false, (err, buildDir) => {

            if (err) {
                return logger.error(err);
            }

            copyFiles(currentDir, buildDir, fileListForCopy, (err)=>{
                logger.info(sprintf('Successfully created package.xml and files in %s\n', buildDir));
                if (deletesHaveOccurred) {
                    buildPackageDir(target, deploymentFolder, metaBagDestructive, destructiveXML, true, (err, buildDir) => {

                        if (err) {
                            return logger.error(err);
                        }

                        logger.info(sprintf('Successfully created destructiveChanges.xml in %s\n', buildDir));
                        cb();
                    });
                }else{
                    cb();
                }
            });
        });

        cb();
        //return;
    }
    
}