var s = require('child_process').spawnSync,
    sprintf = require("sprintf-js").sprintf,
    typeOf = require('./typeof'),
    l = require('./logger'),
    program = require('commander');

exports.branch = function (branch) {
    if (!branch) branch = ['HEAD'];
    if (!branch.length > 0) branch[0] = 'HEAD';
    return s('git', ['rev-parse', '--abbrev-ref', branch[0]]).stdout.toString('utf8').trim();
}
exports.long = function (branch) {
    if (!branch) branch = ['HEAD'];
    if (!branch.length > 0) branch[0] = 'HEAD';
    return s('git', ['rev-parse', branch[0]]).stdout.toString('utf8').trim();
}
exports.short = function (branch) {
    if (!branch) branch = ['HEAD'];
    if (!branch.length > 0) branch[0] = 'HEAD';
    return s('git', ['rev-parse', '--short', branch[0]]).stdout.toString('utf8').trim();
}
exports.tag = function () {
    return s('git', ['describe', '--always', '--tag', '--abbrev=0']).stdout.toString('utf8').trim();
}
exports.spawnSync = function (since, targetBranch, sourceBranch) {
    var opts = {
        rev1: getRevListOpts(targetBranch),
        rev2: getRevListOpts(sourceBranch),
        diff: ['--no-pager', 'diff', '--name-status', '-M100%']
    };
    if (since) {
        opts.rev1.push(sprintf('--before="%s"', since))
    }
    var s1 = s('git', opts.rev1).stdout.toString('utf8').trim();
    var s2 = s('git', opts.rev2).stdout.toString('utf8').trim();
    opts.diff.push(s1);
    opts.diff.push(s2);
    return s('git', opts.diff);
}

function getRevListOpts(branch) {
    return ['rev-list', '-1', branch];
}

exports.diff = function (opts) {
    var gitOpts = ['--no-pager', 'diff', '--name-status'];
    if (typeOf(opts) == 'array') {
        opts.forEach(function (opt, index) {
            gitOpts.push(opt);
        });
    }
    l.debug(gitOpts);
    l.log('\nResults', true);
    var gitCmd = s('git', gitOpts);
    var gitDiffStdErr = gitCmd.stderr.toString('utf8');
    if (gitDiffStdErr) {
        l.error(sprintf('An error has occurred: %s', gitDiffStdErr));
    }
    return gitCmd.stdout.toString('utf8');
}

exports.whatchanged = function (opts) {
    var gitOpts = ['whatchanged', '--format=oneline', '--name-status'];

    if (typeOf(opts) == 'array') {
        opts.forEach(function (opt, index) {
            if (opt.startsWith('since')) opt = '--' + opt;
            gitOpts.push(opt);
        });
    }
    l.debug(gitOpts);
    l.log('\nResults', true);
    var g = s('git', gitOpts);
    var grep = s('grep', ['^[DAM]'], {
        input: g.stdout
    });
    var s1 = grep.stdout.toString('utf8');
    //go line by line and get unique values
    var lines = s1.split("\n");
    var files = [];
    var fileNames = [];
    lines.forEach(function (line, index) {
        if (line != '') {
            var spl = line.split('\t');
            var fn = spl[1];
            l.debug(spl + fileNames.indexOf(fn));

            if (fileNames.indexOf(fn) == -1) {
                fileNames.push(fn);
                files.push(line);
            }
        }
    });
    return files.join('\n');
}