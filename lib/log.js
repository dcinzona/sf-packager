var color = require('colors-cli/safe'),
    program = require('commander');

exports.dorv = function (message, header){
    if(program.debug || program.verbose){
        program.debug ? this.debug(message, header) : this.verbose(message, header);
    }
};

exports.verbose = function (message, header){
    if(program.verbose){
        this.log(message, header);
    }
}

exports.debug = function (message, header){
    if(program.debug){
        if(typeof message == typeof {}){
            message = JSON.stringify(message);
        }
        !header ? console.info('[DEBUG] ' + color.x230(message)) : console.info(color.x229.underline(message))
    }
}

exports.log = function (message, header){
    this.info(message,header);
}

exports.info = function (message, header){
    if(typeof message == typeof {}){
        message = JSON.stringify(message);
    }
    !header ? console.log(color.x253(message)) : console.log(color.green.x34.underline(message))
}
exports.error = function error(message){
    if(typeof message == typeof {}){
        message = JSON.stringify(message);
    }
    console.error(color.red(message));
}
