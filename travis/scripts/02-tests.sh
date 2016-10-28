#!/bin/bash
set -ev
#--------------------------------------------------
# Launch tests
#--------------------------------------------------
cd $JHIPSTER_SAMPLES/$JHIPSTER
pwd
echo "hystrix.command.default.execution.timeout.enabled: false" >> src/test/resources/config/application.yml
./mvnw test
