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
    this.jhipsterVersion = this.fs.readJSON('.yo-rc.json')['generator-jhipster'].jhipsterVersion;
    this.isJHipsterV2 = !this.jhipsterVersion || semver.lt(this.jhipsterVersion, '3.0.0');
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
      var cliTypesChoices = [{ name: 'back-end client', value: 'back' }];
      if (!jhipsterVar.clientFramework || jhipsterVar.clientFramework === 'angular1') {
        cliTypesChoices.push({ name: 'front-end client', value: 'front' });
      }

      var actionList;
      try {
        var swaggerResources = request('GET', 'http://localhost:8080/swagger-resources', {
          // This header is needed to use the custom /swagger-resources controller
          // and not the default one that has only the gateway's swagger resource
          headers: { Accept: 'application/json, text/javascript;' }
        });
        var availableDocs = [];
        JSON.parse(swaggerResources.getBody()).forEach(function (swaggerResource) {
          availableDocs.push({
            value: {url: 'http://localhost:8080' + swaggerResource.location, name: swaggerResource.name},
            name: swaggerResource.name + ' (' + swaggerResource.location + ')'
          });
        });

        this.log('The following swagger-docs have been found at http://localhost:8080');
        availableDocs.forEach(function (doc) {
          this.log('* ' + chalk.green(doc.name) + ' : ' + doc.value.name);
        }.bind(this));
        this.log('');

        actionList = [
          {
            value: 'new-detected',
            name: 'Generate a new API client from one of these swagger-docs'
          },
          {
            value: 'new',
            name: 'Generate a new API client from another swagger-doc'
          }
        ];

      } catch (err) {
        // No live doc found on port 8080
        actionList = [
          {
            value: 'new',
            name: 'Generate a new API client'
          }
        ];
      }

      if (hasExistingApis) {
        actionList.push({value: 'all', name: 'Generate all stored API clients'});
        actionList.push({value: 'select', name: 'Select stored API clients to generate'});
      }

      var newClient = actionList.length === 1;

      var prompts = [
        {
          when: function () {
            return !newClient;
          },
          type: 'list',
          name: 'action',
          message: 'What do you want to do ?',
          choices: actionList
        },
        {
          when: function (response) {
            return response.action === 'new-detected';
          },
          type: 'list',
          name: 'availableDoc',
          message: 'Select the doc for which you want to create a client',
          choices: availableDocs
        },
        {
          when: function (response) {
            return response.action === 'new-detected' && jhipsterVar.jhipsterConfig.serviceDiscoveryType === 'eureka';
          },
          type: 'confirm',
          name: 'useServiceDiscovery',
          message: 'Do you want to use Eureka service discovery ?',
          default: true
        },
        {
          when: function (response) {
            return response.action === 'new' || newClient;
          },
          type: 'input',
          name: 'inputSpec',
          message: 'Where is your Swagger/OpenAPI spec (URL or path) ?',
          default: 'http://petstore.swagger.io/v2/swagger.json',
          store: true
        },
        {
          when: function (response) {
            return (['new', 'new-detected'].includes(response.action) || newClient) && !response.useServiceDiscovery;
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
            return ['new', 'new-detected'].includes(response.action) || newClient;
          },
          type: 'checkbox',
          name: 'cliTypes',
          message: 'Select which type of API client to generate',
          default: ['front'],
          store: true,
          choices: cliTypesChoices
        },
        {
          when: function (response) {
            return ['new', 'new-detected'].includes(response.action) || newClient;
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
        if (props.availableDoc !== undefined) {
          props.inputSpec = props.availableDoc.url;
          props.cliName = props.availableDoc.name;
        }
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
      } else if (['new', 'new-detected'].includes(this.props.action) || this.props.action === undefined) {
        this.apisToGenerate[this.props.cliName] = { spec: this.props.inputSpec, cliTypes: this.props.cliTypes, useServiceDiscovery: this.props.useServiceDiscovery };
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
      var jarPath = path.resolve(__dirname, '../jar/openapi-generator-cli-3.0.0-SNAPSHOT.jar');
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
            if (this.apisToGenerate[cliName].useServiceDiscovery) {
              execLine += ' --additional-properties ribbon=true';
            }
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
      if ((this.jhipsterVersion && semver.gte(this.jhipsterVersion, '4.11.0')) || ['microservice', 'uaa', 'gateway'].includes(jhipsterVar.applicationType)) {
        if (jhipsterVar.buildTool === 'maven') {
          var exclusions;
          if (jhipsterVar.authenticationType === 'session') {
            exclusions = '            <exclusions>' + '\n' +
                        '                <exclusion>' + '\n' +
                        '                    <groupId>org.springframework.cloud</groupId>' + '\n' +
                        '                    <artifactId>spring-cloud-starter-ribbon</artifactId>' + '\n' +
                        '                </exclusion>' + '\n' +
                        '            </exclusions>';
          }
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-feign', null, exclusions);
          jhipsterFunc.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-oauth2');
        } else if (jhipsterVar.buildTool === 'gradle') {
          if (jhipsterVar.authenticationType === 'session') {
            var content = "compile 'org.springframework.cloud:spring-cloud-starter-feign', { exclude group: 'org.springframework.cloud', module: 'spring-cloud-starter-ribbon' }";
            jhipsterFunc.rewriteFile('./build.gradle', 'jhipster-needle-gradle-dependency', content);
          } else {
            jhipsterFunc.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-feign');
          }
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
