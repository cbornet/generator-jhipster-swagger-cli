'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var packagejs = require(__dirname + '/../../package.json');
var request = require('sync-request');
var path = require('path');
var shelljs = require('shelljs');
var CodeGen = require('swagger-js-codegen').CodeGen;
var _ = require('underscore.string');

// Stores JHipster variables
var jhipsterVar = {moduleName: 'swagger-cli'};

// Stores JHipster functions
var jhipsterFunc = {};

function isURL(str) {
  return /\b(https?|ftp|file):\/\/[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|‌​]/.test(str);
}

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
      this.log('Welcome to the ' + chalk.red('JHipster swagger-cli') + ' generator! ' +
        chalk.yellow('v' + packagejs.version + '\n'));
    },
    readConfig: function(){
      apis = this.config.get('apis') || {};
      this.hasBackEnd = false;
    }
  },

  prompting: {
    askForInputSpec: function() {
      var done = this.async();
      var hasExistingApis = (Object.keys(apis).length !== 0);

      try {
        //Check if there is a registry running
        var res = request('GET', 'http://localhost:8761/health');
        if(JSON.parse(res.getBody()).status === "UP") {

          this.log(chalk.yellow('JHipster registry') + ' detected on localhost:8761.');

          var swaggerResources = request('GET', 'http://localhost:8080/swagger-resources', {
            //This header is needed to use the custom /swagger-resources controller
            // and not the default one that has only the gateway's swagger resource
            headers: {Accept: "application/json, text/javascript;"}
          });
          var availableDocs = [];
          JSON.parse(swaggerResources.getBody()).forEach(function (swaggerResource) {
            availableDocs.push({
              value: "http://localhost:8080" + swaggerResource.location,
              name: swaggerResource.name + ' (' + swaggerResource.location + ')'
            });
          });

          this.log('The following swagger-docs have been found :');
          availableDocs.forEach(function (doc) {
            this.log('* ' + chalk.green(doc.name) + " : " + doc.value);
          }.bind(this));

          //If all the previous requests didn't fail, we set the flag
          var isMicroserviceConfig = true;
        }
      } catch(err){
        var isMicroserviceConfig = false;
      }

      var prompts = [
        {
          when : function() {
            return isMicroserviceConfig;
          },
          type: 'confirm',
          name: 'useRegistry',
          message: 'Do you want to use one of these swagger-docs ?',
          default: true
        },
        {
          when : function(response) {
            return response.useRegistry;
          },
          type: 'list',
          name: 'inputSpec',
          message: 'Select the doc for which you want to create a client ?',
          choices: availableDocs
        },
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
            return (response.action == 'new' || !hasExistingApis) && response.inputSpec == undefined;
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
          validate: function (input) {
            if (!/^([a-zA-Z0-9_]*)$/.test(input)) return 'Your API client name cannot contain special characters or a blank space';
            if (input == '') return 'Your API client name cannot be empty';
            return true;
          },
          message: 'What is the unique name for your API client ?',
          default: 'petstore',
          store: true
        },
        {
          when : function(response) {
            return response.action == 'new' || !hasExistingApis;
          },
          type: 'checkbox',
          name: 'cliTypes',
          message: 'Select which type of API client to generate',
          default: ['front'],
          store: true,
          choices: [
            {'name': 'front-end client', 'value': 'front'},
            {'name': 'back-end client', 'value': 'back'},
          ]
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
              choices.push({ 'name': cliName + ' (' + apis[cliName].spec + ' - ' + apis[cliName].cliTypes + ')', 'value': {'cliName': cliName, 'spec':apis[cliName]} });
            });
            return choices;
          }
        }
      ];

      this.prompt(prompts, function (props) {
        this.props = props;

        done();
      }.bind(this));
    }

  },

  configuring: {
    determineApisToGenerate: function() {
      this.apisToGenerate = {};
      if(this.props.action == 'new' || this.props.action == undefined) {
        this.apisToGenerate[this.props.cliName] = {'spec': this.props.inputSpec, 'cliTypes': this.props.cliTypes};
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
        apis[this.props.cliName] = this.apisToGenerate[this.props.cliName];
        this.config.set('apis', apis);
      }
    }
  },

  writing: {
    callSwaggerCodegen : function () {
      this.packageName = jhipsterVar.packageName;
      var jarPath = path.resolve(__dirname, '../jar/swagger-codegen-cli-2.1.6-SNAPSHOT.jar');
      Object.keys(this.apisToGenerate).forEach( function(cliName) {
        var inputSpec = this.apisToGenerate[cliName].spec;
        this.apisToGenerate[cliName].cliTypes.forEach( function(cliType) {
          this.log(chalk.green('Generating ' + cliType + ' end code for ' + cliName + ' (' + inputSpec + ')' ));
          if (cliType === 'front') {
            var swagger = "";
            if (isURL(inputSpec)) {
              var res = request('GET', inputSpec);
              swagger = res.getBody('utf-8');
            } else {
              swagger = fs.readFileSync(inputSpec, 'utf-8');
            }
            swagger = JSON.parse(swagger);
            var angularjsSourceCode = CodeGen.getAngularCode({ className: _.classify(cliName), swagger: swagger, moduleName: _.camelize(cliName) });
            var apiScriptFile = 'components/api-clients/' + _.dasherize(_.decapitalize(cliName)) + '.module.js';
            this.fs.write( jhipsterVar.webappDir + '/scripts/' + apiScriptFile, angularjsSourceCode);
            jhipsterFunc.addAngularJsModule(_.camelize(cliName));
            jhipsterFunc.addJavaScriptToIndex(apiScriptFile);

          }
          else if (cliType === 'back') {
            this.hasBackEnd = true;
            this.cliPackage = jhipsterVar.packageName + '.client.' + _.underscored(cliName);
            var execLine = 'java -Dmodels -Dapis -DsupportingFiles=ApiClient.java,OAuth.java,OAuthFlow.java,ApiKeyAuth.java,HttpBasicAuth.java -jar ' + jarPath + ' generate' +
              ' -t ' + path.resolve(__dirname, 'templates/swagger-codegen') +
              ' -l java --library feign ' +
              ' -i ' + inputSpec +
              ' --artifact-id ' + _.camelize(cliName) +
              ' --api-package ' + this.cliPackage + '.api' +
              ' --model-package ' + this.cliPackage + '.model' +
              ' --invoker-package ' + this.cliPackage +
              ' --type-mappings DateTime=ZonedDateTime,Date=LocalDate --import-mappings ZonedDateTime=java.time.ZonedDateTime,LocalDate=java.time.LocalDate';
            shelljs.exec(execLine);
            this.template('src/main/java/package/client/_ApiClientProperties.java', jhipsterVar.javaDir + '/client/' +  _.underscored(cliName) + '/ApiClientProperties.java', this, {});
          }
        }, this);
      }, this);

    },

    writeTemplates: function() {
      if (!this.hasBackEnd) {
        return;
      }
      if (jhipsterVar.buildTool === 'maven') {
        jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-netflix-core', '1.0.6.RELEASE');
        jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-core', '8.14.3');
        jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-slf4j', '8.14.3');
        jhipsterFunc.addMavenDependency('org.apache.oltu.oauth2', 'org.apache.oltu.oauth2.client', '1.0.1');
      } else if (jhipsterVar.buildTool === 'gradle') {
        jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-netflix-core', '1.0.6.RELEASE');
        jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-core', '8.14.3');
        jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-slf4j', '8.14.3');
        jhipsterFunc.addGradleDependency('compile', 'org.apache.oltu.oauth2', 'org.apache.oltu.oauth2.client', '1.0.1');
      }
    }
  },

});
