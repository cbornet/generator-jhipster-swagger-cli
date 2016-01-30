'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var packagejs = require(__dirname + '/../../package.json');
var request = require('sync-request');
var path = require('path');
var shelljs = require('shelljs');

// Stores JHipster variables
var jhipsterVar = {moduleName: 'swagger-cli'};

// Stores JHipster functions
var jhipsterFunc = {};

/*function isURL(str) {
  return /\b(https?|ftp|file):\/\/[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|‌​]/.test(str);
}*/

module.exports = yeoman.Base.extend({

  initializing: {
    compose: function (args) {
      this.composeWith('jhipster:modules',
        {
          options: {
            jhipsterVar: jhipsterVar,
            jhipsterFunc: jhipsterFunc
          }
        },
        this.options.testmode ? {local: require.resolve('generator-jhipster/modules')} : null
      );
    },
    displayLogo: function () {
      // Have Yeoman greet the user.
      this.log('Welcome to the ' + chalk.red('JHipster swagger-cli') + ' generator! ' + chalk.yellow('v' + packagejs.version + '\n'));
    }
  },

  prompting: {
    askForInputSpec: function() {
      var done = this.async();

      var prompts = [
        {
            type: 'input',
            name: 'inputSpec',
            message: 'Where is your Swagger/OpenAPI spec (URL or file) ?',
            default: 'http://petstore.swagger.io/v2/swagger.json',
            store: true
        },
        {
            type: 'input',
            name: 'cliName',
            message: 'What is the unique name for your client ?',
            default: 'swagger',
            store: true
        }
      ];

      this.prompt(prompts, function (props) {
        this.inputSpec = props.inputSpec;
        this.cliName = props.cliName;
        /*var swagger = "";
        if (isURL(this.inputSpec)) {
          var res = request('GET', this.inputSpec);
          swagger = res.getBody('utf-8');
        } else {
          swagger = fs.readFileSync(this.inputSpec, 'utf-8');
        }
        this.swagger = JSON.parse(swagger);
        console.log(this.swagger.info.title.replace(/ /g, ''));*/

        done();
      }.bind(this));
    }

  },

  writing: {
    callSwaggerCodegen : function () {
      var javaDir = jhipsterVar.javaDir;
      var jarPath = path.resolve(__dirname, '../jar/swagger-codegen-cli-2.1.5.jar');
      var cliPackage = jhipsterVar.packageName + '.client.' + this.cliName;

      var execLine = 'java -Dmodels -Dapis -DsupportingFiles=ApiClient.java,FormAwareEncoder.java,StringUtil.java -jar ' + jarPath + ' generate' +
        ' -l java --library feign ' +
        ' -i ' + this.inputSpec +
        ' -o ' + javaDir +
        ' --api-package ' + cliPackage + '.api' +
        ' --model-package ' + cliPackage + '.model' +
        ' --invoker-package ' + cliPackage;
      shelljs.exec(execLine);

    },

    writeTemplates: function() {
      if (jhipsterVar.buildTool === 'maven') {
        jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-core', '8.1.1');
        jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-jackson', '8.1.1');
        jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-slf4j', '8.1.1');
      } else if (jhipsterVar.buildTool === 'gradle') {
        jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-core', '8.1.1');
        jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-jackson', '8.1.1');
        jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-slf4j', '8.1.1');
      }
    }
  },

  install: function () {
    //this.installDependencies();
  },

  end: function () {
    //this.log('End of swagger-cli generator');
  }
});
