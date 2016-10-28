'use strict';

angular.module('jhipsterappApp')
    .config(function (uibPaginationConfig) {
        uibPaginationConfig.itemsPerPage = 20;
        uibPaginationConfig.maxSize = 5;
        uibPaginationConfig.boundaryLinks = true;
        uibPaginationConfig.firstText = '«';
        uibPaginationConfig.previousText = '‹';
        uibPaginationConfig.nextText = '›';
        uibPaginationConfig.lastText = '»';
    });
