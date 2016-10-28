'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var packagejs = require(__dirname + '/../../package.json');
var semver = require('semver');
var request = require('sync-request');
var path = require('path');
var shelljs = require('shelljs');
var CodeGen = require('swagger-js-codegen').CodeGen;
var _ = require('underscore.string');

// Stores JHipster variables
var jhipsterVar = { moduleName: 'swagger-cli' };

// Stores JHipster functions
var jhipsterFunc = {};

function isURL(str) {
  return /\b(https?|ftp|file):\/\/[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|‌​]/.test(str);
}

var apis;

module.exports = yeoman.Base.extend({
  constructor: function () {
    yeoman.Base.apply(this, arguments);

    // This adds support for a `--[no-]regen` flag
    this.option('regen', {
      desc: 'Regenerates all saved clients',
      type: Boolean,
      defaults: false
    });
    this.hasBackEnd = false;
    this.hasFrontEnd = false;
    var jhipsterVersion = this.fs.readJSON('.yo-rc.json')['generator-jhipster'].jhipsterVersion;
    this.isJHipsterV2 = !jhipsterVersion || semver.lt(jhipsterVersion, '3.0.0');
  },

  initializing: {
    compose: function () {
      this.composeWith('jhipster:modules',
        {
          options: {
            jhipsterVar: jhipsterVar,
            jhipsterFunc: jhipsterFunc
          }
        },
        this.options.testmode ? { local: require.resolve('generator-jhipster/modules') } : null
      );
    },
    displayLogo: function () {
      // Have Yeoman greet the user.
      this.log('Welcome to the ' + chalk.red('JHipster swagger-cli') + ' generator! ' +
        chalk.yellow('v' + packagejs.version + '\n'));
    },
    readConfig: function () {
      apis = this.config.get('apis') || {};
    }
  },

  prompting: {
    askForInputSpec: function () {
      if (this.options.regen) {
        return;
      }

      var done = this.async();
      var hasExistingApis = Object.keys(apis).length !== 0;

      try {
        //Check if there is a registry running
        var res = request('GET', 'http://localhost:8761/health');
        if (JSON.parse(res.getBody()).status === 'UP') {

          this.log(chalk.yellow('JHipster registry') + ' detected on localhost:8761.');

          var swaggerResources = request('GET', 'http://localhost:8080/swagger-resources', {
            //This header is needed to use the custom /swagger-resources controller
            // and not the default one that has only the gateway's swagger resource
            headers: { Accept: 'application/json, text/javascript;' }
          });
          var availableDocs = [];
          JSON.parse(swaggerResources.getBody()).forEach(function (swaggerResource) {
            availableDocs.push({
              value: 'http://localhost:8080' + swaggerResource.location,
              name: swaggerResource.name + ' (' + swaggerResource.location + ')'
            });
          });

          this.log('The following swagger-docs have been found :');
          availableDocs.forEach(function (doc) {
            this.log('* ' + chalk.green(doc.name) + ' : ' + doc.value);
          }.bind(this));

          //If all the previous requests didn't fail, we set the flag
          var isMicroserviceConfig = true;
        }
      } catch (err) {
        isMicroserviceConfig = false;
      }

      var prompts = [
        {
          when: function () {
            return isMicroserviceConfig;
          },
          type: 'confirm',
          name: 'useRegistry',
          message: 'Do you want to use one of these swagger-docs ?',
          default: true
        },
        {
          when: function (response) {
            return response.useRegistry;
          },
          type: 'list',
          name: 'inputSpec',
          message: 'Select the doc for which you want to create a client',
          choices: availableDocs
        },
        {
          when: function () {
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
          when: function (response) {
            return (response.action === 'new' || !hasExistingApis) && response.inputSpec === undefined;
          },
          type: 'input',
          name: 'inputSpec',
          message: 'Where is your Swagger/OpenAPI spec (URL or path) ?',
          default: 'http://petstore.swagger.io/v2/swagger.json',
          store: true
        },
        {
          when: function (response) {
            return response.action === 'new' || !hasExistingApis;
          },
          type: 'input',
          name: 'cliName',
          validate: function (input) {
            if (!/^([a-zA-Z0-9_]*)$/.test(input)) {
              return 'Your API client name cannot contain special characters or a blank space';
            }
            if (input === '') {
              return 'Your API client name cannot be empty';
            }
            return true;
          },
          message: 'What is the unique name for your API client ?',
          default: 'petstore',
          store: true
        },
        {
          when: function (response) {
            return response.action === 'new' || !hasExistingApis;
          },
          type: 'checkbox',
          name: 'cliTypes',
          message: 'Select which type of API client to generate',
          default: ['front'],
          store: true,
          choices: [
            { name: 'front-end client', value: 'front' },
            { name: 'back-end client', value: 'back' }
          ]
        },
        {
          when: function (response) {
            return response.action === 'new' || !hasExistingApis;
          },
          type: 'confirm',
          name: 'saveConfig',
          message: 'Do you want to save this config for future reuse ?',
          default: false
        },
        {
          when: function (response) {
            return response.action === 'select';
          },
          type: 'checkbox',
          name: 'selected',
          message: 'Select which APIs you want to generate',
          choices: function () {
            var choices = [];
            Object.keys(apis).forEach(function (cliName) {
              choices.push({ name: cliName + ' (' + apis[cliName].spec + ' - ' + apis[cliName].cliTypes + ')', value: { cliName: cliName, spec: apis[cliName] } });
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
    determineApisToGenerate: function () {
      this.apisToGenerate = {};
      if (this.options.regen || this.props.action === 'all') {
        this.apisToGenerate = apis;
      } else if (this.props.action === 'new' || this.props.action === undefined) {
        this.apisToGenerate[this.props.cliName] = { spec: this.props.inputSpec, cliTypes: this.props.cliTypes };
      } else if (this.props.action === 'select') {
        this.props.selected.forEach(function (selection) {
          this.apisToGenerate[selection.cliName] = selection.spec;
        }, this);
      }
    },

    saveConfig: function () {
      if (!this.options.regen && this.props.saveConfig) {
        apis[this.props.cliName] = this.apisToGenerate[this.props.cliName];
        this.config.set('apis', apis);
      }
    }
  },

  writing: {
    callSwaggerCodegen: function () {
      this.packageName = jhipsterVar.packageName;
      var jarPath = path.resolve(__dirname, '../jar/swagger-codegen-cli-2.2.2-SNAPSHOT.jar');
      Object.keys(this.apisToGenerate).forEach(function (cliName) {
        var inputSpec = this.apisToGenerate[cliName].spec;
        this.apisToGenerate[cliName].cliTypes.forEach(function (cliType) {
          this.log(chalk.green('Generating ' + cliType + ' end code for ' + cliName + ' (' + inputSpec + ')'));
          if (cliType === 'front') {
            this.hasFrontEnd = true;
            var swagger = '';
            if (isURL(inputSpec)) {
              var res = request('GET', inputSpec);
              swagger = res.getBody('utf-8');
            } else {
              swagger = this.fs.readFileSync(inputSpec, 'utf-8');
            }
            swagger = JSON.parse(swagger);
            var angularjsSourceCode = CodeGen.getAngularCode({ className: _.classify(cliName), swagger: swagger, moduleName: _.camelize(cliName) });
            var apiScriptFile = 'components/api-clients/' + _.dasherize(_.decapitalize(cliName)) + '.module.js';

            //Determine if jhipster version is 2.x or 3.x
            if (!this.isJHipsterV2) {
              this.fs.write(jhipsterVar.webappDir + '/app/' + apiScriptFile, angularjsSourceCode);
            } else {
              this.fs.write(jhipsterVar.webappDir + '/scripts/' + apiScriptFile, angularjsSourceCode);
              jhipsterFunc.addJavaScriptToIndex(apiScriptFile);
            }
            jhipsterFunc.addAngularJsModule(_.camelize(cliName));
          } else if (cliType === 'back') {
            this.hasBackEnd = true;
            this.cliPackage = jhipsterVar.packageName + '.client.' + _.underscored(cliName);
            var execLine = 'java -Dmodels -Dapis -DsupportingFiles=ApiKeyRequestInterceptor.java,ClientConfiguration.java -jar ' + jarPath + ' generate' +
              ' -t ' + path.resolve(__dirname, 'templates/swagger-codegen/libraries/spring-cloud') +
              ' -l spring --library spring-cloud ' +
              ' -i ' + inputSpec +
              ' --artifact-id ' + _.camelize(cliName) +
              ' --api-package ' + this.cliPackage + '.api' +
              ' --model-package ' + this.cliPackage + '.model' +
              ' --type-mappings DateTime=OffsetDateTime,Date=LocalDate --import-mappings OffsetDateTime=java.time.OffsetDateTime,LocalDate=java.time.LocalDate' +
              ' -DdateLibrary=custom,basePackage=' + jhipsterVar.packageName + '.client,configPackage=' + this.cliPackage + ',title=' + _.camelize(cliName);
            this.log(execLine);
            shelljs.exec(execLine);
          }
        }, this);
      }, this);

    },

    writeTemplates: function () {
      if (!this.hasBackEnd) {
        return;
      }
      if (jhipsterVar.applicationType === 'microservice' || jhipsterVar.applicationType === 'gateway' || jhipsterVar.applicationType === 'uaa') {
        if (jhipsterVar.buildTool === 'maven') {
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-feign');
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-oauth2');
        } else if (jhipsterVar.buildTool === 'gradle') {
          jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-feign');
          jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-oauth2');
        }
      } else {
        if (jhipsterVar.buildTool === 'maven') {
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter', '1.1.1.RELEASE');
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-hystrix', '1.1.5.RELEASE');
          jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-core', '8.16.2');
          jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-slf4j', '8.16.2');
          jhipsterFunc.addMavenDependency('com.netflix.feign', 'feign-hystrix', '8.16.2');
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-oauth2', '1.1.3.RELEASE');
        } else if (jhipsterVar.buildTool === 'gradle') {
          jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter', '1.1.1.RELEASE');
          jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-hystrix', '1.1.5.RELEASE');
          jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-core', '8.16.2');
          jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-slf4j', '8.16.2');
          jhipsterFunc.addGradleDependency('compile', 'com.netflix.feign', 'feign-hystrix', '8.16.2');
          jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-oauth2', '1.1.3.RELEASE');
        }
      }
      var mainClassFile = jhipsterVar.javaDir;
      if (this.isJHipsterV2) {
        mainClassFile += 'Application.java';
      } else {
        mainClassFile += jhipsterVar.mainClassName + '.java';
      }
      var newComponentScan = '@ComponentScan( excludeFilters = {\n' +
        '    @ComponentScan.Filter(' + jhipsterVar.packageName + '.client.ExcludeFromComponentScan.class)\n' +
        '})\n' +
        '@org.springframework.cloud.netflix.feign.EnableFeignClients\n';
      jhipsterFunc.replaceContent(mainClassFile, '@ComponentScan\n', newComponentScan);
      this.template('src/main/java/package/client/_ExcludeFromComponentScan.java', jhipsterVar.javaDir + '/client/ExcludeFromComponentScan.java', this, {});
    }
  },

  install: function () {
    if (!this.isJHipsterV2 && this.hasFrontEnd) {
      this.spawnCommand('gulp', ['inject']);
    }
  }

});
