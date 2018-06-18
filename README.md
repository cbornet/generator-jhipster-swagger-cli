# generator-jhipster-swagger-cli
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]
> JHipster module to generate client code from an OpenAPI/Swagger definition

# Introduction

This is a [JHipster](http://jhipster.github.io/) module, that is meant to be used in a JHipster application.

This module generates client code using [Spring-Cloud FeignClients](http://projects.spring.io/spring-cloud/spring-cloud.html#spring-cloud-feign) in your JHipster app from an OpenAPI/Swagger definition.

The generated FeignClient can be used in both Monolithic and Micro-service applications.

This module works for JHipster v5+ apps.
For older JHipster version, use version 2.x of this module (branch [v2.x-JHipster2-3-4](https://github.com/cbornet/generator-jhipster-swagger-cli/tree/v2.x-JHipster2-3-4))

This module works with both Swagger v2 and OpenAPI v3 definitions.

# Prerequisites

As this is a [JHipster](http://jhipster.github.io/) module, we expect you have JHipster and its related tools already installed:

- [Installing JHipster](https://jhipster.github.io/installation.html)

# Installation

To install this module:

```bash
npm install -g generator-jhipster-swagger-cli
```

To update this module:
```bash
npm update -g generator-jhipster-swagger-cli
```

# Usage
Run:
```bash
yo jhipster-swagger-cli
```
then answer the questions.
You have the possibility to store a client configuration for future regeneration (eg. if there is an API update).
If you do so, next time you launch the module, you will have the choice to generate a new client or to reuse one or several stored configurations.

## Use the generated back-end Spring-Cloud FeignClient code

### Client configuration

You can configure the generated FeignClients directly from the application.yml.
`RequestInterceptor` beans are generated from the OpenAPI `securitySchemes` and are only activated if relevant properties are set.
If the OpenAPI spec doesn't contain the `securitySchemes`, then you will need to configure the clients by yourself (see [spring-cloud doc](http://projects.spring.io/spring-cloud/spring-cloud.html#spring-cloud-feign) for details.)

#### Configuring basic auth

The basic auth RequestInterceptor is activated if `<clientName>.security.<securityName>.username` is set.
```yaml
petstore:
    security:
        basicAuth:
            username: admin
            password: admin
```

#### Configuring API key auth

The API key RequestInterceptor is activated if `<clientName>.security.<securityName>.key` is set.
```yaml
petstore:
    security:
        apiKey:
            key: 12345
```

#### Configuring OAuth2

The OAuth2 RequestInterceptor is activated if `<clientName>.security.<securityName>.key` is set.
For details on configuring OAuth2, see the [spring-security-oauth2 doc](http://projects.spring.io/spring-security-oauth/docs/oauth2.html#protected-resource-configuration).
```yaml
petstore:
    security:
        passwordOauth:
            client-id: myClientId
            client-secret: myClientSecret
            username: myUsername
            password: myPassword
            scopes:
            - read
            - write
```

#### Configuring the remote URL

The remote URL will default to the one from the OpenAPI spec but can be changed with the `<clientName>.url` property.
```yaml
petstore:
    url: http://petstore-uat.swagger.io/v2
```

#### Use Ribbon (w/wo Eureka)

You need to add spring-cloud-starter-ribbon to your pom.xml if needed.
Note that it seems to cause an issue with form-login on monoliths so it is not done by this module.
Then set `<cliName>.url` to blank.
```yaml
petstore:
    url:
    ribbon:
        listOfServers: petstore1.swagger.io,petstore2.swagger.io
```

#### Advanced configuration

If the generated clients don't fit your needs because you want to use Hystrix fallbacks, change the Ribbon context path or use different Feign client configuration, then simply create your own FeignClient beans extending the generated xxxApi classes.

### Calling API methods

For instance if you generated the [petstore](http://petstore.swagger.io) API, you can call the addPet method like this:
```java
@Inject
private PetApiClient petApiClient;
...
Pet myPet = new Pet();
petApiClient.addPet(myPet);
```

# License

Apache-2.0 © [Christophe Bornet]

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-swagger-cli.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-swagger-cli
[travis-image]: https://travis-ci.org/cbornet/generator-jhipster-swagger-cli.svg?branch=master
[travis-url]: https://travis-ci.org/cbornet/generator-jhipster-swagger-cli
[daviddm-image]: https://david-dm.org/cbornet/generator-jhipster-swagger-cli.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/cbornet/generator-jhipster-module
