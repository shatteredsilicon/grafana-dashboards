/// <reference path="../../headers/common.d.ts" />

import {MetricsPanelCtrl} from 'app/plugins/sdk';
import config from 'app/core/config';
import $ from "jquery";

export class PanelCtrl extends MetricsPanelCtrl {

    static template = `
		<iframe ng-src="{{ trustSrc(url) }}"
			style="width: 100%; height: 400px; border: 0;" scrolling="no" />
	`;

    base_url = '/qan/ssm-list';

    constructor($scope, $injector, templateSrv, $sce, $http) {
        super($scope, $injector);
        $scope.trustSrc = (src) => $sce.trustAsResourceUrl(src);
        $scope.qanParams = {
            'theme': config.bootData.user.lightTheme ? 'light' : 'dark'
        };

        $scope.url = this.base_url + '?theme=' + $scope.qanParams.theme;
    }

    link($scope, elem) {
        const frame = elem.find('iframe');

        $scope.ctrl.calculatePanelHeight = () => {
            const panel = frame.closest('[class=panel-container]');
            const h = frame.contents().find('body').height() || 730;
            const panelHeight = h + 94;
            const frameHeight = h + 62;

            if (frame.height() === frameHeight && panel.height() === panelHeight) return;

            frame.height(frameHeight);
            panel.height(panelHeight);
        };

        this.disableGrafanaPerfectScroll(elem);
        this.fixMenuVisibility(elem);

        frame.on('load', () => {
            $scope.ctrl.calculatePanelHeight();
            setInterval($scope.ctrl.calculatePanelHeight, 100);
        });
    }

    /**
     * Workaround for scrolling through iframe
     * Grafana perfect scroll is broken for iframe and should be disabled for this case
     * @param elem - qan app panel HTML element
     * @returns {void, boolean}
     */
    private disableGrafanaPerfectScroll(elem): void | boolean {
        if (!elem || !elem[0]) return false;

        const perfectScrollContainers = (<any>elem[0].ownerDocument.getElementsByClassName('ps'));
        const rightScrollbarContainers = (<any>elem[0].ownerDocument.getElementsByClassName('ps__thumb-y'));

        [].forEach.call(perfectScrollContainers, container => container.setAttribute('style', 'overflow: auto !important'));
        [].forEach.call(rightScrollbarContainers, container => container.setAttribute('style', 'display: none !important'));
    }

    private fixMenuVisibility(elem): void | boolean {
        if (!elem || !elem[0]) return false;

        const menu = (<any>elem[0].ownerDocument.getElementsByClassName('dropdown-menu'));

        [].forEach.call(menu, e => e.setAttribute('style', 'z-index: 1001'));
    }
}