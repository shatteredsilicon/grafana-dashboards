/// <reference path="../../headers/common.d.ts" />

import {MetricsPanelCtrl} from 'app/plugins/sdk';
import moment from 'moment';
import $ from 'jquery';

export class PanelCtrl extends MetricsPanelCtrl {
    /**
     * Urls to define panels templates
     */
    static TEMPLATES = {
        MAIN: 'index.html',
    };

    /**
     * Urls to define API endpoints
     */
    static API = {
        GET_CURRENT_VERSION: '/configurator/v1/version',
        CHECK_FOR_UPDATE: '/configurator/v1/check-update',
    };

    /**
     * Date format otpions
     */
    static RELEASE_DATE_OPTION = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }

    /**
     * Grafana param, define url of template that will be used for panel
     */
    static templateUrl: string = PanelCtrl.TEMPLATES.MAIN;

    constructor(public $scope, public $injector, public $http) {
        super($scope, $injector);

        // Re-init all scope params
        this.reset($scope);

        $scope.checkForUpdate = this.checkForUpdate.bind(this, $scope, $http);
        $scope.getCurrentVersion = this.getCurrentVersion.bind(this, $scope, $http);
        $scope.getCurrentVersion($scope, $http);
        $scope.checkForUpdate($scope, $http);
    }

    /**
     * Send request to check if update possible and re-init params
     */
    private checkForUpdate($scope, $http): void {
        const refreshButton = $('#refresh');
        refreshButton.addClass('fa-spin');
        $scope.isChecked = false;

        $http({
            method: 'GET',
            url: PanelCtrl.API.CHECK_FOR_UPDATE,
        }).then((res) => {
            $scope.latestVersion = res.data.version || '';
            $scope.latestReleaseDate = res.data.release_date ? (new Date(res.data.release_date)).toLocaleString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}) : '';
            $scope.updateNeeded = res.data.update_needed || false;
            $scope.lastCheckDate = moment(Number(Date.now().toString())).locale('en').format('MMMM DD, H:mm');
        }).catch(() => {
            $scope.latestVersion = '';
            $scope.latestReleaseDate = '';
        }).finally(() => {
            $scope.isChecked = true;
        });
        refreshButton.removeClass('fa-spin');
    }

    /**
     * Send request to get current version
     */
    private getCurrentVersion($scope, $http): void {
        $http({
            method: 'GET',
            url: PanelCtrl.API.GET_CURRENT_VERSION,
        }).then((res) => {
            $scope.currentVersion = res.data.version;
            $scope.currentReleaseDate = res.data.release_date ? (new Date(res.data.release_date)).toLocaleString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}) : '';
            $('#refresh').removeClass('fa-spin');
        }).catch(() => {
            $('#refresh').removeClass('fa-spin');
            //TODO: add error handler
        });
    }

    /**
     * Re-init all inner parameters that can be changed during update
     */
    private reset($scope): void {
        $scope.isChecked = false;
    }
}
