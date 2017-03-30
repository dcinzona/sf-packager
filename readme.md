# Overview

CLI Tool to generate Salesforce.com package.xml (and destructiveChange.xml) files based on git diff between two branches. 

Note: TargetBranch is the branch to which you want to bring up to speed (i.e. sourceBranch changes go into targetBranch)

If any deletes occurred will also create `./deployFolder/packageName/destructive/destructiveChanges.xml`


## Install
```
git clone https://github.com/dcinzona/sf-packager.git && cd sf-packager && npm link
```

## Using date comparison
```
$ sfpackage since '1 day ago' targetBranch sourceBranch ./deploy/ packageName
```
This will create a package at ./deploy/sourceBranch/unpackaged/package.xml copying all files into directory.
_Note: the files copied are copied from your current branch so it is recommended sourceBranch be whatever branch you are on_
* SourceBranch is optional and will default to your current branch

### Specifying from current branch to target branch

```
$ sfpackage since yesterday targetBranch -f ./deploy -p myDeploymentName
```

### Specifying a custom deployment folder and package name

```
$ sfpackage since yesterday targetBranch -f ./customFolder -p packageName
$ sfpackage since yesterday targetBranch sourceBranch ./customFolder packageName
```

## Using latest commit in each breanch
```
$ sfpackage latest targetBranch sourceBranch ./deploy/ packageName
```

This will create a package at ./deploy/sourceBranch/unpackaged/package.xml copying all files into directory.

_Note: the files copied are copied from your current branch so it is recommended sourceBranch be whatever branch you are on_

* SourceBranch is optional and will default to your current branch


### Display package.xml only, without copying files to package

You can also just write out the package.xml and destructiveChanges.xml by passing the -d flag
```
sfpackage latest targetBranch sourceBranch -d > ~/Desktop/packageAndDestructiveChanges.xml
```

## Backing out (Undo)
You can also create "backout" content by reversing the order of the destination and source branches
```
sfpackage latest sourceBranch targetBranch ./deploy/ packageName
```

## Other commands

### Specifying from a specific commit
```
sfpackage latest HEAD~3
```
_`--folder` or `-f` will default to `./deploy/` when no variable is passed in after the flag_


## Todo
- [ ] Add support for specifying tags / labels and branches
- [ ] Add support to deploy the package to an environment
  - Requires Ant
  - Add method to create an env config for Ant to process
  - Add support for JWT bearer token deployments


<!-- TOC -->

- [Overview](#overview)
  - [Install](#install)
  - [Using date comparison](#using-date-comparison)
    - [Specifying from current branch to target branch](#specifying-from-current-branch-to-target-branch)
    - [Specifying a custom deployment folder and package name](#specifying-a-custom-deployment-folder-and-package-name)
  - [Using latest commit in each breanch](#using-latest-commit-in-each-breanch)
    - [Display package.xml only, without copying files to package](#display-packagexml-only-without-copying-files-to-package)
  - [Backing out (Undo)](#backing-out-undo)
  - [Other commands](#other-commands)
    - [Specifying from a specific commit](#specifying-from-a-specific-commit)
  - [Todo](#todo)

<!-- /TOC -->