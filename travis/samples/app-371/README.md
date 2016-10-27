# jhipsterapp

This application was generated using JHipster, you can find documentation and help at [https://jhipster.github.io](https://jhipster.github.io).

## Development

Before you can build this project, you must install and configure the following dependencies on your machine:


## Building for production

To optimize the jhipsterapp client for production, run:

    ./mvnw -Pprod clean package

To ensure everything worked, run:

    java -jar target/*.war
    
## Continuous Integration

To setup this project in Jenkins, use the following configuration:

* Project name: `jhipsterapp`
* Source Code Management
    * Git Repository: `git@github.com:xxxx/jhipsterapp.git`
    * Branches to build: `*/master`
    * Additional Behaviours: `Wipe out repository & force clone`
* Build Triggers
    * Poll SCM / Schedule: `H/5 * * * *`
* Build
    * Invoke Maven / Tasks: `-Pprod clean package`
* Post-build Actions
    * Publish JUnit test result report / Test Report XMLs: `build/test-results/*.xml`

[JHipster]: https://jhipster.github.io/
[Gatling]: http://gatling.io/
