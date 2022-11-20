/// <reference path="../../headers/common.d.ts" />

import {MetricsPanelCtrl} from 'app/plugins/sdk';
import moment from 'moment';
import $ from 'jquery';

import config from 'app/core/config';

export class PanelCtrl extends MetricsPanelCtrl {
    /**
     * Urls to define panels templates
     */
    static TEMPLATES = {
        MAIN: 'pmm-update-panel/index.html',
    };

    /**
     * Urls to define API endpoints
     */
    static API = {
        GET_CURRENT_VERSION: '/configurator/v1/version',
        CHECK_FOR_UPDATE: '/configurator/v1/check-update',
    };

    /**
     * Possible statuses of update version process (returned by backend)
     */
    static PROCESS_STATUSES = {
        FAILED: 'failed',
        IN_PROGRESS: 'running',
        DONE: 'succeeded',
        ERROR: 'error'
    };
    /**
     * Possible errors during update process
     */
    static ERRORS = {
        UPDATE: 'Error during update',
        NOTHING_TO_UPDATE: 'Nothing to update',
        INCORRECT_SERVER_RESPONSE: 'Incorrect server response'
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

        $scope.logLocation = '';
        $scope.version = '';
        $scope.errorMessage = '';
        $scope.lastCheckDate = localStorage.getItem('lastCheck') ? moment(Number(localStorage.getItem('lastCheck'))).locale('en').format('MMMM DD, H:mm') : '';
        $scope.currentVersion = localStorage.getItem('currentVersion') || '';
        $scope.currentReleaseDate = localStorage.getItem('currentReleaseDate') || '';
        $scope.nextVersion = localStorage.getItem('nextVersion') || '';
        $scope.newReleaseDate = localStorage.getItem('newReleaseDate') || '';

        $scope.checkForUpdate = this.checkForUpdate.bind(this, $scope, $http);
        $scope.getLog = this.getLog.bind(this, $scope, $http);
        $scope.showReleaseNotes = this.showReleaseNotes.bind(this, $scope);
        $scope.getCurrentVersion = this.getCurrentVersion.bind(this, $scope, $http);
        $scope.getCurrentVersion($scope, $http);
        const timeDiff = Date.now() - Number(localStorage.getItem('lastCheck'));
        if (timeDiff >= 1000 * 60 * 60) {
            this.checkForUpdate($scope, $http);
        }
    }

    /**
     * Show error message if update is fail
     * @param message - kind of error message
     */
    public displayError($scope, message) {
        $scope.isChecked = true;
        $scope.errorMessage = message;
        setTimeout(() => {
            $scope.isChecked = false;
            $scope.errorMessage = '';
            $scope.$apply();
        }, 5000);
    }

    /**
     * Send request to check if update possible and re-init params
     */
    private checkForUpdate($scope, $http): void {
        const refreshButton = $('#refresh');
        refreshButton.addClass('fa-spin');

        $http({
            method: 'GET',
            url: PanelCtrl.API.CHECK_FOR_UPDATE,
        }).then((res) => {
            $scope.isChecked = true;
            $scope.nextVersion = res.data.version || '';
            $scope.newReleaseDate = res.data.release_date ? (new Date(res.data.release_date)).toLocaleString('en-US', PanelCtrl.RELEASE_DATE_OPTION) : '';

            this.getCurrentTime($scope);
            this.setNextVersionData($scope);
        }).catch(() => {
            this.displayError($scope, PanelCtrl.ERRORS.NOTHING_TO_UPDATE);
            this.getCurrentTime($scope);
            this.setNextVersionData();
        });
        refreshButton.removeClass('fa-spin');
    }

    /**
     * Save current time to local storage
     * @param $scope
     */
    public getCurrentTime($scope) {
        localStorage.setItem('lastCheck', Date.now().toString());
        $scope.lastCheckDate = moment(Number(localStorage.getItem('lastCheck'))).locale('en').format('MMMM DD, H:mm');
    }

    /**
     * Send request to get current version
     */
    private getCurrentVersion($scope, $http): void {
        $http({
            method: 'GET',
            url: PanelCtrl.API.GET_CURRENT_VERSION,
        }).then((res) => {
            $scope.version = res.data.version;
            $scope.currentReleaseDate = res.data.release_date ? (new Date(res.data.release_date)).toLocaleString('en-US', PanelCtrl.RELEASE_DATE_OPTION) : '';
            localStorage.setItem('currentVersion', $scope.version);
            localStorage.setItem('currentReleaseDate', $scope.currentReleaseDate);
            $scope.currentVersion = localStorage.getItem('currentVersion');
            $scope.currentReleaseDate = localStorage.getItem('currentReleaseDate');
            $('#refresh').removeClass('fa-spin');
        }).catch(() => {
            $('#refresh').removeClass('fa-spin');
            //TODO: add error handler
        });
    }

    /**
     * Send request for get info about update status
     */
    private getLog($scope, $http): void {
        if (!$scope.logLocation.length) return;

        $http({
            method: 'GET',
            url: $scope.logLocation,
        }).then(response => {
            $scope.output = response.data.detail;
            if (response.data.title === PanelCtrl.PROCESS_STATUSES.IN_PROGRESS) window.setTimeout(this.getLog.bind(this, $scope, $http), 1000);

            if (response.data.title === PanelCtrl.PROCESS_STATUSES.DONE) {
                this.reset($scope);
                $scope.version = $scope.errorMessage ? $scope.version : $scope.nextVersion;
                $scope.currentReleaseDate = $scope.errorMessage ? $scope.currentReleaseDate : $scope.nextReleaseDate;
                localStorage.setItem('currentVersion', $scope.version);
                $scope.currentVersion = localStorage.getItem('currentVersion');
                this.setNextVersionData();
            }
            if (response.data.title === PanelCtrl.PROCESS_STATUSES.FAILED) {
                $scope.isChecked = true;
                $scope.errorMessage = PanelCtrl.ERRORS.UPDATE;
            }
        }).catch(() => {
            this.reset($scope);
            this.setNextVersionData();
        });
    }

    /**
     * Send request to get info about new version
     */
    private showReleaseNotes($scope) {
        // TODO: will be implemented after API release
    }

    private setNextVersionData($scope: any = false) {
        localStorage.setItem('nextVersion', !$scope ? '' : $scope.nextVersion);
        localStorage.setItem('newReleaseDate', !$scope ? '' : $scope.newReleaseDate);
    }

    /**
     * Re-init all inner parameters that can be changed during update
     */
    private reset($scope): void {
        $scope.output = '';
        $scope.isChecked = false;
        $scope.isOutputShown = true;
    }
}
