sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (Controller) => {
  "use strict";

  return Controller.extend("QA_REJECTION_SRV.controller.View1", {
    onInit() {
      const sServiceUrl = "/ZMMGW_QUALTITY_REJECTION_SRV/";
      // const oModel = new ODataModel(sServiceUrl, {
      //   user: "ESSA_ABAP01",
      //   password: "Expound@1234",
      //   defaultBindingMode: "TwoWay",
      //   useBatch: false,
      // });

      var oModel = this.getOwnerComponent().getModel();

      oModel.read("/quality_control_kpi", {
        urlParameters: { "$top": "1" },
        success: (oData) => {
          // normalize first object for v2 (d.results) or v4 (value) or direct
          const first =
            (oData && oData.d && oData.d.results && oData.d.results[0]) ||
            (oData && oData.results && oData.results[0]) ||
            (oData && oData.value && oData.value[0]) ||
            null;

          // replace undefined with null and create string for TextArea
          const firstString = first ? JSON.stringify(first, null, 2) : "";

          // set model on the VIEW (not on controller)
          const oJsonModel = new sap.ui.model.json.JSONModel({
            first: first,
            firstString: firstString
          });
          this.getView().setModel(oJsonModel, "firstModel");

          // debug
          console.log("FIRST OBJECT (plain):", first);
          console.log("FIRST OBJECT (text):", firstString);
        },
        error: (err) => console.error("Read error:", err)
      });

      // URL for EBELP = '01000'
      const sUrl1000 =
        sServiceUrl +
        "quality_control_kpi/$count?$filter=" +
        encodeURIComponent("EBELP eq '01000'");
      console.log("Request URL 01000:", sUrl1000);

      oModel.read("/quality_control_kpi/$count", {
        urlParameters: { $filter: "EBELP eq '01000'" },
        success: (oData) => {
          console.log("Count for EBELP 01000:", oData);
        },
        error: (err) => {
          console.error("Error fetching count for 01000", err);
        },
      });

      // URL for EBELP = '2100'
      const sUrl2100 =
        sServiceUrl +
        "quality_control_kpi/$count?$filter=" +
        encodeURIComponent("EBELP eq '2100'");
      console.log("Request URL 2100:", sUrl2100);

      oModel.read("/quality_control_kpi/$count", {
        urlParameters: { $filter: "EBELP eq '2100'" },
        success: (oData) => {
          console.log("Count for EBELP 2100:", oData);
        },
        error: (err) => {
          console.error("Error fetching count for 2100", err);
        },
      });
    },

  });
});