sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/FilterType",
    "sap/ui/export/Spreadsheet"
], (Controller, Filter, FilterOperator, DateFormat, FilterType, Spreadsheet) => {
    "use strict";
    return Controller.extend("qa_rejection_srv.controller.View2", {
        onInit: function () {

    },
     _applyFilters: function (mOptions) {
            var bControlOnly = !!(mOptions && mOptions.controlOnly);
            var oTable = this.byId("idKpiReportSetTable");
            var aAppFilters = [];

            if (this._routeArgs && this._routeArgs.Footer) {
                aAppFilters.push(new Filter("CompanyCode", FilterOperator.EQ, this._routeArgs.Footer));
            }
            // if (this._routeArgs && this._routeArgs.Wbs) {
            //     aAppFilters.push(new Filter("Pspnr", FilterOperator.EQ, this._routeArgs.Wbs));
            // }

            var oDp = this.byId("idMonthYearDatePicker");
            var sSel = oDp ? oDp.getValue() : "";
            var aCtlFilters = [];
            if (sSel) {
                aCtlFilters.push(new Filter("Spmon", FilterOperator.EQ, sSel));
            }

            var oBinding = oTable.getBinding("items");
            if (oBinding && oBinding.filter) {
                if (!bControlOnly) {
                    // Only apply backend filters (Werks/Wbs) when not control-only
                    oBinding.filter(aAppFilters, FilterType.Application);
                }
                // Always apply MonthYear on the client only
                oBinding.filter(aCtlFilters, FilterType.Control);
            }

            this._updateChart();
            this._updateHeaderTotals();
        }
    });
});        
