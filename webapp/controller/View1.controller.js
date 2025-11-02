sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/GenericTile",
    "sap/m/TileContent",
    "sap/m/NumericContent",
  ],
  (Controller, JSONModel, GenericTile, TileContent, NumericContent) => {
    "use strict";

    return Controller.extend("qa_rejection_srv.controller.View1", {
      onInit() {
        const sServiceUrl = "/ZMMGW_QUALTITY_REJECTION_SRV/";
        const oModel = this.getOwnerComponent().getModel();

        // Load first record for debug display
        oModel.read("/quality_control_kpi", {
          urlParameters: { $top: "1" },
          success: (oData) => {
            const first =
              (oData && oData.d && oData.d.results && oData.d.results[0]) ||
              (oData && oData.results && oData.results[0]) ||
              (oData && oData.value && oData.value[0]) ||
              null;

            const firstString = first ? JSON.stringify(first, null, 2) : "";
            const oJsonModel = new JSONModel({ first, firstString });
            this.getView().setModel(oJsonModel, "firstModel");

            console.log("FIRST OBJECT:", first);
          },
          error: (err) => console.error("Read error:", err),
        });

        // Manual test count requests for EBELP = 01000 and 2100
        const sUrl1000 =
          sServiceUrl +
          "quality_control_kpi/$count?$filter=" +
          encodeURIComponent("EBELP eq '01000'");
        console.log("Request URL 01000:", sUrl1000);

        oModel.read("/quality_control_kpi/$count", {
          urlParameters: { $filter: "EBELP eq '01000'" },
          success: (oData) => console.log("Count for EBELP 01000:", oData),
          error: (err) => console.error("Error fetching count for 01000", err),
        });

        const sUrl2100 =
          sServiceUrl +
          "quality_control_kpi/$count?$filter=" +
          encodeURIComponent("EBELP eq '2100'");
        console.log("Request URL 2100:", sUrl2100);

        oModel.read("/quality_control_kpi/$count", {
          urlParameters: { $filter: "EBELP eq '2100'" },
          success: (oData) => console.log("Count for EBELP 2100:", oData),
          error: (err) => console.error("Error fetching count for 2100", err),
        });

        // Dynamic tile creation using bukrs values
        this._loadDynamicTiles(oModel);
      },

      _loadDynamicTiles(oModel) {
        oModel.read("/quality_control_kpi", {
          urlParameters: { $select: "bukrs", $top: 2000 },
          success: (oData) => {
            const aBukrs = [...new Set(oData.results.map((r) => r.bukrs))];
            console.log("[BUKRS Unique]", aBukrs);
            this._createDynamicTiles(aBukrs, oModel);
          },
          error: (err) => console.error("Error fetching bukrs list:", err),
        });
      },

      _createDynamicTiles(aBukrs, oModel) {
        const oHBox = this.byId("tileContainer");
        if (!oHBox) return;
        oHBox.destroyItems();

        const oTileModel = new JSONModel();
        this.getView().setModel(oTileModel, "tileModel");

        aBukrs.forEach((bukrs) => {
          oTileModel.setProperty(`/count${bukrs}`, 0);

          const oNumeric = new NumericContent({
            value: `{tileModel>/count${bukrs}}`,
            truncateValueTo: 5,
          });

          const oTile = new sap.m.GenericTile({
            header: `Company ${bukrs}`,
            press: this.onTilePress.bind(this),
            customData: [
              new sap.ui.core.CustomData({ key: "bukrs", value: bukrs }),
            ],
            tileContent: [
              new sap.m.TileContent({
                unit: "lines",
                content: [oNumeric],
              }),
            ],
          });

          // add spacing: right + bottom margins
          oTile.addStyleClass("sapUiMediumMarginEnd sapUiMediumMarginBottom");

          oHBox.addItem(oTile);
          this._updateCount(oModel, bukrs, oTileModel);
        });
      },

      _updateCount(oModel, bukrs, oTileModel) {
        const sBase = oModel.sServiceUrl.replace(/\/$/, "");
        const sUrl = `${sBase}/quality_control_kpi/$count?$filter=${encodeURIComponent(
          "bukrs eq '" + bukrs + "'"
        )}`;

        fetch(sUrl, { credentials: "include" })
          .then((r) => r.text())
          .then((t) => {
            const count = parseInt((t || "").trim(), 10);
            oTileModel.setProperty(`/count${bukrs}`, isNaN(count) ? 0 : count);
            console.log(`[COUNT][${bukrs}]`, count);
          })
          .catch((e) => console.error(`[COUNT-ERR][${bukrs}]`, e));
      },

      onTilePress(oEvent) {
        const bukrs = oEvent
          .getSource()
          .getCustomData()
          .find((d) => d.getKey() === "bukrs")
          .getValue();
        this.getOwnerComponent().getRouter().navTo("Company", { bukrs });
      },
    });
  }
);
