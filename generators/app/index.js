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
var apis;

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
    },
    readConfig: function(){
      apis = this.config.get('apis') || {};
    }
  },

  prompting: {
    askForInputSpec: function() {
      var done = this.async();
      var hasExistingApis = (Object.keys(apis).length !== 0);

      var prompts = [
        {
          when: function() {
            return hasExistingApis;
          },
          type: 'list',
          name: 'action',
          message: 'What do you want to do ?',
          choices: [
            {
              value: 'new',
              name: 'Generate a new API client'
            },
            {
              value: 'all',
              name: 'Generate all stored API clients'
            },
            {
              value: 'select',
              name: 'Select stored API clients to generate'
            }
          ]
        },
        {
          when : function(response) {
            return response.action == 'new' || !hasExistingApis;
          },
          type: 'input',
          name: 'inputSpec',
          message: 'Where is your Swagger/OpenAPI spec (URL or path) ?',
          default: 'http://petstore.swagger.io/v2/swagger.json',
          store: true
        },
        {
          when : function(response) {
            return response.action == 'new' || !hasExistingApis;
          },
          type: 'input',
          name: 'cliName',
          message: 'What is the unique name for your API client ?',
          default: 'petstore',
          store: true
        },
        {
          when : function(response) {
            return response.action == 'new' || !hasExistingApis;
          },
          type: 'confirm',
          name: 'saveConfig',
          message: 'Do you want to save this config for future reuse ?',
          default: false
        },
        {
          when : function(response) {
            return response.action == 'select';
          },
          type: 'checkbox',
          name: 'selected',
          message: 'Select which APIs you want to generate',
          choices: function() {
            var choices = [];
            Object.keys(apis).forEach( function(cliName) {
              choices.push({ 'name': cliName + ' (' + apis[cliName] + ')', 'value': {'cliName': cliName, 'spec':apis[cliName]} });
            });
            return choices;
          }
        }
      ];

      this.prompt(prompts, function (props) {
        this.props = props;
        this.inputSpec = props.inputSpec;
        this.cliName = props.cliName;
        this.saveConfig = props.saveConfig;
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

  configuring: {
    determineApisToGenerate: function() {
      this.apisToGenerate = {};
      if(this.props.action == 'new') {
        this.apisToGenerate[this.props.cliName] = this.props.inputSpec;
      } else if (this.props.action == 'all') {
        this.apisToGenerate = apis;
      } else if (this.props.action == 'select') {
        this.props.selected.forEach( function(selection) {
          this.apisToGenerate[selection.cliName] = selection.spec;
        }, this);
      }
    },

    saveConfig: function() {
      if (this.props.saveConfig) {
        apis[this.props.cliName] = this.props.inputSpec;
        this.config.set('apis', apis);
      }
    }
  },

  writing: {
    callSwaggerCodegen : function () {
      var javaDir = jhipsterVar.javaDir;
      var jarPath = path.resolve(__dirname, '../jar/swagger-codegen-cli-2.1.5.jar');
      Object.keys(this.apisToGenerate).forEach( function(cliName) {
        var inputSpec = this.apisToGenerate[cliName];
        var cliPackage = jhipsterVar.packageName + '.client.' + cliName;

        var execLine = 'java -Dmodels -Dapis -DsupportingFiles=ApiClient.java,FormAwareEncoder.java,StringUtil.java -jar ' + jarPath + ' generate' +
          ' -l java --library feign ' +
          ' -i ' + inputSpec +
          ' -o ' + javaDir +
          ' --api-package ' + cliPackage + '.api' +
          ' --model-package ' + cliPackage + '.model' +
          ' --invoker-package ' + cliPackage;
        shelljs.exec(execLine);
      }, this);

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
