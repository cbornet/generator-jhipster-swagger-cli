#!/bin/bash
set -ev
#--------------------------------------------------
# Launch tests
#--------------------------------------------------
cd $JHIPSTER_SAMPLES/$JHIPSTER
pwd
./mvnw test
