const chalk = require('chalk');
const packagejs = require('../../package.json');
const semver = require('semver');
const BaseGenerator = require('generator-jhipster/generators/generator-base');
const jhipsterConstants = require('generator-jhipster/generators/generator-constants');
const request = require('sync-request');
const path = require('path');
const shelljs = require('shelljs');
const _ = require('underscore.string');


module.exports = class extends BaseGenerator {
    get initializing() {
        return {
            init() {
                this.option('regen', {
                    desc: 'Regenerates all saved clients',
                    type: Boolean,
                    defaults: false
                });
            },
            readConfig() {
                this.jhipsterAppConfig = this.getJhipsterAppConfig();
                if (!this.jhipsterAppConfig) {
                    this.error('Can\'t read .yo-rc.json');
                }
                this.apis = this.config.get('apis') || {};
            },
            displayLogo() {
                // Have Yeoman greet the user.
                this.log(`\nWelcome to the ${chalk.bold.yellow('JHipster swagger-cli')} generator! ${chalk.yellow(`v${packagejs.version}\n`)}`);
            },
            checkJhipster() {
                const currentJhipsterVersion = this.jhipsterAppConfig.jhipsterVersion;
                const minimumJhipsterVersion = packagejs.dependencies['generator-jhipster'];
                if (!semver.satisfies(currentJhipsterVersion, minimumJhipsterVersion)) {
                    this.warning(`\nYour generated project used an old JHipster version (${currentJhipsterVersion})... you need at least (${minimumJhipsterVersion})\n`);
                }
            }
        };
    }

    prompting() {
        if (this.options.regen) {
            return;
        }

        const hasExistingApis = Object.keys(this.apis).length !== 0;
        let actionList;
        const availableDocs = [];
        try {
            const swaggerResources = request('GET', 'http://localhost:8080/swagger-resources', {
                // This header is needed to use the custom /swagger-resources controller
                // and not the default one that has only the gateway's swagger resource
                headers: { Accept: 'application/json, text/javascript;' }
            });

            JSON.parse(swaggerResources.getBody()).forEach((swaggerResource) => {
                availableDocs.push({
                    value: { url: `http://localhost:8080${swaggerResource.location}`, name: swaggerResource.name },
                    name: `${swaggerResource.name} (${swaggerResource.location})`
                });
            });

            this.log('The following swagger-docs have been found at http://localhost:8080');
            availableDocs.forEach((doc) => {
                this.log(`* ${chalk.green(doc.name)} : ${doc.value.name}`);
            });
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
            actionList.push({ value: 'all', name: 'Generate all stored API clients' });
            actionList.push({ value: 'select', name: 'Select stored API clients to generate' });
        }

        const newClient = actionList.length === 1;

        const prompts = [
            {
                when: !newClient,
                type: 'list',
                name: 'action',
                message: 'What do you want to do ?',
                choices: actionList
            },
            {
                when: response => response.action === 'new-detected',
                type: 'list',
                name: 'availableDoc',
                message: 'Select the doc for which you want to create a client',
                choices: availableDocs
            },
            {
                when: response => response.action === 'new-detected' && this.jhipsterAppConfig.serviceDiscoveryType === 'eureka',
                type: 'confirm',
                name: 'useServiceDiscovery',
                message: 'Do you want to use Eureka service discovery ?',
                default: true
            },
            {
                when: response => response.action === 'new' || newClient,
                type: 'input',
                name: 'inputSpec',
                message: 'Where is your Swagger/OpenAPI spec (URL or path) ?',
                default: 'http://petstore.swagger.io/v2/swagger.json',
                store: true
            },
            {
                when: response => (['new', 'new-detected'].includes(response.action) || newClient) && !response.useServiceDiscovery,
                type: 'input',
                name: 'cliName',
                validate: (input) => {
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
                when: response => ['new', 'new-detected'].includes(response.action) || newClient,
                type: 'confirm',
                name: 'saveConfig',
                message: 'Do you want to save this config for future reuse ?',
                default: false
            },
            {
                when: response => response.action === 'select',
                type: 'checkbox',
                name: 'selected',
                message: 'Select which APIs you want to generate',
                choices: () => {
                    const choices = [];
                    Object.keys(this.apis).forEach((cliName) => {
                        choices.push({
                            name: `${cliName} (${this.apis[cliName].spec})`,
                            value: { cliName, spec: this.apis[cliName] }
                        });
                    });
                    return choices;
                }
            }
        ];

        const done = this.async();
        this.prompt(prompts).then((props) => {
            if (props.availableDoc !== undefined) {
                props.inputSpec = props.availableDoc.url;
                props.cliName = props.availableDoc.name;
            }
            this.props = props;
            done();
        });
    }

    get configuring() {
        return {
            determineApisToGenerate() {
                this.apisToGenerate = {};
                if (this.options.regen || this.props.action === 'all') {
                    this.apisToGenerate = this.apis;
                } else if (['new', 'new-detected'].includes(this.props.action) || this.props.action === undefined) {
                    this.apisToGenerate[this.props.cliName] = { spec: this.props.inputSpec, useServiceDiscovery: this.props.useServiceDiscovery };
                } else if (this.props.action === 'select') {
                    this.props.selected.forEach(function (selection) {
                        this.apisToGenerate[selection.cliName] = selection.spec;
                    });
                }
            },

            saveConfig() {
                if (!this.options.regen && this.props.saveConfig) {
                    this.apis[this.props.cliName] = this.apisToGenerate[this.props.cliName];
                    this.config.set('apis', this.apis);
                }
            }
        };
    }

    get writing() {
        return {
            callSwaggerCodegen() {
                this.baseName = this.jhipsterAppConfig.baseName;
                this.authenticationType = this.jhipsterAppConfig.authenticationType;
                this.packageName = this.jhipsterAppConfig.packageName;
                this.packageFolder = this.jhipsterAppConfig.packageFolder;
                this.buildTool = this.jhipsterAppConfig.buildTool;

                this.javaDir = `${jhipsterConstants.SERVER_MAIN_SRC_DIR + this.packageFolder}/`;
                const jarPath = path.resolve(__dirname, '../jar/openapi-generator-cli-3.0.0-SNAPSHOT.jar');

                Object.keys(this.apisToGenerate).forEach((cliName) => {
                    const inputSpec = this.apisToGenerate[cliName].spec;
                    const cliPackage = `${this.packageName}.client.${_.underscored(cliName)}`;
                    this.log(chalk.green(`Generating client code for ${cliName} (${inputSpec})`));

                    let execLine = `java -Dmodels -Dapis -DsupportingFiles=ApiKeyRequestInterceptor.java,ClientConfiguration.java -jar ${jarPath} generate` +
                        ` -t ${path.resolve(__dirname, 'templates/swagger-codegen/libraries/spring-cloud')} -l spring --library spring-cloud ` +
                        ` -i ${inputSpec} --artifact-id ${_.camelize(cliName)} --api-package ${cliPackage}.api` +
                        ` --model-package ${cliPackage}.model` +
                        ' --type-mappings DateTime=OffsetDateTime,Date=LocalDate --import-mappings OffsetDateTime=java.time.OffsetDateTime,LocalDate=java.time.LocalDate' +
                        ` -DdateLibrary=custom,basePackage=${this.packageName}.client,configPackage=${cliPackage},title=${_.camelize(cliName)}`;
                    if (this.apisToGenerate[cliName].useServiceDiscovery) {
                        execLine += ' --additional-properties ribbon=true';
                    }
                    this.log(execLine);
                    shelljs.exec(execLine);
                });
            },

            writeTemplates() {
                // function to use directly template
                this.template = (source, destination) => this.fs.copyTpl(
                    this.templatePath(source),
                    this.destinationPath(destination),
                    this
                );
                if (this.buildTool === 'maven') {
                    if (!['microservice', 'gateway', 'uaa'].includes(this.applicationType)) {
                        let exclusions;
                        if (this.authenticationType === 'session') {
                            exclusions = '            <exclusions>\n' +
                            '                <exclusion>\n' +
                            '                    <groupId>org.springframework.cloud</groupId>\n' +
                            '                    <artifactId>spring-cloud-starter-ribbon</artifactId>\n' +
                            '                </exclusion>\n' +
                            '            </exclusions>';
                        }
                        this.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-openfeign', null, exclusions);
                    }
                    this.addMavenDependency('org.springframework.cloud', 'spring-cloud-starter-oauth2');
                } else if (this.buildTool === 'gradle') {
                    if (!['microservice', 'gateway', 'uaa'].includes(this.applicationType)) {
                        if (this.authenticationType === 'session') {
                            const content = 'compile \'org.springframework.cloud:spring-cloud-starter-openfeign\', { exclude group: \'org.springframework.cloud\', module: \'spring-cloud-starter-ribbon\' }';
                            this.rewriteFile('./build.gradle', 'jhipster-needle-gradle-dependency', content);
                        } else {
                            this.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-openfeign');
                        }
                    }
                    this.addGradleDependency('compile', 'org.springframework.cloud', 'spring-cloud-starter-oauth2');
                }

                const mainClassFile = `${this.javaDir + this.getMainClassName()}.java`;

                if (this.applicationType !== 'microservice' || !['uaa', 'jwt'].includes(this.authenticationType)) {
                    this.rewriteFile(mainClassFile, 'import org.springframework.core.env.Environment;', 'import org.springframework.cloud.openfeign.EnableFeignClients;');
                }
                this.rewriteFile(mainClassFile, 'import org.springframework.core.env.Environment;', 'import org.springframework.context.annotation.ComponentScan;');

                const componentScan = `${'@ComponentScan( excludeFilters = {\n' +
          '    @ComponentScan.Filter('}${this.packageName}.client.ExcludeFromComponentScan.class)\n` +
          '})';
                this.rewriteFile(mainClassFile, '@SpringBootApplication', componentScan);

                if (this.applicationType !== 'microservice' || !['uaa', 'jwt'].includes(this.authenticationType)) {
                    this.rewriteFile(mainClassFile, '@SpringBootApplication', '@EnableFeignClients');
                }
                this.template('src/main/java/package/client/_ExcludeFromComponentScan.java', `${this.javaDir}/client/ExcludeFromComponentScan.java`);
            }
        };
    }

    end() {
        this.log('End of swagger-cli generator');
    }
};
