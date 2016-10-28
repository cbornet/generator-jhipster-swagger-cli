'use strict';

angular.module('jhipsterappApp')
    .factory('Register', function ($resource) {
        return $resource('api/register', {}, {
        });
    });


