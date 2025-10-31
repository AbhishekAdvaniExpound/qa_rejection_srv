/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["QA_REJECTION_SRV/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
