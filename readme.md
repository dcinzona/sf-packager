# Overview

CLI Tool to generate Salesforce.com package.xml (and destructiveChange.xml) files based on git diff between two branches. 

## Install
```
git clone https://github.com/dcinzona/sf-packager.git && cd sf-packager && npm link
```

## Usage

### Specifying source and target branches
```
$ sfpackage frombranch sourceBranch targetBranch ./deploy/ packageName
```
This will create a package at ./deploy/sourceBranch/unpackaged/package.xml copying all files into directory.
_Note: the files copied are copied from your current branch_

### Specifying from current branch and target branch
```
$ sfpackage fromcurrent targetBranch ./deploy/ packageName
```

If any deletes occurred will also create ./deploy/packageName/destructive/destructiveChanges.xml

### Display package.xml only, without copying files to package
You can also just write out the package.xml and destructiveChanges.xml by passing the -d flag
```
sfpackage fb sourceBranch targetBranch -d > ~/Desktop/packageAndDestructiveChanges.xml
```

### Backing out (Undo)
You can also create "backout" content by reversing the order of the destination and source branches
```
sfpackage fb targetBranch sourceBranch ./deploy/ packageName
```

## Other commands

### Specifying from a specific commit
```
sfpackage create --commit HEAD~3 --output ./deploy/ --folder 
```
`--output` or `-o` will default to `./deploy/` when no variable is passed in after the flag

### Specifying from a specific timespan
```
sfpackage create --commit HEAD~3 -o --timeframe @{2.days.ago}
```

## Todo
1. Add support for specifying tags / labels and branches
2. Add support to deploy the package to an environment
  - Requires Ant
  - Add method to create an env config for Ant to process
  - Add support for JWT bearer token deployments