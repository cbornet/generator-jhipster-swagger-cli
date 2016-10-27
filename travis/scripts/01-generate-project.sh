#!/bin/bash
set -ev
#-------------------------------------------------------------------------------
# Generate the project with yo jhipster
#-------------------------------------------------------------------------------
cd $JHIPSTER_SAMPLES/$JHIPSTER
pwd

npm link generator-jhipster-swagger-cli
yo jhipster-swagger-cli --regen --force
ls -al $JHIPSTER_SAMPLES/$JHIPSTER/src/main/java/client
