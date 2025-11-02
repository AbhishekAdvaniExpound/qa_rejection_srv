// controller/View2.controller.js
sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ui/model/json/JSONModel",
  ],
  function (Controller, Filter, FilterOperator, FilterType, JSONModel) {
    "use strict";

    function _yearTriplet() {
      var y = new Date().getFullYear();
      return { y1: y - 1, y2: y, y3: y + 1 };
    }
    function _toNum(v) {
      if (v == null) return 0;
      const n = parseFloat(String(v).replace(",", "."));
      return isNaN(n) ? 0 : n;
    }

    return Controller.extend("qa_rejection_srv.controller.View2", {
      _pgIndexMap: null,

      onInit: function () {
        const r = this.getOwnerComponent().getRouter();
        r.getRoute("Company")?.attachPatternMatched(
          this._onCompanyMatched,
          this
        );
        r.getRoute("RouteView2")?.attachPatternMatched(
          this._onRouteView2Matched,
          this
        );

        this.getView().setModel(
          new JSONModel(
            Object.assign(
              {
                bukrs: "",
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
              },
              _yearTriplet()
            )
          ),
          "view"
        );

        this.getView().setModel(
          new JSONModel({
            bars: [],
            // kpi.avg remains a fraction 0..1 if you still show "% Avg" elsewhere
            kpi: { avg: 0, totalLines: 0, rejectedLines: 0 },
            yMax: 0,
          }),
          "chart"
        );
        this.getView().setModel(new JSONModel([]), "pgModel");

        this._ensureTableBinding();
      },

      // ---------- Routing ----------
      _onCompanyMatched: function (e) {
        const bukrs = e.getParameter("arguments").bukrs;
        this._routeArgs = { Footer: bukrs };
        this.getModel("view").setProperty("/bukrs", bukrs);
        this._applyTableFilters();
        this._rebuildAggregatesFromAll();
      },

      _onRouteView2Matched: function (e) {
        const a = e.getParameter("arguments") || {};
        this._routeArgs = { Footer: a.Footer, Wbs: a.Wbs };
        this.getModel("view").setProperty("/bukrs", a.Footer || "");
        this._applyTableFilters();
        this._rebuildAggregatesFromAll();
      },

      // ---------- Events ----------
      onFilterChanged: function () {
        this._applyTableFilters();
        this._rebuildAggregatesFromAll();
      },
      onRefresh: function () {
        this._applyTableFilters(true);
        this._rebuildAggregatesFromAll();
      },

      // ---------- Table binding (paged via "growing") ----------
      _ensureTableBinding: function () {
        const oTable = this.byId("idKpiReportSetTable");
        if (!oTable.getBinding("items")) {
          const tpl = oTable.getItems()[0].clone();
          oTable.bindItems({
            path: "/quality_control_kpi",
            template: tpl,
            parameters: {
              $select:
                "bukrs,year,month,ekgrp,Purchasing_Group_Description,MATNR,Vendor_Name,Accepted_Qty,Rejected_Qty",
            },
          });
        }
      },

      _applyTableFilters: function (forceRebind) {
        const oTable = this.byId("idKpiReportSetTable");
        const b = oTable.getBinding("items");
        if (!b) return;

        const vm = this.getModel("view");
        const bukrs = vm.getProperty("/bukrs");
        const monthKey = this.byId("idMonthSel")?.getSelectedKey() || "";
        const yearKey = this.byId("idYearSel")?.getSelectedKey() || "";
        const pgIndex = this.byId("idPgSel")?.getSelectedKey() || "";
        const pgReal = this._pgIndexMap?.get(pgIndex) || "";

        const aApp = [];
        if (bukrs) aApp.push(new Filter("bukrs", FilterOperator.EQ, bukrs));
        if (yearKey) aApp.push(new Filter("year", FilterOperator.EQ, yearKey));
        if (monthKey)
          aApp.push(new Filter("month", FilterOperator.EQ, monthKey));
        if (pgReal) {
          aApp.push(
            new Filter({
              filters: [
                new Filter("ekgrp", FilterOperator.EQ, pgReal),
                new Filter(
                  "Purchasing_Group_Description",
                  FilterOperator.EQ,
                  pgReal
                ),
              ],
              and: false,
            })
          );
        }

        if (forceRebind) b.refresh(true);
        b.filter(aApp, FilterType.Application);
      },

      // ---------- Full-dataset aggregation (chart + PG dropdown + KPIs) ----------
      _rebuildAggregatesFromAll: async function () {
        const view = this.getView();
        view.setBusy(true);
        try {
          const all = await this._fetchAllForCurrentFilters();
          this._buildPgIndexFromAll(all);
          this._rebuildChartFromAll(all); // computes yMax from API data
          this._updateHeaderFromAll(all);
        } finally {
          view.setBusy(false);
        }
      },

      _fetchAllForCurrentFilters: function () {
        const oModel = this.getView().getModel(); // OData V2
        const vm = this.getModel("view");
        const bukrs = vm.getProperty("/bukrs");
        const monthKey = this.byId("idMonthSel")?.getSelectedKey() || "";
        const yearKey = this.byId("idYearSel")?.getSelectedKey() || "";

        const base = [];
        if (bukrs) base.push(new Filter("bukrs", FilterOperator.EQ, bukrs));
        if (yearKey) base.push(new Filter("year", FilterOperator.EQ, yearKey));
        if (monthKey)
          base.push(new Filter("month", FilterOperator.EQ, monthKey));

        const TOP = 500;
        let skip = 0;
        const acc = [];

        return new Promise((resolve, reject) => {
          const step = () => {
            oModel.read("/quality_control_kpi", {
              filters: base,
              urlParameters: {
                $top: String(TOP),
                $skip: String(skip),
                $select:
                  "bukrs,year,month,ekgrp,Purchasing_Group_Description,Rejected_Qty,Accepted_Qty",
              },
              success: (o) => {
                const rows = o?.results || o?.d?.results || [];
                acc.push.apply(acc, rows);
                if (rows.length === TOP) {
                  skip += TOP;
                  step();
                } else {
                  resolve(acc);
                }
              },
              error: reject,
            });
          };
          step();
        });
      },

      _buildPgIndexFromAll: function (rows) {
        const seen = new Set();
        const ordered = [];
        rows.forEach((r) => {
          const code = String(r.ekgrp || "").trim();
          const desc = String(r.Purchasing_Group_Description || "").trim();
          const real = code || desc;
          if (!real || seen.has(real)) return;
          seen.add(real);
          ordered.push({
            real,
            label: code && desc ? `${code} – ${desc}` : real,
          });
        });

        const indexed = ordered.map((o, i) => ({
          key: String(i + 1),
          text: o.label,
          real: o.real,
        }));
        this._pgIndexMap = new Map(indexed.map((x) => [x.key, x.real]));

        const arr = [{ key: "", text: "All" }].concat(
          indexed.map((x) => ({ key: x.key, text: x.text }))
        );
        this.getModel("pgModel").setData(arr);

        const sel = this.byId("idPgSel");
        const k = sel?.getSelectedKey?.() || "";
        if (!arr.some((x) => x.key === k)) sel?.setSelectedKey("");
      },

      // % helper

      // % bars + avg line inputs
      _rebuildChartFromAll: function (rows) {
        // per PG: total lines and rejected lines (>0 qty)
        const agg = new Map(); // key -> {total, rej}
        rows.forEach((r) => {
          const key =
            String(r.ekgrp || r.Purchasing_Group_Description || "—").trim() ||
            "—";
          const rej = _toNum(r.Rejected_Qty) > 0 ? 1 : 0;
          const a = agg.get(key) || { total: 0, rej: 0 };
          a.total += 1;
          a.rej += rej;
          agg.set(key, a);
        });

        const bars = [...agg.entries()]
          .map(([group, a]) => ({
            group,
            pct: a.total ? (a.rej / a.total) * 100 : 0,
          }))
          .sort((a, b) => a.group.localeCompare(b.group));

        const maxPct = bars.length ? Math.max(...bars.map((b) => b.pct)) : 0;
        const avgPct = bars.length
          ? bars.reduce((s, b) => s + b.pct, 0) / bars.length
          : 0;

        const cm = this.getModel("chart");
        cm.setProperty("/bars", bars);
        cm.setProperty(
          "/yMax",
          Math.max(5, Math.ceil((maxPct || avgPct) * 1.1))
        ); // headroom
        cm.setProperty("/avgPct", avgPct);

        // KPI: % of lines rejected on total lines for the period
        const totalLines = rows.length;
        const rejectedLines = rows.filter(
          (r) => _toNum(r.Rejected_Qty) > 0
        ).length;
        cm.setProperty("/kpi", {
          avg: totalLines ? rejectedLines / totalLines : 0,
          totalLines,
          rejectedLines,
        });

        this._applyVizProps();
      },

      _applyVizProps: function () {
        const vf = this.byId("idViz");
        if (!vf) return;
        const cm = this.getModel("chart");
        const yMax = cm.getProperty("/yMax") || 5;
        const avg = cm.getProperty("/avgPct") || 0;

        vf.setVizProperties({
          title: { visible: true, text: "Target (%) by Purchasing Group" },
          valueAxis: {
            title: { visible: true, text: "Target (%)" },
            scale: { fixedRange: true, maxValue: yMax, minValue: 0 },
          },
          plotArea: {
            dataLabel: { visible: true, formatString: "0.##" },
            referenceLine: {
              line: {
                valueAxis: [
                  {
                    value: avg, // numeric percent
                    visible: true,
                    label: { text: "Target (%)" },
                    color: "red",
                    lineStyle: { width: 2 },
                  },
                ],
              },
            },
          },
          legend: { visible: true },
        });
      },

      // KPI: % of lines rejected on total lines for the period.
      // A line is "rejected" when Rejected_Qty is a numeric value > 0.
      _updateHeaderFromAll: function (rows) {
        const toNum = (v) => {
          if (v == null) return 0;
          const n = parseFloat(String(v).replace(",", "."));
          return isNaN(n) ? 0 : n;
        };

        const totalLines = rows.length;
        const rejectedLines = rows.filter(
          (r) => toNum(r.Rejected_Qty) > 0
        ).length;
        const avg = totalLines ? rejectedLines / totalLines : 0; // fraction 0..1

        this.getModel("chart").setProperty("/kpi", {
          avg, // your ObjectNumber already multiplies by 100
          totalLines,
          rejectedLines,
        });
      },

      // ---------- helpers ----------
      getModel: function (name) {
        return this.getView().getModel(name);
      },
    });
  }
);
