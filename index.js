#!/usr/bin/env node

const vorpal = require('vorpal')();
var commands = require('./lib/vorpalCommands');
var color = require('colors-cli/safe'),
    logger = require('./lib/logger');

var options = {
    sourceBranch: false,
    targetBranch: false,
    commit: false,
    timeframe: false,
    output: false,
    packageName: false
}
// set initial log level
vorpal.use(commands);
    //.parse(process.argv)

var autoExit = false;

if(process.argv.length <= 2){
    logger.setLogLevel(1);
    vorpal
        .delimiter(color.yellow('sfpackage') + ' > ')
        .show();
}else{
    logger.setLogLevel(3);
    autoExit = true;
    var comms = process.argv.slice(2).join(' ');
    //vorpal.parse(process.argv);
    console.log(color.yellow('sfpackage [RUN] > ')
                + color.x45(comms));
    vorpal.exec(comms, function(err, data) {
        if (!err) {
            process.exit(0);
        }
    });
}