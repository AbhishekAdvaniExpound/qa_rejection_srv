/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["qa_rejection_srv/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
